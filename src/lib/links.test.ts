import { describe, expect, it } from 'vitest';
import { appBase, guestLink, hostLink } from './links';

describe('Links', () => {
  it('lokal ohne Unterpfad', () => {
    const base = appBase('http://localhost:5178', '/');
    expect(base).toBe('http://localhost:5178');
    expect(guestLink(base, 'abc123')).toBe('http://localhost:5178/#/w/abc123');
  });

  it('auf GitHub Pages mit Unterpfad', () => {
    const base = appBase('https://zenlosmas.github.io', '/wichteln/');
    expect(base).toBe('https://zenlosmas.github.io/wichteln');
    expect(guestLink(base, 'abc123')).toBe(
      'https://zenlosmas.github.io/wichteln/#/w/abc123',
    );
    expect(hostLink(base, 'host9')).toBe(
      'https://zenlosmas.github.io/wichteln/#/h/host9',
    );
  });

  it('entfernt doppelte und fehlende Schrägstriche', () => {
    expect(appBase('https://x.dev', '/wichteln//')).toBe('https://x.dev/wichteln');
    expect(appBase('https://x.dev', '')).toBe('https://x.dev');
    expect(appBase('https://x.dev', '/')).toBe('https://x.dev');
  });

  it('erzeugt niemals einen Pfad ohne Hash', () => {
    const base = appBase('https://zenlosmas.github.io', '/wichteln/');
    expect(guestLink(base, 'id')).not.toMatch(/wichteln\/w\//);
    expect(guestLink(base, 'id')).toContain('/#/w/');
  });
});
