import { useEffect, useRef, useState } from 'react';
import { Show3DEngine, type PlaybackSnapshot } from '@/lib/showEngine/Show3DEngine';
import type { ShowPlan } from '@/lib/aiShowBuilder/types';
import { engineDiagnostics } from '@/lib/showEngine/EngineDiagnostics';
import type { ViewportState } from '@/lib/showEngine/viewportState';
import ViewportBootingOverlay from './overlays/ViewportBootingOverlay';
import EmptySceneOverlay from './overlays/EmptySceneOverlay';
import ViewportErrorOverlay from './overlays/ViewportErrorOverlay';
import RecoverWebGLOverlay from './overlays/RecoverWebGLOverlay';
import EngineDiagnosticsPanel from './overlays/EngineDiagnosticsPanel';
import ViewportSegmentToolbar, { type ViewportSegmentToolbarOrientation } from '@/features/viewport-tools/components/ViewportSegmentToolbar';
import PlaybackTransportOverlay from './overlays/PlaybackTransportOverlay';

interface Props {
  plan: ShowPlan | null;
  className?: string;
  onRequestGenerate?: () => void;
  showDiagnostics?: boolean;
  /** Accepted for backward compatibility; the dock is always rendered as a
   *  draggable vertical-right glass float in the desktop Mission Control
   *  layout. The prop is ignored and exists only to keep older call-sites
   *  type-safe during the chrome refactor. */
  segmentToolbarOrientation?: ViewportSegmentToolbarOrientation;
  /** When true, do not render the embedded segment toolbar (host page mounts its own). */
  hideSegmentToolbar?: boolean;
  /** Begin auto-playing the show as soon as the plan is ready. Default: true. */
  autoPlay?: boolean;
  /** Hide the bottom Play/Pause/Stop transport overlay. Default: false. */
  hideTransport?: boolean;
}

/**
 * ShowEngineHost — mounts a Show3DEngine into a DOM container and renders
 * overlays for every non-`ready` viewport state. The canvas is never
 * shown alone.
 *
 * Once a plan is loaded, the engine auto-advances `showTime` each RAF
 * frame so Particle Explosions (pyro) and Light Points (drones) fire
 * automatically as the timeline crosses each cue. The bottom transport
 * overlay exposes Play / Pause / Stop and the live time/duration.
 */
export default function ShowEngineHost({
  plan,
  className,
  onRequestGenerate,
  showDiagnostics,
  hideSegmentToolbar = false,
  autoPlay = true,
  hideTransport = false,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Show3DEngine | null>(null);
  const [state, setState] = useState<ViewportState>('booting');
  const [errMsg, setErrMsg] = useState<string | undefined>(undefined);
  const [playback, setPlayback] = useState<PlaybackSnapshot>({
    time: 0,
    duration: 0,
    playing: false,
    rate: 1,
    loop: false,
  });

  useEffect(() => {
    if (!containerRef.current) return;
    const engine = new Show3DEngine();
    engineRef.current = engine;
    const unsubVp = engine.viewport.subscribe(setState);
    const unsubDiag = engineDiagnostics.subscribe((d) => setErrMsg(d.lastError));
    const unsubPb = engine.subscribePlayback(setPlayback);
    engine.init(containerRef.current);
    return () => {
      unsubVp();
      unsubDiag();
      unsubPb();
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  // Load plan whenever it changes; auto-play once ready.
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || !plan) return;
    engine.loadPlan(plan);
    if (autoPlay) engine.play();
  }, [plan, autoPlay]);

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
      {state === 'ready' && !hideSegmentToolbar && <ViewportSegmentToolbar />}
      {state === 'ready' && !hideTransport && plan && (
        <PlaybackTransportOverlay
          snapshot={playback}
          onPlay={() => engineRef.current?.play()}
          onPause={() => engineRef.current?.pause()}
          onStop={() => engineRef.current?.stop()}
          onSeek={(t) => engineRef.current?.seek(t, { mode: 'scrub' })}
          onToggleLoop={() => {
            const e = engineRef.current;
            if (!e) return;
            const next = !playback.loop;
            // reuse play() to update loop flag without restart side-effects
            if (e.isPlaying()) e.play({ loop: next });
            else {
              // Just persist by calling play(loop) then pause to keep state.
              e.play({ loop: next });
              e.pause();
            }
          }}
        />
      )}
    </div>
  );
}

export function getEngineFromHost(): Show3DEngine | null {
  // Helper for tests / debugging.
  return null;
}
