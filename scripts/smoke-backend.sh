#!/usr/bin/env bash
# Prüft das echte Backend gegen die laufende Supabase-Instanz.
# Aufruf:  ./scripts/smoke-backend.sh
# Liest VITE_SUPABASE_URL und VITE_SUPABASE_ANON_KEY aus .env.local.
set -uo pipefail

cd "$(dirname "$0")/.." || exit 1
[ -f .env.local ] || { echo "FEHLT: .env.local"; exit 1; }
set -a; . ./.env.local; set +a

URL="${VITE_SUPABASE_URL:?VITE_SUPABASE_URL fehlt}"
KEY="${VITE_SUPABASE_ANON_KEY:?VITE_SUPABASE_ANON_KEY fehlt}"
API="$URL/rest/v1"

fail=0
ok()   { echo "  PASS  $1"; }
bad()  { echo "  FAIL  $1"; fail=1; }

rpc() { # rpc <name> <json>
  curl -sS -X POST "$API/rpc/$1" \
    -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
    -H 'Content-Type: application/json' -d "$2"
}

jget() { python3 -c "import sys,json;d=json.load(sys.stdin);print(d$1)" 2>/dev/null; }

echo "Backend: $URL"

echo "1) Tabelle direkt lesen (muss scheitern)"
direct=$(curl -sS "$API/wichtel_participants?select=*" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY")
if echo "$direct" | grep -qiE 'permission denied|not allowed|42P01|401'; then
  ok "Direktzugriff verweigert"
else
  bad "Direktzugriff liefert Daten: $direct"
fi

echo "2) Runde anlegen"
created=$(rpc wichtel_create '{"p_title":"Smoke-Test","p_budget":"10 €","p_event_date":"2026-12-24","p_names":["Anna","Papa","Mama","Jonas"]}')
rid=$(echo "$created" | jget "['roundId']")
host=$(echo "$created" | jget "['hostToken']")
[ -n "$rid" ] && [ -n "$host" ] && ok "roundId=$rid" || { bad "Anlegen fehlgeschlagen: $created"; exit 1; }

echo "3) Zustand vor dem Ziehen"
state=$(rpc wichtel_state "{\"p_round_id\":\"$rid\"}")
open=$(echo "$state" | python3 -c "import sys,json;d=json.load(sys.stdin);print(sum(1 for p in d['participants'] if not p['revealed'] and not p['taken']))")
[ "$open" = "4" ] && ok "4 Namen offen und frei" || bad "erwartet 4, war $open"

echo "4) Ziehen (Anna, Gerät A)"
draw=$(rpc wichtel_draw "{\"p_round_id\":\"$rid\",\"p_name\":\"Anna\",\"p_device_secret\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\"}")
status=$(echo "$draw" | jget "['status']")
assign=$(echo "$draw" | jget "['assignment']")
[ "$status" = "ok" ] && [ -n "$assign" ] && ok "Zuteilung: $assign" || bad "Ziehen: $draw"

if [ "$assign" = "Anna" ]; then bad "Fixpunkt! Anna hat sich selbst gezogen"; fi

echo "5) Zustand nach dem Ziehen"
state2=$(rpc wichtel_state "{\"p_round_id\":\"$rid\"}")
taken=$(echo "$state2" | python3 -c "import sys,json;d=json.load(sys.stdin);print(sum(1 for p in d['participants'] if p['taken']))")
echo "$state2" | grep -q '"taken"' && ok "taken-Feld vorhanden" || bad "taken fehlt in der Antwort"
[ "$taken" = "1" ] && ok "genau ein Name ist vergeben" || bad "erwartet 1 vergeben, war $taken"
echo "$state2" | grep -qi 'assignment' && bad "Zustand verrät die Zuteilung" || ok "Zustand verrät die Zuteilung nicht"

echo "6) Zweites Ziehen mit fremdem Gerät (muss 'already' sein)"
again=$(rpc wichtel_draw "{\"p_round_id\":\"$rid\",\"p_name\":\"Anna\",\"p_device_secret\":\"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\"}")
st2=$(echo "$again" | jget "['status']")
[ "$st2" = "already" ] && ok "fremdes Gerät bekommt nichts" || bad "erwartet already, war: $again"

echo "7) Zweites Ziehen mit gleichem Gerät (muss dieselbe Zuteilung sein)"
same=$(rpc wichtel_draw "{\"p_round_id\":\"$rid\",\"p_name\":\"Anna\",\"p_device_secret\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\"}")
st3=$(echo "$same" | jget "['assignment']")
[ "$st3" = "$assign" ] && ok "gleiches Gerät sieht wieder $assign" || bad "erwartet $assign, war $st3"

echo "8) Zurücksetzen über das Host-Token"
reset=$(rpc wichtel_reset "{\"p_host_token\":\"$host\",\"p_name\":\"Anna\"}")
[ "$(echo "$reset" | jget "['ok']")" = "True" ] && ok "Zug zurückgesetzt" || bad "Reset: $reset"

state3=$(rpc wichtel_state "{\"p_round_id\":\"$rid\"}")
taken3=$(echo "$state3" | python3 -c "import sys,json;d=json.load(sys.stdin);print(sum(1 for p in d['participants'] if p['taken']))")
[ "$taken3" = "0" ] && ok "Name wieder im Topf" || bad "erwartet 0 vergeben, war $taken3"

echo
if [ "$fail" = "0" ]; then
  echo "ERGEBNIS: alles grün"
else
  echo "ERGEBNIS: Fehler oben"
fi
echo "Testrunde: $rid"
exit "$fail"
