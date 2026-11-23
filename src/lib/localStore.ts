import { derange, validateNames } from './assignment';
import { randomId } from './ids';
import { safeStorage, type StorageLike } from './storage';
import type {
  CreateRoundInput,
  CreatedRound,
  DrawResult,
  ResetResult,
  RoundState,
  WichtelStore,
} from './types';

const STORE_KEY = 'wichtel:local:v1';

type StoredParticipant = {
  name: string;
  assignment: string;
  revealedAt: string | null;
  deviceSecret: string | null;
};

type StoredRound = {
  id: string;
  title: string;
  budget: string | null;
  eventDate: string | null;
  hostToken: string;
  createdAt: string;
  participants: StoredParticipant[];
};

type Database = { rounds: Record<string, StoredRound> };

const lower = (value: string) => value.toLocaleLowerCase('de');

function emptyDb(): Database {
  return { rounds: {} };
}

function toState(round: StoredRound): RoundState {
  // „Vergeben" heißt: dieser Name wurde schon gezogen. Bewusst nur als Flag –
  // wer ihn gezogen hat, bleibt im Zustand verborgen.
  const taken = new Set(
    round.participants
      .filter((p) => p.revealedAt !== null)
      .map((p) => lower(p.assignment)),
  );

  return {
    id: round.id,
    title: round.title,
    budget: round.budget,
    eventDate: round.eventDate,
    participants: round.participants.map((p) => ({
      name: p.name,
      revealed: p.revealedAt !== null,
      taken: taken.has(lower(p.name)),
    })),
  };
}

/**
 * Development / demo adapter. Everything lives in localStorage, so a round
 * survives a reload and can be opened from a second tab.
 */
export class LocalStore implements WichtelStore {
  private readonly storage: StorageLike;

  constructor(storage: StorageLike = safeStorage()) {
    this.storage = storage;
  }

  private read(): Database {
    const raw = this.storage.getItem(STORE_KEY);
    if (!raw) return emptyDb();
    try {
      const parsed = JSON.parse(raw) as Partial<Database>;
      if (parsed && typeof parsed.rounds === 'object' && parsed.rounds !== null) {
        return { rounds: parsed.rounds };
      }
    } catch {
      // unlesbarer Stand: mit leerer Datenbank weitermachen
    }
    return emptyDb();
  }

  private write(db: Database): void {
    this.storage.setItem(STORE_KEY, JSON.stringify(db));
  }

  async createRound(input: CreateRoundInput): Promise<CreatedRound> {
    const problem = validateNames(input.names);
    if (problem) throw new Error(problem);

    const assignments = derange(input.names);
    const db = this.read();

    let roundId = randomId();
    while (db.rounds[roundId]) roundId = randomId();

    const round: StoredRound = {
      id: roundId,
      title: input.title.trim() || 'Wichteln',
      budget: input.budget,
      eventDate: input.eventDate,
      hostToken: randomId(),
      createdAt: new Date().toISOString(),
      participants: input.names.map((name, i) => ({
        name,
        assignment: assignments[i],
        revealedAt: null,
        deviceSecret: null,
      })),
    };

    db.rounds[round.id] = round;
    this.write(db);
    return { roundId: round.id, hostToken: round.hostToken };
  }

  async roundState(roundId: string): Promise<RoundState | null> {
    const round = this.read().rounds[roundId];
    return round ? toState(round) : null;
  }

  async hostRoundState(hostToken: string): Promise<RoundState | null> {
    const round = Object.values(this.read().rounds).find(
      (candidate) => candidate.hostToken === hostToken,
    );
    return round ? toState(round) : null;
  }

  async draw(
    roundId: string,
    name: string,
    deviceSecret: string,
  ): Promise<DrawResult> {
    const db = this.read();
    const round = db.rounds[roundId];
    if (!round) return { status: 'unknown' };

    const participant = round.participants.find(
      (candidate) => lower(candidate.name) === lower(name),
    );
    if (!participant) return { status: 'unknown' };

    if (participant.revealedAt === null) {
      participant.revealedAt = new Date().toISOString();
      participant.deviceSecret = deviceSecret;
      this.write(db);
      return { status: 'ok', assignment: participant.assignment };
    }

    if (participant.deviceSecret && participant.deviceSecret === deviceSecret) {
      return { status: 'ok', assignment: participant.assignment };
    }

    return { status: 'already' };
  }

  async reset(hostToken: string, name: string): Promise<ResetResult> {
    const db = this.read();
    const round = Object.values(db.rounds).find(
      (candidate) => candidate.hostToken === hostToken,
    );
    if (!round) return { ok: false };

    const participant = round.participants.find(
      (candidate) => lower(candidate.name) === lower(name),
    );
    if (!participant) return { ok: false };

    participant.revealedAt = null;
    participant.deviceSecret = null;
    this.write(db);
    return { ok: true };
  }

  /** Test helper: wipe every round this adapter knows about. */
  clear(): void {
    this.storage.removeItem(STORE_KEY);
  }
}
