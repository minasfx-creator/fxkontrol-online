/**
 * EdgeSnapGuides — viewport-spanning overlay that draws cyan guide lines
 * along edges that are currently within the snap zone of a dragging float.
 *
 * Pure presentation. Renders nothing when no edge is active.
 * Mounts via a portal-free fixed div with `pointer-events: none` so it
 * never intercepts user input.
 */
import { useEffect, useState } from 'react';

interface SnapEdges {
  h: 'l' | 'r' | null;
  v: 't' | 'b' | null;
}

interface Props {
  active: boolean;
  edges: SnapEdges;
}

export default function EdgeSnapGuides({ active, edges }: Props) {
  const [mounted, setMounted] = useState(false);

  // Stay mounted briefly after release so the fade-out animation completes.
  useEffect(() => {
    if (active) {
      setMounted(true);
      return;
    }
    const t = setTimeout(() => setMounted(false), 220);
    return () => clearTimeout(t);
  }, [active]);

  if (!mounted) return null;

  const showLeft = active && edges.h === 'l';
  const showRight = active && edges.h === 'r';
  const showTop = active && edges.v === 't';
  const showBottom = active && edges.v === 'b';

  const lineBase =
    'absolute bg-gradient-to-b from-transparent via-cyan-300/80 to-transparent shadow-[0_0_12px_hsl(190_100%_60%_/_0.6)] transition-opacity duration-200';
  const lineH =
    'absolute bg-gradient-to-r from-transparent via-cyan-300/80 to-transparent shadow-[0_0_12px_hsl(190_100%_60%_/_0.6)] transition-opacity duration-200';

  return (
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden">
      <div
        className={lineBase}
        style={{
          left: 0,
          top: 0,
          width: 2,
          height: '100%',
          opacity: showLeft ? 1 : 0,
        }}
      />
      <div
        className={lineBase}
        style={{
          right: 0,
          top: 0,
          width: 2,
          height: '100%',
          opacity: showRight ? 1 : 0,
        }}
      />
      <div
        className={lineH}
        style={{
          left: 0,
          top: 0,
          height: 2,
          width: '100%',
          opacity: showTop ? 1 : 0,
        }}
      />
      <div
        className={lineH}
        style={{
          left: 0,
          bottom: 0,
          height: 2,
          width: '100%',
          opacity: showBottom ? 1 : 0,
        }}
      />
    </div>
  );
}
