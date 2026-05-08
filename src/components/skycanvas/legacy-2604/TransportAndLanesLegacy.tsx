/**
 * Legacy-2604 transport bar + firing lanes + JOI FAB.
 * Visual-only. Reads cues from useProjectStore.
 */
import { useMemo, useRef, useState } from 'react';
import { Play, Pause, Square, SkipBack, SkipForward, ZoomIn, ZoomOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProjectStore } from '@/store/useProjectStore';

function fmtTime(s: number) {
  const a = Math.max(0, s);
  const mm = Math.floor(a / 60).toString().padStart(2, '0');
  const ss = Math.floor(a % 60).toString().padStart(2, '0');
  const cs = Math.floor((a % 1) * 100).toString().padStart(2, '0');
  return `${mm}:${ss}.${cs}`;
}

export function TransportBarLegacy({
  playing, onTogglePlay, onStop, onSeek, time, duration, rate, onRateChange,
}: {
  playing: boolean;
  onTogglePlay: () => void;
  onStop: () => void;
  onSeek: (delta: number) => void;
  time: number;
  duration: number;
  rate: number;
  onRateChange: (r: number) => void;
}) {
  const cuesCount = useProjectStore((s) => s.cueMarkers.length);
  return (
    <div className="h-12 px-3 flex items-center gap-3 bg-zinc-950/85 border-t border-cyan-500/10">
      <button type="button" onClick={() => onSeek(-Infinity)} aria-label="Início"
        className="h-8 w-8 rounded-md flex items-center justify-center text-zinc-400 hover:text-cyan-200 hover:bg-white/[0.05] ds-focus">
        <SkipBack className="h-4 w-4" />
      </button>
      <button type="button" onClick={onTogglePlay} aria-label={playing ? 'Pausar' : 'Tocar'}
        className={cn('h-9 w-9 rounded-full flex items-center justify-center border ds-focus transition-colors',
          playing ? 'bg-amber-500/20 text-amber-200 border-amber-500/40'
                  : 'bg-cyan-500/20 text-cyan-100 border-cyan-500/40')}>
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </button>
      <button type="button" onClick={onStop} aria-label="Parar"
        className="h-8 w-8 rounded-md flex items-center justify-center text-zinc-400 hover:text-rose-300 hover:bg-rose-500/10 ds-focus">
        <Square className="h-4 w-4" />
      </button>
      <button type="button" onClick={() => onSeek(Infinity)} aria-label="Fim"
        className="h-8 w-8 rounded-md flex items-center justify-center text-zinc-400 hover:text-cyan-200 hover:bg-white/[0.05] ds-focus">
        <SkipForward className="h-4 w-4" />
      </button>

      <div className="ds-mono text-[12px] text-amber-300 tabular-nums px-2">
        {fmtTime(time)}
        <span className="text-zinc-500 mx-1">/</span>
        <span className="text-zinc-400">{fmtTime(duration)}</span>
      </div>

      <div className="flex-1" />

      {/* Rate segmented */}
      <div className="flex items-center gap-1 bg-zinc-900/70 rounded-md p-0.5 border border-white/5">
        <span className="ds-mono text-[10px] text-amber-300 px-2">{rate.toFixed(1)}x</span>
        {[0.5, 1, 2].map((r) => (
          <button key={r} type="button" onClick={() => onRateChange(r)}
            className={cn('h-6 px-2 rounded ds-mono text-[10px] transition-colors ds-focus',
              rate === r ? 'bg-amber-500/20 text-amber-200' : 'text-zinc-500 hover:text-zinc-300')}>
            {r}x
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1">
        <button type="button" aria-label="Zoom out" className="h-7 w-7 rounded-md flex items-center justify-center text-zinc-400 hover:text-cyan-200 hover:bg-white/[0.05] ds-focus">
          <ZoomOut className="h-3.5 w-3.5" />
        </button>
        <span className="ds-mono text-[10px] text-zinc-500">100%</span>
        <button type="button" aria-label="Zoom in" className="h-7 w-7 rounded-md flex items-center justify-center text-zinc-400 hover:text-cyan-200 hover:bg-white/[0.05] ds-focus">
          <ZoomIn className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="ds-mono text-[10px] text-zinc-500 px-2">{cuesCount} cues</div>
    </div>
  );
}

const FXK_EFFECT_DRAG_TYPE = 'application/x-fxk-effect';

export type LaneKind = 'pyro' | 'drone' | 'formation';

/** Classify a cue label into one of the 3 firing lanes.
 *  Labels carry a trailing tag (· drone / · formation) added by the
 *  drop handler in GlassTimelineDock. Heuristic fallback covers
 *  legacy cues without tags. */
export function classifyCueLane(label: string): LaneKind {
  const l = (label || '').toLowerCase();
  if (l.includes('· formation') || l.includes('formation') || l.includes('formação') || l.includes('formacao')) return 'formation';
  if (l.includes('· drone') || l.includes('drone') || l.includes('move')) return 'drone';
  return 'pyro';
}

export function FiringLanesTimelineLegacy({
  duration, time, onDropEffect,
}: {
  duration: number;
  time: number;
  onDropEffect?: (effectId: string, t: number, lane: LaneKind) => void;
}) {
  const cues = useProjectStore((s) => s.cueMarkers);
  const { pyro, drone, formation } = useMemo(() => {
    const p: typeof cues = [];
    const d: typeof cues = [];
    const f: typeof cues = [];
    cues.forEach((c) => {
      const lane = classifyCueLane(c.label || '');
      if (lane === 'formation') f.push(c);
      else if (lane === 'drone') d.push(c);
      else p.push(c);
    });
    return { pyro: p, drone: d, formation: f };
  }, [cues]);

  const ticks = useMemo(() => {
    const out: number[] = [];
    const step = duration <= 30 ? 5 : duration <= 120 ? 10 : 30;
    for (let t = 0; t <= duration; t += step) out.push(t);
    return out;
  }, [duration]);

  const playheadPct = duration > 0 ? (time / duration) * 100 : 0;

  return (
    <div className="flex-1 px-3 py-2 bg-zinc-950/60 border-t border-white/[0.05] overflow-hidden">
      <div className="ds-mono text-[10px] uppercase tracking-wider text-cyan-300/80 mb-2">Firing Systems</div>
      <Lane label="PYRO SYS" color="#FF7700" cues={pyro} duration={duration}
        onDropEffect={onDropEffect ? (id, t) => onDropEffect(id, t, 'pyro') : undefined} />
      <Lane label="DRONE SYS" color="#22d3ee" cues={drone} duration={duration}
        onDropEffect={onDropEffect ? (id, t) => onDropEffect(id, t, 'drone') : undefined} />
      <Lane label="FORMATIONS" color="#a78bfa" cues={formation} duration={duration}
        onDropEffect={onDropEffect ? (id, t) => onDropEffect(id, t, 'formation') : undefined} />
      <div className="relative mt-1.5 h-4 ml-24">
        {ticks.map((t) => (
          <div key={t} className="absolute top-0 ds-mono text-[9px] text-zinc-600 -translate-x-1/2"
               style={{ left: `${(t / duration) * 100}%` }}>
            {fmtTime(t).slice(0, 5)}
          </div>
        ))}
        <div className="absolute top-0 bottom-0 w-px bg-amber-400 pointer-events-none" style={{ left: `${playheadPct}%` }} />
      </div>
    </div>
  );
}

function Lane({ label, color, cues, duration, onDropEffect }:
  { label: string; color: string; cues: { id: string; time: number; label: string }[]; duration: number;
    onDropEffect?: (effectId: string, t: number) => void }) {
  const [hoverPct, setHoverPct] = useState<number | null>(null);
  const [isOver, setIsOver] = useState(false);
  const trackRef = useRef<HTMLDivElement | null>(null);

  const pctFromEvent = (e: React.DragEvent<HTMLDivElement>) => {
    const r = trackRef.current?.getBoundingClientRect();
    if (!r || r.width <= 0) return 0;
    return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
  };

  return (
    <div className="flex items-center gap-2 mb-1">
      <div className="w-24 flex items-center gap-1.5 shrink-0">
        <span className="h-2 w-2 rounded-full" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
        <span className="ds-mono text-[9px] uppercase text-zinc-400 tracking-wider">{label}</span>
      </div>
      <div
        ref={trackRef}
        className={cn(
          'flex-1 h-6 relative rounded bg-black/40 border overflow-hidden transition-colors',
          isOver ? 'border-cyan-400/60 bg-cyan-500/[0.06]' : 'border-white/[0.04]',
        )}
        onDragOver={(e) => {
          if (!onDropEffect) return;
          if (!e.dataTransfer.types.includes(FXK_EFFECT_DRAG_TYPE)
              && !e.dataTransfer.types.includes('text/plain')) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
          setIsOver(true);
          setHoverPct(pctFromEvent(e));
        }}
        onDragLeave={() => { setIsOver(false); setHoverPct(null); }}
        onDrop={(e) => {
          if (!onDropEffect) return;
          const id = e.dataTransfer.getData(FXK_EFFECT_DRAG_TYPE)
                  || e.dataTransfer.getData('text/plain');
          if (!id) return;
          e.preventDefault();
          const pct = pctFromEvent(e);
          onDropEffect(id, pct * duration);
          setIsOver(false);
          setHoverPct(null);
        }}
      >
        {cues.map((c) => (
          <div key={c.id} title={`${c.label} · ${fmtTime(c.time)}`}
            className="absolute top-0 bottom-0 w-1 rounded-sm transition-opacity"
            style={{ left: `${(c.time / duration) * 100}%`, background: color, boxShadow: `0 0 4px ${color}` }} />
        ))}
        {hoverPct !== null && (
          <div className="absolute top-0 bottom-0 w-px bg-cyan-300 pointer-events-none"
               style={{ left: `${hoverPct * 100}%` }} />
        )}
      </div>
    </div>
  );
}

export function JoiAvatarFab({ onClick }: { onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="JOI Assistant"
      className="fixed bottom-4 right-4 z-40 h-16 w-16 rounded-full bg-gradient-to-br from-cyan-500/30 to-violet-500/30 border-2 border-cyan-400/50 backdrop-blur-md shadow-[0_0_24px_-4px_rgba(34,211,238,0.5)] hover:scale-105 transition-transform ds-focus flex items-center justify-center"
      style={{ marginRight: 'calc(env(safe-area-inset-right, 0px))' }}
    >
      <span className="ds-mono text-[10px] tracking-wider text-cyan-200">JOI</span>
    </button>
  );
}
