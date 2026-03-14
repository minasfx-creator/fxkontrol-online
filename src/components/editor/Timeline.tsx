import { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward, Square, Trash2, ZoomIn, ZoomOut, Magnet, Copy, Scissors, GripVertical } from 'lucide-react';
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
          backgroundColor: isMeasure ? 'hsla(24, 95%, 53%, 0.25)' : 'hsla(24, 95%, 53%, 0.08)',
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
        <div className={cn("w-px", isMajor ? "h-3 bg-muted-foreground/60" : "h-2 bg-border/60")} />
        {isMajor && <span className="text-[9px] font-mono-code text-muted-foreground mt-0.5">{formatTime(i)}</span>}
      </div>
    );
  }
  return <div className="relative h-5 border-b border-border">{marks}</div>;
}

// --- Draggable Timeline Item ---
function DraggableTimelineItem({
  item,
  effect,
  pixelsPerSecond,
  isSelected,
  isMultiSelected,
  onSelect,
  onDragStart,
}: {
  item: any;
  effect: any;
  pixelsPerSecond: number;
  isSelected: boolean;
  isMultiSelected: boolean;
  onSelect: (e: React.MouseEvent) => void;
  onDragStart: (e: React.MouseEvent, itemId: string) => void;
}) {
  const pft = effect.type === 'firework' ? getPreFireTime(effect.name) : 0;
  const pftPx = pft * pixelsPerSecond;

  return (
    <div className="absolute top-1" style={{ left: `${item.startTime * pixelsPerSecond}px` }}>
      {pft > 0 && (
        <div
          className="absolute h-8 rounded-l-sm bg-warning/10 border-l-2 border-warning/40"
          style={{ left: `-${pftPx}px`, width: `${pftPx}px` }}
          title={`Pre-Fire: ${pft.toFixed(1)}s`}
        >
          <span className="text-[7px] font-mono-code text-warning/60 absolute bottom-0 left-0.5">PFT</span>
        </div>
      )}
      <button
        onClick={onSelect}
        onMouseDown={(e) => {
          if (e.button === 0) onDragStart(e, item.id);
        }}
        className={cn(
          "h-8 rounded-sm flex items-center px-1.5 text-[10px] font-medium transition-all cursor-grab active:cursor-grabbing border group",
          isSelected
            ? "border-primary shadow-[0_0_8px_hsl(var(--electric)/0.3)] z-10"
            : isMultiSelected
              ? "border-primary/40 bg-primary/5 z-10"
              : "border-transparent hover:border-border"
        )}
        style={{
          width: `${Math.max(effect.duration * pixelsPerSecond, 20)}px`,
          backgroundColor: `${effect.color}22`,
        }}
      >
        <GripVertical className="w-2 h-2 text-muted-foreground/40 group-hover:text-muted-foreground mr-0.5 flex-shrink-0" />
        <div className="w-1 h-full rounded-full mr-1 flex-shrink-0" style={{ backgroundColor: effect.color }} />
        <div className="flex flex-col items-start min-w-0 overflow-hidden">
          <span className="truncate text-secondary-foreground leading-tight">{effect.name}</span>
          {item.positionName && (
            <span className="truncate text-[7px] text-muted-foreground leading-tight">📍 {item.positionName}</span>
          )}
        </div>
      </button>
    </div>
  );
}

function TimelineTrackRow({
  label,
  trackIndex,
  pixelsPerSecond,
  color,
  duration,
  scrollRef,
}: {
  label: string;
  trackIndex: number;
  pixelsPerSecond: number;
  color: string;
  duration: number;
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

    // Finale logic: link to selected pyro positions
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
          effectId: effect.id,
          startTime: time,
          trackIndex,
          position: { x: pos.x, y: pos.y, z: pos.z },
          positionId: posId,
          positionIds: targetIds.length > 1 ? targetIds : undefined,
          positionName: pos.name,
        });
      });
    } else {
      addTimelineItem({
        id: `tl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        effectId: effect.id,
        startTime: time,
        trackIndex,
        position: {
          x: (Math.random() - 0.5) * 16,
          y: effect.type === 'firework' ? 0 : 5 + Math.random() * 10,
          z: (Math.random() - 0.5) * 8,
        },
      });
    }
  }, [pixelsPerSecond, duration, trackIndex, addTimelineItem, bpm, snapToBeat, positions, selectedPositionId, selectedPositionIds]);

  // --- Item drag to reposition ---
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

    const handleUp = () => {
      dragState.current = null;
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  }, [timelineItems, pixelsPerSecond, duration, bpm, snapToBeat, updateTimelineItem]);

  const handleItemSelect = useCallback((e: React.MouseEvent, itemId: string) => {
    e.stopPropagation();
    if (e.shiftKey || e.ctrlKey || e.metaKey) {
      toggleTimelineItemSelection(itemId);
    } else {
      selectTimelineItem(itemId);
    }
  }, [selectTimelineItem, toggleTimelineItemSelection]);

  return (
    <div className="flex border-b border-border/50">
      <div className="w-28 flex-shrink-0 flex items-center px-3 border-r border-border/50 bg-surface-1">
        <div className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: color }} />
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
      </div>
      <div
        className={cn(
          "flex-1 relative h-10 bg-surface-0/50 transition-colors",
          isDragOver && "ring-1 ring-primary/50 bg-primary/5"
        )}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {items.map((item) => {
          const effect = EFFECT_LIBRARY.find((e) => e.id === item.effectId);
          if (!effect) return null;
          const isSelected = selectedTimelineItemId === item.id;
          const isMultiSelected = selectedTimelineItemIds.includes(item.id);
          return (
            <DraggableTimelineItem
              key={item.id}
              item={item}
              effect={effect}
              pixelsPerSecond={pixelsPerSecond}
              isSelected={isSelected}
              isMultiSelected={isMultiSelected}
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
    <div className="flex border-b border-border/50">
      <div className="w-28 flex-shrink-0 flex items-center px-3 border-r border-border/50 bg-surface-1">
        <div className="w-2 h-2 rounded-full mr-2 bg-[#FFD700]" />
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Waypoints</span>
      </div>
      <div className="flex-1 relative h-10 bg-surface-0/50">
        {wpEvents.map(({ wp, traj, pad, index, nextWp }) => {
          const isSelected = selectedTrajectoryId === traj.id;
          const endTime = nextWp ? nextWp.time : wp.time + 1;
          const widthPx = Math.max((endTime - wp.time) * pixelsPerSecond, 14);
          return (
            <button
              key={wp.id}
              onClick={(e) => { e.stopPropagation(); selectTrajectory(traj.id); }}
              className={cn(
                "absolute top-1 h-8 rounded-sm flex items-center px-1 text-[9px] font-mono-code transition-all cursor-pointer border",
                isSelected ? "border-primary/60 shadow-[0_0_6px_hsl(var(--electric)/0.2)] z-10" : "border-transparent hover:border-border"
              )}
              style={{ left: `${wp.time * pixelsPerSecond}px`, width: `${widthPx}px`, backgroundColor: `${pad.color || '#00B4D8'}22` }}
            >
              <div className="w-1 h-full rounded-full mr-0.5 flex-shrink-0" style={{ backgroundColor: pad.color || '#00B4D8' }} />
              <span className="truncate text-secondary-foreground">WP{index + 1}</span>
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
    <div className="flex border-b border-border/50">
      <div className="w-28 flex-shrink-0 flex items-center px-3 border-r border-border/50 bg-surface-1">
        <div className="w-2 h-2 rounded-full mr-2 bg-[#7B68EE]" />
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Formações</span>
      </div>
      <div className="flex-1 relative h-10 bg-surface-0/50">
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
                "absolute top-1 h-8 rounded-sm flex items-center px-1.5 text-[9px] font-mono-code transition-all cursor-pointer border",
                isSelected ? "border-primary/60 shadow-[0_0_6px_hsl(var(--electric)/0.2)] z-10" : "border-transparent hover:border-border"
              )}
              style={{ left: `${f.startTime * pixelsPerSecond}px`, width: `${widthPx}px`, backgroundColor: `${f.color}22` }}
            >
              <div className="w-1 h-full rounded-full mr-1 flex-shrink-0" style={{ backgroundColor: f.color }} />
              <span className="truncate text-secondary-foreground">{preset || f.formationType} #{i + 1}</span>
              <div
                className="absolute top-0 h-full border-r border-dashed opacity-30"
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
        const mouseX = e.clientX - rect.left + el.scrollLeft - 112;
        const timeAtCursor = mouseX / pixelsPerSecond;
        setPixelsPerSecond((prev) => {
          const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
          const next = Math.min(MAX_PPS, Math.max(MIN_PPS, prev * factor));
          requestAnimationFrame(() => {
            if (scrollRef.current) {
              const newX = timeAtCursor * next + 112;
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
        if (selectedTimelineItemIds.length > 0) {
          removeMultipleTimelineItems(selectedTimelineItemIds);
        } else if (selectedTimelineItemId) {
          removeTimelineItem(selectedTimelineItemId);
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        const ids = selectedTimelineItemIds.length > 0 ? selectedTimelineItemIds : selectedTimelineItemId ? [selectedTimelineItemId] : [];
        if (ids.length > 0) duplicateTimelineItems(ids);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        // Select all
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
      const x = e.clientX - rect.left + scrollLeft - 112;
      if (x < 0) return;
      let time = Math.max(0, Math.min(x / pixelsPerSecond, duration));
      time = snapTimeToBeat(time, bpm, snapToBeat, pixelsPerSecond);
      setCurrentTime(time);
      if (!e.shiftKey && !e.ctrlKey && !e.metaKey) clearTimelineItemSelection();
    },
    [duration, pixelsPerSecond, setCurrentTime, bpm, snapToBeat, clearTimelineItemSelection]
  );

  const handleDeleteSelected = () => {
    if (selectedTimelineItemIds.length > 0) {
      removeMultipleTimelineItems(selectedTimelineItemIds);
    } else if (selectedTimelineItemId) {
      removeTimelineItem(selectedTimelineItemId);
    }
  };

  const handleDuplicate = () => {
    const ids = selectedTimelineItemIds.length > 0 ? selectedTimelineItemIds : selectedTimelineItemId ? [selectedTimelineItemId] : [];
    if (ids.length > 0) duplicateTimelineItems(ids);
  };

  const zoomIn = () => setPixelsPerSecond((p) => Math.min(MAX_PPS, p * 1.3));
  const zoomOut = () => setPixelsPerSecond((p) => Math.max(MIN_PPS, p / 1.3));
  const zoomPercent = Math.round((pixelsPerSecond / 12) * 100);

  return (
    <div className="flex flex-col bg-card border-t border-border h-full">
      {/* Transport controls */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-border bg-surface-1">
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setCurrentTime(0)}>
          <SkipBack className="h-3 w-3" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-primary hover:text-primary" onClick={() => setPlaying(!isPlaying)}>
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setPlaying(false)}>
          <Square className="h-3 w-3" />
        </Button>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setCurrentTime(Math.min(currentTime + 10, duration))}>
          <SkipForward className="h-3 w-3" />
        </Button>

        {/* Timecode */}
        <div className="ml-3 px-2 py-0.5 bg-surface-0 rounded-sm border border-border">
          <span className="font-mono-code text-xs text-electric">{formatTime(currentTime)}</span>
          <span className="text-muted-foreground text-[10px] mx-1">/</span>
          <span className="font-mono-code text-xs text-muted-foreground">{formatTime(duration)}</span>
        </div>

        {/* Playback speed */}
        <div className="flex items-center gap-1.5 mr-2">
          <span className="text-[9px] font-mono-code text-muted-foreground w-7 text-right">{playbackSpeed.toFixed(playbackSpeed < 1 ? 2 : 1)}x</span>
          <input
            type="range" min={0.1} max={2} step={0.05} value={playbackSpeed}
            onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
            className="w-20 h-1 accent-primary bg-surface-3 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-[0_0_6px_hsl(207_90%_54%/0.4)]"
          />
          <div className="flex gap-0.5">
            {[0.25, 0.5, 1].map((s) => (
              <button
                key={s}
                className={cn(
                  "text-[9px] font-mono-code px-1 py-0.5 rounded-sm border",
                  Math.abs(playbackSpeed - s) < 0.01
                    ? "bg-primary/20 text-primary border-primary/40"
                    : "bg-surface-2 text-muted-foreground border-border hover:text-foreground"
                )}
                onClick={() => setPlaybackSpeed(s)}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>

        <div className="w-px h-4 bg-border mx-1" />

        {/* Zoom */}
        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={zoomOut}><ZoomOut className="h-3 w-3" /></Button>
          <span className="text-[9px] font-mono-code text-muted-foreground w-8 text-center">{zoomPercent}%</span>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={zoomIn}><ZoomIn className="h-3 w-3" /></Button>
        </div>

        {/* Beat snap */}
        <button
          className={cn(
            "flex items-center gap-1 text-[9px] font-mono-code px-1.5 py-0.5 rounded-sm border ml-1 transition-colors",
            snapToBeat ? "bg-safety/20 text-safety border-safety/40" : "bg-surface-2 text-muted-foreground border-border hover:text-foreground"
          )}
          onClick={() => setSnapToBeat(!snapToBeat)}
          title={`Beat snap ${snapToBeat ? 'ON' : 'OFF'}${bpm ? ` (${bpm} BPM)` : ''}`}
        >
          <Magnet className="h-3 w-3" />
          {bpm && <span>{bpm}</span>}
        </button>

        <div className="w-px h-4 bg-border mx-1" />

        {/* Multi-select actions */}
        {selectionCount > 1 && (
          <div className="flex items-center gap-1">
            <span className="text-[9px] font-mono-code text-primary">{selectionCount} sel</span>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleDuplicate} title="Duplicar (Ctrl+D)">
              <Copy className="h-3 w-3" />
            </Button>
          </div>
        )}

        <div className="flex-1" />

        {/* Stats */}
        <div className="flex items-center gap-3 text-[10px] font-mono-code text-muted-foreground mr-2">
          <span>Units: <span className="text-foreground">{timelineItems.length}</span></span>
          <span>Cost: <span className="text-safety">${totalCost.toFixed(2)}</span></span>
        </div>

        <Button
          variant="ghost" size="icon"
          className="h-6 w-6 text-destructive hover:text-destructive"
          onClick={handleDeleteSelected}
          disabled={!selectedTimelineItemId && selectedTimelineItemIds.length === 0}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>

      {/* Timeline tracks */}
      <div ref={scrollRef} className="flex-1 overflow-x-auto overflow-y-auto" onClick={handleTrackClick}>
        <div style={{ width: `${duration * pixelsPerSecond + 112}px` }}>
          <div className="flex">
            <div className="w-28 flex-shrink-0" />
            <div className="flex-1 relative">
              <TimeRuler duration={duration} pixelsPerSecond={pixelsPerSecond} />
              <BeatGrid duration={duration} pixelsPerSecond={pixelsPerSecond} bpm={bpm} />
              <div className="absolute top-0 bottom-0 w-px bg-primary z-20 pointer-events-none" style={{ left: `${currentTime * pixelsPerSecond}px` }}>
                <div className="w-2 h-2 bg-primary rounded-full -translate-x-[3px] -translate-y-[1px]" />
              </div>
            </div>
          </div>
          <FormationTrackRow pixelsPerSecond={pixelsPerSecond} duration={duration} />
          <PyroTimelineTrack pixelsPerSecond={pixelsPerSecond} duration={duration} />
          <TimelineTrackRow label="DRONE FX" trackIndex={1} pixelsPerSecond={pixelsPerSecond} color="#00B4D8" duration={duration} scrollRef={scrollRef} />
          <TimelineTrackRow label="PYRO SYS" trackIndex={0} pixelsPerSecond={pixelsPerSecond} color="#FF6B35" duration={duration} scrollRef={scrollRef} />
          <WaypointTrackRow pixelsPerSecond={pixelsPerSecond} duration={duration} />
          <AudioWaveform pixelsPerSecond={pixelsPerSecond} />
        </div>
      </div>
    </div>
  );
}
