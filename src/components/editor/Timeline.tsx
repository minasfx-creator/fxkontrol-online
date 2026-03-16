import React, { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward, Square, Trash2, ZoomIn, ZoomOut, Magnet, Copy, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useProjectStore, EFFECT_LIBRARY } from '@/store/useProjectStore';
import { getPreFireTime } from '@/lib/safetyEngine';
import { cn } from '@/lib/utils';
import AudioWaveform from './AudioWaveform';
import PyroTimelineTrack from './PyroTimelineTrack';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
}

function snapTimeToBeat(time: number, bpm: number | null, snapEnabled: boolean, pixelsPerSecond: number): number {
  if (!snapEnabled || !bpm) return time;
  const beatInterval = 60 / bpm;
  const nearestBeat = Math.round(time / beatInterval) * beatInterval;
  const threshold = 8 / pixelsPerSecond;
  return Math.abs(time - nearestBeat) < threshold ? nearestBeat : time;
}

function BeatGrid({ duration, pixelsPerSecond, bpm }: { duration: number; pixelsPerSecond: number; bpm: number | null }) {
  if (!bpm) return null;
  const beatInterval = 60 / bpm;
  const lines = [];
  for (let t = 0; t < duration; t += beatInterval) {
    const isMeasure = Math.round(t / beatInterval) % 4 === 0;
    lines.push(
      <div
        key={t}
        className="absolute top-0 bottom-0 pointer-events-none"
        style={{
          left: `${t * pixelsPerSecond}px`,
          width: '1px',
          backgroundColor: isMeasure ? 'hsl(var(--accent) / 0.2)' : 'hsl(var(--accent) / 0.06)',
        }}
      />
    );
  }
  return <>{lines}</>;
}

function TimeRuler({ duration, pixelsPerSecond }: { duration: number; pixelsPerSecond: number }) {
  const marks = [];
  let step: number;
  if (pixelsPerSecond >= 40) step = 1;
  else if (pixelsPerSecond >= 15) step = 2;
  else if (pixelsPerSecond >= 8) step = 5;
  else step = 10;
  const labelStep = step <= 2 ? 5 : 10;

  for (let i = 0; i <= duration; i += step) {
    const isMajor = i % labelStep === 0;
    marks.push(
      <div key={i} className="absolute top-0 flex flex-col items-center" style={{ left: `${i * pixelsPerSecond}px` }}>
        <div className={cn("w-px", isMajor ? "h-3.5 bg-muted-foreground/30" : "h-2 bg-border/30")} />
        {isMajor && <span className="text-[8px] font-mono text-muted-foreground/40 mt-0.5 tabular-nums">{formatTime(i)}</span>}
      </div>
    );
  }
  return <div className="relative h-5 border-b border-border/5">{marks}</div>;
}

// --- Draggable Timeline Item ---
function DraggableTimelineItem({
  item, effect, pixelsPerSecond, isSelected, isMultiSelected, onSelect, onDragStart,
}: {
  item: any; effect: any; pixelsPerSecond: number; isSelected: boolean; isMultiSelected: boolean;
  onSelect: (e: React.MouseEvent) => void; onDragStart: (e: React.MouseEvent, itemId: string) => void;
}) {
  const pft = effect.type === 'firework' ? getPreFireTime(effect.name) : 0;
  const pftPx = pft * pixelsPerSecond;
  const widthPx = Math.max(effect.duration * pixelsPerSecond, 28);

  return (
    <div className="absolute top-0.5" style={{ left: `${item.startTime * pixelsPerSecond}px` }}>
      {pft > 0 && (
        <div
          className="absolute h-7 rounded-l-md border-l border-dashed border-warning/20"
          style={{ left: `-${pftPx}px`, width: `${pftPx}px`, background: 'hsl(var(--warning) / 0.04)' }}
          title={`Pre-Fire: ${pft.toFixed(1)}s`}
        />
      )}
      <button
        onClick={onSelect}
        onMouseDown={(e) => { if (e.button === 0) onDragStart(e, item.id); }}
        className={cn(
          "h-7 rounded-md flex items-center px-1.5 text-[9px] font-medium transition-all cursor-grab active:cursor-grabbing border group",
          isSelected
            ? "border-primary/60 shadow-[0_0_10px_hsl(var(--primary)/0.2)] z-10 ring-1 ring-primary/15"
            : isMultiSelected
              ? "border-primary/25 z-10"
              : "border-white/[0.04] hover:border-white/[0.08] hover:shadow-sm"
        )}
        style={{
          width: `${widthPx}px`,
          background: isSelected
            ? `linear-gradient(135deg, ${effect.color}28, ${effect.color}15)`
            : `${effect.color}12`,
          backdropFilter: 'blur(8px)',
        }}
      >
        <GripVertical className="w-2 h-2 text-muted-foreground/15 group-hover:text-muted-foreground/30 mr-0.5 flex-shrink-0 transition-colors" />
        <div className="w-[3px] h-4 rounded-full mr-1.5 flex-shrink-0" style={{ backgroundColor: effect.color, boxShadow: `0 0 6px ${effect.color}55` }} />
        <div className="flex flex-col items-start min-w-0 overflow-hidden">
          <span className="truncate text-foreground/75 leading-tight text-[9px]">{effect.name}</span>
          {item.positionName && (
            <span className="truncate text-[7px] text-muted-foreground/40 leading-tight">📍 {item.positionName}</span>
          )}
        </div>
      </button>
    </div>
  );
}

function TimelineTrackRow({
  label, trackIndex, pixelsPerSecond, color, duration, scrollRef,
}: {
  label: string; trackIndex: number; pixelsPerSecond: number; color: string; duration: number;
  scrollRef: React.RefObject<HTMLDivElement>;
}) {
  const { 
    timelineItems, selectedTimelineItemId, selectTimelineItem, addTimelineItem, 
    bpm, snapToBeat, updateTimelineItem, selectedTimelineItemIds, toggleTimelineItemSelection,
    positions, selectedPositionId, selectedPositionIds,
  } = useProjectStore();
  const [isDragOver, setIsDragOver] = useState(false);
  const items = timelineItems.filter((i) => i.trackIndex === trackIndex);
  const dragState = useRef<{ itemId: string; startX: number; startTime: number } | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    const effectId = e.dataTransfer.types.includes('application/effect-id');
    if (!effectId || trackIndex === 2) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, [trackIndex]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('application/effect-id') || trackIndex === 2) return;
    e.preventDefault();
    setIsDragOver(true);
  }, [trackIndex]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const effectId = e.dataTransfer.getData('application/effect-id');
    if (!effectId) return;
    const effect = EFFECT_LIBRARY.find((ef) => ef.id === effectId);
    if (!effect) return;
    if (effect.type === 'firework' && trackIndex !== 0) return;
    if (effect.type === 'drone' && trackIndex !== 1) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    let time = Math.max(0, Math.min(x / pixelsPerSecond, duration));
    time = snapTimeToBeat(time, bpm, snapToBeat, pixelsPerSecond);

    const targetIds = selectedPositionIds.length > 0
      ? selectedPositionIds.filter(id => positions.find(p => p.id === id)?.type === 'pyro')
      : selectedPositionId && positions.find(p => p.id === selectedPositionId)?.type === 'pyro'
        ? [selectedPositionId]
        : [];

    if (targetIds.length > 0) {
      targetIds.forEach((posId, i) => {
        const pos = positions.find(p => p.id === posId);
        if (!pos) return;
        addTimelineItem({
          id: `tl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${i}`,
          effectId: effect.id, startTime: time, trackIndex,
          position: { x: pos.x, y: pos.y, z: pos.z },
          positionId: posId, positionIds: targetIds.length > 1 ? targetIds : undefined, positionName: pos.name,
        });
      });
    } else {
      addTimelineItem({
        id: `tl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        effectId: effect.id, startTime: time, trackIndex,
        position: { x: (Math.random() - 0.5) * 16, y: effect.type === 'firework' ? 0 : 5 + Math.random() * 10, z: (Math.random() - 0.5) * 8 },
      });
    }
  }, [pixelsPerSecond, duration, trackIndex, addTimelineItem, bpm, snapToBeat, positions, selectedPositionId, selectedPositionIds]);

  const handleItemDragStart = useCallback((e: React.MouseEvent, itemId: string) => {
    const item = timelineItems.find(i => i.id === itemId);
    if (!item) return;
    dragState.current = { itemId, startX: e.clientX, startTime: item.startTime };
    const handleMove = (me: MouseEvent) => {
      if (!dragState.current) return;
      const dx = me.clientX - dragState.current.startX;
      const dt = dx / pixelsPerSecond;
      let newTime = Math.max(0, Math.min(dragState.current.startTime + dt, duration));
      newTime = snapTimeToBeat(newTime, bpm, snapToBeat, pixelsPerSecond);
      updateTimelineItem(dragState.current.itemId, { startTime: newTime });
    };
    const handleUp = () => { dragState.current = null; window.removeEventListener('mousemove', handleMove); window.removeEventListener('mouseup', handleUp); };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  }, [timelineItems, pixelsPerSecond, duration, bpm, snapToBeat, updateTimelineItem]);

  const handleItemSelect = useCallback((e: React.MouseEvent, itemId: string) => {
    e.stopPropagation();
    if (e.shiftKey || e.ctrlKey || e.metaKey) { toggleTimelineItemSelection(itemId); } else { selectTimelineItem(itemId); }
  }, [selectTimelineItem, toggleTimelineItemSelection]);

  return (
    <div className="flex border-b border-white/[0.03]">
      <div className="w-24 flex-shrink-0 flex items-center px-2.5 border-r border-white/[0.04]" style={{ background: 'hsl(var(--card))' }}>
        <div className="w-1.5 h-1.5 rounded-full mr-2 flex-shrink-0" style={{ backgroundColor: color, boxShadow: `0 0 4px ${color}55` }} />
        <span className="text-[9px] font-semibold text-muted-foreground/50 uppercase tracking-[0.08em]">{label}</span>
      </div>
      <div
        className={cn("flex-1 relative h-8 transition-colors", isDragOver && "ring-1 ring-primary/30 bg-primary/[0.03]")}
        style={{ background: 'hsl(var(--background) / 0.4)' }}
        onDragOver={handleDragOver} onDragEnter={handleDragEnter} onDragLeave={handleDragLeave} onDrop={handleDrop}
      >
        {items.map((item) => {
          const effect = EFFECT_LIBRARY.find((e) => e.id === item.effectId);
          if (!effect) return null;
          return (
            <DraggableTimelineItem
              key={item.id} item={item} effect={effect} pixelsPerSecond={pixelsPerSecond}
              isSelected={selectedTimelineItemId === item.id}
              isMultiSelected={selectedTimelineItemIds.includes(item.id)}
              onSelect={(e) => handleItemSelect(e, item.id)}
              onDragStart={handleItemDragStart}
            />
          );
        })}
      </div>
    </div>
  );
}

function WaypointTrackRow({ pixelsPerSecond, duration }: { pixelsPerSecond: number; duration: number }) {
  const { trajectories, positions, selectedTrajectoryId, selectTrajectory } = useProjectStore();
  const wpEvents = useMemo(() => {
    return trajectories.flatMap((traj) => {
      const pad = positions.find((p) => p.id === traj.positionId);
      if (!pad) return [];
      const sorted = [...traj.waypoints].sort((a, b) => a.time - b.time);
      return sorted.map((wp, i) => ({ wp, traj, pad, index: i, nextWp: sorted[i + 1] }));
    });
  }, [trajectories, positions]);

  return (
    <div className="flex border-b border-white/[0.03]">
      <div className="w-24 flex-shrink-0 flex items-center px-2.5 border-r border-white/[0.04]" style={{ background: 'hsl(var(--card))' }}>
        <div className="w-1.5 h-1.5 rounded-full mr-2 bg-[#FFD700]" style={{ boxShadow: '0 0 4px #FFD70055' }} />
        <span className="text-[9px] font-semibold text-muted-foreground/50 uppercase tracking-[0.08em]">Waypoints</span>
      </div>
      <div className="flex-1 relative h-8" style={{ background: 'hsl(var(--background) / 0.4)' }}>
        {wpEvents.map(({ wp, traj, pad, index, nextWp }) => {
          const isSelected = selectedTrajectoryId === traj.id;
          const endTime = nextWp ? nextWp.time : wp.time + 1;
          const widthPx = Math.max((endTime - wp.time) * pixelsPerSecond, 14);
          return (
            <button
              key={wp.id}
              onClick={(e) => { e.stopPropagation(); selectTrajectory(traj.id); }}
              className={cn(
                "absolute top-0.5 h-7 rounded-md flex items-center px-1 text-[8px] font-mono transition-all cursor-pointer border",
                isSelected ? "border-primary/50 shadow-[0_0_6px_hsl(var(--primary)/0.15)] z-10" : "border-white/[0.04] hover:border-white/[0.08]"
              )}
              style={{ left: `${wp.time * pixelsPerSecond}px`, width: `${widthPx}px`, backgroundColor: `${pad.color || '#00B4D8'}15` }}
            >
              <div className="w-[2px] h-full rounded-full mr-0.5 flex-shrink-0" style={{ backgroundColor: pad.color || '#00B4D8' }} />
              <span className="truncate text-muted-foreground/60">WP{index + 1}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FormationTrackRow({ pixelsPerSecond, duration }: { pixelsPerSecond: number; duration: number }) {
  const { droneFormations, selectFormation, selectedFormationId } = useProjectStore();
  if (droneFormations.length === 0) return null;

  return (
    <div className="flex border-b border-white/[0.03]">
      <div className="w-24 flex-shrink-0 flex items-center px-2.5 border-r border-white/[0.04]" style={{ background: 'hsl(var(--card))' }}>
        <div className="w-1.5 h-1.5 rounded-full mr-2 bg-[#7B68EE]" style={{ boxShadow: '0 0 4px #7B68EE55' }} />
        <span className="text-[9px] font-semibold text-muted-foreground/50 uppercase tracking-[0.08em]">Formações</span>
      </div>
      <div className="flex-1 relative h-8" style={{ background: 'hsl(var(--background) / 0.4)' }}>
        {droneFormations.map((f, i) => {
          const totalDuration = f.transitionDuration + f.holdDuration;
          const widthPx = Math.max(totalDuration * pixelsPerSecond, 20);
          const isSelected = selectedFormationId === f.id;
          const preset = FORMATION_PRESETS_MAP[f.formationType];
          return (
            <button
              key={f.id}
              onClick={(e) => { e.stopPropagation(); selectFormation(f.id); }}
              className={cn(
                "absolute top-0.5 h-7 rounded-md flex items-center px-1.5 text-[8px] font-mono transition-all cursor-pointer border",
                isSelected ? "border-primary/50 shadow-[0_0_6px_hsl(var(--primary)/0.15)] z-10" : "border-white/[0.04] hover:border-white/[0.08]"
              )}
              style={{ left: `${f.startTime * pixelsPerSecond}px`, width: `${widthPx}px`, backgroundColor: `${f.color}15` }}
            >
              <div className="w-[2px] h-full rounded-full mr-1 flex-shrink-0" style={{ backgroundColor: f.color }} />
              <span className="truncate text-muted-foreground/60">{preset || f.formationType} #{i + 1}</span>
              <div
                className="absolute top-0 h-full border-r border-dashed opacity-20"
                style={{ left: `${f.transitionDuration * pixelsPerSecond}px`, borderColor: f.color }}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

const FORMATION_PRESETS_MAP: Record<string, string> = {
  heart: '❤️', star: '⭐', circle: '⭕', grid: '⊞',
  wave: '🌊', spiral: '🌀', line: '➖', 'v-shape': '✌️',
};

// ── DRONE FX Track — only visible when formations exist ──
function DroneFXTrackRow({ pixelsPerSecond, duration }: { pixelsPerSecond: number; duration: number }) {
  const { droneFormations, timelineItems, selectedTimelineItemId, selectTimelineItem, addTimelineItem, bpm, snapToBeat } = useProjectStore();
  
  const droneFxItems = useMemo(() => timelineItems.filter((i) => i.trackIndex === 3), [timelineItems]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    const hasEffect = e.dataTransfer.types.includes('application/effect-id');
    if (!hasEffect) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const effectId = e.dataTransfer.getData('application/effect-id');
    if (!effectId) return;
    const effect = EFFECT_LIBRARY.find((ef) => ef.id === effectId);
    if (!effect || effect.type !== 'drone') return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    let time = Math.max(0, Math.min(x / pixelsPerSecond, duration));
    time = snapTimeToBeat(time, bpm, snapToBeat, pixelsPerSecond);

    addTimelineItem({
      id: `tl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      effectId: effect.id, startTime: time, trackIndex: 3,
      position: { x: 0, y: 20, z: 0 },
    });
  }, [pixelsPerSecond, duration, addTimelineItem, bpm, snapToBeat]);

  if (droneFormations.length === 0) return null;

  return (
    <div className="flex border-b border-white/[0.03]">
      <div className="w-24 flex-shrink-0 flex items-center px-2.5 border-r border-white/[0.04]" style={{ background: 'hsl(var(--card))' }}>
        <div className="w-1.5 h-1.5 rounded-full mr-2 bg-[#00E5FF]" style={{ boxShadow: '0 0 4px #00E5FF55' }} />
        <span className="text-[9px] font-semibold text-muted-foreground/50 uppercase tracking-[0.08em]">Drone FX</span>
      </div>
      <div
        className="flex-1 relative h-8"
        style={{ background: 'hsl(var(--background) / 0.4)' }}
        onDragOver={handleDragOver} onDrop={handleDrop}
      >
        {droneFormations.map((f) => {
          const totalDuration = f.transitionDuration + f.holdDuration;
          const widthPx = Math.max(totalDuration * pixelsPerSecond, 20);
          return (
            <div key={`bg-${f.id}`} className="absolute top-0 h-full opacity-[0.06] pointer-events-none rounded-sm"
              style={{ left: `${f.startTime * pixelsPerSecond}px`, width: `${widthPx}px`, backgroundColor: f.color }} />
          );
        })}
        {droneFxItems.map((item) => {
          const effect = EFFECT_LIBRARY.find((e) => e.id === item.effectId);
          if (!effect) return null;
          const isSelected = selectedTimelineItemId === item.id;
          return (
            <button
              key={item.id}
              onClick={(e) => { e.stopPropagation(); selectTimelineItem(item.id); }}
              className={cn(
                "absolute top-0.5 h-7 rounded-md flex items-center px-1.5 text-[8px] font-mono transition-all cursor-pointer border",
                isSelected ? "border-primary/50 shadow-[0_0_6px_hsl(var(--primary)/0.15)] z-10" : "border-white/[0.04] hover:border-white/[0.08]"
              )}
              style={{ left: `${item.startTime * pixelsPerSecond}px`, width: `${Math.max(effect.duration * pixelsPerSecond, 20)}px`, backgroundColor: `${effect.color}15` }}
            >
              <div className="w-[2px] h-full rounded-full mr-1 flex-shrink-0" style={{ backgroundColor: effect.color }} />
              <span className="truncate text-muted-foreground/60">{effect.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const MIN_PPS = 4;
const MAX_PPS = 80;

export default function Timeline() {
  const {
    isPlaying, setPlaying, currentTime, setCurrentTime, duration,
    selectedTimelineItemId, removeTimelineItem, timelineItems,
    playbackSpeed, setPlaybackSpeed, bpm, snapToBeat, setSnapToBeat,
    selectedTimelineItemIds, clearTimelineItemSelection, duplicateTimelineItems, removeMultipleTimelineItems,
  } = useProjectStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [pixelsPerSecond, setPixelsPerSecond] = useState(12);

  const totalCost = useMemo(() => {
    return timelineItems.reduce((sum, item) => {
      const effect = EFFECT_LIBRARY.find((e) => e.id === item.effectId);
      return sum + (effect?.cost ?? 0);
    }, 0);
  }, [timelineItems]);

  const selectionCount = selectedTimelineItemIds.length + (selectedTimelineItemId && !selectedTimelineItemIds.includes(selectedTimelineItemId) ? 1 : 0);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const rect = el.getBoundingClientRect();
        const mouseX = e.clientX - rect.left + el.scrollLeft - 96;
        const timeAtCursor = mouseX / pixelsPerSecond;
        setPixelsPerSecond((prev) => {
          const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
          const next = Math.min(MAX_PPS, Math.max(MIN_PPS, prev * factor));
          requestAnimationFrame(() => {
            if (scrollRef.current) {
              const newX = timeAtCursor * next + 96;
              scrollRef.current.scrollLeft = newX - (e.clientX - rect.left);
            }
          });
          return next;
        });
      }
    };
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [pixelsPerSecond]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === ' ') { e.preventDefault(); setPlaying(!isPlaying); }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedTimelineItemIds.length > 0) { removeMultipleTimelineItems(selectedTimelineItemIds); }
        else if (selectedTimelineItemId) { removeTimelineItem(selectedTimelineItemId); }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        const ids = selectedTimelineItemIds.length > 0 ? selectedTimelineItemIds : selectedTimelineItemId ? [selectedTimelineItemId] : [];
        if (ids.length > 0) duplicateTimelineItems(ids);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        const allIds = timelineItems.map(i => i.id);
        allIds.forEach(id => useProjectStore.getState().toggleTimelineItemSelection(id));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, selectedTimelineItemId, selectedTimelineItemIds, timelineItems]);

  const handleTrackClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const scrollLeft = scrollRef.current?.scrollLeft ?? 0;
      const x = e.clientX - rect.left + scrollLeft - 96;
      if (x < 0) return;
      let time = Math.max(0, Math.min(x / pixelsPerSecond, duration));
      time = snapTimeToBeat(time, bpm, snapToBeat, pixelsPerSecond);
      setCurrentTime(time);
      if (!e.shiftKey && !e.ctrlKey && !e.metaKey) clearTimelineItemSelection();
    },
    [duration, pixelsPerSecond, setCurrentTime, bpm, snapToBeat, clearTimelineItemSelection]
  );

  const handleDeleteSelected = () => {
    if (selectedTimelineItemIds.length > 0) { removeMultipleTimelineItems(selectedTimelineItemIds); }
    else if (selectedTimelineItemId) { removeTimelineItem(selectedTimelineItemId); }
  };

  const handleDuplicate = () => {
    const ids = selectedTimelineItemIds.length > 0 ? selectedTimelineItemIds : selectedTimelineItemId ? [selectedTimelineItemId] : [];
    if (ids.length > 0) duplicateTimelineItems(ids);
  };

  const zoomIn = () => setPixelsPerSecond((p) => Math.min(MAX_PPS, p * 1.3));
  const zoomOut = () => setPixelsPerSecond((p) => Math.max(MIN_PPS, p / 1.3));
  const zoomPercent = Math.round((pixelsPerSecond / 12) * 100);

  // Progress percentage for the scrubber
  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex flex-col h-full border-t border-white/[0.04]" style={{ background: 'hsl(var(--card) / 0.95)', backdropFilter: 'blur(20px)' }}>
      {/* ─── Transport Bar ─── */}
      <div className="flex items-center gap-1 px-2.5 py-1 border-b border-white/[0.04]">
        {/* Play controls */}
        <div className="flex items-center gap-px rounded-lg p-px" style={{ background: 'hsl(var(--muted) / 0.15)' }}>
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md hover:bg-white/[0.06]" onClick={() => setCurrentTime(0)}>
            <SkipBack className="h-3 w-3 text-muted-foreground" />
          </Button>
          <Button
            variant="ghost" size="icon"
            className={cn("h-8 w-8 rounded-md transition-all", isPlaying ? "bg-primary/12 text-primary" : "hover:bg-white/[0.06]")}
            onClick={() => setPlaying(!isPlaying)}
          >
            {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 ml-0.5" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md hover:bg-white/[0.06]" onClick={() => setPlaying(false)}>
            <Square className="h-2.5 w-2.5 text-muted-foreground" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md hover:bg-white/[0.06]" onClick={() => setCurrentTime(Math.min(currentTime + 10, duration))}>
            <SkipForward className="h-3 w-3 text-muted-foreground" />
          </Button>
        </div>

        {/* Timecode — large mono display */}
        <div className="px-3 py-0.5 rounded-lg border border-white/[0.04]" style={{ background: 'hsl(var(--background) / 0.5)' }}>
          <span className="font-mono text-[13px] text-primary font-bold tabular-nums tracking-tight">{formatTime(currentTime)}</span>
          <span className="text-muted-foreground/20 text-[10px] mx-1">/</span>
          <span className="font-mono text-[13px] text-muted-foreground/35 tabular-nums tracking-tight">{formatTime(duration)}</span>
        </div>

        {/* Speed */}
        <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg" style={{ background: 'hsl(var(--muted) / 0.1)' }}>
          <span className="text-[8px] font-mono text-muted-foreground/40 w-6 text-right tabular-nums">{playbackSpeed.toFixed(playbackSpeed < 1 ? 2 : 1)}x</span>
          <input
            type="range" min={0.1} max={2} step={0.05} value={playbackSpeed}
            onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
            className="w-14 h-0.5 accent-primary rounded-full appearance-none cursor-pointer bg-white/[0.06] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-2 [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:rounded-full"
          />
          {[0.5, 1].map((s) => (
            <button
              key={s}
              className={cn("text-[7px] font-mono px-1 py-0.5 rounded transition-all",
                Math.abs(playbackSpeed - s) < 0.01 ? "bg-primary/12 text-primary" : "text-muted-foreground/30 hover:text-muted-foreground/50")}
              onClick={() => setPlaybackSpeed(s)}
            >{s}x</button>
          ))}
        </div>

        <div className="w-px h-4 bg-white/[0.04] mx-0.5" />

        {/* Zoom */}
        <div className="flex items-center gap-0 rounded-lg p-px" style={{ background: 'hsl(var(--muted) / 0.1)' }}>
          <Button variant="ghost" size="icon" className="h-6 w-6 rounded-md hover:bg-white/[0.06]" onClick={zoomOut}><ZoomOut className="h-2.5 w-2.5 text-muted-foreground/50" /></Button>
          <span className="text-[8px] font-mono text-muted-foreground/35 w-7 text-center tabular-nums">{zoomPercent}%</span>
          <Button variant="ghost" size="icon" className="h-6 w-6 rounded-md hover:bg-white/[0.06]" onClick={zoomIn}><ZoomIn className="h-2.5 w-2.5 text-muted-foreground/50" /></Button>
        </div>

        {/* Beat snap */}
        <button
          className={cn("flex items-center gap-1 text-[8px] font-mono px-1.5 py-0.5 rounded-lg transition-all",
            snapToBeat ? "bg-accent/10 text-accent" : "text-muted-foreground/25 hover:text-muted-foreground/40")}
          onClick={() => setSnapToBeat(!snapToBeat)}
          style={!snapToBeat ? { background: 'hsl(var(--muted) / 0.1)' } : undefined}
        >
          <Magnet className="h-2.5 w-2.5" />
          {bpm && <span className="tabular-nums">{bpm}</span>}
        </button>

        {/* Multi-select */}
        {selectionCount > 1 && (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-primary/[0.06] border border-primary/10">
            <span className="text-[8px] font-mono text-primary font-semibold">{selectionCount} sel</span>
            <Button variant="ghost" size="icon" className="h-5 w-5 rounded" onClick={handleDuplicate}><Copy className="h-2.5 w-2.5" /></Button>
          </div>
        )}

        <div className="flex-1" />

        {/* Stats */}
        <div className="flex items-center gap-2.5 text-[9px] font-mono text-muted-foreground/30 mr-1">
          <span><span className="text-foreground/50">{timelineItems.length}</span> cues</span>
          <span className="text-accent/50">${totalCost.toFixed(0)}</span>
        </div>

        <Button
          variant="ghost" size="icon"
          className="h-6 w-6 rounded-md text-muted-foreground/20 hover:text-destructive hover:bg-destructive/8"
          onClick={handleDeleteSelected}
          disabled={!selectedTimelineItemId && selectedTimelineItemIds.length === 0}
        >
          <Trash2 className="h-2.5 w-2.5" />
        </Button>
      </div>

      {/* ─── Mini progress bar ─── */}
      <div className="h-[2px] w-full relative" style={{ background: 'hsl(var(--muted) / 0.08)' }}>
        <div className="h-full bg-primary/40 transition-[width] duration-75" style={{ width: `${progressPct}%` }} />
      </div>

      {/* ─── Timeline tracks ─── */}
      <div ref={scrollRef} className="flex-1 overflow-x-auto overflow-y-auto" onClick={handleTrackClick}>
        <div style={{ width: `${duration * pixelsPerSecond + 96}px` }}>
          <div className="flex">
            <div className="w-24 flex-shrink-0" />
            <div className="flex-1 relative">
              <TimeRuler duration={duration} pixelsPerSecond={pixelsPerSecond} />
              <BeatGrid duration={duration} pixelsPerSecond={pixelsPerSecond} bpm={bpm} />
              {/* Playhead */}
              <div className="absolute top-0 bottom-0 w-px z-20 pointer-events-none" style={{ left: `${currentTime * pixelsPerSecond}px` }}>
                <div className="w-2 h-2 bg-primary rounded-full -translate-x-[3px] -translate-y-px shadow-[0_0_8px_hsl(var(--primary)/0.4)]" />
                <div className="absolute top-0 w-px h-full bg-gradient-to-b from-primary via-primary/30 to-transparent" />
              </div>
            </div>
          </div>
          <FormationTrackRow pixelsPerSecond={pixelsPerSecond} duration={duration} />
          <DroneFXTrackRow pixelsPerSecond={pixelsPerSecond} duration={duration} />
          <PyroTimelineTrack pixelsPerSecond={pixelsPerSecond} duration={duration} />
          <TimelineTrackRow label="PYRO SYS" trackIndex={0} pixelsPerSecond={pixelsPerSecond} color="#FF6B35" duration={duration} scrollRef={scrollRef} />
          <WaypointTrackRow pixelsPerSecond={pixelsPerSecond} duration={duration} />
          <AudioWaveform pixelsPerSecond={pixelsPerSecond} />
        </div>
      </div>
    </div>
  );
}
