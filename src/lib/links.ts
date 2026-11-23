/**
 * Baut die Links, die in die Familiengruppe gehen.
 *
 * Zwei Fallen, die hier zusammenkommen:
 * 1. Die App liegt auf GitHub Pages unter einem Unterpfad (`/wichtel/`), der in
 *    `import.meta.env.BASE_URL` steht. Ein Link ohne diesen Pfad landet auf
 *    GitHubs 404-Seite.
 * 2. Die Route steckt hinter dem `#` (HashRouter), nicht im Pfad.
 */
export function appBase(origin: string, baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/, '');
  return `${origin}${trimmed}`;
}

export function guestLink(base: string, roundId: string): string {
  return `${base}/#/w/${roundId}`;
}

export function hostLink(base: string, hostToken: string): string {
  return `${base}/#/h/${hostToken}`;
}
