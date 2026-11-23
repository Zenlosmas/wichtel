export type Participant = {
  name: string;
  /** Diese Person hat ihren Namen schon gezogen. */
  revealed: boolean;
  /** Dieser Name ist schon vergeben – jemand hat ihn als Geschenk gezogen. */
  taken: boolean;
};

export type RoundState = {
  id: string;
  title: string;
  budget: string | null;
  eventDate: string | null;
  participants: Participant[];
};

export type CreateRoundInput = {
  title: string;
  budget: string | null;
  eventDate: string | null;
  names: string[];
};

export type CreatedRound = {
  roundId: string;
  hostToken: string;
};

/**
 * `ok` only ever reaches the device that drew the name: the assignment travels
 * exclusively over the draw call, never over the state call.
 */
export type DrawResult =
  | { status: 'ok'; assignment: string }
  | { status: 'already' }
  | { status: 'unknown' };

export type ResetResult = { ok: boolean };

export interface WichtelStore {
  createRound(input: CreateRoundInput): Promise<CreatedRound>;
  roundState(roundId: string): Promise<RoundState | null>;
  /** Host view is keyed by host token, so it needs its own entry point. */
  hostRoundState(hostToken: string): Promise<RoundState | null>;
  draw(roundId: string, name: string, deviceSecret: string): Promise<DrawResult>;
  reset(hostToken: string, name: string): Promise<ResetResult>;
}
