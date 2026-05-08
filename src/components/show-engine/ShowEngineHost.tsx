import { useEffect, useRef, useState } from 'react';
import { Show3DEngine, type PlaybackSnapshot, type Show3DEngineOptions } from '@/lib/showEngine/Show3DEngine';
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
import { useShow3DEngineSync } from '@/hooks/useShow3DEngineSync';

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
  /**
   * When true, the engine follows `useProjectStore.currentTime` (driven by
   * `timelineClock` / audio master) instead of running its own auto-advance.
   * Required in the main editor so the 3D viewport stays locked to the audio
   * waveform when the operator clicks Play on the timeline. When this is on,
   * `autoPlay` and the embedded transport overlay are ignored.
   */
  externalClock?: boolean;
  /** Forwarded to the Show3DEngine constructor (transparent overlay etc). */
  engineOptions?: Show3DEngineOptions;
  /** When true, do not paint the host container background (overlay mode). */
  transparentHost?: boolean;
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
  externalClock = false,
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

  // Load plan whenever it changes; auto-play once ready (only when the
  // engine owns its own clock — in externalClock mode the project store
  // drives playback via useShow3DEngineSync below).
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || !plan) return;
    engine.loadPlan(plan);
    if (autoPlay && !externalClock) engine.play();
  }, [plan, autoPlay, externalClock]);

  // External-clock bridge: while enabled, the project store (timelineClock /
  // audio master) becomes the sole driver of `showTime`. The engine's
  // internal RAF auto-advance is gated off; cues fire via explicit seek().
  useShow3DEngineSync(engineRef, externalClock);


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
      {state === 'ready' && !hideTransport && !externalClock && plan && (
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
