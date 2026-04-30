import { useEffect, useRef, useState } from 'react';
import { Show3DEngine } from '@/lib/showEngine/Show3DEngine';
import type { ShowPlan } from '@/lib/aiShowBuilder/types';
import { engineDiagnostics } from '@/lib/showEngine/EngineDiagnostics';
import type { ViewportState } from '@/lib/showEngine/viewportState';
import ViewportBootingOverlay from './overlays/ViewportBootingOverlay';
import EmptySceneOverlay from './overlays/EmptySceneOverlay';
import ViewportErrorOverlay from './overlays/ViewportErrorOverlay';
import RecoverWebGLOverlay from './overlays/RecoverWebGLOverlay';
import EngineDiagnosticsPanel from './overlays/EngineDiagnosticsPanel';
import ViewportSegmentToolbar, { type ViewportSegmentToolbarOrientation } from '@/features/viewport-tools/components/ViewportSegmentToolbar';

interface Props {
  plan: ShowPlan | null;
  className?: string;
  onRequestGenerate?: () => void;
  showDiagnostics?: boolean;
  /** Layout for the segment toolbar. Defaults to 'horizontal-top' (legacy). */
  segmentToolbarOrientation?: ViewportSegmentToolbarOrientation;
  /** When true, do not render the embedded segment toolbar (host page mounts its own). */
  hideSegmentToolbar?: boolean;
}

/**
 * ShowEngineHost — mounts a Show3DEngine into a DOM container and renders
 * overlays for every non-`ready` viewport state. The canvas is never
 * shown alone.
 */
export default function ShowEngineHost({
  plan,
  className,
  onRequestGenerate,
  showDiagnostics,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Show3DEngine | null>(null);
  const [state, setState] = useState<ViewportState>('booting');
  const [errMsg, setErrMsg] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!containerRef.current) return;
    const engine = new Show3DEngine();
    engineRef.current = engine;
    const unsubVp = engine.viewport.subscribe(setState);
    const unsubDiag = engineDiagnostics.subscribe((d) => setErrMsg(d.lastError));
    engine.init(containerRef.current);
    return () => {
      unsubVp();
      unsubDiag();
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  // Load plan whenever it changes
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || !plan) return;
    engine.loadPlan(plan);
  }, [plan]);

  return (
    <div ref={containerRef} className={`relative w-full h-full bg-[#050810] ${className ?? ''}`}>
      {state === 'booting' && <ViewportBootingOverlay />}
      {state === 'empty' && <EmptySceneOverlay onGenerate={onRequestGenerate} />}
      {state === 'error' && (
        <ViewportErrorOverlay
          message={errMsg}
          onReset={() => engineRef.current?.recoverContext()}
        />
      )}
      {state === 'contextLost' && (
        <RecoverWebGLOverlay onRecover={() => engineRef.current?.recoverContext()} />
      )}
      {showDiagnostics && <EngineDiagnosticsPanel />}
      {state === 'ready' && <ViewportSegmentToolbar />}
    </div>
  );
}

export function getEngineFromHost(): Show3DEngine | null {
  // Helper for tests / debugging.
  return null;
}
