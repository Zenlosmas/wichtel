-- Wichteln – Runden, Zuteilungen, drei Zugänge.
--
-- Grundsatz: Der Browser liest keine Tabelle. RLS ist auf beiden Tabellen
-- aktiv und es gibt keine Policy für anon, dazu sind die Tabellenrechte
-- entzogen. Alles läuft über security-definer-Funktionen, die nur anon
-- ausführen darf. Die Zuteilung wird beim Anlegen berechnet, nie beim Ziehen –
-- sonst hätte der Letzte nur sich selbst übrig.

create table if not exists public.wichtel_rounds (
  id          text primary key,
  title       text not null,
  budget      text,
  event_date  date,
  host_token  text not null unique,
  created_at  timestamptz not null default now()
);

create table if not exists public.wichtel_participants (
  id               uuid primary key default gen_random_uuid(),
  round_id         text not null references public.wichtel_rounds (id) on delete cascade,
  name             text not null,
  position         int  not null,
  token            text,
  assignment_name  text not null,
  revealed_at      timestamptz,
  device_secret    text
);

create index if not exists wichtel_participants_round_idx
  on public.wichtel_participants (round_id);

create unique index if not exists wichtel_participants_round_name_idx
  on public.wichtel_participants (round_id, lower(name));

alter table public.wichtel_rounds       enable row level security;
alter table public.wichtel_participants enable row level security;

-- Keine Policies anlegen. Zusätzlich die Tabellenrechte entziehen, damit auch
-- ein vergessener Grant nichts lesbar macht.
revoke all on public.wichtel_rounds       from anon, authenticated;
revoke all on public.wichtel_participants from anon, authenticated;

-- 16 URL-sichere Zeichen aus zwei UUIDs (32 zufällige Bytes). 256 ist ein
-- Vielfaches von 64, deshalb ist das Modulo unverzerrt.
create or replace function public.wichtel_new_id(p_len int default 16)
returns text
language sql
volatile
set search_path = public
as $$
  with bytes as (
    select uuid_send(gen_random_uuid()) || uuid_send(gen_random_uuid()) as b
  )
  select string_agg(
           substr(
             'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_',
             (get_byte(b, i) % 64) + 1,
             1
           ),
           '' order by i
         )
    from bytes, generate_series(0, least(p_len, 32) - 1) as i;
$$;

-- Runde anlegen: prüft Namen, zieht die komplette Permutation, speichert alles.
create or replace function public.wichtel_create(
  p_title      text,
  p_budget     text,
  p_event_date date,
  p_names      text[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_names    text[];
  v_assign   text[];
  v_n        int;
  v_i        int;
  v_j        int;
  v_tmp      text;
  v_attempt  int := 0;
  v_ok       boolean;
  v_round_id text;
  v_host     text;
  v_title    text;
begin
  select array_agg(btrim(n)) into v_names
    from unnest(coalesce(p_names, '{}'::text[])) as n
   where btrim(n) <> '';

  v_n := coalesce(array_length(v_names, 1), 0);

  if v_n < 3 then
    return jsonb_build_object('status', 'error', 'message', 'Mindestens 3 Namen nötig.');
  end if;

  if v_n > 200 then
    return jsonb_build_object('status', 'error', 'message', 'Höchstens 200 Namen.');
  end if;

  if exists (
    select 1 from unnest(v_names) as n group by lower(n) having count(*) > 1
  ) then
    return jsonb_build_object(
      'status', 'error',
      'message', 'Namen dürfen sich nicht wiederholen.'
    );
  end if;

  -- Fisher-Yates, wiederholt bis kein Fixpunkt mehr übrig ist.
  v_assign := v_names;
  loop
    for v_i in reverse v_n .. 2 loop
      v_j := 1 + floor(random() * v_i)::int;
      v_tmp := v_assign[v_i];
      v_assign[v_i] := v_assign[v_j];
      v_assign[v_j] := v_tmp;
    end loop;

    v_ok := true;
    for v_i in 1 .. v_n loop
      if v_assign[v_i] = v_names[v_i] then
        v_ok := false;
        exit;
      end if;
    end loop;

    exit when v_ok;

    v_attempt := v_attempt + 1;
    if v_attempt >= 200 then
      -- Sicherheitsnetz: die zyklische Verschiebung ist immer ein Derangement.
      for v_i in 1 .. v_n loop
        v_assign[v_i] := v_names[(v_i % v_n) + 1];
      end loop;
      exit;
    end if;
  end loop;

  v_round_id := public.wichtel_new_id(16);
  while exists (select 1 from public.wichtel_rounds r where r.id = v_round_id) loop
    v_round_id := public.wichtel_new_id(16);
  end loop;

  v_host  := public.wichtel_new_id(16);
  v_title := nullif(btrim(coalesce(p_title, '')), '');
  if v_title is null then
    v_title := 'Wichteln';
  end if;

  insert into public.wichtel_rounds (id, title, budget, event_date, host_token)
  values (
    v_round_id,
    v_title,
    nullif(btrim(coalesce(p_budget, '')), ''),
    p_event_date,
    v_host
  );

  insert into public.wichtel_participants (round_id, name, position, assignment_name)
  select v_round_id, v_names[i], i, v_assign[i]
    from generate_series(1, v_n) as i;

  return jsonb_build_object('status', 'ok', 'roundId', v_round_id, 'hostToken', v_host);
end;
$$;

-- Zustand für Gäste: Namen und ob gezogen wurde. Nie die Zuteilung.
create or replace function public.wichtel_state(p_round_id text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
           'id', r.id,
           'title', r.title,
           'budget', r.budget,
           'eventDate', to_char(r.event_date, 'YYYY-MM-DD'),
           'participants', coalesce(
             (
               select jsonb_agg(
                        jsonb_build_object(
                          'name', p.name,
                          'revealed', p.revealed_at is not null
                        )
                        order by p.position
                      )
                 from public.wichtel_participants p
                where p.round_id = r.id
             ),
             '[]'::jsonb
           )
         )
    from public.wichtel_rounds r
   where r.id = p_round_id;
$$;

-- Zustand für den Host: gleiche Form, aber über das Host-Token aufgelöst.
create or replace function public.wichtel_host_state(p_host_token text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
           'id', r.id,
           'title', r.title,
           'budget', r.budget,
           'eventDate', to_char(r.event_date, 'YYYY-MM-DD'),
           'participants', coalesce(
             (
               select jsonb_agg(
                        jsonb_build_object(
                          'name', p.name,
                          'revealed', p.revealed_at is not null
                        )
                        order by p.position
                      )
                 from public.wichtel_participants p
                where p.round_id = r.id
             ),
             '[]'::jsonb
           )
         )
    from public.wichtel_rounds r
   where r.host_token = p_host_token;
$$;

-- Ziehen. Atomar über ein einziges UPDATE, damit zwei gleichzeitige Klicks auf
-- denselben Namen nicht beide gewinnen.
create or replace function public.wichtel_draw(
  p_round_id      text,
  p_name          text,
  p_device_secret text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.wichtel_participants;
begin
  if p_device_secret is null or length(p_device_secret) < 16 then
    return jsonb_build_object('status', 'unknown');
  end if;

  update public.wichtel_participants p
     set revealed_at = now(),
         device_secret = p_device_secret
   where p.round_id = p_round_id
     and lower(p.name) = lower(btrim(p_name))
     and p.revealed_at is null
  returning * into v_row;

  if v_row.id is not null then
    return jsonb_build_object('status', 'ok', 'assignment', v_row.assignment_name);
  end if;

  select * into v_row
    from public.wichtel_participants p
   where p.round_id = p_round_id
     and lower(p.name) = lower(btrim(p_name));

  if v_row.id is null then
    return jsonb_build_object('status', 'unknown');
  end if;

  if v_row.device_secret is not null and v_row.device_secret = p_device_secret then
    return jsonb_build_object('status', 'ok', 'assignment', v_row.assignment_name);
  end if;

  return jsonb_build_object('status', 'already');
end;
$$;

-- Zug zurücksetzen (Handywechsel, Fehlklick). Die Zuteilung bleibt gleich.
create or replace function public.wichtel_reset(
  p_host_token text,
  p_name       text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_round_id text;
  v_rows     int;
begin
  select r.id into v_round_id
    from public.wichtel_rounds r
   where r.host_token = p_host_token;

  if v_round_id is null then
    return jsonb_build_object('ok', false);
  end if;

  update public.wichtel_participants p
     set revealed_at = null,
         device_secret = null
   where p.round_id = v_round_id
     and lower(p.name) = lower(btrim(p_name));

  get diagnostics v_rows = row_count;
  return jsonb_build_object('ok', v_rows > 0);
end;
$$;

-- Execute-Rechte: nur anon, und nur auf die fünf Zugänge.
revoke all on function public.wichtel_new_id(int)                        from public, anon, authenticated;
revoke all on function public.wichtel_create(text, text, date, text[])    from public, anon, authenticated;
revoke all on function public.wichtel_state(text)                         from public, anon, authenticated;
revoke all on function public.wichtel_host_state(text)                    from public, anon, authenticated;
revoke all on function public.wichtel_draw(text, text, text)              from public, anon, authenticated;
revoke all on function public.wichtel_reset(text, text)                   from public, anon, authenticated;

grant execute on function public.wichtel_create(text, text, date, text[]) to anon;
grant execute on function public.wichtel_state(text)                      to anon;
grant execute on function public.wichtel_host_state(text)                 to anon;
grant execute on function public.wichtel_draw(text, text, text)           to anon;
grant execute on function public.wichtel_reset(text, text)                to anon;

notify pgrst, 'reload schema';
