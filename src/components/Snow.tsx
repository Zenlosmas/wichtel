/**
 * Schnee im Kopfbereich. Bewusst sparsam: zwei Dutzend kleine Flocken, keine
 * Bilder, kein DOM-Gewitter. Die Werte sind fest verdrahtet statt zufällig,
 * damit sich die Flocken bei jedem Neuzeichnen nicht neu verteilen.
 *
 * Bei `prefers-reduced-motion` blendet das CSS die Ebene komplett aus.
 */

type Flake = {
  left: number;
  size: number;
  delay: number;
  duration: number;
  opacity: number;
};

// Einfacher linearer Kongruenzgenerator mit festem Startwert: gleiche Flocken
// bei jedem Aufruf, ohne Math.random und ohne Hydration-Überraschungen.
function buildFlakes(count: number): Flake[] {
  let seed = 20251224;
  const next = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };

  return Array.from({ length: count }, () => ({
    left: Math.round(next() * 98),
    size: 2 + Math.round(next() * 1),
    delay: -Math.round(next() * 120) / 10,
    duration: 9 + Math.round(next() * 8),
    opacity: 0.3 + Math.round(next() * 30) / 100,
  }));
}

const FLAKES = buildFlakes(22);

export function Snow({ count = 22 }: { count?: number }) {
  return (
    <div className="snow" aria-hidden="true">
      {FLAKES.slice(0, count).map((flake, index) => (
        <i
          key={index}
          style={{
            left: `${flake.left}%`,
            width: `${flake.size}px`,
            height: `${flake.size}px`,
            opacity: flake.opacity,
            animationDelay: `${flake.delay}s`,
            animationDuration: `${flake.duration}s`,
          }}
        />
      ))}
    </div>
  );
}
