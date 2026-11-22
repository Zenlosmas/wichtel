import { useEffect, useState, type ReactNode } from 'react';
import { loadStore, type StoreHandle } from '../lib/store';
import { StoreContext } from '../lib/storeContext';

type State =
  | { kind: 'loading' }
  | { kind: 'ready'; handle: StoreHandle }
  | { kind: 'failed'; message: string };

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    let alive = true;
    loadStore().then(
      (handle) => {
        if (alive) setState({ kind: 'ready', handle });
      },
      (error: unknown) => {
        if (!alive) return;
        setState({
          kind: 'failed',
          message: error instanceof Error ? error.message : String(error),
        });
      },
    );
    return () => {
      alive = false;
    };
  }, []);

  if (state.kind === 'loading') {
    return (
      <main className="page">
        <p className="muted">Einen Moment …</p>
      </main>
    );
  }

  if (state.kind === 'failed') {
    return (
      <main className="page">
        <div className="error">
          <strong>App konnte nicht starten.</strong>
          <br />
          {state.message}
        </div>
      </main>
    );
  }

  return (
    <StoreContext.Provider value={state.handle}>
      {children}
    </StoreContext.Provider>
  );
}
