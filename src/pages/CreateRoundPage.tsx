import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CopyButton } from '../components/CopyButton';
import { DemoNote } from '../components/DemoNote';
import { MIN_NAMES, parseNames, validateNames } from '../lib/assignment';
import { formatDate } from '../lib/format';
import { useStore } from '../lib/storeContext';
import type { CreatedRound } from '../lib/types';

function whatsappText(
  title: string,
  url: string,
  budget: string | null,
  eventDate: string | null,
  count: number,
): string {
  const lines = [
    `Wichteln: ${title}`,
    `${count} Leute, jede Person zieht genau eine andere. Link öffnen, eigenen Namen antippen, ziehen – fertig.`,
    url,
  ];
  const details: string[] = [];
  if (budget) details.push(`Budget: ${budget}`);
  if (eventDate) details.push(`Termin: ${formatDate(eventDate)}`);
  if (details.length > 0) lines.push(details.join(' · '));
  return lines.join('\n');
}

export function CreateRoundPage() {
  const { store, demo } = useStore();

  const [title, setTitle] = useState('Wichteln');
  const [budget, setBudget] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [namesRaw, setNamesRaw] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<CreatedRound | null>(null);

  const names = useMemo(() => parseNames(namesRaw), [namesRaw]);
  const nameProblem = names.length === 0 ? null : validateNames(names);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const problem = validateNames(names);
    if (problem) {
      setError(problem);
      return;
    }

    setError(null);
    setBusy(true);
    try {
      const result = await store.createRound({
        title: title.trim() || 'Wichteln',
        budget: budget.trim() || null,
        eventDate: eventDate || null,
        names,
      });
      setCreated(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unbekannter Fehler.');
    } finally {
      setBusy(false);
    }
  }

  if (created) {
    const guestUrl = `${window.location.origin}/w/${created.roundId}`;
    const hostUrl = `${window.location.origin}/h/${created.hostToken}`;
    const text = whatsappText(
      title.trim() || 'Wichteln',
      guestUrl,
      budget.trim() || null,
      eventDate || null,
      names.length,
    );

    return (
      <main className="page">
        <div className="brand">
          <span className="brand-dot" aria-hidden="true" />
          Wichteln
        </div>

        <div>
          <h1>Runde steht</h1>
          <p className="muted">
            {names.length} Namen, alle Zuteilungen sind bereits gezogen. Der Link
            verteilt nur noch.
          </p>
        </div>

        {demo && (
          <div className="warn">
            <strong>Dieser Link funktioniert nur auf diesem Gerät.</strong>
            <span>
              Es ist kein Backend verbunden, die Runde liegt im Speicher dieses
              Browsers. Auf dem Handy oder in einem anderen Browser steht
              „Runde nicht gefunden". Für die Familie: Supabase anschließen und
              deployen.
            </span>
          </div>
        )}

        <section className="card stack">
          <h2>Link für die Gruppe</h2>
          <div className="link-box">
            <input readOnly value={guestUrl} aria-label="Teilnehmer-Link" />
            <CopyButton text={guestUrl} label="Kopieren" />
          </div>
          <CopyButton
            text={text}
            label="WhatsApp-Text kopieren"
            className="btn btn-primary btn-block"
          />
          <a
            className="btn btn-ghost btn-block"
            href={`https://wa.me/?text=${encodeURIComponent(text)}`}
            target="_blank"
            rel="noreferrer"
          >
            In WhatsApp öffnen
          </a>
          <p className="muted small">
            Der Link enthält keine Namen, nur eine Zufalls-ID. Wer ihn hat, kann
            mitmachen – also nur in die Familiengruppe.
          </p>
        </section>

        <section className="card card-tight stack">
          <h2>Deine Host-Ansicht</h2>
          <p className="muted small">
            Status, wer noch fehlt, und Zurücksetzen bei Handywechsel. Nicht in
            die Gruppe posten.
          </p>
          <Link className="btn btn-ghost btn-block" to={`/h/${created.hostToken}`}>
            Host-Ansicht öffnen
          </Link>
          <p className="muted small" style={{ wordBreak: 'break-all' }}>
            {hostUrl}
          </p>
        </section>

        <button
          type="button"
          className="btn btn-ghost btn-block"
          onClick={() => {
            setCreated(null);
            setNamesRaw('');
            setTitle('Wichteln');
            setBudget('');
            setEventDate('');
          }}
        >
          Neue Runde anlegen
        </button>

        {demo && <DemoNote />}
      </main>
    );
  }

  return (
    <main className="page">
      <div className="brand">
        <span className="brand-dot" aria-hidden="true" />
        Wichteln
      </div>

      <div>
        <h1>Wichteln auslosen</h1>
        <p className="muted">
          Ein Link für alle. Jeder tippt seinen Namen an und sieht, wen er
          beschenkt.
        </p>
      </div>

      {demo && <DemoNote />}

      <form className="stack" onSubmit={handleSubmit}>
        <div className="field">
          <label className="label" htmlFor="title">
            Titel
          </label>
          <input
            id="title"
            value={title}
            maxLength={60}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Wichteln"
          />
        </div>

        <div className="row">
          <div className="field" style={{ flex: '1 1 150px' }}>
            <label className="label" htmlFor="budget">
              Budget (optional)
            </label>
            <input
              id="budget"
              value={budget}
              maxLength={30}
              onChange={(event) => setBudget(event.target.value)}
              placeholder="10 €"
            />
          </div>
          <div className="field" style={{ flex: '1 1 150px' }}>
            <label className="label" htmlFor="date">
              Termin (optional)
            </label>
            <input
              id="date"
              type="date"
              value={eventDate}
              onChange={(event) => setEventDate(event.target.value)}
            />
          </div>
        </div>

        <div className="field">
          <label className="label" htmlFor="names">
            Namen – einer pro Zeile
          </label>
          <textarea
            id="names"
            value={namesRaw}
            onChange={(event) => setNamesRaw(event.target.value)}
            placeholder={'Anna\nPapa\nMama\nJonas'}
            spellCheck={false}
          />
          <p className="muted small">
            Mindestens {MIN_NAMES} Namen. Kommas gehen auch.
          </p>
          {names.length > 0 && (
            <div className="chips">
              {names.map((name, index) => (
                <span className="chip" key={`${name}-${index}`}>
                  {name}
                </span>
              ))}
            </div>
          )}
        </div>

        {nameProblem && <p className="error">{nameProblem}</p>}
        {error && <p className="error">{error}</p>}

        <button
          type="submit"
          className="btn btn-primary btn-block"
          disabled={busy || names.length < MIN_NAMES}
        >
          {busy ? 'Wird angelegt …' : 'Runde anlegen'}
        </button>
      </form>
    </main>
  );
}
