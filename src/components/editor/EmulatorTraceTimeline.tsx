/**
 * ─── EmulatorTraceTimeline (Wireshark-lite) ────────────────────────
 * Visual TX/RX timeline for the loaded replay trace. Shows direction
 * lanes, time axis, replay cursor and lets the user click frames to
 * inspect their payload. Dev-only.
 */
import { useMemo, useRef, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

export interface TraceFrame {
  dir: 'tx' | 'rx';
  data: string;
  at: number;
}

interface Props {
  frames: ReadonlyArray<TraceFrame>;
  cursor: number;     // index of next frame to deliver
  state: 'idle' | 'running' | 'paused';
  /** Indices that pass the active filter — others render dimmed. */
  filteredIndices?: ReadonlyArray<number>;
  /** Index of last frame that hit a breakpoint (highlighted). */
  breakpointIndex?: number | null;
  onSeek?: (index: number) => void;
  onInspect?: (index: number) => void;
}

const LANE_HEIGHT = 18;
const TIMELINE_HEIGHT = LANE_HEIGHT * 2 + 22;

export default function EmulatorTraceTimeline({ frames, cursor, state, onSeek }: Props) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(600);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setWidth(Math.max(200, e.contentRect.width));
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  const { t0, t1, totalMs } = useMemo(() => {
    if (frames.length === 0) return { t0: 0, t1: 0, totalMs: 0 };
    const a = frames[0].at;
    const b = frames[frames.length - 1].at;
    return { t0: a, t1: b, totalMs: Math.max(1, b - a) };
  }, [frames]);

  const x = (at: number) => ((at - t0) / totalMs) * (width - 8) + 4;

  const cursorX = useMemo(() => {
    if (frames.length === 0 || cursor <= 0) return 4;
    const idx = Math.min(cursor, frames.length) - 1;
    return x(frames[idx].at);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor, frames, width, totalMs]);

  return (
    <div ref={wrapRef} className="w-full font-mono">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[7px] text-muted-foreground uppercase tracking-widest">
          Wire Timeline · {frames.length} frames · {(totalMs / 1000).toFixed(2)}s
        </span>
        <span className="text-[7px] text-muted-foreground">
          {hover !== null ? `[${frames[hover]?.dir.toUpperCase()}] ${frames[hover]?.data.slice(0, 80)}` : ''}
        </span>
      </div>

      <svg width={width} height={TIMELINE_HEIGHT} className="block">
        {/* Lanes */}
        <rect x={0} y={4} width={width} height={LANE_HEIGHT} fill="hsl(var(--muted) / 0.15)" />
        <rect x={0} y={6 + LANE_HEIGHT} width={width} height={LANE_HEIGHT} fill="hsl(var(--muted) / 0.10)" />
        <text x={4} y={4 + LANE_HEIGHT - 5} fontSize="7" fill="hsl(var(--muted-foreground))">TX</text>
        <text x={4} y={6 + LANE_HEIGHT * 2 - 5} fontSize="7" fill="hsl(var(--muted-foreground))">RX</text>

        {/* Frame markers */}
        {frames.map((f, i) => {
          const fx = x(f.at);
          const fy = f.dir === 'tx' ? 4 + LANE_HEIGHT / 2 : 6 + LANE_HEIGHT + LANE_HEIGHT / 2;
          const past = i < cursor;
          const color = f.dir === 'tx' ? 'hsl(190 95% 55%)' : 'hsl(150 85% 50%)';
          return (
            <circle
              key={i}
              cx={fx}
              cy={fy}
              r={hover === i ? 4 : 2.5}
              fill={color}
              opacity={past ? 0.35 : 1}
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onClick={() => onSeek?.(i)}
            />
          );
        })}

        {/* Cursor line */}
        {frames.length > 0 && (
          <line
            x1={cursorX} x2={cursorX}
            y1={2} y2={LANE_HEIGHT * 2 + 10}
            stroke={state === 'running' ? 'hsl(48 95% 55%)' : 'hsl(0 0% 60%)'}
            strokeWidth={1}
            strokeDasharray={state === 'paused' ? '2 2' : undefined}
          />
        )}

        {/* Time axis */}
        <line x1={0} x2={width} y1={LANE_HEIGHT * 2 + 12} y2={LANE_HEIGHT * 2 + 12} stroke="hsl(var(--border))" strokeWidth={0.5} />
        <text x={2} y={LANE_HEIGHT * 2 + 20} fontSize="6" fill="hsl(var(--muted-foreground))">0ms</text>
        <text x={width - 32} y={LANE_HEIGHT * 2 + 20} fontSize="6" fill="hsl(var(--muted-foreground))">
          {totalMs.toFixed(0)}ms
        </text>
      </svg>

      <div className={cn('text-[7px] uppercase tracking-widest mt-0.5',
        state === 'running' ? 'text-amber-400' : state === 'paused' ? 'text-muted-foreground' : 'text-muted-foreground/60')}>
        {state}
      </div>
    </div>
  );
}
