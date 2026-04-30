/**
 * SkyCanvasMount — Unified mount for the SkyCanvas 3D viewport.
 *
 * Adotado a partir do padrão de /dev/skycanvas-smoke (que provou ser
 * o caminho mais robusto em produção):
 *
 *   StudioErrorBoundary  →  WebGLErrorBoundary  →  Suspense  →  SkyCanvas
 *
 * - StudioErrorBoundary: captura crashes React acima do canvas.
 * - WebGLErrorBoundary:  fallback gracioso (SimplifiedSkyFallback) quando
 *                         a inicialização do WebGL falha; ANTES o editor
 *                         usava um CanvasErrorBoundary local que mostrava
 *                         tela técnica de erro — ruim para o operador.
 * - Suspense:            usa CanvasLoaderWithTimeout (8s) em vez do
 *                         spinner minimalista do smoke, pra evitar trap
 *                         de spinner infinito após HMR/deploy stale.
 *
 * Drop-in replacement das 3 montagens duplicadas em src/pages/Index.tsx
 * (mobile live, mobile design, desktop) e do mount de SkyCanvasSmoke.
 *
 * Nada de hardware aqui — é só presentation. Não muda contratos do
 * SkyCanvas, do CommandBus, nem da SafetyStateMachine.
 */
import { lazy, Suspense, type ReactNode } from 'react';
import { lazyRetry } from '@/lib/lazyRetry';
import { WebGLErrorBoundary } from '@/components/editor/skycanvas/sharedState';
import StudioErrorBoundary from '@/components/errors/StudioErrorBoundary';
import CanvasLoaderWithTimeout from '@/components/editor/CanvasLoaderWithTimeout';

// SkyCanvas deferido com lazyRetry — chunk stale após deploy/HMR é
// retentado uma vez antes de bubbling para o LazyChunkBoundary global.
const SkyCanvas = lazy(lazyRetry(() => import('@/components/editor/SkyCanvas')));

export interface SkyCanvasMountProps {
  /** Distinguishing key: 'desktop', 'mobile', 'mobile-live', 'smoke', etc. */
  instanceKey?: string;
  /** Boundary area label for diagnostics. Default: '3D viewport'. */
  area?: string;
  /** Suspense timeout (ms). Default: 8000. */
  loaderTimeoutMs?: number;
  /** Suspense loader label. Default: 'Loading 3D Engine...'. */
  loaderLabel?: string;
  /** Optional siblings rendered alongside the canvas (overlays etc). */
  children?: ReactNode;
}

export default function SkyCanvasMount({
  instanceKey,
  area = '3D viewport',
  loaderTimeoutMs = 8000,
  loaderLabel = 'Loading 3D Engine...',
  children,
}: SkyCanvasMountProps) {
  return (
    <StudioErrorBoundary area={area}>
      <WebGLErrorBoundary>
        <Suspense
          fallback={
            <CanvasLoaderWithTimeout
              timeoutMs={loaderTimeoutMs}
              label={loaderLabel}
            />
          }
        >
          <SkyCanvas key={instanceKey} />
        </Suspense>
      </WebGLErrorBoundary>
      {children}
    </StudioErrorBoundary>
  );
}
