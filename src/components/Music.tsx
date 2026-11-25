import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Weihnachtsmusik ohne Audiodatei: "Stille Nacht" (Gruber, 1818, gemeinfrei)
 * als Spieluhr über die Web-Audio-API. Kein Download, keine Lizenz, kein
 * Cloud-Dienst.
 *
 * Warum es nicht einfach von allein losgeht: Browser starten Ton erst nach
 * einer Interaktion. Also:
 * 1. Läuft die Seite schon mit Nutzer-Interaktion (Reload), wird es versucht.
 * 2. Sonst startet der erste Tipp irgendwo auf der Seite die Musik.
 * 3. Der Knopf schaltet sie jederzeit aus, dauerhaft gemerkt.
 */

const STORAGE_KEY = 'wichtel:music';
const BPM = 76;
const BEAT = 60 / BPM;

// [MIDI-Note, Schläge] – "Stille Nacht", erste Strophe, gekürzt.
const MELODY: Array<[number, number]> = [
  [67, 1.5], [69, 0.5], [67, 1], [64, 2],
  [67, 1.5], [69, 0.5], [67, 1], [64, 2],
  [74, 1.5], [74, 0.5], [71, 2],
  [72, 1.5], [72, 0.5], [67, 2],
  [64, 0.5], [67, 0.5], [72, 1], [71, 2],
];

const MELODY_SECONDS = MELODY.reduce((sum, [, beats]) => sum + beats * BEAT, 0);

function playNote(
  ctx: AudioContext,
  out: GainNode,
  midi: number,
  at: number,
  duration: number,
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'triangle';
  osc.frequency.value = 440 * 2 ** ((midi - 69) / 12);

  // Spieluhr: harter Anschlag, weicher Ausklang.
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(0.9, at + 0.012);
  gain.gain.exponentialRampToValueAtTime(
    0.0001,
    at + Math.max(0.35, duration * 1.4),
  );

  osc.connect(gain);
  gain.connect(out);
  osc.start(at);
  osc.stop(at + Math.max(0.4, duration * 1.5));
}

export function Music() {
  const [playing, setPlaying] = useState(false);
  const [wanted, setWanted] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) !== 'off';
    } catch {
      return true;
    }
  });

  const ctxRef = useRef<AudioContext | null>(null);
  const outRef = useRef<GainNode | null>(null);
  const timerRef = useRef<number | null>(null);
  const playingRef = useRef(false);
  const busyRef = useRef(false);

  const stop = useCallback(() => {
    playingRef.current = false;
    setPlaying(false);
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const ctx = ctxRef.current;
    ctxRef.current = null;
    outRef.current = null;
    if (ctx) void ctx.close();
  }, []);

  /** Nur aus einer echten Nutzergeste heraus aufrufen. */
  const start = useCallback(() => {
    if (playingRef.current || busyRef.current) return;

    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return;

    busyRef.current = true;
    const ctx = new Ctor();
    const master = ctx.createGain();
    master.gain.value = 0.07;
    master.connect(ctx.destination);

    ctxRef.current = ctx;
    outRef.current = master;

    const begin = () => {
      busyRef.current = false;
      if (playingRef.current) return;
      playingRef.current = true;
      setPlaying(true);

      const round = () => {
        const live = ctxRef.current;
        const out = outRef.current;
        if (!live || !out || !playingRef.current) return;

        // Im Hintergrund ist die Uhr angehalten – dann nur weiter warten,
        // sonst würden alle Noten auf denselben Zeitpunkt gelegt.
        if (document.hidden || live.state !== 'running') {
          timerRef.current = window.setTimeout(round, 1200);
          return;
        }

        let at = live.currentTime + 0.08;
        for (const [midi, beats] of MELODY) {
          const length = beats * BEAT;
          playNote(live, out, midi, at, length);
          at += length;
        }
        // Kleine Pause zwischen den Durchläufen, sonst pappt es.
        timerRef.current = window.setTimeout(
          round,
          (MELODY_SECONDS + 2.2) * 1000,
        );
      };
      round();
    };

    const giveUp = () => {
      busyRef.current = false;
      if (ctxRef.current === ctx) {
        ctxRef.current = null;
        outRef.current = null;
      }
      void ctx.close();
    };

    if (ctx.state === 'running') {
      begin();
      return;
    }

    // Innerhalb einer Geste läuft resume() durch. Ohne Geste bleibt es
    // hängen – dann lieber sauber abbrechen als dem Knopf etwas vorlügen.
    ctx
      .resume()
      .then(() => {
        if (ctx.state === 'running') begin();
        else giveUp();
      })
      .catch(giveUp);

    window.setTimeout(() => {
      if (!playingRef.current && ctx.state !== 'running') giveUp();
    }, 800);
  }, []);

  // 1. Nur versuchen, wenn der Browser der Seite schon eine Interaktion
  //    zugetraut hat – sonst entsteht nur ein hängender AudioContext.
  useEffect(() => {
    if (!wanted) return;
    const activation = navigator.userActivation;
    if (activation?.hasBeenActive) start();
  }, [wanted, start]);

  // 2. Der erste Tipp irgendwo auf der Seite startet die Musik.
  useEffect(() => {
    if (!wanted || playing) return;

    const onFirstTouch = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('.music-toggle')) return; // regelt sich selbst
      start();
    };

    document.addEventListener('pointerdown', onFirstTouch, { once: true });
    document.addEventListener('keydown', onFirstTouch, { once: true });
    return () => {
      document.removeEventListener('pointerdown', onFirstTouch);
      document.removeEventListener('keydown', onFirstTouch);
    };
  }, [wanted, playing, start]);

  // 3. Im Hintergrund schweigen, beim Zurückkommen weiter.
  useEffect(() => {
    const onVisibility = () => {
      const ctx = ctxRef.current;
      if (!ctx) return;
      if (document.hidden) void ctx.suspend();
      else if (playingRef.current) void ctx.resume();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      stop();
    };
  }, [stop]);

  function toggle() {
    if (playing) {
      stop();
      setWanted(false);
      try {
        localStorage.setItem(STORAGE_KEY, 'off');
      } catch {
        /* privater Modus: dann ohne Erinnerung */
      }
      return;
    }

    setWanted(true);
    try {
      localStorage.setItem(STORAGE_KEY, 'on');
    } catch {
      /* egal */
    }
    start();
  }

  return (
    <button
      type="button"
      className={playing ? 'music-toggle is-on' : 'music-toggle'}
      onClick={toggle}
      aria-pressed={playing}
      title={playing ? 'Musik ausschalten' : 'Weihnachtsmusik einschalten'}
    >
      <span className="music-note" aria-hidden="true">
        ♪
      </span>
      {playing ? 'Musik aus' : 'Musik an'}
    </button>
  );
}
