/**
 * Tannen am Seitenende. Reine CSS-Formen, kein Bild, kein Emoji.
 * Höhen und Farbtöne sind fest verdrahtet, damit die Reihe immer gleich
 * aussieht und nicht bei jedem Rendern springt.
 */

import type { CSSProperties } from 'react';

type Tree = { height: number; tone: 0 | 1; star?: boolean };

const TREES: Tree[] = [
  { height: 46, tone: 0 },
  { height: 70, tone: 1 },
  { height: 54, tone: 0 },
  { height: 88, tone: 1, star: true },
  { height: 62, tone: 0 },
  { height: 78, tone: 1 },
  { height: 50, tone: 0 },
  { height: 94, tone: 1, star: true },
  { height: 58, tone: 0 },
  { height: 72, tone: 1 },
  { height: 44, tone: 0 },
];

export function TreeLine() {
  return (
    <div className="treeline" aria-hidden="true">
      <span className="treeline-ground" />
      {TREES.map((tree, index) => (
        <span
          key={index}
          className={`tree tone-${tree.tone}`}
          style={{ '--h': tree.height } as CSSProperties}
        >
          {tree.star && <span className="tree-star" />}
          <span className="tree-crown" />
        </span>
      ))}
    </div>
  );
}
