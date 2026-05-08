/**
 * TimelineStripView — extracted from SkyCanvas.tsx so it can be reused
 * as a tab body inside TabbedDockPanel (Timeline · Cues).
 * Pure presentation; reads cue markers from the project store.
 */
import { useRef, useState } from 'react';
import { useProjectStore } from '@/store/useProjectStore';
import { FXK_EFFECT_DRAG_TYPE } from '@/components/editor/EffectLibrarySidebar';
import WaveformLayer from '@/components/skycanvas/WaveformLayer';
import { cn } from '@/lib/utils';
import type { TimelineStripProps } from './timelineStripTypes';

function fmtTime(s: number) {
  const sign = s < 0 ? '-' : '';
  const a = Math.abs(s);
  const mm = Math.floor(a / 60).toString().padStart(2, '0');
  const ss = Math.floor(a % 60).toString().padStart(2, '0');
  const ff = Math.floor((a % 1) * 30).toString().padStart(2, '0');
  return `${sign}${mm}:${ss}:${ff}`;
}

export default function TimelineStripView({
  time, duration, onSeekAbs, onDropEffect, peaks,
}: TimelineStripProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const cueMarkers = useProjectStore((s) => s.cueMarkers);
  const removeCueMarker = useProjectStore((s) => s.removeCueMarker);
  const selectCueMarker = useProjectStore((s) => s.selectCueMarker);
  const selectedCueMarkerId = useProjectStore((s) => s.selectedCueMarkerId);

  const xToTime = (clientX: number) => {
    const el = ref.current; if (!el) return 0;
    const rect = el.getBoundingClientRect();
    return Math.max(0, Math.min(duration, ((clientX - rect.left) / rect.width) * duration));
  };
  const onClick = (e: React.MouseEvent<HTMLDivElement>) => onSeekAbs(xToTime(e.clientX));
  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (e.dataTransfer.types.includes(FXK_EFFECT_DRAG_TYPE)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      setDragOver(true);
    }
  };
  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    const id = e.dataTransfer.getData(FXK_EFFECT_DRAG_TYPE);
    if (!id) return;
    e.preventDefault();
    setDragOver(false);
    onDropEffect(id, xToTime(e.clientX));
  };

  const pct = duration > 0 ? (time / duration) * 100 : 0;
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-7 items-center justify-between px-3 border-b border-white/[0.06]">
        <span className="ds-mono text-[10px] tracking-wider text-cyan-300/80">
          TIMELINE · {cueMarkers.length} cue{cueMarkers.length === 1 ? '' : 's'}
        </span>
        <span className="ds-mono text-[10px] text-zinc-500 hidden sm:inline">
          FPS 30 · SMPTE 29.97 · arraste efeitos aqui
        </span>
      </div>
      <div
        ref={ref}
        onClick={onClick}
        onDragOver={onDragOver}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={cn(
          'relative flex-1 cursor-crosshair transition-colors duration-200',
          dragOver && 'bg-cyan-500/[0.08] ring-1 ring-inset ring-cyan-400/40',
        )}
        role="slider"
        aria-label="Timeline"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(time)}
      >
        <div className="absolute inset-x-0 top-0 h-5 border-b border-white/[0.06] flex">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="flex-1 border-l border-white/[0.04] ds-mono text-[9px] text-zinc-500 pl-1">
              {fmtTime((duration / 12) * i).slice(0, 5)}
            </div>
          ))}
        </div>
        <WaveformLayer peaks={peaks} height={80} />

        {cueMarkers.map((c) => {
          const left = duration > 0 ? (c.time / duration) * 100 : 0;
          return (
            <button
              key={c.id}
              onClick={(e) => { e.stopPropagation(); onSeekAbs(c.time); }}
              onDoubleClick={(e) => { e.stopPropagation(); removeCueMarker(c.id); }}
              className="group absolute top-5 bottom-0 w-[3px] -translate-x-1/2 cursor-pointer hover:w-[4px]"
              style={{ left: `${left}%`, background: c.color }}
              title={`${c.label} @ ${fmtTime(c.time)} — duplo clique para remover`}
              aria-label={`Cue ${c.label} aos ${fmtTime(c.time)}`}
            >
              <span
                className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded px-1 py-px text-[9px] ds-mono opacity-0 group-hover:opacity-100 transition"
                style={{ background: c.color, color: '#050810' }}
              >
                {c.label}
              </span>
            </button>
          );
        })}
        <div
          className="pointer-events-none absolute top-0 bottom-0 w-px bg-cyan-300"
          style={{ left: `${pct}%`, filter: 'drop-shadow(0 0 4px hsl(189 94% 55% / 0.6))' }}
        />
        <div
          className="pointer-events-none absolute top-0 -translate-x-1/2 size-2 rotate-45 bg-cyan-300"
          style={{ left: `${pct}%`, filter: 'drop-shadow(0 0 4px hsl(189 94% 55% / 0.6))' }}
        />
      </div>
    </div>
  );
}
