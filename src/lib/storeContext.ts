import { createContext, useContext } from 'react';
import type { StoreHandle } from './store';

export const StoreContext = createContext<StoreHandle | null>(null);

export function useStore(): StoreHandle {
  const handle = useContext(StoreContext);
  if (!handle) {
    throw new Error('useStore() wurde außerhalb des StoreProvider benutzt.');
  }
  return handle;
}
