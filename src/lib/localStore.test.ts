import { describe, expect, it } from 'vitest';
import { LocalStore } from './localStore';
import type { StorageLike } from './storage';

class MemoryStorage implements StorageLike {
  private readonly map = new Map<string, string>();

  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }
}

const SECRET_A = 'a'.repeat(32);
const SECRET_B = 'b'.repeat(32);

async function makeRound(names = ['Anna', 'Papa', 'Mama']) {
  const store = new LocalStore(new MemoryStorage());
  const created = await store.createRound({
    title: 'Testwichteln',
    budget: '10 €',
    eventDate: '2026-12-24',
    names,
  });
  return { store, ...created };
}

describe('LocalStore.createRound', () => {
  it('legt eine Runde mit Host-Token und offenen Namen an', async () => {
    const { store, roundId, hostToken } = await makeRound();

    expect(roundId).toMatch(/^[A-Za-z0-9_-]{16}$/);
    expect(hostToken).toMatch(/^[A-Za-z0-9_-]{16}$/);

    const state = await store.roundState(roundId);
    expect(state).not.toBeNull();
    expect(state?.title).toBe('Testwichteln');
    expect(state?.budget).toBe('10 €');
    expect(state?.eventDate).toBe('2026-12-24');
    expect(state?.participants).toHaveLength(3);
    expect(state?.participants.every((p) => !p.revealed)).toBe(true);
  });

  it('gibt die Zuteilung nicht über den Zustand preis', async () => {
    const { store, roundId } = await makeRound();
    const state = await store.roundState(roundId);
    const raw = JSON.stringify(state);
    expect(raw).not.toContain('assignment');
  });

  it('lehnt zu kurze Listen ab', async () => {
    const store = new LocalStore(new MemoryStorage());
    await expect(
      store.createRound({
        title: 'X',
        budget: null,
        eventDate: null,
        names: ['Anna', 'Papa'],
      }),
    ).rejects.toThrow(/Mindestens 3/);
  });

  it('lehnt doppelte Namen ab', async () => {
    const store = new LocalStore(new MemoryStorage());
    await expect(
      store.createRound({
        title: 'X',
        budget: null,
        eventDate: null,
        names: ['Anna', 'anna', 'Papa'],
      }),
    ).rejects.toThrow(/derselbe Name/);
  });

  it('teilt jeden genau einmal zu, niemand sich selbst', async () => {
    const names = ['Anna', 'Papa', 'Mama', 'Jonas', 'Oma'];
    const { store, roundId } = await makeRound(names);

    const received: string[] = [];
    for (const name of names) {
      const result = await store.draw(roundId, name, SECRET_A);
      if (result.status !== 'ok') throw new Error(`Zug für ${name} fehlgeschlagen`);
      expect(result.assignment).not.toBe(name);
      received.push(result.assignment);
    }

    expect([...received].sort()).toEqual([...names].sort());
    expect(new Set(received).size).toBe(names.length);
  });
});

describe('LocalStore.draw', () => {
  it('erster Zug gibt die Zuteilung zurück', async () => {
    const { store, roundId } = await makeRound();
    const result = await store.draw(roundId, 'Anna', SECRET_A);

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(['Papa', 'Mama']).toContain(result.assignment);
  });

  it('zweiter Zug mit gleichem Secret gibt dieselbe Zuteilung', async () => {
    const { store, roundId } = await makeRound();
    const first = await store.draw(roundId, 'Anna', SECRET_A);
    const second = await store.draw(roundId, 'Anna', SECRET_A);

    expect(second).toEqual(first);
  });

  it('zweiter Zug mit fremdem Secret liefert nur „already"', async () => {
    const { store, roundId } = await makeRound();
    await store.draw(roundId, 'Anna', SECRET_A);
    const foreign = await store.draw(roundId, 'Anna', SECRET_B);

    expect(foreign).toEqual({ status: 'already' });
    expect(JSON.stringify(foreign)).not.toContain('assignment');
  });

  it('unbekannte Namen und Runden liefern „unknown"', async () => {
    const { store, roundId } = await makeRound();
    expect(await store.draw(roundId, 'Fremder', SECRET_A)).toEqual({ status: 'unknown' });
    expect(await store.draw('gibtesnicht', 'Anna', SECRET_A)).toEqual({ status: 'unknown' });
  });

  it('senkt die Zahl der offenen Namen nach dem Ziehen um genau eins', async () => {
    const { store, roundId } = await makeRound(['Anna', 'Papa', 'Mama', 'Jonas']);
    const before = await store.roundState(roundId);
    const openBefore = before?.participants.filter((p) => !p.revealed).length ?? -1;

    await store.draw(roundId, 'Papa', SECRET_A);

    const after = await store.roundState(roundId);
    const openAfter = after?.participants.filter((p) => !p.revealed).length ?? -1;

    expect(openAfter).toBe(openBefore - 1);
    expect(after?.participants.find((p) => p.name === 'Papa')?.revealed).toBe(true);
    expect(after?.participants.find((p) => p.name === 'Anna')?.revealed).toBe(false);
  });

  it('markiert den gezogenen Namen als vergeben, ohne ihn zu verraten', async () => {
    const { store, roundId } = await makeRound(['Anna', 'Papa', 'Mama', 'Jonas']);

    const result = await store.draw(roundId, 'Anna', SECRET_A);
    if (result.status !== 'ok') throw new Error('Zug fehlgeschlagen');

    const state = await store.roundState(roundId);
    const drawnName = state?.participants.find((p) => p.name === result.assignment);

    expect(drawnName?.taken).toBe(true);
    expect(state?.participants.filter((p) => p.taken)).toHaveLength(1);
    expect(state?.participants.find((p) => p.name === 'Anna')?.taken).toBe(false);
    // Wer gezogen hat, bleibt trotzdem geheim.
    expect(JSON.stringify(state)).not.toContain('assignment');
  });
});

describe('LocalStore.reset', () => {
  it('öffnet den Zug wieder und behält die Zuteilung', async () => {
    const { store, roundId, hostToken } = await makeRound();

    const first = await store.draw(roundId, 'Anna', SECRET_A);
    if (first.status !== 'ok') throw new Error('Zug fehlgeschlagen');

    expect(await store.reset(hostToken, 'Anna')).toEqual({ ok: true });

    const state = await store.roundState(roundId);
    expect(state?.participants.find((p) => p.name === 'Anna')?.revealed).toBe(false);

    const again = await store.draw(roundId, 'Anna', SECRET_B);
    expect(again).toEqual({ status: 'ok', assignment: first.assignment });
  });

  it('lehnt ein fremdes Host-Token ab', async () => {
    const { store, roundId } = await makeRound();
    await store.draw(roundId, 'Anna', SECRET_A);
    expect(await store.reset('falschesToken123', 'Anna')).toEqual({ ok: false });
  });
});

describe('LocalStore.hostRoundState', () => {
  it('löst die Runde über das Host-Token auf', async () => {
    const { store, roundId, hostToken } = await makeRound();
    const state = await store.hostRoundState(hostToken);
    expect(state?.id).toBe(roundId);
    expect(state?.participants).toHaveLength(3);
  });

  it('liefert null bei unbekanntem Token', async () => {
    const { store } = await makeRound();
    expect(await store.hostRoundState('unbekannt')).toBeNull();
  });
});

describe('LocalStore Persistenz', () => {
  it('überlebt einen Reload (neue Instanz, gleicher Storage)', async () => {
    const storage = new MemoryStorage();
    const store = new LocalStore(storage);
    const created = await store.createRound({
      title: 'Reload',
      budget: null,
      eventDate: null,
      names: ['Anna', 'Papa', 'Mama'],
    });
    await store.draw(created.roundId, 'Anna', SECRET_A);

    const reloaded = new LocalStore(storage);
    const state = await reloaded.roundState(created.roundId);
    expect(state?.participants.filter((p) => p.revealed)).toHaveLength(1);
  });
});
