/**
 * GlassTimelineDock — Timeline canônica glassmorphism do editor SkyCanvas.
 *
 * Plano: Show / Experience. ZERO CommandBus / FieldBus / SafetyStateMachine.
 * Reutiliza 100% de tecnologia existente:
 *   - Transport      → TransportBarLegacy (legacy-2604)
 *   - Waveform       → WaveformLayer + decodeAudioPeaks
 *   - Cue ruler      → TimelineStripView (drop FXK_EFFECT_DRAG_TYPE)
 *   - Lanes          → GlassTimelineLanes (wrapper de FiringLanesTimelineLegacy)
 *   - Sync           → useProjectStore.currentTime (clock master = audio)
 *
 * Layout (200px alt total, colapsável):
 *   ┌─ glass-pane-strong, blur-2xl, Vantablack 55%
 *   │  ┌ 32px  Transport pill + timecode + speed
 *   │  ├ 80px  Waveform + cue ruler (TimelineStripView)
 *   │  └ 88px  5 lanes (Pyro/SFX/Drone/Light/DMX compact via legacy split)
 *   └─
 *
 * Cores: cyan-dessat 190 70% 58% (canônico). Sem laranja-CTA.
 */
import { useCallback, useMemo } from 'react';
import { useProjectStore } from '@/store/useProjectStore';
import { resolveEffectLedAccurate } from '@/data/effectsLibraries/resolveEffect';
import { EFFECT_LIBRARY } from '@/data/effectLibrary';
import TimelineStripView from '@/components/skycanvas/TimelineStripView';
import GlassTimelineLanes from '@/components/skycanvas/timeline/GlassTimelineLanes';
import { TransportBarLegacy } from '@/components/skycanvas/legacy-2604/TransportAndLanesLegacy';
import { cn } from '@/lib/utils';

export interface GlassTimelineDockProps {
  /** Audio peaks (decoded via decodeAudioPeaks). null ⇒ sem waveform. */
  peaks: Float32Array | null;
  /** Altura total do dock em px. Default 200. */
  height?: number;
  /** Compact ⇒ esconde lanes (só transport+ruler). Default false. */
  compact?: boolean;
  className?: string;
}

export default function GlassTimelineDock({
  peaks,
  height = 200,
  compact = false,
  className,
}: GlassTimelineDockProps) {
  const time = useProjectStore((s) => s.currentTime);
  const duration = useProjectStore((s) => s.duration);
  const isPlaying = useProjectStore((s) => s.isPlaying);
  const speed = useProjectStore((s) => s.playbackSpeed);
  const setCurrentTime = useProjectStore((s) => s.setCurrentTime);
  const setPlaying = useProjectStore((s) => s.setPlaying);
  const setPlaybackSpeed = useProjectStore((s) => s.setPlaybackSpeed);

  const togglePlay = useCallback(() => setPlaying(!isPlaying), [isPlaying, setPlaying]);
  const stop = useCallback(() => { setPlaying(false); setCurrentTime(0); }, [setPlaying, setCurrentTime]);
  const seekDelta = useCallback((d: number) => {
    if (!Number.isFinite(d)) {
      setCurrentTime(d > 0 ? duration : 0);
    } else {
      setCurrentTime(Math.max(0, Math.min(duration, time + d)));
    }
  }, [duration, time, setCurrentTime]);
  const seekAbs = useCallback((t: number) => {
    setCurrentTime(Math.max(0, Math.min(duration, t)));
  }, [duration, setCurrentTime]);

  const dropEffect = useCallback((effectId: string, t: number, laneHint?: 'pyro' | 'drone') => {
    const fx = resolveEffectLedAccurate(effectId) ?? EFFECT_LIBRARY.find((e) => e.id === effectId);
    if (!fx) return;
    const baseLabel = `${fx.icon ?? '✦'} ${fx.name}`;
    const label = laneHint === 'drone' && !baseLabel.toLowerCase().includes('drone')
      ? `${baseLabel} · drone`
      : baseLabel;
    useProjectStore.getState().addCueMarker({
      id: `cue-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      time: Math.max(0, Math.min(duration, t)),
      label,
      color: fx.color,
    });
  }, [duration]);

  const stripProps = useMemo(() => ({
    time, duration, peaks,
    onSeekAbs: seekAbs,
    onDropEffect: (id: string, t: number) => dropEffect(id, t),
  }), [time, duration, peaks, seekAbs, dropEffect]);

  return (
    <div
      className={cn(
        'pointer-events-auto select-none',
        'glass-pane glass-pane-strong',
        'border-t border-cyan-500/10',
        'shadow-[0_-8px_32px_rgba(0,0,0,0.6)]',
        'flex flex-col overflow-hidden',
        className,
      )}
      style={{
        height,
        background: 'rgba(5, 8, 16, 0.55)',
        backdropFilter: 'blur(20px) saturate(140%)',
        WebkitBackdropFilter: 'blur(20px) saturate(140%)',
      }}
      aria-label="Timeline glassmorphism"
    >
      {/* Transport */}
      <div className="shrink-0 [&>div]:!bg-transparent [&>div]:!border-t-0">
        <TransportBarLegacy
          playing={isPlaying}
          onTogglePlay={togglePlay}
          onStop={stop}
          onSeek={seekDelta}
          time={time}
          duration={duration}
          rate={speed}
          onRateChange={setPlaybackSpeed}
        />
      </div>

      {/* Waveform + cue ruler */}
      <div className="relative flex-1 min-h-0 border-t border-white/[0.04]">
        <TimelineStripView {...stripProps} />
      </div>

      {/* Lanes (oculto em compact) */}
      {!compact && (
        <div className="shrink-0 border-t border-white/[0.04]" style={{ height: 88 }}>
          <GlassTimelineLanes
            duration={duration}
            time={time}
            onDropEffect={dropEffect}
          />
        </div>
      )}
    </div>
  );
}
