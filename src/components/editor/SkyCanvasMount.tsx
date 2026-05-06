/**
 * SkyCanvasMount — Single canonical mount for the SkyCanvas 3D viewport.
 *
 * Boundary stack (proven in production):
 *   StudioErrorBoundary → WebGLErrorBoundary → Suspense → <Engine />
 *
 * Engine selection (Round 7 consolidation):
 *   - 'auto'   (default): respects the `skycanvas_v2` feature flag, falls
 *               back to the legacy editor SkyCanvas if v2 throws fatally.
 *   - 'v2'     : forces SkyCanvas2 (modular Show Plane). Forwards
 *               SkyCanvas2Props via the optional `v2Props` bag (memoized
 *               by callers).
 *   - 'legacy' : forces the heavy `components/editor/SkyCanvas` engine.
 *
 * One lazy chunk per engine, shared across all callers — eliminates the
 * 3 duplicated SkyCanvas2 lazy roots that lived in `pages/SkyCanvas.tsx`,
 * `UE5BridgePage.tsx` and the previous version of this file.
 *
 * Plano: Show/Experience. Nada de CommandBus, FieldBus ou SafetyStateMachine.
 */
import { lazy, memo, Suspense, useEffect, useState, type ReactNode } from 'react';
import { lazyRetry } from '@/lib/lazyRetry';
import { WebGLErrorBoundary } from '@/components/editor/skycanvas/sharedState';
import StudioErrorBoundary from '@/components/errors/StudioErrorBoundary';
import CanvasLoaderWithTimeout from '@/components/editor/CanvasLoaderWithTimeout';
import { isSkycanvasV2Enabled } from '@/lib/featureFlags';
import type { SkyCanvas2Props } from '@/components/show3d/v2/types';

// Single lazy roots — every consumer shares these chunks.
const SkyCanvasLegacy = lazy(lazyRetry(() => import('@/components/editor/SkyCanvas')));
const SkyCanvas2 = lazy(lazyRetry(() => import('@/components/show3d/v2/SkyCanvas2')));

export type SkyCanvasEngine = 'auto' | 'v2' | 'legacy';

export interface SkyCanvasMountProps {
  /** Distinguishing key for unmount/remount cycles. */
  instanceKey?: string;
  /** Boundary area label for diagnostics. Default: '3D viewport'. */
  area?: string;
  /** Suspense timeout (ms). Default: 8000. */
  loaderTimeoutMs?: number;
  /** Suspense loader label. Default: 'Loading 3D Engine…'. */
  loaderLabel?: string;
  /** Engine selection. Default: 'auto' (flag-driven, with legacy fallback). */
  engine?: SkyCanvasEngine;
  /** Props forwarded to SkyCanvas2 when engine resolves to v2. Memoize at
   *  the call site to avoid spurious re-renders of the heavy canvas tree. */
  v2Props?: SkyCanvas2Props;
  /** Optional siblings rendered alongside the canvas (overlays etc). */
  children?: ReactNode;
}

function SkyCanvasMountImpl({
  instanceKey,
  area = '3D viewport',
  loaderTimeoutMs = 8000,
  loaderLabel = 'Loading 3D Engine…',
  engine = 'auto',
  v2Props,
  children,
}: SkyCanvasMountProps) {
  // Resolve which engine actually mounts. In 'auto', we honour the flag
  // and let a fatal SkyCanvas2 error demote us to the legacy engine
  // without a page reload (operator-friendly).
  const [resolved, setResolved] = useState<'v2' | 'legacy'>(() => {
    if (engine === 'v2') return 'v2';
    if (engine === 'legacy') return 'legacy';
    return isSkycanvasV2Enabled() ? 'v2' : 'legacy';
  });

  useEffect(() => {
    if (engine === 'v2') setResolved('v2');
    else if (engine === 'legacy') setResolved('legacy');
    else setResolved(isSkycanvasV2Enabled() ? 'v2' : 'legacy');
  }, [engine, instanceKey]);

  return (
    <StudioErrorBoundary area={area}>
      <WebGLErrorBoundary>
        <Suspense fallback={<CanvasLoaderWithTimeout timeoutMs={loaderTimeoutMs} label={loaderLabel} />}>
          {resolved === 'v2' ? (
            <SkyCanvas2
              key={`v2-${instanceKey ?? 'default'}`}
              {...(v2Props ?? {})}
              onFatalError={() => {
                if (engine === 'auto') setResolved('legacy');
              }}
            />
          ) : (
            <SkyCanvasLegacy key={`legacy-${instanceKey ?? 'default'}`} />
          )}
        </Suspense>
      </WebGLErrorBoundary>
      {children}
    </StudioErrorBoundary>
  );
}

// Memoized — protects the heavy 3D tree from parent re-renders that
// don't change the actual mount inputs. v2Props identity matters: callers
// MUST useMemo it (documented above).
const SkyCanvasMount = memo(SkyCanvasMountImpl);
export default SkyCanvasMount;
