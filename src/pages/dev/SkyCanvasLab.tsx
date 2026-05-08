/**
 * /dev/skycanvas-lab — Unified SkyCanvas dev harness.
 *
 * Consolida as 3 antigas rotas dev (`/dev/skycanvas-smoke`, `/dev/skycanvas-3d`,
 * `/dev/skycanvas-2`) em uma única superfície com toggle de variante. Reduz
 * imports lazy no App.tsx (3 → 1) e simplifica o footprint dev.
 *
 * Variantes:
 *   - smoke : SkyCanvasMount unificado (mesmo do editor de produção)
 *   - r3f   : SkyCanvas3D (R3F clean) com seed determinístico
 *   - v2    : SkyCanvas2 (engine modular) + flags via query string
 *
 * Sem auth, sem hardware, sem ARM/FIRE — Show Plane only.
 */
import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { lazyRetry } from '@/lib/lazyRetry';
import SkyCanvasMount from '@/components/editor/SkyCanvasMount';
import SkyCanvasViewportShell from '@/components/skycanvas/SkyCanvasViewportShell';
import { useProjectStore } from '@/store/useProjectStore';
import { EFFECT_LIBRARY } from '@/data/effectLibrary';

const SkyCanvas3D = lazy(lazyRetry(() => import('@/components/show3d/SkyCanvas3D')));
const SkyCanvas2 = lazy(
  lazyRetry(() => import('@/components/show3d/v2').then((m) => ({ default: m.SkyCanvas2 })))
);

type Variant = 'smoke' | 'r3f' | 'v2';

function useR3fSeed(active: boolean) {
  // Seed a tiny demo plan so the R3F layers have something to show.
  useEffect(() => {
    if (!active) return;
    const s = useProjectStore.getState();
    if (s.positions.length > 0) return;

    const pyroEffect = EFFECT_LIBRARY.find((e) => e.type === 'firework') ?? EFFECT_LIBRARY[0];
    const droneEffect = EFFECT_LIBRARY.find((e) => e.type === 'drone' || e.type === 'light');

    useProjectStore.setState({
      positions: [
        { id: 'pyro-L', name: 'Pyro L', type: 'pyro', x: -20, y: 0, z: 0, heading: 0, pitch: 0, roll: 0, color: '#ff7700' },
        { id: 'pyro-R', name: 'Pyro R', type: 'pyro', x: 20, y: 0, z: 0, heading: 0, pitch: 0, roll: 0, color: '#ff7700' },
        { id: 'drone-A', name: 'Drone A', type: 'drone-pad', x: -10, y: 12, z: -10, heading: 0, pitch: 0, roll: 0, color: '#2dd4ff' },
        { id: 'drone-B', name: 'Drone B', type: 'drone-pad', x: 10, y: 12, z: -10, heading: 0, pitch: 0, roll: 0, color: '#22ee88' },
      ] as never,
      timelineItems: [
        { id: 'cue1', effectId: pyroEffect.id, startTime: 1, trackIndex: 0, position: { x: -20, y: 0, z: 0 }, positionId: 'pyro-L' },
        { id: 'cue2', effectId: pyroEffect.id, startTime: 2.5, trackIndex: 0, position: { x: 20, y: 0, z: 0 }, positionId: 'pyro-R' },
        ...(droneEffect
          ? [
              { id: 'cue3', effectId: droneEffect.id, startTime: 0, trackIndex: 1, position: { x: -10, y: 12, z: -10 }, positionId: 'drone-A' },
              { id: 'cue4', effectId: droneEffect.id, startTime: 0, trackIndex: 1, position: { x: 10, y: 12, z: -10 }, positionId: 'drone-B' },
            ]
          : []),
      ] as never,
      duration: 30,
      isPlaying: true,
    });

    const start = performance.now();
    const id = window.setInterval(() => {
      const t = ((performance.now() - start) / 1000) % 12;
      useProjectStore.setState({ currentTime: t });
    }, 33);
    return () => window.clearInterval(id);
  }, [active]);
}

export default function SkyCanvasLab() {
  const [params, setParams] = useSearchParams();
  const variant = (params.get('v') as Variant) ?? 'smoke';
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (variant !== 'smoke') return;
    const id = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [variant]);

  useR3fSeed(variant === 'r3f');

  const v2opts = useMemo(() => ({
    perf: params.get('perf') === '1',
    stars: params.get('nostars') !== '1',
    grid: params.get('nogrid') !== '1',
    stage: params.get('nostage') !== '1',
    variant: (params.get('stage') === 'minimal' ? 'minimal' : 'arch') as 'arch' | 'minimal',
  }), [params]);

  const setVariant = (v: Variant) => {
    const next = new URLSearchParams(params);
    next.set('v', v);
    setParams(next, { replace: true });
  };

  return (
    <div className="fixed inset-0 bg-[#050810] text-cyan-200 font-mono">
      <div className="absolute top-2 left-2 z-50 flex gap-1 rounded border border-cyan-500/30 bg-black/60 p-1 text-[11px]">
        {(['smoke', 'r3f', 'v2'] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setVariant(v)}
            className={`px-2 py-1 rounded transition-colors ${
              variant === v
                ? 'bg-cyan-500/30 text-cyan-100'
                : 'text-cyan-300/70 hover:text-cyan-100'
            }`}
            aria-pressed={variant === v}
          >
            {v.toUpperCase()}
          </button>
        ))}
        <span className="ml-2 self-center opacity-60">
          {variant === 'smoke' && `t=${tick}s`}
          {variant === 'r3f' && 'drag=orbit · wheel=zoom'}
          {variant === 'v2' && '?perf ?nostars ?nogrid ?nostage ?stage=minimal'}
        </span>
      </div>

      {variant === 'smoke' && (
        <SkyCanvasViewportShell variant="dev" />
      )}
      {variant === 'r3f' && (
        <Suspense fallback={<div className="grid h-full place-items-center text-xs">Booting R3F…</div>}>
          <SkyCanvas3D />
        </Suspense>
      )}
      {variant === 'v2' && (
        <Suspense fallback={<div className="grid h-full place-items-center text-xs">Booting v2…</div>}>
          <SkyCanvas2
            hideStars={!v2opts.stars}
            hideGrid={!v2opts.grid}
            hideStage={!v2opts.stage}
            stageVariant={v2opts.variant}
            showPerfHud={v2opts.perf}
          />
        </Suspense>
      )}
    </div>
  );
}
