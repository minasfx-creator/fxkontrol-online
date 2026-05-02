import { Play, Pause, Square, Repeat } from 'lucide-react';
import type { PlaybackSnapshot } from '@/lib/showEngine/Show3DEngine';

interface Props {
  snapshot: PlaybackSnapshot;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onSeek: (t: number) => void;
  onToggleLoop: () => void;
}

function fmt(t: number): string {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * PlaybackTransportOverlay — bottom transport bar. Uses semantic ds-*
 * tokens / Tailwind utilities only; no hardcoded brand colors so it
 * inherits from the Vantablack/cyan-dessat operational palette.
 */
export default function PlaybackTransportOverlay({
  snapshot,
  onPlay,
  onPause,
  onStop,
  onSeek,
  onToggleLoop,
}: Props) {
  const { time, duration, playing, loop } = snapshot;
  const pct = duration > 0 ? Math.min(100, (time / duration) * 100) : 0;
  return (
    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 pointer-events-auto">
      <div className="flex items-center gap-3 rounded-md border border-border/60 bg-background/70 backdrop-blur px-3 py-2 shadow-lg">
        {playing ? (
          <button
            type="button"
            onClick={onPause}
            aria-label="Pause"
            className="h-8 w-8 inline-flex items-center justify-center rounded hover:bg-foreground/10 text-foreground"
          >
            <Pause className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onPlay}
            aria-label="Play"
            className="h-8 w-8 inline-flex items-center justify-center rounded hover:bg-foreground/10 text-foreground"
          >
            <Play className="h-4 w-4" />
          </button>
        )}
        <button
          type="button"
          onClick={onStop}
          aria-label="Stop"
          className="h-8 w-8 inline-flex items-center justify-center rounded hover:bg-foreground/10 text-foreground"
        >
          <Square className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onToggleLoop}
          aria-label="Toggle loop"
          aria-pressed={loop}
          className={`h-8 w-8 inline-flex items-center justify-center rounded hover:bg-foreground/10 ${
            loop ? 'text-primary' : 'text-foreground/70'
          }`}
        >
          <Repeat className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-2 min-w-[260px]">
          <span className="text-[11px] tabular-nums text-foreground/80 w-10 text-right">
            {fmt(time)}
          </span>
          <input
            type="range"
            min={0}
            max={Math.max(0.1, duration)}
            step={0.05}
            value={time}
            onChange={(e) => onSeek(parseFloat(e.target.value))}
            aria-label="Show time"
            className="flex-1 h-1 accent-primary"
          />
          <span className="text-[11px] tabular-nums text-foreground/60 w-10">
            {fmt(duration)}
          </span>
        </div>

        <div
          className="h-1 w-16 rounded bg-foreground/10 overflow-hidden hidden md:block"
          aria-hidden
        >
          <div
            className="h-full bg-primary transition-[width] duration-100 ease-linear"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
