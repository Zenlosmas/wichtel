import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CopyButton } from '../components/CopyButton';
import { DemoNote } from '../components/DemoNote';
import { Snow } from '../components/Snow';
import { TreeLine } from '../components/TreeLine';
import {
  clearReveal,
  getDeviceSecret,
  readReveal,
  writeReveal,
  type RevealRecord,
} from '../lib/device';
import { formatDate } from '../lib/format';
import { useStore } from '../lib/storeContext';
import type { RoundState } from '../lib/types';

type View = 'list' | 'confirm' | 'mixing' | 'result';

const MIX_MS = 950;

const same = (a: string, b: string) => a.toLocaleLowerCase('de') === b.toLocaleLowerCase('de');

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });

export function GuestRoundPage() {
  const { roundId } = useParams();
  const { store, demo } = useStore();
  const deviceSecret = useMemo(() => getDeviceSecret(), []);

  const [state, setState] = useState<RoundState | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [view, setView] = useState<View>('list');
  const [selected, setSelected] = useState<string | null>(null);
  const [reveal, setReveal] = useState<RevealRecord | null>(null);
  const [busyName, setBusyName] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!roundId) {
      setStatus('missing');
      return;
    }
    try {
      const next = await store.roundState(roundId);
      if (!next) {
        setStatus('missing');
        return;
      }
      setState(next);
      setStatus('ready');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unbekannter Fehler.');
      setStatus('error');
    }
  }, [store, roundId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Ein lokal gespeichertes Ergebnis gilt nur, solange der Zug nicht vom Host
  // zurückgesetzt wurde.
  useEffect(() => {
    if (!roundId || !state) return;
    const stored = readReveal(roundId);
    if (!stored) {
      setReveal(null);
      return;
    }
    const participant = state.participants.find((p) => same(p.name, stored.name));
    if (participant?.revealed) {
      setReveal(stored);
    } else {
      clearReveal(roundId);
      setReveal(null);
    }
  }, [roundId, state]);

  async function startDraw(name: string) {
    if (!roundId) return;
    setView('mixing');
    setNotice(null);
    const startedAt = Date.now();
    try {
      const result = await store.draw(roundId, name, deviceSecret);
      const remaining = MIX_MS - (Date.now() - startedAt);
      if (remaining > 0) await sleep(remaining);

      if (result.status === 'ok') {
        const record: RevealRecord = {
          name,
          assignment: result.assignment,
          at: new Date().toISOString(),
        };
        writeReveal(roundId, record);
        setReveal(record);
        setSelected(null);
        setView('result');
        void load();
        return;
      }

      setView('list');
      if (result.status === 'already') {
        setNotice('Hat schon gezogen. Der Name steht auf dem Gerät, das gezogen hat.');
      } else {
        setError('Dieser Name gehört nicht zu dieser Runde.');
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unbekannter Fehler.');
      setView('list');
    }
  }

  async function openExisting(name: string) {
    if (!roundId) return;
    if (reveal && same(reveal.name, name)) {
      setNotice(null);
      setView('result');
      return;
    }

    setBusyName(name);
    try {
      const result = await store.draw(roundId, name, deviceSecret);
      if (result.status === 'ok') {
        const record: RevealRecord = {
          name,
          assignment: result.assignment,
          at: new Date().toISOString(),
        };
        writeReveal(roundId, record);
        setReveal(record);
        setNotice(null);
        setView('result');
        void load();
      } else {
        setNotice('Hat schon gezogen. Der Name steht auf dem Gerät, das gezogen hat.');
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unbekannter Fehler.');
    } finally {
      setBusyName(null);
    }
  }

  function handleNameClick(name: string, revealed: boolean) {
    setError(null);
    if (revealed) {
      void openExisting(name);
      return;
    }
    setNotice(null);
    setSelected(name);
    setView('confirm');
  }

  if (status === 'loading') {
    return (
      <main className="page">
        <p className="muted">Runde wird geladen …</p>
      </main>
    );
  }

  if (status === 'error') {
    return (
      <main className="page">
        <div className="error">{error ?? 'Runde konnte nicht geladen werden.'}</div>
        <Link className="btn btn-ghost btn-block" to="/">
          Zur Startseite
        </Link>
      </main>
    );
  }

  if (status === 'missing' || !state) {
    return (
      <main className="page">
        <h1>Runde nicht gefunden</h1>
        <p className="muted">
          Der Link ist unvollständig oder die Runde wurde gelöscht. Frag die
          Person, die eingeladen hat.
        </p>
        <Link className="btn btn-ghost btn-block" to="/">
          Neue Runde anlegen
        </Link>
      </main>
    );
  }

  const total = state.participants.length;
  const drawn = state.participants.filter((p) => p.revealed).length;
  const openPool = state.participants.filter((p) => !p.taken).map((p) => p.name);
  const percent = total === 0 ? 0 : Math.round((drawn / total) * 100);
  const details = [state.budget && `Budget: ${state.budget}`, state.eventDate && `Termin: ${formatDate(state.eventDate)}`]
    .filter(Boolean)
    .join(' · ');

  return (
    <main className="page">
      <header className="stack hero">
        <Snow />
        <div className="brand">
          <span className="brand-dot" aria-hidden="true" />
          Wichteln
        </div>
        <h1>{state.title}</h1>
        <div className="meta">
          {state.budget && <span className="badge">Budget: {state.budget}</span>}
          {state.eventDate && (
            <span className="badge">Termin: {formatDate(state.eventDate)}</span>
          )}
          <span className={drawn === total ? 'badge is-done' : 'badge'}>
            {drawn} von {total} {drawn === 1 ? 'hat' : 'haben'} gezogen
          </span>
        </div>
        <div
          className="progress"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={drawn}
        >
          <span style={{ width: `${percent}%` }} />
        </div>
      </header>

      {demo && <DemoNote compact />}
      {notice && <p className="note">{notice}</p>}
      {error && <p className="error">{error}</p>}

      {view === 'confirm' && selected && (
        <section className="stage card">
          <p className="muted">Du bist</p>
          <p className="confirm-name">{selected}</p>
          <p className="muted small">
            Danach ist der Name weg. Nur dieses Gerät kann dein Ergebnis später
            nochmal zeigen.
          </p>
          <button
            type="button"
            className="btn btn-primary btn-block"
            onClick={() => void startDraw(selected)}
          >
            Ziehen
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-block"
            onClick={() => {
              setSelected(null);
              setView('list');
            }}
          >
            Zurück
          </button>
        </section>
      )}

      {view === 'mixing' && (
        <section className="stage">
          <div className="mix-stack" aria-hidden="true">
            <div className="mix-card" />
            <div className="mix-card" />
            <div className="mix-card" />
          </div>
          <p className="center muted">Karten werden gemischt …</p>
        </section>
      )}

      {view === 'result' && reveal && (
        <section className="stage">
          <div className="result-card">
            <p className="muted small">Du hast gezogen</p>
            <p className="result-name">{reveal.assignment}</p>
            <p className="muted small">Nicht verraten. Nur diese Person beschenken.</p>
          </div>
          <CopyButton
            text={reveal.assignment}
            label="Namen kopieren"
            className="btn btn-ghost btn-block"
          />
          {details && <p className="center muted small">{details}</p>}
          <button
            type="button"
            className="btn btn-primary btn-block"
            onClick={() => setView('list')}
          >
            Zur Liste
          </button>
        </section>
      )}

      {view === 'list' && (
        <>
          {drawn > 0 && (
            <section className="stack">
              <h2>Noch zu vergeben</h2>
              {openPool.length > 0 ? (
                <div className="chips">
                  {openPool.map((name) => (
                    <span key={name} className="chip">
                      {name}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="muted">Alle Namen sind vergeben.</p>
              )}
            </section>
          )}

          <section className="stack">
            <h2>Wer bist du?</h2>
            <ul className="name-list">
              {state.participants.map((participant) => (
                <li key={participant.name}>
                  <button
                    type="button"
                    className={participant.revealed ? 'name-btn is-taken' : 'name-btn'}
                    onClick={() => handleNameClick(participant.name, participant.revealed)}
                    disabled={busyName === participant.name}
                  >
                    <span>{participant.name}</span>
                    <span
                      className={participant.revealed ? 'hint is-done' : 'hint'}
                    >
                      {busyName === participant.name
                        ? '…'
                        : participant.revealed
                          ? '✓ gezogen'
                          : 'noch offen'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          {reveal && (
            <div className="sticky-result">
              <div>
                <p className="muted small">Dein Ergebnis</p>
                <strong>{reveal.assignment}</strong>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                onClick={() => setView('result')}
              >
                Anzeigen
              </button>
            </div>
          )}
        </>
      )}

      <TreeLine />
    </main>
  );
}
