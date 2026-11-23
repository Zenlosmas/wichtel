import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  CreateRoundInput,
  CreatedRound,
  DrawResult,
  ResetResult,
  RoundState,
  WichtelStore,
} from './types';

type JsonObject = Record<string, unknown>;

function asObject(data: unknown): JsonObject | null {
  return data && typeof data === 'object' && !Array.isArray(data)
    ? (data as JsonObject)
    : null;
}

function asState(data: unknown): RoundState | null {
  const obj = asObject(data);
  if (!obj || typeof obj.id !== 'string') return null;

  const participants = Array.isArray(obj.participants) ? obj.participants : [];
  return {
    id: obj.id,
    title: typeof obj.title === 'string' ? obj.title : 'Wichteln',
    budget: typeof obj.budget === 'string' ? obj.budget : null,
    eventDate: typeof obj.eventDate === 'string' ? obj.eventDate : null,
    participants: participants.flatMap((entry) => {
      const p = asObject(entry);
      if (!p || typeof p.name !== 'string') return [];
      return [{ name: p.name, revealed: p.revealed === true, taken: p.taken === true }];
    }),
  };
}

function fail(context: string, error: { message: string } | null): never {
  throw new Error(`${context}: ${error?.message ?? 'unbekannter Fehler'}`);
}

/**
 * Talks to Postgres exclusively through `security definer` functions. The
 * tables themselves are RLS deny-all for `anon`, so no select ever leaves the
 * browser.
 */
export class SupabaseStore implements WichtelStore {
  private readonly client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  async createRound(input: CreateRoundInput): Promise<CreatedRound> {
    const { data, error } = await this.client.rpc('wichtel_create', {
      p_title: input.title,
      p_budget: input.budget,
      p_event_date: input.eventDate,
      p_names: input.names,
    });
    if (error) fail('Runde anlegen', error);

    const result = asObject(data);
    if (!result || result.status !== 'ok') {
      throw new Error(
        typeof result?.message === 'string'
          ? result.message
          : 'Runde konnte nicht angelegt werden.',
      );
    }
    if (typeof result.roundId !== 'string' || typeof result.hostToken !== 'string') {
      throw new Error('Antwort ohne Runden-ID oder Host-Token.');
    }
    return { roundId: result.roundId, hostToken: result.hostToken };
  }

  async roundState(roundId: string): Promise<RoundState | null> {
    const { data, error } = await this.client.rpc('wichtel_state', {
      p_round_id: roundId,
    });
    if (error) fail('Runde laden', error);
    return asState(data);
  }

  async hostRoundState(hostToken: string): Promise<RoundState | null> {
    const { data, error } = await this.client.rpc('wichtel_host_state', {
      p_host_token: hostToken,
    });
    if (error) fail('Runde laden', error);
    return asState(data);
  }

  async draw(
    roundId: string,
    name: string,
    deviceSecret: string,
  ): Promise<DrawResult> {
    const { data, error } = await this.client.rpc('wichtel_draw', {
      p_round_id: roundId,
      p_name: name,
      p_device_secret: deviceSecret,
    });
    if (error) fail('Ziehen', error);

    const result = asObject(data);
    if (result?.status === 'ok' && typeof result.assignment === 'string') {
      return { status: 'ok', assignment: result.assignment };
    }
    if (result?.status === 'already') return { status: 'already' };
    return { status: 'unknown' };
  }

  async reset(hostToken: string, name: string): Promise<ResetResult> {
    const { data, error } = await this.client.rpc('wichtel_reset', {
      p_host_token: hostToken,
      p_name: name,
    });
    if (error) fail('Zug zurücksetzen', error);

    const result = asObject(data);
    return { ok: result?.ok === true };
  }
}
