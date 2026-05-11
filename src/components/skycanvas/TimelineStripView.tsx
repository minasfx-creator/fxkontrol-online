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
  const [hoverX, setHoverX] = useState<number | null>(null);
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
  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current; if (!el) return;
    const rect = el.getBoundingClientRect();
    setHoverX(Math.max(0, Math.min(rect.width, e.clientX - rect.left)));
  };
  const onLeave = () => setHoverX(null);

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (e.dataTransfer.types.includes(FXK_EFFECT_DRAG_TYPE)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      setDragOver(true);
      const el = ref.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        setHoverX(Math.max(0, Math.min(rect.width, e.clientX - rect.left)));
      }
    }
  };
  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    const id = e.dataTransfer.getData(FXK_EFFECT_DRAG_TYPE);
    if (!id) return;
    e.preventDefault();
    setDragOver(false);
    setHoverX(null);
    onDropEffect(id, xToTime(e.clientX));
  };

  const pct = duration > 0 ? (time / duration) * 100 : 0;
  const hoverTime = hoverX !== null && ref.current && duration > 0
    ? (hoverX / ref.current.clientWidth) * duration
    : null;
  const hasAudio = !!peaks && peaks.length > 0;
  const hasDuration = duration > 0;
  const hasCues = cueMarkers.length > 0;

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-7 items-center justify-between px-3 border-b border-white/[0.06] gap-2">
        <span className="ds-mono text-[10px] tracking-wider text-cyan-300/80 truncate">
          TIMELINE · {cueMarkers.length} cue{cueMarkers.length === 1 ? '' : 's'}
          {!hasAudio && (
            <span
              className="ml-2 inline-flex items-center gap-1 rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-px text-amber-300 text-[9px] tracking-wider"
              title="Carregue um arquivo MP3/WAV para visualizar a waveform e ancorar cues à música."
            >
              ⚠ SEM ÁUDIO
            </span>
          )}
        </span>
        <span className="ds-mono text-[10px] text-zinc-500 hidden sm:inline truncate">
          {hasDuration
            ? 'FPS 30 · SMPTE 29.97 · arraste efeitos aqui'
            : 'Carregue áudio para definir a duração da timeline'}
        </span>
      </div>
      <div
        ref={ref}
        onClick={onClick}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        onDragOver={onDragOver}
        onDragLeave={() => { setDragOver(false); setHoverX(null); }}
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
          const isSel = selectedCueMarkerId === c.id;
          return (
            <button
              key={c.id}
              onClick={(e) => { e.stopPropagation(); selectCueMarker(c.id); onSeekAbs(c.time); }}
              onDoubleClick={(e) => { e.stopPropagation(); removeCueMarker(c.id); }}
              className={cn(
                'group absolute top-5 bottom-0 -translate-x-1/2 cursor-pointer transition-all',
                isSel ? 'w-[5px] z-10' : 'w-[3px] hover:w-[5px]',
              )}
        <WaveformLayer peaks={peaks} height={80} />

        {/* Empty audio overlay (subtle, non-blocking) */}
        {!hasAudio && (
          <div
            className="pointer-events-none absolute inset-x-0 top-5 bottom-0 flex items-center justify-center"
            aria-hidden
          >
            <div className="ds-mono text-[10px] text-zinc-600 tracking-wider text-center px-4 leading-relaxed">
              <div className="text-zinc-500">Nenhum áudio carregado</div>
              <div className="text-[9px] text-zinc-700 mt-0.5">
                arraste um MP3/WAV ou use o botão de upload da waveform
              </div>
            </div>
          </div>
        )}

        {cueMarkers.map((c) => {
          const left = hasDuration ? (c.time / duration) * 100 : 0;
          const isSel = selectedCueMarkerId === c.id;
          const outOfRange = hasDuration && (c.time < 0 || c.time > duration);
          const invalid = outOfRange || !Number.isFinite(c.time);
          const tooltip = invalid
            ? `⚠ ${c.label} @ ${fmtTime(c.time)} — fora do intervalo da timeline (0–${fmtTime(duration)})`
            : `${c.label} @ ${fmtTime(c.time)} — clique para inspecionar, duplo clique para remover`;
          return (
            <button
              key={c.id}
              onClick={(e) => { e.stopPropagation(); selectCueMarker(c.id); if (!invalid) onSeekAbs(c.time); }}
              onDoubleClick={(e) => { e.stopPropagation(); removeCueMarker(c.id); }}
              className={cn(
                'group absolute top-5 bottom-0 -translate-x-1/2 cursor-pointer transition-all',
                isSel ? 'w-[5px] z-10' : 'w-[3px] hover:w-[5px]',
                invalid && 'animate-pulse',
              )}
              style={{
                left: `${Math.max(0, Math.min(100, left))}%`,
                background: invalid ? 'hsl(0 84% 60%)' : c.color,
                boxShadow: isSel
                  ? `0 0 10px ${invalid ? 'hsl(0 84% 60%)' : c.color}, 0 0 3px hsl(189 94% 70%)`
                  : `0 0 4px ${invalid ? 'hsl(0 84% 60%)' : c.color}`,
                outline: isSel ? '1px solid hsl(189 94% 70%)' : invalid ? '1px solid hsl(0 84% 60%)' : undefined,
              }}
              title={tooltip}
              aria-label={tooltip}
              aria-invalid={invalid || undefined}
              aria-pressed={isSel}
            >
              <span
                className={cn(
                  'absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded px-1 py-px text-[9px] ds-mono transition pointer-events-none',
                  isSel ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
                )}
                style={{ background: invalid ? 'hsl(0 84% 60%)' : c.color, color: '#050810' }}
              >
                {invalid ? '⚠ ' : ''}{c.label}
              </span>
            </button>
          );
        })}

        {/* Hover guide line + timestamp tooltip */}
        {hoverX !== null && hoverTime !== null && (
          <>
            <div
              className="pointer-events-none absolute top-5 bottom-0 w-px bg-cyan-300/40"
              style={{ left: hoverX }}
            />
            <div
              className="pointer-events-none absolute -translate-x-1/2 ds-mono text-[9px] tabular-nums tracking-wider px-1.5 py-0.5 rounded border border-cyan-500/40 bg-[#050810]/95 text-cyan-200 shadow-lg"
              style={{ left: hoverX, bottom: 4 }}
            >
              {fmtTime(hoverTime)}
            </div>
          </>
        )}

        {/* Playhead — only when timeline has duration */}
        {hasDuration && (
          <>
            <div
              className="pointer-events-none absolute top-0 bottom-0 w-px bg-cyan-300"
              style={{ left: `${pct}%`, filter: 'drop-shadow(0 0 6px hsl(189 94% 55% / 0.7))' }}
            />
            <div
              className="pointer-events-none absolute top-0.5 -translate-x-1/2 size-2.5 rotate-45 bg-cyan-300 border border-cyan-100"
              style={{ left: `${pct}%`, filter: 'drop-shadow(0 0 6px hsl(189 94% 55% / 0.8))' }}
            />
          </>
        )}
      </div>
    </div>
  );
}
