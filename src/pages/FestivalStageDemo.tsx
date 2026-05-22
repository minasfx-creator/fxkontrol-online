/**
 * /festival-stage-demo — R3F preview of the festival main stage with the
 * canonical demo seed (`marketing_hypothesis`). Standalone Canvas — does
 * not depend on SkyCanvas3D (which is referenced by memory but not present).
 */

import { Suspense, useState, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stats } from '@react-three/drei';
import { FestivalStageModel } from '@/components/festival/FestivalStageModel';
import { DemoModeOverlay } from '@/components/festival/DemoModeOverlay';
import {
  buildFestivalMainStageDemo,
  FESTIVAL_DEMO_DURATION_S,
  FESTIVAL_DEMO_MANIFEST,
} from '@/data/demoShows/festivalMainStageDemo';

export default function FestivalStageDemo() {
  const plan = useMemo(() => buildFestivalMainStageDemo(), []);
  const [showAnchors, setShowAnchors] = useState(false);
  const [showSource, setShowSource] = useState(false);

  return (
    <div className="relative h-[100dvh] w-full bg-[#050810] text-cyan-100">
      <Canvas
        shadows
        camera={{ position: [22, 14, 30], fov: 45 }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
      >
        <color attach="background" args={['#050810']} />
        <ambientLight intensity={0.25} />
        <directionalLight position={[20, 30, 10]} intensity={0.6} castShadow />
        <Suspense fallback={null}>
          <FestivalStageModel variant="festival" showAnchors={showAnchors} ledPulseHz={2} />
        </Suspense>
        <OrbitControls makeDefault />
        <Stats />
      </Canvas>

      <DemoModeOverlay showId={plan.metadata.id} lang="pt" onShowSource={() => setShowSource(true)} />

      <div className="pointer-events-auto absolute right-4 top-4 z-[9998] flex flex-col gap-2 rounded-md border border-cyan-400/40 bg-[#050810cc] p-3 backdrop-blur-md">
        <div className="text-[11px] uppercase tracking-wider text-cyan-300">Festival Stage Demo</div>
        <div className="text-[10px] text-cyan-100/80">
          {plan.metadata.name} · {FESTIVAL_DEMO_DURATION_S}s · {plan.pyroCues.length} pyro · {plan.dmxCues.length} DMX · {plan.dronePaths.length} drones
        </div>
        <label className="flex items-center gap-2 text-[11px]">
          <input type="checkbox" checked={showAnchors} onChange={(e) => setShowAnchors(e.target.checked)} />
          Show anchors
        </label>
        <div className="text-[10px] text-amber-300">provenance: {FESTIVAL_DEMO_MANIFEST.provenance}</div>
      </div>

      {showSource && (
        <div
          className="absolute inset-0 z-[10000] flex items-center justify-center bg-black/80 p-6"
          onClick={() => setShowSource(false)}
        >
          <div
            className="max-h-[80vh] w-full max-w-3xl overflow-auto rounded border border-cyan-400/40 bg-[#0a0f1c] p-4 text-[12px] text-cyan-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="font-bold">Seed source · {plan.metadata.id}</span>
              <button
                onClick={() => setShowSource(false)}
                className="rounded border border-cyan-400/40 px-2 py-0.5"
              >
                Close
              </button>
            </div>
            <pre className="font-mono text-[11px] leading-snug">
{JSON.stringify(
  {
    metadata: plan.metadata,
    manifest: FESTIVAL_DEMO_MANIFEST,
    counts: {
      pyroCues: plan.pyroCues.length,
      dmxCues: plan.dmxCues.length,
      dronePaths: plan.dronePaths.length,
      modules: plan.hardwareConfig.modules.length,
    },
    firstPyroCue: plan.pyroCues[0],
  },
  null,
  2,
)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
