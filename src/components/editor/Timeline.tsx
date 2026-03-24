import React, { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward, Square, Trash2, ZoomIn, ZoomOut, Magnet, Copy, GripVertical, Zap, Sparkles, ChevronDown, ChevronRight, Clock, Move, Crosshair, Link2, Unlink, Scissors, ClipboardPaste, Eye, EyeOff, Headphones } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useProjectStore, EFFECT_LIBRARY } from '@/store/useProjectStore';
import { useLaserPreviewStore } from '@/store/useLaserPreviewStore';
import useGenerativeStore from '@/store/useGenerativeStore';
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

const BeatGrid = React.forwardRef<HTMLDivElement, { duration: number; pixelsPerSecond: number; bpm: number | null; scrollLeft?: number; viewportWidth?: number }>(function BeatGrid({ duration, pixelsPerSecond, bpm, scrollLeft = 0, viewportWidth = 1200 }, _ref) {
  if (!bpm) return null;
  const beatInterval = 60 / bpm;

  // Virtualize: only render lines visible in the scroll viewport + buffer
  const buffer = 200; // px
  const startTime = Math.max(0, (scrollLeft - buffer) / pixelsPerSecond);
  const endTime = Math.min(duration, (scrollLeft + viewportWidth + buffer) / pixelsPerSecond);
  const firstBeat = Math.floor(startTime / beatInterval) * beatInterval;

  const lines = [];
  for (let t = firstBeat; t < endTime; t += beatInterval) {
    if (t < 0) continue;
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
});

const TimeRuler = React.forwardRef<HTMLDivElement, { duration: number; pixelsPerSecond: number; scrollLeft?: number; viewportWidth?: number }>(function TimeRuler({ duration, pixelsPerSecond, scrollLeft = 0, viewportWidth = 1200 }, _ref) {
  let step: number;
  if (pixelsPerSecond >= 40) step = 1;
  else if (pixelsPerSecond >= 15) step = 2;
  else if (pixelsPerSecond >= 8) step = 5;
  else step = 10;
  const labelStep = step <= 2 ? 5 : 10;

  // Virtualize: only render marks visible in the scroll viewport + buffer
  const buffer = 100; // px
  const startTime = Math.max(0, (scrollLeft - buffer) / pixelsPerSecond);
  const endTime = Math.min(duration, (scrollLeft + viewportWidth + buffer) / pixelsPerSecond);
  const firstMark = Math.floor(startTime / step) * step;

  const marks = [];
  for (let i = firstMark; i <= endTime; i += step) {
    if (i < 0) continue;
    const isMajor = i % labelStep === 0;
    marks.push(
      <div key={i} className="absolute top-0 flex flex-col items-center" style={{ left: `${i * pixelsPerSecond}px` }}>
        <div className={cn("w-px", isMajor ? "h-3.5 bg-muted-foreground/30" : "h-2 bg-border/30")} />
        {isMajor && <span className="text-[8px] font-mono text-muted-foreground/40 mt-0.5 tabular-nums">{formatTime(i)}</span>}
      </div>
    );
  }
  return <div className="relative h-5 border-b border-border/5">{marks}</div>;
});

// --- Context Menu for Timeline Items ---
function TimelineContextMenu({
  x, y, item, onClose,
}: {
  x: number; y: number; item: any; onClose: () => void;
}) {
  const {
    removeTimelineItem, duplicateTimelineItems, selectTimelineItem,
    updateTimelineItem, positions, setEditorMode, currentTime,
    addTimelineItem, selectedTimelineItemIds,
  } = useProjectStore();

  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    const handleEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => { document.removeEventListener('mousedown', handleClickOutside); document.removeEventListener('keydown', handleEscape); };
  }, [onClose]);

  const pyroPositions = positions.filter(p => p.type === 'pyro');
  const [showPositions, setShowPositions] = useState(false);

  return (
    <div
      ref={menuRef}
      className="fixed z-[100] min-w-[180px] rounded-md border border-border/60 bg-popover/95 p-1 text-popover-foreground shadow-lg backdrop-blur-sm"
      style={{ left: x, top: y }}
    >
      <button className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-[10px] hover:bg-accent/50 transition-colors"
        onClick={() => { const t = prompt('Set time (seconds):', String(item.startTime)); if (t !== null) updateTimelineItem(item.id, { startTime: parseFloat(t) || 0 }); onClose(); }}>
        <Clock className="h-3 w-3 text-muted-foreground" /> Set Time…
      </button>
      <button className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-[10px] hover:bg-accent/50 transition-colors"
        onClick={() => { selectTimelineItem(item.id); setEditorMode('adjust-angles'); onClose(); }}>
        <Crosshair className="h-3 w-3 text-muted-foreground" /> Set Angle…
      </button>
      <div className="h-px bg-border/30 my-0.5" />
      <button className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-[10px] hover:bg-accent/50 transition-colors"
        onClick={() => { duplicateTimelineItems([item.id]); onClose(); }}>
        <Copy className="h-3 w-3 text-muted-foreground" /> Duplicate <span className="ml-auto text-muted-foreground/50 text-[8px]">Ctrl+D</span>
      </button>
      <button className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-[10px] hover:bg-accent/50 transition-colors"
        onClick={() => { removeTimelineItem(item.id); onClose(); }}>
        <Trash2 className="h-3 w-3 text-destructive/70" /> Delete <span className="ml-auto text-muted-foreground/50 text-[8px]">Del</span>
      </button>
      <div className="h-px bg-border/30 my-0.5" />
      <div className="relative">
        <button className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-[10px] hover:bg-accent/50 transition-colors"
          onClick={() => setShowPositions(!showPositions)}>
          <Move className="h-3 w-3 text-muted-foreground" /> Assign to Position <ChevronRight className="h-3 w-3 ml-auto text-muted-foreground/50" />
        </button>
        {showPositions && pyroPositions.length > 0 && (
          <div className="absolute left-full top-0 ml-1 min-w-[120px] rounded-md border border-border/60 bg-popover/95 p-1 shadow-lg backdrop-blur-sm max-h-[200px] overflow-y-auto">
            {pyroPositions.map(pos => (
              <button key={pos.id}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1 text-[9px] hover:bg-accent/50 transition-colors"
                onClick={() => {
                  updateTimelineItem(item.id, { positionId: pos.id, positionName: pos.name, position: { x: pos.x, y: pos.y, z: pos.z } });
                  onClose();
                }}>
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: pos.color }} />
                {pos.name}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="h-px bg-border/30 my-0.5" />
      <button className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-[10px] hover:bg-accent/50 transition-colors"
        onClick={() => {
          const ids = selectedTimelineItemIds.length > 1 ? selectedTimelineItemIds : [item.id];
          useProjectStore.getState().combineAsChain(ids);
          onClose();
        }}>
        <Link2 className="h-3 w-3 text-muted-foreground" /> Add to Chain
      </button>
      {item.chainRef && (
        <button className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-[10px] hover:bg-accent/50 transition-colors"
          onClick={() => { useProjectStore.getState().breakChain(item.chainRef); onClose(); }}>
          <Unlink className="h-3 w-3 text-muted-foreground" /> Break Chain
        </button>
      )}
    </div>
  );
}

// Section color map
const SECTION_COLORS: Record<string, string> = {
  A: '#4CAF50', B: '#2196F3', C: '#FF9800', D: '#E91E63', E: '#9C27B0', F: '#00BCD4',
};

// --- Draggable Timeline Item (memoized to avoid re-renders during scroll) ---
const DraggableTimelineItem = React.memo(React.forwardRef<HTMLButtonElement, {
  item: any;
  effect: any;
  pixelsPerSecond: number;
  isSelected: boolean;
  isMultiSelected: boolean;
  isLinkedHighlight?: boolean;
  onSelect: (e: React.MouseEvent) => void;
  onDragStart: (e: React.MouseEvent, itemId: string) => void;
  onContextMenu: (e: React.MouseEvent, item: any) => void;
  onResize: (itemId: string, edge: 'left' | 'right', deltaTime: number) => void;
  sectionColor?: string;
}>(function DraggableTimelineItem({
  item, effect, pixelsPerSecond, isSelected, isMultiSelected, isLinkedHighlight, onSelect, onDragStart, onContextMenu, onResize, sectionColor,
}, ref) {
  const pft = effect.type === 'firework' ? getPreFireTime(effect.name) : 0;
  const pftPx = pft * pixelsPerSecond;
  const effectDuration = item.durationOverride ?? effect.duration;
  const widthPx = Math.max(effectDuration * pixelsPerSecond, 28);
  const [resizing, setResizing] = useState<'left' | 'right' | null>(null);

  const handleResizeStart = useCallback((e: React.MouseEvent, edge: 'left' | 'right') => {
    e.stopPropagation();
    e.preventDefault();
    setResizing(edge);
    const startX = e.clientX;
    const startTime = item.startTime;
    const startDuration = effectDuration;

    const handleMove = (me: MouseEvent) => {
      const dx = me.clientX - startX;
      const dt = dx / pixelsPerSecond;
      if (edge === 'right') {
        const newDur = Math.max(0.2, startDuration + dt);
        onResize(item.id, 'right', newDur);
      } else {
        const newStart = Math.max(0, startTime + dt);
        onResize(item.id, 'left', newStart);
      }
    };
    const handleUp = () => {
      setResizing(null);
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  }, [item, pixelsPerSecond, effectDuration, onResize]);

  // Angle indicator
  const pan = item.pan ?? 0;
  const showAngle = widthPx > 40 && effect.type === 'firework';

  return (
    <div className="absolute top-0.5" style={{ left: `${item.startTime * pixelsPerSecond}px` }}>
      {pft > 0 && (
        <div
          className="absolute h-7 rounded-l-md border-l border-dashed border-warning/20"
          style={{ left: `-${pftPx}px`, width: `${pftPx}px`, background: 'hsl(var(--warning) / 0.04)' }}
          title={`Pre-Fire: ${pft.toFixed(1)}s`}
        />
      )}
      {/* Left resize handle */}
      <div
        className="absolute top-0 left-0 w-[3px] h-7 cursor-col-resize z-20 hover:bg-primary/30 transition-colors"
        onMouseDown={(e) => handleResizeStart(e, 'left')}
      />
      <button
        ref={ref}
        onClick={onSelect}
        onMouseDown={(e) => { if (e.button === 0 && !resizing) onDragStart(e, item.id); }}
        onContextMenu={(e) => { e.preventDefault(); onContextMenu(e, item); }}
        className={cn(
          "h-7 rounded-md flex items-center px-1.5 text-[9px] font-medium transition-all cursor-grab active:cursor-grabbing border group",
          isSelected
            ? "border-primary/60 shadow-[0_0_10px_hsl(var(--primary)/0.2)] z-10 ring-1 ring-primary/15"
            : isLinkedHighlight
              ? "border-accent/40 shadow-[0_0_8px_hsl(var(--accent)/0.15)] z-10 ring-1 ring-accent/20 border-dashed"
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
          borderLeftWidth: sectionColor ? '2px' : undefined,
          borderLeftColor: sectionColor || undefined,
        }}
      >
        <GripVertical className="w-2 h-2 text-muted-foreground/15 group-hover:text-muted-foreground/30 mr-0.5 flex-shrink-0 transition-colors" />
        <div className="w-[3px] h-4 rounded-full mr-1.5 flex-shrink-0" style={{ backgroundColor: effect.color, boxShadow: `0 0 6px ${effect.color}55` }} />
        <div className="flex flex-col items-start min-w-0 overflow-hidden flex-1">
          <span className="truncate text-foreground/75 leading-tight text-[9px]">{effect.name}</span>
          {item.positionName && (
            <span className="truncate text-[7px] text-muted-foreground/40 leading-tight">📍 {item.positionName}</span>
          )}
        </div>
        {/* Angle indicator */}
        {showAngle && (
          <svg width="8" height="8" viewBox="0 0 8 8" className="flex-shrink-0 ml-0.5 opacity-60">
            <line x1="4" y1="4" x2={4 + 3 * Math.sin(pan * Math.PI / 180)} y2={4 - 3 * Math.cos(pan * Math.PI / 180)}
              stroke={Math.abs(pan) > 45 ? '#4FC3F7' : '#FF8A65'} strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="4" cy="4" r="1" fill={Math.abs(pan) > 45 ? '#4FC3F7' : '#FF8A65'} opacity="0.5" />
          </svg>
        )}
      </button>
      {/* Right resize handle */}
      <div
        className="absolute top-0 right-0 w-[3px] h-7 cursor-col-resize z-20 hover:bg-primary/30 transition-colors"
        style={{ left: `${widthPx - 3}px` }}
        onMouseDown={(e) => handleResizeStart(e, 'right')}
      />
    </div>
  );
}));

DraggableTimelineItem.displayName = 'DraggableTimelineItem';

// Track header context menu
function TrackContextMenu({ x, y, trackIndex, onClose }: { x: number; y: number; trackIndex: number; onClose: () => void }) {
  const { timelineItems, selectTimelineItem, toggleTimelineItemSelection, removeMultipleTimelineItems } = useProjectStore();
  const trackItems = timelineItems.filter(i => i.trackIndex === trackIndex);

  useEffect(() => {
    const handler = () => onClose();
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, [onClose]);

  return (
    <div
      className="fixed z-[200] border border-border/30 rounded-xl shadow-2xl py-1 min-w-[160px] backdrop-blur-2xl"
      style={{ top: y, left: x, background: 'hsl(var(--popover) / 0.97)' }}
      onClick={e => e.stopPropagation()}
    >
      <button className="w-full text-left px-3 py-1.5 text-[10px] hover:bg-primary/8 transition-colors"
        onClick={() => { trackItems.forEach(i => toggleTimelineItemSelection(i.id)); onClose(); }}>
        Select All on Track ({trackItems.length})
      </button>
      <button className="w-full text-left px-3 py-1.5 text-[10px] text-destructive hover:bg-destructive/8 transition-colors"
        onClick={() => { removeMultipleTimelineItems(trackItems.map(i => i.id)); onClose(); }}>
        Delete All on Track
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
  // Track scroll position for item virtualization
  const [scrollLeft, setScrollLeft] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(1200);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => { setScrollLeft(el.scrollLeft); setViewportWidth(el.clientWidth); };
    update();
    el.addEventListener('scroll', update, { passive: true });
    return () => el.removeEventListener('scroll', update);
  }, [scrollRef]);
  const { 
    timelineItems, selectedTimelineItemId, selectTimelineItem, addTimelineItem, 
    bpm, snapToBeat, updateTimelineItem, selectedTimelineItemIds, toggleTimelineItemSelection,
    positions, selectedPositionId, selectedPositionIds,
  } = useProjectStore();
  const [isDragOver, setIsDragOver] = useState(false);
  const [muted, setMuted] = useState(false);
  const [trackCtxMenu, setTrackCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const items = timelineItems.filter((i) => i.trackIndex === trackIndex);
  const dragState = useRef<{ itemId: string; startX: number; startTime: number } | null>(null);

  // Lookup section color for each item
  const getItemSectionColor = useCallback((item: any) => {
    if (!item.positionId) return undefined;
    const pos = positions.find(p => p.id === item.positionId);
    if (!pos?.section) return undefined;
    return SECTION_COLORS[pos.section] || undefined;
  }, [positions]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    const effectId = e.dataTransfer.types.includes('application/effect-id');
    if (!effectId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('application/effect-id')) return;
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
    if ((effect.type === 'firework' || effect.type === 'sfx') && trackIndex !== 0) return;
    if (effect.type === 'drone' && trackIndex !== 1) return;
    if (effect.type === 'light' && trackIndex !== 2) return;
    if (effect.type === 'laser' && trackIndex !== 0 && trackIndex !== 2) return;

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
    if (e.shiftKey || e.ctrlKey || e.metaKey) {
      toggleTimelineItemSelection(itemId);
    } else {
      // Bidirectional: select item and linked position
      useProjectStore.getState().selectTimelineItemAndLinkedPosition(itemId);
    }
  }, [toggleTimelineItemSelection]);

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; item: any } | null>(null);

  // Marquee selection state
  const [marquee, setMarquee] = useState<{ startX: number; startY: number; currentX: number; currentY: number } | null>(null);
  const trackAreaRef = useRef<HTMLDivElement>(null);

  const handleContextMenu = useCallback((e: React.MouseEvent, item: any) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, item });
  }, []);

  const handleResize = useCallback((itemId: string, edge: 'left' | 'right', value: number) => {
    if (edge === 'right') {
      updateTimelineItem(itemId, { durationOverride: value });
    } else {
      updateTimelineItem(itemId, { startTime: value });
    }
  }, [updateTimelineItem]);

  // Marquee selection
  const handleMarqueeStart = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setMarquee({ startX: x, startY: y, currentX: x, currentY: y });

    const handleMove = (me: MouseEvent) => {
      const cx = me.clientX - rect.left;
      const cy = me.clientY - rect.top;
      setMarquee(prev => prev ? { ...prev, currentX: cx, currentY: cy } : null);
    };
    const handleUp = (me: MouseEvent) => {
      const cx = me.clientX - rect.left;
      setMarquee(null);
      
      const minX = Math.min(x, cx);
      const maxX = Math.max(x, cx);
      if (Math.abs(maxX - minX) < 4) {
        window.removeEventListener('mousemove', handleMove);
        window.removeEventListener('mouseup', handleUp);
        return;
      }

      // Collect all items within the marquee
      const selectedIds: string[] = [];
      const linkedPosIds = new Set<string>();
      items.forEach(item => {
        const effect = EFFECT_LIBRARY.find(ef => ef.id === item.effectId);
        if (!effect) return;
        const itemLeft = item.startTime * pixelsPerSecond;
        const itemRight = itemLeft + Math.max((item.durationOverride ?? effect.duration) * pixelsPerSecond, 28);
        if (itemLeft < maxX && itemRight > minX) {
          selectedIds.push(item.id);
          if (item.positionId) linkedPosIds.add(item.positionId);
          item.positionIds?.forEach(pid => linkedPosIds.add(pid));
        }
      });

      // Batch select all items at once
      const store = useProjectStore.getState();
      selectedIds.forEach(id => toggleTimelineItemSelection(id));

      // Sync linked positions to viewport with glow
      if (linkedPosIds.size > 0) {
        store.selectMultiplePositionsAndLinkedEvents(Array.from(linkedPosIds));
      }

      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  }, [items, pixelsPerSecond, toggleTimelineItemSelection]);

  const handleTrackHeaderContext = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setTrackCtxMenu({ x: e.clientX, y: e.clientY });
  }, []);

  return (
    <div className="flex border-b border-white/[0.03]">
      <div
        className="w-24 flex-shrink-0 flex items-center px-2.5 border-r border-white/[0.04] group cursor-pointer"
        style={{ background: 'hsl(var(--card))' }}
        onContextMenu={handleTrackHeaderContext}
      >
        <div className="w-1.5 h-1.5 rounded-full mr-2 flex-shrink-0" style={{ backgroundColor: color, boxShadow: `0 0 4px ${color}55` }} />
        <span className="text-[9px] font-semibold text-muted-foreground/50 uppercase tracking-[0.08em]">{label}</span>
        <span className="text-[7px] text-muted-foreground/25 ml-1 tabular-nums">{items.length > 0 ? `·${items.length}` : ''}</span>
        <div className="ml-auto flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={(e) => { e.stopPropagation(); setMuted(!muted); }} className="text-muted-foreground/30 hover:text-muted-foreground/60" title={muted ? 'Show' : 'Hide'}>
            {muted ? <EyeOff className="w-2.5 h-2.5" /> : <Eye className="w-2.5 h-2.5" />}
          </button>
        </div>
      </div>
      <div
        ref={trackAreaRef}
        className={cn("flex-1 relative h-8 transition-colors", isDragOver && "ring-1 ring-primary/30 bg-primary/[0.03]")}
        style={{ background: 'hsl(var(--background) / 0.4)' }}
        onDragOver={handleDragOver} onDragEnter={handleDragEnter} onDragLeave={handleDragLeave} onDrop={handleDrop}
        onMouseDown={handleMarqueeStart}
      >
        {/* Marquee selection rectangle */}
        {marquee && (
          <div
            className="absolute pointer-events-none z-30 border border-dashed border-primary/50 rounded-sm"
            style={{
              left: Math.min(marquee.startX, marquee.currentX),
              top: Math.min(marquee.startY, marquee.currentY),
              width: Math.abs(marquee.currentX - marquee.startX),
              height: Math.abs(marquee.currentY - marquee.startY),
              background: 'hsl(var(--primary) / 0.08)',
            }}
          />
        )}
        {!muted && items.map((item) => {
          const effect = EFFECT_LIBRARY.find((e) => e.id === item.effectId);
          if (!effect) return null;
          // Virtualize: skip items outside visible scroll range
          const effectDuration = item.durationOverride ?? effect.duration;
          const itemLeftPx = item.startTime * pixelsPerSecond;
          const itemRightPx = itemLeftPx + Math.max(effectDuration * pixelsPerSecond, 28);
          const visibleLeft = scrollLeft - 96 - 200; // account for label column + buffer
          const visibleRight = scrollLeft - 96 + viewportWidth + 200;
          if (itemRightPx < visibleLeft || itemLeftPx > visibleRight) return null;

          const linkedIds = useProjectStore.getState().linkedTimelineItemIds;
          const isLinked = linkedIds.includes(item.id);
          return (
            <DraggableTimelineItem
              key={item.id} item={item} effect={effect} pixelsPerSecond={pixelsPerSecond}
              isSelected={selectedTimelineItemId === item.id}
              isMultiSelected={selectedTimelineItemIds.includes(item.id)}
              isLinkedHighlight={isLinked}
              onSelect={(e) => handleItemSelect(e, item.id)}
              onDragStart={handleItemDragStart}
              onContextMenu={handleContextMenu}
              onResize={handleResize}
              sectionColor={getItemSectionColor(item)}
            />
          );
        })}
      </div>
      {/* Context Menu */}
      {contextMenu && (
        <TimelineContextMenu
          x={contextMenu.x} y={contextMenu.y} item={contextMenu.item}
          onClose={() => setContextMenu(null)}
        />
      )}
      {trackCtxMenu && (
        <TrackContextMenu
          x={trackCtxMenu.x} y={trackCtxMenu.y} trackIndex={trackIndex}
          onClose={() => setTrackCtxMenu(null)}
        />
      )}
    </div>
  );
}

const WaypointTrackRow = React.forwardRef<HTMLDivElement, { pixelsPerSecond: number; duration: number }>(function WaypointTrackRow({ pixelsPerSecond, duration }, ref) {
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
});

const FormationTrackRow = React.forwardRef<HTMLDivElement, { pixelsPerSecond: number; duration: number }>(function FormationTrackRow({ pixelsPerSecond, duration }, _ref) {
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
});

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

// ── LASER Track — shows laser cues with live preview state ──
function LaserTrackRow({ pixelsPerSecond, duration }: { pixelsPerSecond: number; duration: number }) {
  const { timelineItems, selectedTimelineItemId, selectTimelineItem, addTimelineItem, bpm, snapToBeat } = useProjectStore();
  const laserEnabled = useLaserPreviewStore((s) => s.globalEnabled);
  const [collapsed, setCollapsed] = useState(false);

  const laserItems = useMemo(() => timelineItems.filter((i) => {
    const effect = EFFECT_LIBRARY.find((e) => e.id === i.effectId);
    return effect?.type === 'laser';
  }), [timelineItems]);

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
    if (!effect || effect.type !== 'laser') return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    let time = Math.max(0, Math.min(x / pixelsPerSecond, duration));
    time = snapTimeToBeat(time, bpm, snapToBeat, pixelsPerSecond);
    addTimelineItem({
      id: `tl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      effectId: effect.id, startTime: time, trackIndex: 4,
      position: { x: 0, y: 0.5, z: 0 },
    });
  }, [pixelsPerSecond, duration, addTimelineItem, bpm, snapToBeat]);

  return (
    <div className="flex border-b border-white/[0.03]">
      <div className="w-24 flex-shrink-0 flex items-center px-2.5 border-r border-white/[0.04] cursor-pointer" style={{ background: 'hsl(var(--card))' }} onClick={() => setCollapsed(!collapsed)}>
        {collapsed ? <ChevronRight className="w-2.5 h-2.5 text-muted-foreground/30 mr-1" /> : <ChevronDown className="w-2.5 h-2.5 text-muted-foreground/30 mr-1" />}
        <Zap className="w-2.5 h-2.5 mr-1.5" style={{ color: '#00FF88' }} />
        <span className="text-[9px] font-semibold text-muted-foreground/50 uppercase tracking-[0.08em]">Laser</span>
        {laserEnabled && <div className="w-1.5 h-1.5 rounded-full bg-green-400 ml-auto animate-pulse" />}
      </div>
      {!collapsed && (
        <div className="flex-1 relative h-8" style={{ background: 'hsl(var(--background) / 0.4)' }} onDragOver={handleDragOver} onDrop={handleDrop}>
          {laserItems.map((item) => {
            const effect = EFFECT_LIBRARY.find((e) => e.id === item.effectId);
            if (!effect) return null;
            const isSelected = selectedTimelineItemId === item.id;
            const widthPx = Math.max(effect.duration * pixelsPerSecond, 20);
            return (
              <button
                key={item.id}
                onClick={(e) => { e.stopPropagation(); selectTimelineItem(item.id); }}
                className={cn(
                  "absolute top-0.5 h-7 rounded-md flex items-center px-1.5 text-[8px] font-mono transition-all cursor-pointer border",
                  isSelected ? "border-primary/50 shadow-[0_0_6px_hsl(var(--primary)/0.15)] z-10" : "border-white/[0.04] hover:border-white/[0.08]"
                )}
                style={{ left: `${item.startTime * pixelsPerSecond}px`, width: `${widthPx}px`, backgroundColor: `${effect.color}15` }}
              >
                <Zap className="w-2 h-2 mr-0.5 flex-shrink-0" style={{ color: effect.color }} />
                <span className="truncate text-muted-foreground/60">{effect.name}</span>
              </button>
            );
          })}
        </div>
      )}
      {collapsed && <div className="flex-1 h-2" style={{ background: 'hsl(var(--background) / 0.2)' }} />}
    </div>
  );
}

// ── GENERATIVE Track — shows generative preset blocks ──
function GenerativeTrackRow({ pixelsPerSecond, duration }: { pixelsPerSecond: number; duration: number }) {
  const genEnabled = useGenerativeStore((s: any) => s.enabled);
  const genLayers = useGenerativeStore((s: any) => s.layers) as any[];
  const [collapsed, setCollapsed] = useState(false);

  // Show a single block representing the generative engine state
  if (!genEnabled || genLayers.length === 0) return null;

  const activePresetName = genLayers[0]?.type || 'Generative';
  const layerColors = genLayers.map((_: any, i: number) => {
    const hue = (i * 60) % 360;
    return `hsl(${hue} 70% 55%)`;
  });

  return (
    <div className="flex border-b border-white/[0.03]">
      <div className="w-24 flex-shrink-0 flex items-center px-2.5 border-r border-white/[0.04] cursor-pointer" style={{ background: 'hsl(var(--card))' }} onClick={() => setCollapsed(!collapsed)}>
        {collapsed ? <ChevronRight className="w-2.5 h-2.5 text-muted-foreground/30 mr-1" /> : <ChevronDown className="w-2.5 h-2.5 text-muted-foreground/30 mr-1" />}
        <Sparkles className="w-2.5 h-2.5 mr-1.5" style={{ color: '#FF44FF' }} />
        <span className="text-[9px] font-semibold text-muted-foreground/50 uppercase tracking-[0.08em]">Gen</span>
        {genEnabled && <div className="w-1.5 h-1.5 rounded-full bg-purple-400 ml-auto animate-pulse" />}
      </div>
      {!collapsed && (
        <div className="flex-1 relative h-8" style={{ background: 'hsl(var(--background) / 0.4)' }}>
          {/* Full-span bar showing active generative engine */}
          <div
            className="absolute top-0.5 h-7 rounded-md flex items-center px-2 text-[8px] font-mono border border-purple-500/20"
            style={{
              left: 0,
              width: `${duration * pixelsPerSecond}px`,
              background: `linear-gradient(90deg, ${layerColors.map((c: string, i: number) => `${c}15 ${(i / layerColors.length) * 100}%`).join(', ')})`,
            }}
          >
            <Sparkles className="w-2 h-2 mr-1 flex-shrink-0 text-purple-400" />
            <span className="truncate text-purple-300/60">{genLayers.length} layers · {activePresetName}</span>
          </div>
        </div>
      )}
      {collapsed && <div className="flex-1 h-2" style={{ background: 'hsl(var(--background) / 0.2)' }} />}
    </div>
  );
}

// ── Collapsible Track Group ──
function CollapsibleTrackGroup({ label, defaultOpen = true, children }: { label: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <div
        className="flex items-center px-2.5 py-1 cursor-pointer border-b border-white/[0.03] select-none"
        style={{ background: 'hsl(var(--card) / 0.8)' }}
        onClick={() => setOpen(!open)}
      >
        {open ? <ChevronDown className="w-2.5 h-2.5 text-muted-foreground/40 mr-1.5" /> : <ChevronRight className="w-2.5 h-2.5 text-muted-foreground/40 mr-1.5" />}
        <span className="text-[8px] font-bold text-muted-foreground/35 uppercase tracking-[0.12em]">{label}</span>
      </div>
      {open && children}
    </div>
  );
}

/** Playhead rendered via direct DOM manipulation — no React re-renders during playback */
function PlayheadIndicator({ pixelsPerSecond }: { pixelsPerSecond: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const initial = useProjectStore.getState().currentTime;
    if (ref.current) ref.current.style.transform = `translateX(${initial * pixelsPerSecond}px)`;
    const unsub = useProjectStore.subscribe((state) => {
      if (ref.current) ref.current.style.transform = `translateX(${state.currentTime * pixelsPerSecond}px)`;
    });
    return unsub;
  }, [pixelsPerSecond]);

  return (
    <div ref={ref} className="absolute top-0 bottom-0 w-px z-20 pointer-events-none" style={{ transform: 'translateX(0px)' }}>
      <div className="w-2 h-2 bg-primary rounded-full -translate-x-[3px] -translate-y-px shadow-[0_0_8px_hsl(var(--primary)/0.4)]" />
      <div className="absolute top-0 w-px h-full bg-gradient-to-b from-primary via-primary/30 to-transparent" />
    </div>
  );
}

const MIN_PPS = 4;
const MAX_PPS = 80;

const Timeline = React.forwardRef<HTMLDivElement, {}>(function Timeline(_props, _ref) {
  const {
    isPlaying, setPlaying, currentTime, setCurrentTime, duration,
    selectedTimelineItemId, removeTimelineItem, timelineItems,
    playbackSpeed, setPlaybackSpeed, bpm, snapToBeat, setSnapToBeat,
    selectedTimelineItemIds, clearTimelineItemSelection, duplicateTimelineItems, removeMultipleTimelineItems,
  } = useProjectStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [pixelsPerSecond, setPixelsPerSecond] = useState(12);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(1200);

  const totalCost = useMemo(() => {
    return timelineItems.reduce((sum, item) => {
      const effect = EFFECT_LIBRARY.find((e) => e.id === item.effectId);
      return sum + (effect?.cost ?? 0);
    }, 0);
  }, [timelineItems]);

  const selectionCount = selectedTimelineItemIds.length + (selectedTimelineItemId && !selectedTimelineItemIds.includes(selectedTimelineItemId) ? 1 : 0);

  // Track scroll position for virtualized BeatGrid/TimeRuler
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const updateScroll = () => {
      setScrollLeft(el.scrollLeft);
      setViewportWidth(el.clientWidth);
    };
    updateScroll();
    el.addEventListener('scroll', updateScroll, { passive: true });
    const ro = new ResizeObserver(updateScroll);
    ro.observe(el);
    return () => { el.removeEventListener('scroll', updateScroll); ro.disconnect(); };
  }, []);

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
      // Space play/pause handled globally by useKeybindings — do NOT duplicate here
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

        {/* LIVE indicator placeholder */}
        <div className="badge-live hidden" id="live-badge">● LIVE</div>

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
              <TimeRuler duration={duration} pixelsPerSecond={pixelsPerSecond} scrollLeft={scrollLeft} viewportWidth={viewportWidth} />
              <BeatGrid duration={duration} pixelsPerSecond={pixelsPerSecond} bpm={bpm} scrollLeft={scrollLeft} viewportWidth={viewportWidth} />
              {/* Playhead — DOM-direct updates via transient Zustand subscription (zero re-renders) */}
              <PlayheadIndicator pixelsPerSecond={pixelsPerSecond} />
            </div>
          </div>
          {/* ── FIRING SYSTEMS group ── */}
          <CollapsibleTrackGroup label="FIRING SYSTEMS" defaultOpen>
            <PyroTimelineTrack pixelsPerSecond={pixelsPerSecond} duration={duration} />
            <TimelineTrackRow label="PYRO SYS" trackIndex={0} pixelsPerSecond={pixelsPerSecond} color="#FF6B35" duration={duration} scrollRef={scrollRef} />
            <TimelineTrackRow label="DRONE SYS" trackIndex={1} pixelsPerSecond={pixelsPerSecond} color="#00B4D8" duration={duration} scrollRef={scrollRef} />
            <TimelineTrackRow label="LIGHT SYS" trackIndex={2} pixelsPerSecond={pixelsPerSecond} color="#FBBF24" duration={duration} scrollRef={scrollRef} />
            <LaserTrackRow pixelsPerSecond={pixelsPerSecond} duration={duration} />
            <GenerativeTrackRow pixelsPerSecond={pixelsPerSecond} duration={duration} />
          </CollapsibleTrackGroup>
          {/* ── CHOREOGRAPHY group ── */}
          <CollapsibleTrackGroup label="CHOREOGRAPHY" defaultOpen>
            <FormationTrackRow pixelsPerSecond={pixelsPerSecond} duration={duration} />
            <DroneFXTrackRow pixelsPerSecond={pixelsPerSecond} duration={duration} />
            <WaypointTrackRow pixelsPerSecond={pixelsPerSecond} duration={duration} />
          </CollapsibleTrackGroup>
          <AudioWaveform pixelsPerSecond={pixelsPerSecond} />
        </div>
      </div>
    </div>
  );
});

export default Timeline;
