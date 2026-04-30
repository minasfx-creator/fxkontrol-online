/**
 * /dev/skycanvas-smoke — Public dev route to mount SkyCanvas in isolation
 * for E2E QA without auth. Mirrors the editor's mount pattern (Suspense +
 * StudioErrorBoundary + CanvasErrorBoundary) so any boundary catch shows up
 * in __fxkRuntimeMonitor exactly as in production.
 *
 * Not linked from any nav. Safe to ship — no hardware, no ARM, no FIRE.
 */
import { lazy, Suspense, useEffect, useState } from 'react';
import { WebGLErrorBoundary } from '@/components/editor/skycanvas/sharedState';
import StudioErrorBoundary from '@/components/errors/StudioErrorBoundary';
import { lazyRetry } from '@/lib/lazyRetry';

const SkyCanvas = lazy(lazyRetry(() => import('@/components/editor/SkyCanvas')));

export default function SkyCanvasSmoke() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="fixed inset-0 bg-[#050810] text-cyan-200 font-mono">
      <div className="absolute top-2 left-2 z-50 px-2 py-1 rounded border border-cyan-500/30 bg-black/60 text-[11px]">
        SKYCANVAS · SMOKE · t={tick}s · open devtools for diagnostics
      </div>
      <StudioErrorBoundary area="3D viewport (smoke)">
        <WebGLErrorBoundary>
          <Suspense
            fallback={
              <div className="absolute inset-0 grid place-items-center text-cyan-400/70 text-sm">
                Booting SkyCanvas…
              </div>
            }
          >
            <SkyCanvas />
          </Suspense>
        </WebGLErrorBoundary>
      </StudioErrorBoundary>
    </div>
  );
}
