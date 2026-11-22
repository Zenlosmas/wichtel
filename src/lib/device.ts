import { randomHex } from './ids';
import { safeStorage, type StorageLike } from './storage';

const DEVICE_KEY = 'wichtel:device';
const REVEAL_PREFIX = 'wichtel:reveal:';

export type RevealRecord = {
  name: string;
  assignment: string;
  at: string;
};

/**
 * One secret per browser. It is written to the participant row on the first
 * draw and is the only thing that lets this device show the result again.
 */
export function getDeviceSecret(storage: StorageLike = safeStorage()): string {
  const existing = storage.getItem(DEVICE_KEY);
  if (existing && /^[0-9a-f]{32}$/.test(existing)) return existing;
  const created = randomHex(32);
  storage.setItem(DEVICE_KEY, created);
  return created;
}

export function readReveal(
  roundId: string,
  storage: StorageLike = safeStorage(),
): RevealRecord | null {
  const raw = storage.getItem(REVEAL_PREFIX + roundId);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<RevealRecord>;
    if (typeof parsed.name === 'string' && typeof parsed.assignment === 'string') {
      return {
        name: parsed.name,
        assignment: parsed.assignment,
        at: typeof parsed.at === 'string' ? parsed.at : '',
      };
    }
  } catch {
    // kaputter Eintrag: ignorieren und beim nächsten Zug überschreiben
  }
  return null;
}

export function writeReveal(
  roundId: string,
  record: RevealRecord,
  storage: StorageLike = safeStorage(),
): void {
  storage.setItem(REVEAL_PREFIX + roundId, JSON.stringify(record));
}

export function clearReveal(
  roundId: string,
  storage: StorageLike = safeStorage(),
): void {
  storage.removeItem(REVEAL_PREFIX + roundId);
}
