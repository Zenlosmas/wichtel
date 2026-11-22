import { describe, expect, it } from 'vitest';
import { derange, isDerangement, parseNames, validateNames } from './assignment';
import { randomHex, randomId } from './ids';

const namesFor = (n: number) => Array.from({ length: n }, (_, i) => `Person ${i + 1}`);

describe('derange', () => {
  it('liefert für n = 3..12 immer eine vollständige Permutation ohne Fixpunkt', () => {
    for (let n = 3; n <= 12; n += 1) {
      const names = namesFor(n);
      const sorted = [...names].sort();

      for (let round = 0; round < 1000; round += 1) {
        const assigned = derange(names);

        expect(assigned).toHaveLength(n);
        expect([...assigned].sort()).toEqual(sorted);
        expect(new Set(assigned).size).toBe(n);
        expect(isDerangement(names, assigned)).toBe(true);

        for (let i = 0; i < n; i += 1) {
          expect(assigned[i]).not.toBe(names[i]);
        }
      }
    }
  });

  it('verteilt über viele Runden unterschiedlich', () => {
    const names = namesFor(4);
    const seen = new Set<string>();
    for (let round = 0; round < 200; round += 1) {
      seen.add(derange(names).join('|'));
    }
    expect(seen.size).toBeGreaterThan(5);
  });

  it('lehnt weniger als zwei Einträge ab', () => {
    expect(() => derange(['Anna'])).toThrow();
    expect(() => derange([])).toThrow();
  });

  it('erkennt Fixpunkte korrekt', () => {
    expect(isDerangement(['a', 'b'], ['b', 'a'])).toBe(true);
    expect(isDerangement(['a', 'b'], ['a', 'b'])).toBe(false);
    expect(isDerangement(['a', 'b', 'c'], ['b', 'a', 'c'])).toBe(false);
  });
});

describe('parseNames', () => {
  it('trennt an Zeilen, Kommas und Semikolons', () => {
    expect(parseNames('Anna\nPapa, Mama;Jonas')).toEqual(['Anna', 'Papa', 'Mama', 'Jonas']);
  });

  it('entfernt Leerraum und leere Einträge', () => {
    expect(parseNames('  Anna  \n\n   \n Papa ')).toEqual(['Anna', 'Papa']);
  });

  it('normalisiert Mehrfach-Leerzeichen innerhalb eines Namens', () => {
    expect(parseNames('Tante   Inge')).toEqual(['Tante Inge']);
  });
});

describe('validateNames', () => {
  it('verlangt mindestens drei Namen', () => {
    expect(validateNames([])).toContain('Mindestens 3');
    expect(validateNames(['Anna', 'Papa'])).toContain('Mindestens 3');
    expect(validateNames(['Anna', 'Papa', 'Mama'])).toBeNull();
  });

  it('blockt doppelte Namen unabhängig von Groß-/Kleinschreibung', () => {
    expect(validateNames(['Anna', 'Anna', 'Papa'])).toContain('doppelt');
    expect(validateNames(['Anna', 'anna', 'Papa'])).toMatch(/derselbe Name/);
    expect(validateNames(['Anna', 'ANNA', 'Papa'])).toMatch(/derselbe Name/);
    expect(validateNames(['Anna', 'Anke', 'Papa'])).toBeNull();
  });
});

describe('ids', () => {
  it('erzeugt 16 URL-sichere Zeichen', () => {
    for (let i = 0; i < 200; i += 1) {
      const id = randomId();
      expect(id).toHaveLength(16);
      expect(id).toMatch(/^[A-Za-z0-9_-]{16}$/);
    }
  });

  it('erzeugt 32 Hex-Zeichen', () => {
    expect(randomHex(32)).toMatch(/^[0-9a-f]{32}$/);
  });

  it('kollidiert praktisch nicht', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 5000; i += 1) seen.add(randomId());
    expect(seen.size).toBe(5000);
  });
});
