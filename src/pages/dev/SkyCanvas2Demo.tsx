/**
 * /dev/skycanvas-2 — Demo do SkyCanvas 2.0.
 *
 * Query params:
 *   ?perf=1       → mostra HUD FPS/draw/triangles/dpr/bursts
 *   ?nostars=1    → desliga o star field
 *   ?nogrid=1     → desliga o grid de chão
 *   ?nostage=1    → esconde o palco (deck + truss + painéis + beams)
 *   ?stage=minimal → variante minimal (só deck)
 */
import { useMemo } from 'react';
import { SkyCanvas2 } from '@/components/show3d/v2';

export default function SkyCanvas2Demo() {
  const opts = useMemo(() => {
    if (typeof window === 'undefined')
      return { perf: false, stars: true, grid: true, stage: true, variant: 'arch' as const };
    const q = new URLSearchParams(window.location.search);
    return {
      perf: q.get('perf') === '1',
      stars: q.get('nostars') !== '1',
      grid: q.get('nogrid') !== '1',
      stage: q.get('nostage') !== '1',
      variant: (q.get('stage') === 'minimal' ? 'minimal' : 'arch') as 'arch' | 'minimal',
    };
  }, []);

  return (
    <div className="relative w-screen h-screen bg-[#050810] text-white">
      <SkyCanvas2
        hideStars={!opts.stars}
        hideGrid={!opts.grid}
        hideStage={!opts.stage}
        stageVariant={opts.variant}
        showPerfHud={opts.perf}
      />
      <div className="absolute top-3 left-3 z-10 px-3 py-2 rounded-md bg-black/60 backdrop-blur border border-cyan-500/30 text-xs font-mono">
        <div className="text-cyan-300">SkyCanvas 2.0 · Stage</div>
        <div className="opacity-70">Show Plane · presentation only</div>
        <div className="opacity-50 mt-1">?perf · ?nostars · ?nogrid · ?nostage · ?stage=minimal</div>
      </div>
    </div>
  );
}
