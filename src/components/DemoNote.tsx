export function DemoNote({ compact = false }: { compact?: boolean }) {
  return (
    <p className="demo-note">
      <span aria-hidden="true">⚙︎</span>
      <span>
        {compact
          ? 'Demo-Modus, kein Backend verbunden.'
          : 'Demo-Modus, kein Backend verbunden. Alles bleibt in diesem Browser – Links funktionieren nur hier.'}
      </span>
    </p>
  );
}
