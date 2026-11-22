import type { WichtelStore } from './types';

export type StoreHandle = {
  store: WichtelStore;
  /** true when no backend is configured and everything stays in this browser */
  demo: boolean;
};

let pending: Promise<StoreHandle> | null = null;

async function build(): Promise<StoreHandle> {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim();
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

  if (url && anonKey) {
    const [{ createClient }, { SupabaseStore }] = await Promise.all([
      import('@supabase/supabase-js'),
      import('./supabaseStore'),
    ]);
    const client = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    return { store: new SupabaseStore(client), demo: false };
  }

  const { LocalStore } = await import('./localStore');
  return { store: new LocalStore(), demo: true };
}

/** Resolved once per page load; the supabase client is only loaded when configured. */
export function loadStore(): Promise<StoreHandle> {
  if (!pending) pending = build();
  return pending;
}
