import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CopyButton } from '../components/CopyButton';
import { DemoNote } from '../components/DemoNote';
import { Snow } from '../components/Snow';
import { formatDate } from '../lib/format';
import { appBase, guestLink } from '../lib/links';
import { useStore } from '../lib/storeContext';
import type { RoundState } from '../lib/types';

function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} und ${names[names.length - 1]}`;
}

export function HostRoundPage() {
  const { hostToken } = useParams();
  const { store, demo } = useStore();

  const [state, setState] = useState<RoundState | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!hostToken) {
      setStatus('missing');
      return;
    }
    try {
      const next = await store.hostRoundState(hostToken);
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
  }, [store, hostToken]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleReset(name: string) {
    if (!hostToken) return;
    setBusy(name);
    try {
      const result = await store.reset(hostToken, name);
      if (!result.ok) {
        setError('Zurücksetzen hat nicht geklappt.');
      } else {
        await load();
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unbekannter Fehler.');
    } finally {
      setBusy(null);
      setConfirming(null);
    }
  }

  if (status === 'loading') {
    return (
      <main className="page">
        <p className="muted">Wird geladen …</p>
      </main>
    );
  }

  if (status === 'error') {
    return (
      <main className="page">
        <div className="error">{error ?? 'Konnte nicht geladen werden.'}</div>
        <Link className="btn btn-ghost btn-block" to="/">
          Zur Startseite
        </Link>
      </main>
    );
  }

  if (status === 'missing' || !state) {
    return (
      <main className="page">
        <h1>Host-Link unbekannt</h1>
        <p className="muted">
          Dieser Link gehört zu keiner Runde. Vielleicht ein Tippfehler oder die
          Runde wurde neu angelegt.
        </p>
        <Link className="btn btn-ghost btn-block" to="/">
          Neue Runde anlegen
        </Link>
      </main>
    );
  }

  const total = state.participants.length;
  const missing = state.participants.filter((p) => !p.revealed).map((p) => p.name);
  const drawn = total - missing.length;
  // Musste denselben Weg gehen wie die Links beim Anlegen: Unterpfad plus Hash.
  const guestUrl = guestLink(
    appBase(window.location.origin, import.meta.env.BASE_URL),
    state.id,
  );

  const reminder =
    missing.length === 0
      ? `Beim Wichteln „${state.title}" haben alle gezogen. Fertig.`
      : `Erinnerung zum Wichteln „${state.title}": ${joinNames(missing)} ${
          missing.length === 1 ? 'fehlt' : 'fehlen'
        } noch. Kurz den Link öffnen, eigenen Namen antippen, ziehen:\n${guestUrl}`;

  return (
    <main className="page">
      <header className="stack hero">
        <Snow />
        <div className="brand">
          <span className="brand-dot" aria-hidden="true" />
          Host-Ansicht
        </div>
        <h1>{state.title}</h1>
        <div className="meta">
          <span className={missing.length === 0 ? 'badge is-done' : 'badge'}>
            {drawn} von {total} haben gezogen
          </span>
          {state.budget && <span className="badge">Budget: {state.budget}</span>}
          {state.eventDate && (
            <span className="badge">Termin: {formatDate(state.eventDate)}</span>
          )}
        </div>
        <div className="progress" aria-hidden="true">
          <span style={{ width: `${total === 0 ? 0 : Math.round((drawn / total) * 100)}%` }} />
        </div>
      </header>

      {demo && <DemoNote compact />}
      {error && <p className="error">{error}</p>}

      <section className="stack">
        <h2>Status</h2>
        <ul className="name-list">
          {state.participants.map((participant) => (
            <li key={participant.name}>
              <div className="name-btn" style={{ cursor: 'default' }}>
                <span>{participant.name}</span>
                {confirming === participant.name ? (
                  <span className="row" style={{ gap: 6 }}>
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      disabled={busy === participant.name}
                      onClick={() => void handleReset(participant.name)}
                    >
                      Ja
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-ghost"
                      onClick={() => setConfirming(null)}
                    >
                      Nein
                    </button>
                  </span>
                ) : participant.revealed ? (
                  <span className="row" style={{ gap: 6, alignItems: 'center' }}>
                    <span className="hint is-done">✓ gezogen</span>
                    <button
                      type="button"
                      className="btn btn-sm btn-ghost"
                      onClick={() => setConfirming(participant.name)}
                    >
                      Zurücksetzen
                    </button>
                  </span>
                ) : (
                  <span className="hint">noch offen</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="card stack">
        <h2>{missing.length === 0 ? 'Alle sind durch' : 'Erinnerung schicken'}</h2>
        <p className="muted small">
          {missing.length === 0
            ? 'Niemand fehlt. Du kannst die Runde abschließen.'
            : `Fehlt noch: ${joinNames(missing)}.`}
        </p>
        <CopyButton
          text={reminder}
          label="Text kopieren"
          className="btn btn-primary btn-block"
        />
      </section>

      <section className="card card-tight stack">
        <h2>Link für die Gruppe</h2>
        <div className="link-box">
          <input readOnly value={guestUrl} aria-label="Teilnehmer-Link" />
          <CopyButton text={guestUrl} label="Kopieren" />
        </div>
        <p className="muted small">
          Zurücksetzen öffnet den Zug wieder – die Zuteilung bleibt dieselbe
          Person. Nötig bei Handywechsel oder Fehlklick.
        </p>
      </section>

      <Link className="btn btn-ghost btn-block" to="/">
        Neue Runde anlegen
      </Link>
    </main>
  );
}
