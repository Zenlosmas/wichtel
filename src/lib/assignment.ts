export type Rng = () => number;

export function shuffle<T>(items: readonly T[], rng: Rng = Math.random): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

/** True when no position kept its original value. */
export function isDerangement(
  original: readonly string[],
  candidate: readonly string[],
): boolean {
  if (original.length !== candidate.length) return false;
  for (let i = 0; i < original.length; i += 1) {
    if (original[i] === candidate[i]) return false;
  }
  return true;
}

/**
 * Returns a permutation of `items` in which nobody draws themselves:
 * `result[i]` is what `items[i]` draws.
 *
 * Rejection sampling over Fisher-Yates keeps the distribution flat across all
 * derangements. The cyclic shift at the end is a deterministic safety net that
 * only triggers if 500 shuffles in a row had a fixed point (p ~ 1e-215 for
 * n >= 3), so it never actually runs.
 */
export function derange<T>(items: readonly T[], rng: Rng = Math.random): T[] {
  const n = items.length;
  if (n < 2) {
    throw new Error('Ein Derangement braucht mindestens zwei Einträge.');
  }

  const values = items as readonly string[];
  for (let attempt = 0; attempt < 500; attempt += 1) {
    const candidate = shuffle(items, rng);
    if (isDerangement(values, candidate as readonly string[])) return candidate;
  }

  return items.map((_, i) => items[(i + 1) % n]);
}

const NAME_SPLIT = /[\n,;]+/;

/** One name per line, commas and semicolons tolerated. Empty entries dropped. */
export function parseNames(raw: string): string[] {
  return raw
    .split(NAME_SPLIT)
    .map((entry) => entry.replace(/\s+/g, ' ').trim())
    .filter((entry) => entry.length > 0);
}

export const MIN_NAMES = 3;

/** Returns a human readable problem, or null when the list is usable. */
export function validateNames(names: readonly string[]): string | null {
  if (names.length < MIN_NAMES) {
    return `Mindestens ${MIN_NAMES} Namen nötig – aktuell ${names.length}.`;
  }

  const seen = new Map<string, string>();
  for (const name of names) {
    const key = name.toLocaleLowerCase('de');
    const first = seen.get(key);
    if (first !== undefined) {
      return first === name
        ? `„${name}" steht doppelt in der Liste.`
        : `„${first}" und „${name}" sind derselbe Name. Bitte unterscheidbar machen.`;
    }
    seen.set(key, name);
  }

  return null;
}
