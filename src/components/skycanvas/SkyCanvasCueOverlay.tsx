/**
 * SkyCanvasCueOverlay — Transparent ShowEngineHost overlay that sits on
 * top of the SkyCanvas viewport and fires Particle Explosions (pyro/
 * formation) and Light Points (drone) whenever the audio master clock
 * crosses a cue from `useProjectStore.cueMarkers`.
 *
 * Pipeline:
 *   audio.currentTime → useAudioMasterClock → timelineClock
 *     → useProjectStore.currentTime → useShow3DEngineSync(engine, true)
 *     → engine.seek(t, 'playback') → applyCue() → effectsLayer.add(...)
 *
 * Renderer is created with `transparent: true`, helpers/static layer
 * hidden, container is `pointer-events-none` so the host SkyCanvas keeps
 * orbit/pan/zoom controls. ZERO CommandBus / FieldBus / SafetyStateMachine.
 */
import { useMemo } from 'react';
import { useProjectStore } from '@/store/useProjectStore';
import ShowEngineHost from '@/components/show-engine/ShowEngineHost';
import { cueMarkersToEnginePlan } from '@/lib/showEngine/cueMarkersToEnginePlan';

export interface SkyCanvasCueOverlayProps {
  className?: string;
}

export default function SkyCanvasCueOverlay({ className }: SkyCanvasCueOverlayProps) {
  const cueMarkers = useProjectStore((s) => s.cueMarkers);
  const duration = useProjectStore((s) => s.duration);

  // Memoize the engine plan by a deterministic fingerprint of cue
  // identities + times + durations + lanes, so the engine doesn't reload
  // on unrelated store updates (currentTime, isPlaying, etc).
  const fingerprint = useMemo(() => {
    return cueMarkers
      .map((c) => `${c.id}:${c.time.toFixed(3)}:${c.durationSec ?? ''}:${c.lane ?? ''}:${c.effectId ?? ''}`)
      .join('|') + `#${duration}`;
  }, [cueMarkers, duration]);

  const plan = useMemo(
    () => cueMarkersToEnginePlan(cueMarkers, { duration, id: `skycanvas-live-${fingerprint.length}` }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fingerprint],
  );

  const engineOptions = useMemo(
    () => ({ transparent: true, hideHelpers: true, hideStaticLayer: true }),
    [],
  );

  return (
    <div
      className={`absolute inset-0 pointer-events-none ${className ?? ''}`}
      aria-hidden
    >
      <ShowEngineHost
        plan={plan}
        externalClock
        autoPlay={false}
        hideTransport
        hideSegmentToolbar
        transparentHost
        engineOptions={engineOptions}
      />
    </div>
  );
}
