import React, { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward, Square, Trash2, ZoomIn, ZoomOut, Magnet, Copy, GripVertical, Zap, Sparkles, ChevronDown, ChevronRight, Clock, Move, Crosshair, Link2, Unlink, Scissors, ClipboardPaste, Eye, EyeOff, Headphones, RefreshCw, AlignVerticalJustifyCenter } from 'lucide-react';
// Lazy toast: import('sonner') keeps it out of the initial JS bundle (budget guard).
const toast = {
  info: (m: string) => { void import('sonner').then(({ toast }) => toast.info(m)); },
  warning: (m: string) => { void import('sonner').then(({ toast }) => toast.warning(m)); },
  success: (m: string) => { void import('sonner').then(({ toast }) => toast.success(m)); },
};
import { Button } from '@/components/ui/button';
import { useProjectStore } from '@/store/useProjectStore';
import { useSMPTEStore } from '@/store/useSMPTEStore';
import { timelineTransport } from '@/core/transport/timelineTransport';
import { resyncTimeline, getAudioMaster } from '@/lib/audio/audioMasterRegistry';
import { TimelineHealthBadge } from '@/components/editor/TimelineHealthBadge';
import { TimelineHealthSettingsPopover } from '@/components/editor/TimelineHealthSettingsPopover';
import { TimelineHealthLogPopover } from '@/components/editor/TimelineHealthLogPopover';
import { useTransportDiagnostics } from '@/hooks/useTransportDiagnostics';
import { EFFECT_LIBRARY } from '@/data/effectLibrary';
import { useLaserPreviewStore } from '@/store/useLaserPreviewStore';
import useGenerativeStore from '@/store/useGenerativeStore';
import { getPreFireTime } from '@/lib/safetyEngine';
import { cn } from '@/lib/utils';
import AudioWaveform from './AudioWaveform';
import PyroTimelineTrack from './PyroTimelineTrack';
import { useRenderCounter } from '@/hooks/useRenderCounter';
import { loadTimelineView, saveTimelineView } from '@/lib/timelineViewState';
import { useScrollViewport, isInScrollWindow } from '@/hooks/useScrollViewport';
import {
  resolveDropTime,
  formatDropTimestamp,
  snapAccent,
  markRecentDrop,
  useRecentDropId,
  isEffectAllowedOnTrack,
  type SnapReason,
} from './timelineDropFx';
import {
  getActiveGrid,
  snapTime,
  quantizeTime,
  stepTime,
  getSubdivisions,
  type SnapMode,
} from './timelineGrid';
import { timecodeProvider } from '@/core/time/timecodeProvider';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
}

// ── TimelineGrid: replaces the old beat-only `BeatGrid`. Now renders beat OR
//    frame OR second subdivisions depending on the active `snapMode`, BPM and
//    zoom level. Virtualised to the visible scroll window.
const TimelineGrid = React.forwardRef<HTMLDivElement, {
  duration: number;
  pixelsPerSecond: number;
  bpm: number | null;
  snapMode: SnapMode;
  scrollLeft?: number;
  viewportWidth?: number;
}>(function TimelineGrid({ duration, pixelsPerSecond, bpm, snapMode, scrollLeft = 0, viewportWidth = 1200 }, _ref) {
  const grid = getActiveGrid({ bpm, snapMode });
  if (grid.unit === 'none') return null;
  const lines = getSubdivisions({ grid, duration, pixelsPerSecond, scrollLeft, viewportWidth });
  if (lines.length === 0) return null;

  return (
    <>
      {lines.map((l) => {
        // Three-tier opacity: major (measure / second), unit (beat / frame), sub (¼ / 6-frame).
        const opacity = l.weight === 'major' ? 0.35 : l.weight === 'unit' ? 0.18 : 0.08;
        const tone = grid.unit === 'beat' ? '--accent' : '--primary';
        return (
          <div
            key={`${l.weight}-${l.t}`}
            className="absolute top-0 bottom-0 pointer-events-none"
            style={{
              left: `${l.t * pixelsPerSecond}px`,
              width: '1px',
              backgroundColor: `hsl(var(${tone}) / ${opacity})`,
            }}
          />
        );
      })}
    </>
  );
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
    const removeTimelineItem = useProjectStore(s => s.removeTimelineItem);
  const duplicateTimelineItems = useProjectStore(s => s.duplicateTimelineItems);
  const selectTimelineItem = useProjectStore(s => s.selectTimelineItem);
  const updateTimelineItem = useProjectStore(s => s.updateTimelineItem);
  const positions = useProjectStore(s => s.positions);
  const setEditorMode = useProjectStore(s => s.setEditorMode);
  const currentTime = useProjectStore(s => s.currentTime);
  const addTimelineItem = useProjectStore(s => s.addTimelineItem);
  const selectedTimelineItemIds = useProjectStore(s => s.selectedTimelineItemIds);

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
  const recentDropId = useRecentDropId();
  const isRecentDrop = recentDropId === item.id;

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
              : "border-white/[0.04] hover:border-white/[0.08] hover:shadow-sm",
          isRecentDrop && "fxk-drop-flash"
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
    const timelineItems = useProjectStore(s => s.timelineItems);
  const selectTimelineItem = useProjectStore(s => s.selectTimelineItem);
  const toggleTimelineItemSelection = useProjectStore(s => s.toggleTimelineItemSelection);
  const removeMultipleTimelineItems = useProjectStore(s => s.removeMultipleTimelineItems);
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
  // Track scroll position via shared hook (replaces local useEffect duplicated in 6 rows)
  const { scrollLeft, viewportWidth } = useScrollViewport(scrollRef);
    const timelineItems = useProjectStore(s => s.timelineItems);
  const selectedTimelineItemId = useProjectStore(s => s.selectedTimelineItemId);
  const selectTimelineItem = useProjectStore(s => s.selectTimelineItem);
  const addTimelineItem = useProjectStore(s => s.addTimelineItem);
  const bpm = useProjectStore(s => s.bpm);
  const snapToBeat = useProjectStore(s => s.snapToBeat);
  const snapMode = useProjectStore(s => s.snapMode);
  const updateTimelineItem = useProjectStore(s => s.updateTimelineItem);
  const selectedTimelineItemIds = useProjectStore(s => s.selectedTimelineItemIds);
  const toggleTimelineItemSelection = useProjectStore(s => s.toggleTimelineItemSelection);
  const positions = useProjectStore(s => s.positions);
  const selectedPositionId = useProjectStore(s => s.selectedPositionId);
  const selectedPositionIds = useProjectStore(s => s.selectedPositionIds);
  // Subscribe to linkedTimelineItemIds outside the .map hot path. A Set
  // gives O(1) membership checks per item instead of O(n) Array.includes.
  const linkedTimelineItemIds = useProjectStore(s => s.linkedTimelineItemIds);
  const linkedIdSet = useMemo(() => new Set(linkedTimelineItemIds), [linkedTimelineItemIds]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [dropPreview, setDropPreview] = useState<{ time: number; snap: SnapReason } | null>(null);
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

  const computeDropPreview = useCallback((e: React.DragEvent): { time: number; snap: SnapReason } | null => {
    const effectId = e.dataTransfer.getData('application/effect-id');
    // dataTransfer.getData() returns "" during dragOver in most browsers — fall back to types.
    const placingEffect = effectId
      ? EFFECT_LIBRARY.find((ef) => ef.id === effectId)
      : undefined;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const rawTime = x / pixelsPerSecond;
    const trackNeighbours = items.map((it) => ({
      id: it.id,
      startTime: it.startTime,
      effectId: it.effectId,
      durationOverride: it.durationOverride,
    }));
    return resolveDropTime({
      rawTime,
      duration,
      pixelsPerSecond,
      bpm,
      snapToBeat,
      currentTime: useProjectStore.getState().currentTime,
      neighbours: trackNeighbours,
      placing: placingEffect ? { effectId: placingEffect.id } : undefined,
    });
  }, [pixelsPerSecond, duration, bpm, snapToBeat, items]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    const hasEffect = e.dataTransfer.types.includes('application/effect-id');
    if (!hasEffect) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    const preview = computeDropPreview(e);
    if (preview) setDropPreview(preview);
  }, [computeDropPreview]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('application/effect-id')) return;
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
      setDropPreview(null);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    setDropPreview(null);
    const effectId = e.dataTransfer.getData('application/effect-id');
    if (!effectId) return;
    const effect = EFFECT_LIBRARY.find((ef) => ef.id === effectId);
    if (!effect) return;
    if (!isEffectAllowedOnTrack(effect.type, trackIndex)) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const { time } = resolveDropTime({
      rawTime: x / pixelsPerSecond,
      duration,
      pixelsPerSecond,
      bpm,
      snapToBeat,
      currentTime: useProjectStore.getState().currentTime,
      neighbours: items.map((it) => ({
        id: it.id, startTime: it.startTime, effectId: it.effectId, durationOverride: it.durationOverride,
      })),
      placing: { effectId: effect.id },
    });

    const targetIds = selectedPositionIds.length > 0
      ? selectedPositionIds.filter(id => positions.find(p => p.id === id)?.type === 'pyro')
      : selectedPositionId && positions.find(p => p.id === selectedPositionId)?.type === 'pyro'
        ? [selectedPositionId]
        : [];

    if (targetIds.length > 0) {
      let firstId: string | null = null;
      targetIds.forEach((posId, i) => {
        const pos = positions.find(p => p.id === posId);
        if (!pos) return;
        const id = `tl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${i}`;
        if (i === 0) firstId = id;
        addTimelineItem({
          id, effectId: effect.id, startTime: time, trackIndex,
          position: { x: pos.x, y: pos.y, z: pos.z },
          positionId: posId, positionIds: targetIds.length > 1 ? targetIds : undefined, positionName: pos.name,
        });
      });
      if (firstId) markRecentDrop(firstId);
    } else {
      const id = `tl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      addTimelineItem({
        id, effectId: effect.id, startTime: time, trackIndex,
        position: { x: (Math.random() - 0.5) * 16, y: effect.type === 'firework' ? 0 : 5 + Math.random() * 10, z: (Math.random() - 0.5) * 8 },
      });
      markRecentDrop(id);
    }
  }, [pixelsPerSecond, duration, trackIndex, addTimelineItem, bpm, snapToBeat, positions, selectedPositionId, selectedPositionIds, items]);

  const handleItemDragStart = useCallback((e: React.MouseEvent, itemId: string) => {
    const item = timelineItems.find(i => i.id === itemId);
    if (!item) return;
    const startX = e.clientX;
    const startTime = item.startTime;
    let dragActivated = false;

    const handleMove = (me: MouseEvent) => {
      const dx = me.clientX - startX;

      // ── Dead zone: 4px threshold prevents accidental drags ──
      if (!dragActivated) {
        if (Math.abs(dx) < 4) return;
        dragActivated = true;
        dragState.current = { itemId, startX, startTime };
      }

      const dt = dx / pixelsPerSecond;
      let newTime = Math.max(0, Math.min(startTime + dt, duration));

      // Modifier keys: Shift = force quantize to grid centre; Alt = no snap.
      const grid = getActiveGrid({ bpm, snapMode });
      if (me.altKey) {
        // free move — skip both grid and edge snap
      } else if (me.shiftKey) {
        newTime = quantizeTime(newTime, grid);
      } else {
        newTime = snapTime(newTime, grid, pixelsPerSecond);
      }

      // ── Magnetic snap to adjacent items (edge-to-edge) ──
      if (!me.altKey) {
        const snapThresholdSec = 6 / pixelsPerSecond;
        const currentEffect = EFFECT_LIBRARY.find(ef => ef.id === item.effectId);
        const currentDuration = item.durationOverride ?? currentEffect?.duration ?? 2;

        for (const other of timelineItems) {
          if (other.id === itemId || other.trackIndex !== item.trackIndex) continue;
          const otherEffect = EFFECT_LIBRARY.find(ef => ef.id === other.effectId);
          const otherDur = other.durationOverride ?? otherEffect?.duration ?? 2;
          const otherEnd = other.startTime + otherDur;

          // Snap my start to other's end
          if (Math.abs(newTime - otherEnd) < snapThresholdSec) {
            newTime = otherEnd;
            break;
          }
          // Snap my end to other's start
          if (Math.abs((newTime + currentDuration) - other.startTime) < snapThresholdSec) {
            newTime = other.startTime - currentDuration;
            break;
          }
        }
      }

      updateTimelineItem(itemId, { startTime: newTime });
    };
    const handleUp = () => {
      dragState.current = null;
      dragActivated = false;
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
        {/* ── Drop preview guide (live snap timestamp + reason) ── */}
        {dropPreview && (() => {
          const accent = snapAccent(dropPreview.snap);
          const leftPx = dropPreview.time * pixelsPerSecond;
          return (
            <>
              <div
                className={cn("absolute top-0 bottom-0 w-px pointer-events-none z-30", accent.text.replace('text-', 'bg-'))}
                style={{ left: `${leftPx}px`, opacity: 0.85 }}
                aria-hidden
              />
              <div
                className={cn(
                  "absolute -top-4 px-1.5 py-[1px] rounded-sm text-[8px] font-mono tabular-nums pointer-events-none z-30 ring-1 bg-background/90 backdrop-blur-sm fxk-drop-guide",
                  accent.ring, accent.text,
                )}
                style={{ left: `${leftPx}px`, transform: 'translateX(-50%)' }}
                aria-hidden
              >
                {formatDropTimestamp(dropPreview.time)} · {accent.label}
              </div>
            </>
          );
        })()}
        {!muted && items.map((item) => {
          const effect = EFFECT_LIBRARY.find((e) => e.id === item.effectId);
          if (!effect) return null;
          // Virtualize: skip items outside visible scroll range (uses shared helper)
          const effectDuration = item.durationOverride ?? effect.duration;
          const itemLeftPx = item.startTime * pixelsPerSecond;
          const itemWidthPx = Math.max(effectDuration * pixelsPerSecond, 28);
          if (!isInScrollWindow(itemLeftPx, itemWidthPx, { scrollLeft, viewportWidth }, { labelOffsetPx: 96 })) {
            return null;
          }

          // O(1) Set lookup instead of getState()+Array.includes() per item.
          const isLinked = linkedIdSet.has(item.id);
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

const WaypointTrackRow = React.forwardRef<HTMLDivElement, { pixelsPerSecond: number; duration: number; scrollRef: React.RefObject<HTMLDivElement> }>(function WaypointTrackRow({ pixelsPerSecond, duration, scrollRef }, ref) {
    const trajectories = useProjectStore(s => s.trajectories);
  const positions = useProjectStore(s => s.positions);
  const selectedTrajectoryId = useProjectStore(s => s.selectedTrajectoryId);
  const selectTrajectory = useProjectStore(s => s.selectTrajectory);
  const { scrollLeft, viewportWidth } = useScrollViewport(scrollRef);
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
          const endTime = nextWp ? nextWp.time : wp.time + 1;
          const itemLeftPx = wp.time * pixelsPerSecond;
          const widthPx = Math.max((endTime - wp.time) * pixelsPerSecond, 14);
          // Horizontal culling — skip waypoints outside the visible window.
          if (!isInScrollWindow(itemLeftPx, widthPx, { scrollLeft, viewportWidth }, { labelOffsetPx: 96 })) {
            return null;
          }
          const isSelected = selectedTrajectoryId === traj.id;
          return (
            <button
              key={wp.id}
              onClick={(e) => { e.stopPropagation(); selectTrajectory(traj.id); }}
              className={cn(
                "absolute top-0.5 h-7 rounded-md flex items-center px-1 text-[8px] font-mono transition-all cursor-pointer border",
                isSelected ? "border-primary/50 shadow-[0_0_6px_hsl(var(--primary)/0.15)] z-10" : "border-white/[0.04] hover:border-white/[0.08]"
              )}
              style={{ left: `${itemLeftPx}px`, width: `${widthPx}px`, backgroundColor: `${pad.color || '#00B4D8'}15` }}
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

const FormationTrackRow = React.forwardRef<HTMLDivElement, { pixelsPerSecond: number; duration: number; scrollRef: React.RefObject<HTMLDivElement> }>(function FormationTrackRow({ pixelsPerSecond, duration, scrollRef }, _ref) {
    const droneFormations = useProjectStore(s => s.droneFormations);
  const selectFormation = useProjectStore(s => s.selectFormation);
  const selectedFormationId = useProjectStore(s => s.selectedFormationId);
  const { scrollLeft, viewportWidth } = useScrollViewport(scrollRef);
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
          const itemLeftPx = f.startTime * pixelsPerSecond;
          const widthPx = Math.max(totalDuration * pixelsPerSecond, 20);
          if (!isInScrollWindow(itemLeftPx, widthPx, { scrollLeft, viewportWidth }, { labelOffsetPx: 96 })) {
            return null;
          }
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
              style={{ left: `${itemLeftPx}px`, width: `${widthPx}px`, backgroundColor: `${f.color}15` }}
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
function DroneFXTrackRow({ pixelsPerSecond, duration, scrollRef }: { pixelsPerSecond: number; duration: number; scrollRef: React.RefObject<HTMLDivElement> }) {
  const { scrollLeft, viewportWidth } = useScrollViewport(scrollRef);
    const droneFormations = useProjectStore(s => s.droneFormations);
  const timelineItems = useProjectStore(s => s.timelineItems);
  const selectedTimelineItemId = useProjectStore(s => s.selectedTimelineItemId);
  const selectTimelineItem = useProjectStore(s => s.selectTimelineItem);
  const addTimelineItem = useProjectStore(s => s.addTimelineItem);
  const updateDroneFormation = useProjectStore(s => s.updateDroneFormation);
  const materializeFormation = useProjectStore(s => s.materializeFormation);
  const bpm = useProjectStore(s => s.bpm);
  const snapToBeat = useProjectStore(s => s.snapToBeat);
  const recentDropId = useRecentDropId();

  const droneFxItems = useMemo(() => timelineItems.filter((i) => i.trackIndex === 3), [timelineItems]);
  const [dropPreview, setDropPreview] = useState<{ time: number; snap: SnapReason } | null>(null);

  const computePreview = useCallback((e: React.DragEvent): { time: number; snap: SnapReason } => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    return resolveDropTime({
      rawTime: x / pixelsPerSecond,
      duration, pixelsPerSecond, bpm, snapToBeat,
      currentTime: useProjectStore.getState().currentTime,
      neighbours: droneFxItems.map((it) => ({
        id: it.id, startTime: it.startTime, effectId: it.effectId, durationOverride: it.durationOverride,
      })),
    });
  }, [pixelsPerSecond, duration, bpm, snapToBeat, droneFxItems]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    const hasEffect = e.dataTransfer.types.includes('application/effect-id');
    const hasFormation = e.dataTransfer.types.includes('application/formation-id');
    if (!hasEffect && !hasFormation) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setDropPreview(computePreview(e));
  }, [computePreview]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropPreview(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDropPreview(null);
    const { time } = computePreview(e);

    const formationId = e.dataTransfer.getData('application/formation-id');
    if (formationId) {
      const formation = useProjectStore.getState().droneFormations.find(f => f.id === formationId);
      if (!formation) return;
      const repositioned = { ...formation, startTime: time };
      updateDroneFormation(formation.id, { startTime: time });
      materializeFormation(repositioned);
      return;
    }

    const effectId = e.dataTransfer.getData('application/effect-id');
    if (!effectId) return;
    const effect = EFFECT_LIBRARY.find((ef) => ef.id === effectId);
    if (!effect || effect.type !== 'drone') return;

    const id = `tl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    addTimelineItem({
      id, effectId: effect.id, startTime: time, trackIndex: 3,
      position: { x: 0, y: 20, z: 0 },
    });
    markRecentDrop(id);
  }, [addTimelineItem, computePreview, updateDroneFormation, materializeFormation]);

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
        onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
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
          const isRecentDrop = recentDropId === item.id;
          return (
            <button
              key={item.id}
              onClick={(e) => { e.stopPropagation(); selectTimelineItem(item.id); }}
              className={cn(
                "absolute top-0.5 h-7 rounded-md flex items-center px-1.5 text-[8px] font-mono transition-all cursor-pointer border",
                isSelected ? "border-primary/50 shadow-[0_0_6px_hsl(var(--primary)/0.15)] z-10" : "border-white/[0.04] hover:border-white/[0.08]",
                isRecentDrop && "fxk-drop-flash",
              )}
              style={{ left: `${item.startTime * pixelsPerSecond}px`, width: `${Math.max(effect.duration * pixelsPerSecond, 20)}px`, backgroundColor: `${effect.color}15` }}
            >
              <div className="w-[2px] h-full rounded-full mr-1 flex-shrink-0" style={{ backgroundColor: effect.color }} />
              <span className="truncate text-muted-foreground/60">{effect.name}</span>
            </button>
          );
        })}
        {dropPreview && (() => {
          const accent = snapAccent(dropPreview.snap);
          const leftPx = dropPreview.time * pixelsPerSecond;
          return (
            <>
              <div
                className={cn("absolute top-0 bottom-0 w-px pointer-events-none z-30", accent.text.replace('text-', 'bg-'))}
                style={{ left: `${leftPx}px`, opacity: 0.85 }}
                aria-hidden
              />
              <div
                className={cn(
                  "absolute -top-4 px-1.5 py-[1px] rounded-sm text-[8px] font-mono tabular-nums pointer-events-none z-30 ring-1 bg-background/90 backdrop-blur-sm fxk-drop-guide",
                  accent.ring, accent.text,
                )}
                style={{ left: `${leftPx}px`, transform: 'translateX(-50%)' }}
                aria-hidden
              >
                {formatDropTimestamp(dropPreview.time)} · {accent.label}
              </div>
            </>
          );
        })()}
      </div>
    </div>
  );
}

// ── LASER Track — shows laser cues with live preview state ──
function LaserTrackRow({ pixelsPerSecond, duration, scrollRef }: { pixelsPerSecond: number; duration: number; scrollRef: React.RefObject<HTMLDivElement> }) {
  const { scrollLeft, viewportWidth } = useScrollViewport(scrollRef);
    const timelineItems = useProjectStore(s => s.timelineItems);
  const selectedTimelineItemId = useProjectStore(s => s.selectedTimelineItemId);
  const selectTimelineItem = useProjectStore(s => s.selectTimelineItem);
  const addTimelineItem = useProjectStore(s => s.addTimelineItem);
  const bpm = useProjectStore(s => s.bpm);
  const snapToBeat = useProjectStore(s => s.snapToBeat);
  const laserEnabled = useLaserPreviewStore((s) => s.globalEnabled);
  const [collapsed, setCollapsed] = useState(false);
  const recentDropId = useRecentDropId();

  const laserItems = useMemo(() => timelineItems.filter((i) => {
    const effect = EFFECT_LIBRARY.find((e) => e.id === i.effectId);
    return effect?.type === 'laser';
  }), [timelineItems]);

  const [dropPreview, setDropPreview] = useState<{ time: number; snap: SnapReason } | null>(null);

  const computePreview = useCallback((e: React.DragEvent): { time: number; snap: SnapReason } => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    return resolveDropTime({
      rawTime: x / pixelsPerSecond,
      duration, pixelsPerSecond, bpm, snapToBeat,
      currentTime: useProjectStore.getState().currentTime,
      neighbours: laserItems.map((it) => ({
        id: it.id, startTime: it.startTime, effectId: it.effectId, durationOverride: it.durationOverride,
      })),
    });
  }, [pixelsPerSecond, duration, bpm, snapToBeat, laserItems]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    const hasEffect = e.dataTransfer.types.includes('application/effect-id');
    if (!hasEffect) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setDropPreview(computePreview(e));
  }, [computePreview]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropPreview(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDropPreview(null);
    const effectId = e.dataTransfer.getData('application/effect-id');
    if (!effectId) return;
    const effect = EFFECT_LIBRARY.find((ef) => ef.id === effectId);
    if (!effect || effect.type !== 'laser') return;
    const { time } = computePreview(e);
    const id = `tl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    addTimelineItem({
      id, effectId: effect.id, startTime: time, trackIndex: 4,
      position: { x: 0, y: 0.5, z: 0 },
    });
    markRecentDrop(id);
  }, [addTimelineItem, computePreview]);

  return (
    <div className="flex border-b border-white/[0.03]">
      <div className="w-24 flex-shrink-0 flex items-center px-2.5 border-r border-white/[0.04] cursor-pointer" style={{ background: 'hsl(var(--card))' }} onClick={() => setCollapsed(!collapsed)}>
        {collapsed ? <ChevronRight className="w-2.5 h-2.5 text-muted-foreground/30 mr-1" /> : <ChevronDown className="w-2.5 h-2.5 text-muted-foreground/30 mr-1" />}
        <Zap className="w-2.5 h-2.5 mr-1.5" style={{ color: '#00FF88' }} />
        <span className="text-[9px] font-semibold text-muted-foreground/50 uppercase tracking-[0.08em]">Laser</span>
        {laserEnabled && <div className="w-1.5 h-1.5 rounded-full bg-green-400 ml-auto animate-pulse" />}
      </div>
      {!collapsed && (
        <div
          className="flex-1 relative h-8"
          style={{ background: 'hsl(var(--background) / 0.4)' }}
          onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
        >
          {laserItems.map((item) => {
            const effect = EFFECT_LIBRARY.find((e) => e.id === item.effectId);
            if (!effect) return null;
            const isSelected = selectedTimelineItemId === item.id;
            const isRecentDrop = recentDropId === item.id;
            const widthPx = Math.max(effect.duration * pixelsPerSecond, 20);
            return (
              <button
                key={item.id}
                onClick={(e) => { e.stopPropagation(); selectTimelineItem(item.id); }}
                className={cn(
                  "absolute top-0.5 h-7 rounded-md flex items-center px-1.5 text-[8px] font-mono transition-all cursor-pointer border",
                  isSelected ? "border-primary/50 shadow-[0_0_6px_hsl(var(--primary)/0.15)] z-10" : "border-white/[0.04] hover:border-white/[0.08]",
                  isRecentDrop && "fxk-drop-flash",
                )}
                style={{ left: `${item.startTime * pixelsPerSecond}px`, width: `${widthPx}px`, backgroundColor: `${effect.color}15` }}
              >
                <Zap className="w-2 h-2 mr-0.5 flex-shrink-0" style={{ color: effect.color }} />
                <span className="truncate text-muted-foreground/60">{effect.name}</span>
              </button>
            );
          })}
          {dropPreview && (() => {
            const accent = snapAccent(dropPreview.snap);
            const leftPx = dropPreview.time * pixelsPerSecond;
            return (
              <>
                <div
                  className={cn("absolute top-0 bottom-0 w-px pointer-events-none z-30", accent.text.replace('text-', 'bg-'))}
                  style={{ left: `${leftPx}px`, opacity: 0.85 }}
                  aria-hidden
                />
                <div
                  className={cn(
                    "absolute -top-4 px-1.5 py-[1px] rounded-sm text-[8px] font-mono tabular-nums pointer-events-none z-30 ring-1 bg-background/90 backdrop-blur-sm fxk-drop-guide",
                    accent.ring, accent.text,
                  )}
                  style={{ left: `${leftPx}px`, transform: 'translateX(-50%)' }}
                  aria-hidden
                >
                  {formatDropTimestamp(dropPreview.time)} · {accent.label}
                </div>
              </>
            );
          })()}
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

/** Playhead rendered via direct DOM manipulation — no React re-renders during playback.
 *  The top "handle" (bolinha) is interactive so the operator can grab the playhead
 *  directly to scrub. The vertical line stays pointer-events-none so it never
 *  blocks clicks on timeline items below it. */
function PlayheadIndicator({
  pixelsPerSecond,
  snapMode,
  onScrubPointerDown,
}: {
  pixelsPerSecond: number;
  snapMode: SnapMode;
  onScrubPointerDown?: (e: React.PointerEvent<HTMLDivElement>) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const tcRef = useRef<HTMLDivElement>(null);
  const showTimecode = snapMode === 'frame';

  useEffect(() => {
    const formatTC = (t: number): string => {
      // Frame-accurate HH:MM:SS:FF using current SMPTE frame rate (drop-frame aware)
      const fr = useSMPTEStore.getState().frameRate;
      const isDrop = fr === 29.97;
      const nominalFps = isDrop ? 30 : Math.round(fr);
      const totalFrames = Math.max(0, Math.round(t * fr));
      const fps = nominalFps;
      const ff = totalFrames % fps;
      const totalSec = Math.floor(totalFrames / fps);
      const ss = totalSec % 60;
      const mm = Math.floor(totalSec / 60) % 60;
      const hh = Math.floor(totalSec / 3600);
      const sep = isDrop ? ';' : ':';
      const pad = (n: number) => n.toString().padStart(2, '0');
      return `${pad(hh)}:${pad(mm)}:${pad(ss)}${sep}${pad(ff)}`;
    };

    const initial = useProjectStore.getState().currentTime;
    if (ref.current) ref.current.style.transform = `translateX(${initial * pixelsPerSecond}px)`;
    if (tcRef.current && showTimecode) tcRef.current.textContent = formatTC(initial);
    const unsub = useProjectStore.subscribe((state) => {
      if (ref.current) ref.current.style.transform = `translateX(${state.currentTime * pixelsPerSecond}px)`;
      if (tcRef.current && showTimecode) tcRef.current.textContent = formatTC(state.currentTime);
    });
    return unsub;
  }, [pixelsPerSecond, showTimecode]);

  return (
    <div ref={ref} className="absolute top-0 bottom-0 w-px z-20 pointer-events-none" style={{ transform: 'translateX(0px)' }}>
      {/* Grab handle — larger hit area for touch (12px) */}
      <div
        role="slider"
        aria-label="Scrub playhead"
        className="absolute -top-1 -left-2 w-4 h-4 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.5)] pointer-events-auto cursor-ew-resize touch-none"
        onPointerDown={onScrubPointerDown}
      />
      <div className="absolute top-0 w-px h-full bg-gradient-to-b from-primary via-primary/30 to-transparent" />
      {showTimecode && (
        <div
          ref={tcRef}
          aria-label="Playhead timecode"
          className="absolute top-4 left-1.5 px-1.5 py-0.5 rounded-sm bg-background/85 border border-primary/40 text-primary text-[10px] font-mono leading-none whitespace-nowrap shadow-[0_0_6px_hsl(var(--primary)/0.35)] tabular-nums select-none"
        >
          00:00:00:00
        </div>
      )}
    </div>
  );
}

const MIN_PPS = 4;
const MAX_PPS = 80;

const Timeline = React.forwardRef<HTMLDivElement, Record<string, never>>(function Timeline(_props, _ref) {
  useRenderCounter('Timeline');
    const isPlaying = useProjectStore(s => s.isPlaying);
  const setPlaying = useProjectStore(s => s.setPlaying);
  const currentTime = useProjectStore(s => s.currentTime);
  const setCurrentTime = useProjectStore(s => s.setCurrentTime);
  const duration = useProjectStore(s => s.duration);
  const selectedTimelineItemId = useProjectStore(s => s.selectedTimelineItemId);
  const removeTimelineItem = useProjectStore(s => s.removeTimelineItem);
  const timelineItems = useProjectStore(s => s.timelineItems);
  const playbackSpeed = useProjectStore(s => s.playbackSpeed);
  const setPlaybackSpeed = useProjectStore(s => s.setPlaybackSpeed);
  const bpm = useProjectStore(s => s.bpm);
  const snapToBeat = useProjectStore(s => s.snapToBeat);
  const snapMode = useProjectStore(s => s.snapMode);
  const setSnapMode = useProjectStore(s => s.setSnapMode);
  const setSnapToBeat = useProjectStore(s => s.setSnapToBeat);
  const selectedTimelineItemIds = useProjectStore(s => s.selectedTimelineItemIds);
  const clearTimelineItemSelection = useProjectStore(s => s.clearTimelineItemSelection);
  const duplicateTimelineItems = useProjectStore(s => s.duplicateTimelineItems);
  const removeMultipleTimelineItems = useProjectStore(s => s.removeMultipleTimelineItems);
  const { chip: transportChip, toggle: togglePlayback } = useTransportDiagnostics();
  const scrollRef = useRef<HTMLDivElement>(null);
  // Hydrate zoom + scroll from localStorage. Wrapped in try/catch — if the
  // storage layer ever throws (Safari private mode, SecurityError, etc.) we
  // fall back to safe defaults so the timeline never fails to mount.
  const persistedView = useRef<ReturnType<typeof loadTimelineView>>(
    (() => { try { return loadTimelineView(); } catch { return {}; } })()
  ).current;
  const [pixelsPerSecond, setPixelsPerSecond] = useState(() => {
    const v = persistedView.pixelsPerSecond;
    if (typeof v !== 'number' || !Number.isFinite(v)) return 12;
    return Math.min(MAX_PPS, Math.max(MIN_PPS, v));
  });
  const [scrollLeft, setScrollLeft] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(1200);

  // Persist zoom (cheap — fires only when user zooms).
  useEffect(() => { saveTimelineView({ pixelsPerSecond }); }, [pixelsPerSecond]);

  // Restore scroll position once after the scroll container is mounted and laid out.
  const scrollRestoredRef = useRef(false);
  useEffect(() => {
    if (scrollRestoredRef.current) return;
    const el = scrollRef.current;
    const target = persistedView.scrollLeft;
    if (!el || typeof target !== 'number' || !isFinite(target) || target <= 0) {
      scrollRestoredRef.current = true;
      return;
    }
    // Wait one frame so child tracks have laid out and scrollWidth is final.
    const raf = requestAnimationFrame(() => {
      if (!scrollRef.current) return;
      scrollRef.current.scrollLeft = target;
      setScrollLeft(scrollRef.current.scrollLeft);
      scrollRestoredRef.current = true;
    });
    return () => cancelAnimationFrame(raf);
  }, [persistedView.scrollLeft]);

  // Throttled persistence of scroll position (1 write per 250ms max).
  const scrollSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!scrollRestoredRef.current) return;
    if (scrollSaveTimer.current) clearTimeout(scrollSaveTimer.current);
    scrollSaveTimer.current = setTimeout(() => {
      saveTimelineView({ scrollLeft });
    }, 250);
    return () => { if (scrollSaveTimer.current) clearTimeout(scrollSaveTimer.current); };
  }, [scrollLeft]);

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

      // ── Zoom shortcuts (Ctrl/Cmd + / - / 0) ──
      if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '=')) {
        e.preventDefault();
        setPixelsPerSecond((p) => Math.min(MAX_PPS, p * 1.3));
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '-') {
        e.preventDefault();
        setPixelsPerSecond((p) => Math.max(MIN_PPS, p / 1.3));
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault();
        const el = scrollRef.current;
        const w = el ? el.clientWidth - 96 : 1200;
        if (duration > 0 && w > 0) {
          setPixelsPerSecond(Math.min(MAX_PPS, Math.max(MIN_PPS, w / duration)));
        }
      }

      // ── Nudge shortcuts: arrow keys move selection by 1 grid unit ──
      // Multi-select preserves relative spacing: we compute ONE effective delta clamped
      // by the group's leftmost/rightmost startTime so the entire selection moves rigidly
      // without ever collapsing or stretching when hitting [0, duration] bounds.
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const ids = selectedTimelineItemIds.length > 0
          ? selectedTimelineItemIds
          : selectedTimelineItemId ? [selectedTimelineItemId] : [];
        if (ids.length === 0) return;
        e.preventDefault();
        const dir = e.key === 'ArrowRight' ? 1 : -1;
        const fps = timecodeProvider.getFPS() || 60;
        let delta: number;
        if (e.altKey) {
          delta = dir / fps; // 1 frame
        } else if (e.shiftKey) {
          delta = dir * 1; // 1 second
        } else {
          const grid = getActiveGrid({ bpm, snapMode });
          delta = dir * (grid.interval > 0 ? grid.interval : 1 / fps);
        }
        const allItems = useProjectStore.getState().timelineItems;
        const selected = ids
          .map((id) => allItems.find((i) => i.id === id))
          .filter((i): i is NonNullable<typeof i> => !!i);
        if (selected.length === 0) return;

        // Compute the group's allowed shift so spacing is preserved.
        const minStart = selected.reduce((m, it) => Math.min(m, it.startTime), Infinity);
        const maxStart = selected.reduce((m, it) => Math.max(m, it.startTime), -Infinity);
        const minAllowed = -minStart;                           // can't push leftmost below 0
        const maxAllowed = Math.max(0, duration - maxStart);    // can't push rightmost past duration
        let effectiveDelta = Math.max(minAllowed, Math.min(maxAllowed, delta));

        // Ctrl/Cmd: snap the GROUP shift to the grid (single quantize on delta), still rigid.
        if (e.ctrlKey || e.metaKey) {
          const grid = getActiveGrid({ bpm, snapMode });
          if (grid.interval > 0) {
            const snappedTarget = quantizeTime(minStart + effectiveDelta, grid);
            effectiveDelta = snappedTarget - minStart;
            // Re-clamp after snapping so we still respect bounds.
            effectiveDelta = Math.max(minAllowed, Math.min(maxAllowed, effectiveDelta));
          }
        }

        if (Math.abs(effectiveDelta) < 1e-9) return; // nothing to do (already at edge)

        const updateItem = useProjectStore.getState().updateTimelineItem;
        selected.forEach((it) => {
          updateItem(it.id, { startTime: it.startTime + effectiveDelta });
        });
      }

      // ── Quantize to grid (Q) — aligns selected items to active snap mode ──
      if (!e.ctrlKey && !e.metaKey && !e.altKey && (e.key === 'q' || e.key === 'Q')) {
        const ids = selectedTimelineItemIds.length > 0
          ? selectedTimelineItemIds
          : selectedTimelineItemId ? [selectedTimelineItemId] : [];
        if (ids.length === 0) return;
        e.preventDefault();
        quantizeRef.current?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, selectedTimelineItemId, selectedTimelineItemIds, timelineItems, bpm, snapMode, duration]);

  // ─── Drag-to-scrub on the track + playhead ──────────────────────────
  // Pointer Events cover mouse, touch and pen in one handler.
  // While dragging, we throttle store writes to one per RAF so that the
  // SkyCanvas (drones, light points, shells) re-renders smoothly without
  // flooding zustand subscribers. Snap-to-beat is applied only on release
  // to avoid stair-stepping during the drag.
  const scrubbingRef = useRef(false);
  const wasPlayingBeforeScrubRef = useRef(false);
  const pendingScrubTimeRef = useRef<number | null>(null);
  const scrubRafRef = useRef<number | null>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const scrubTargetElRef = useRef<HTMLElement | null>(null);

  const computeTimeFromClientX = useCallback(
    (clientX: number): number => {
      const el = scrollRef.current;
      if (!el) return 0;
      const rect = el.getBoundingClientRect();
      const x = clientX - rect.left + el.scrollLeft - 96;
      if (x < 0) return 0;
      return Math.max(0, Math.min(x / pixelsPerSecond, duration));
    },
    [duration, pixelsPerSecond],
  );

  const flushScrubTime = useCallback(() => {
    scrubRafRef.current = null;
    const t = pendingScrubTimeRef.current;
    if (t !== null) setCurrentTime(t);
  }, [setCurrentTime]);

  const queueScrubTime = useCallback((time: number) => {
    pendingScrubTimeRef.current = time;
    if (scrubRafRef.current !== null) return;
    scrubRafRef.current = requestAnimationFrame(flushScrubTime);
  }, [flushScrubTime]);

  const handleScrubPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      // Ignore non-primary buttons (right click, middle click)
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      // Don't intercept clicks on timeline items, resize handles, etc.
      const target = e.target as HTMLElement;
      if (target.closest('[data-timeline-item]')) return;

      scrubbingRef.current = true;
      activePointerIdRef.current = e.pointerId;
      scrubTargetElRef.current = e.currentTarget;
      wasPlayingBeforeScrubRef.current = useProjectStore.getState().isPlaying;
      if (wasPlayingBeforeScrubRef.current) timelineTransport.pause();

      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* ignore — some embedded browsers throw on capture */
      }

      const time = computeTimeFromClientX(e.clientX);
      queueScrubTime(time);

      if (!e.shiftKey && !e.ctrlKey && !e.metaKey) clearTimelineItemSelection();
    },
    [computeTimeFromClientX, queueScrubTime, clearTimelineItemSelection],
  );

  const handleScrubPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!scrubbingRef.current) return;
      if (activePointerIdRef.current !== null && e.pointerId !== activePointerIdRef.current) return;
      const time = computeTimeFromClientX(e.clientX);
      queueScrubTime(time);
    },
    [computeTimeFromClientX, queueScrubTime],
  );

  const endScrub = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!scrubbingRef.current) return;
      if (activePointerIdRef.current !== null && e.pointerId !== activePointerIdRef.current) return;
      scrubbingRef.current = false;

      // Flush any pending RAF write before applying snap.
      if (scrubRafRef.current !== null) {
        cancelAnimationFrame(scrubRafRef.current);
        scrubRafRef.current = null;
      }

      const finalTime = pendingScrubTimeRef.current ?? computeTimeFromClientX(e.clientX);
      pendingScrubTimeRef.current = null;
      const grid = getActiveGrid({ bpm, snapMode });
      const snapped = snapTime(finalTime, grid, pixelsPerSecond);
      setCurrentTime(snapped);

      try {
        const captureTarget = scrubTargetElRef.current ?? e.currentTarget;
        if (captureTarget && captureTarget.hasPointerCapture?.(e.pointerId)) {
          captureTarget.releasePointerCapture(e.pointerId);
        }
      } catch {
        /* ignore */
      }
      activePointerIdRef.current = null;
      scrubTargetElRef.current = null;

      if (wasPlayingBeforeScrubRef.current) {
        wasPlayingBeforeScrubRef.current = false;
        timelineTransport.play();
      }
    },
    [bpm, snapMode, pixelsPerSecond, computeTimeFromClientX, setCurrentTime],
  );

  // Cancel any pending RAF on unmount.
  useEffect(() => {
    return () => {
      if (scrubRafRef.current !== null) {
        cancelAnimationFrame(scrubRafRef.current);
        scrubRafRef.current = null;
      }
    };
  }, []);


  const handleDeleteSelected = () => {
    if (selectedTimelineItemIds.length > 0) { removeMultipleTimelineItems(selectedTimelineItemIds); }
    else if (selectedTimelineItemId) { removeTimelineItem(selectedTimelineItemId); }
  };

  const handleDuplicate = () => {
    const ids = selectedTimelineItemIds.length > 0 ? selectedTimelineItemIds : selectedTimelineItemId ? [selectedTimelineItemId] : [];
    if (ids.length > 0) duplicateTimelineItems(ids);
  };

  const quantizeRef = useRef<(() => void) | null>(null);

  /** Quantize selected timeline items' startTime to the active grid (auto/beat/frame).
   *  No-op when snapMode === 'off' or when grid.interval <= 0. Reports outcome via toast. */
  const handleQuantizeSelected = useCallback(() => {
    const ids = selectedTimelineItemIds.length > 0
      ? selectedTimelineItemIds
      : selectedTimelineItemId ? [selectedTimelineItemId] : [];
    if (ids.length === 0) {
      toast.info('Quantize: no timeline items selected');
      return;
    }
    if (snapMode === 'off') {
      toast.warning('Quantize: snap mode is OFF — switch to Auto/Beat/Frame first');
      return;
    }
    const grid = getActiveGrid({ bpm, snapMode });
    if (!grid.interval || grid.interval <= 0) {
      toast.warning('Quantize: active grid has no interval');
      return;
    }
    const updateItem = useProjectStore.getState().updateTimelineItem;
    const items = useProjectStore.getState().timelineItems;
    let moved = 0;
    ids.forEach((id) => {
      const it = items.find((i) => i.id === id);
      if (!it) return;
      const q = quantizeTime(it.startTime, grid);
      const clamped = Math.max(0, Math.min(duration || q, q));
      if (Math.abs(clamped - it.startTime) > 1e-6) {
        updateItem(id, { startTime: clamped });
        moved++;
      }
    });
    toast.success(`Quantized ${moved}/${ids.length} item${ids.length > 1 ? 's' : ''} to ${grid.label}`);
  }, [selectedTimelineItemIds, selectedTimelineItemId, snapMode, bpm, duration]);

  // Keep ref in sync so keyboard shortcut (Q) can call latest version without re-binding listeners.
  useEffect(() => { quantizeRef.current = handleQuantizeSelected; }, [handleQuantizeSelected]);

  const zoomIn = () => setPixelsPerSecond((p) => Math.min(MAX_PPS, p * 1.3));
  const zoomOut = () => setPixelsPerSecond((p) => Math.max(MIN_PPS, p / 1.3));
  const zoomPercent = Math.round((pixelsPerSecond / 12) * 100);

  // Progress percentage for the scrubber
  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex h-full flex-col border-t border-border/20 bg-card/95 shadow-[inset_0_1px_0_hsl(var(--border)/0.08)] backdrop-blur-xl">
      {/* ─── Transport Bar ─── */}
      <div className="flex items-center gap-1 border-b border-border/15 bg-surface-0/70 px-2.5 py-1">
        {/* Play controls */}
        <div className="flex items-center gap-px rounded-lg p-px" style={{ background: 'hsl(var(--muted) / 0.15)' }}>
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md hover:bg-white/[0.06]" onClick={() => timelineTransport.rewind()}>
            <SkipBack className="h-3 w-3 text-muted-foreground" />
          </Button>
          <Button
            variant="ghost" size="icon"
            className={cn("h-8 w-8 rounded-md transition-all", isPlaying ? "bg-primary/12 text-primary" : "hover:bg-white/[0.06]")}
            onClick={() => togglePlayback()}
          >
            {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 ml-0.5" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md hover:bg-white/[0.06]" onClick={() => timelineTransport.stop()}>
            <Square className="h-2.5 w-2.5 text-muted-foreground" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md hover:bg-white/[0.06]" onClick={() => timelineTransport.seekTo(Math.min(currentTime + 10, duration))}>
            <SkipForward className="h-3 w-3 text-muted-foreground" />
          </Button>
          {/* Resync timeline — re-locks TimelineClock to audio.currentTime
              and retries playback. Useful when the watchdog detects a
              stall or the operator wants to force a re-lock manually. */}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-md hover:bg-accent/[0.12]"
            disabled={!getAudioMaster()}
            title="Resync timeline to audio"
            onClick={() => resyncTimeline({ reason: 'Manual resync from toolbar.' })}
          >
            <RefreshCw className="h-3 w-3 text-accent" />
          </Button>
        </div>

        {/* Timecode — large mono display */}
        <div className="px-3 py-0.5 rounded-lg border border-white/[0.04]" style={{ background: 'hsl(var(--background) / 0.5)' }}>
          <span className="font-mono text-[13px] text-primary font-bold tabular-nums tracking-tight">{formatTime(currentTime)}</span>
          <span className="text-muted-foreground/20 text-[10px] mx-1">/</span>
          <span className="font-mono text-[13px] text-muted-foreground/35 tabular-nums tracking-tight">{formatTime(duration)}</span>
        </div>

        {/* Clock health badge — running / stalled / recovered, fed by the
            same watchdog that drives auto-recovery (`useTimelineClockHealthCheck`). */}
        <div className="flex items-center gap-1">
          <TimelineHealthBadge />
          <TimelineHealthLogPopover />
          <TimelineHealthSettingsPopover />
        </div>

        {/* Transport diagnostic chip — explains why Play may not advance (0×, END, EXT) */}
        {transportChip && (
          <div
            className={cn(
              "flex items-center px-1.5 h-5 rounded-md ring-1 tabular-nums",
              transportChip.tone === 'warning' && "ring-[hsl(var(--warning)/0.45)] bg-[hsl(var(--warning)/0.08)]",
              transportChip.tone === 'accent' && "ring-[hsl(var(--accent)/0.45)] bg-[hsl(var(--accent)/0.08)]",
            )}
            title={transportChip.reason}
            aria-label={transportChip.reason}
          >
            <span className={cn(
              "text-[9px] font-mono font-bold tracking-wider",
              transportChip.tone === 'warning' && "text-[hsl(var(--warning))]",
              transportChip.tone === 'accent' && "text-[hsl(var(--accent))]",
            )}>{transportChip.label}</span>
          </div>
        )}

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

        {/* Snap mode segmented control: Auto / Beat / Frame / Off */}
        {(() => {
          const activeGrid = getActiveGrid({ bpm, snapMode });
          return (
            <div className="flex items-center gap-1">
              <div className="flex items-center gap-px rounded-lg p-px" style={{ background: 'hsl(var(--muted) / 0.1)' }} title="Snap mode (drag/drop quantization)">
                <Magnet className="h-2.5 w-2.5 text-muted-foreground/50 ml-1 mr-0.5" />
                {(['auto', 'beat', 'frame', 'off'] as const).map((m) => (
                  <button
                    key={m}
                    className={cn(
                      "text-[8px] font-mono uppercase px-1.5 py-0.5 rounded-md transition-all tracking-wider",
                      snapMode === m
                        ? "bg-accent/12 text-accent"
                        : "text-muted-foreground/35 hover:text-muted-foreground/55",
                    )}
                    onClick={() => setSnapMode(m)}
                  >{m}</button>
                ))}
              </div>
              <span className="text-[8px] font-mono text-muted-foreground/45 tabular-nums" title="Active snap unit">
                {activeGrid.label}
              </span>
            </div>
          );
        })()}

        {/* LIVE indicator placeholder */}
        <div className="badge-live hidden" id="live-badge">● LIVE</div>

        {/* Multi-select */}
        {selectionCount > 1 && (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-primary/[0.06] border border-primary/10">
            <span className="text-[8px] font-mono text-primary font-semibold">{selectionCount} sel</span>
            <Button variant="ghost" size="icon" className="h-5 w-5 rounded" onClick={handleDuplicate}><Copy className="h-2.5 w-2.5" /></Button>
          </div>
        )}

        {/* Quantize to grid — aligns selected items to the active snap mode (Q) */}
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-6 w-6 rounded-md transition-all",
            (selectionCount > 0 && snapMode !== 'off')
              ? "text-accent hover:bg-accent/10"
              : "text-muted-foreground/30 hover:text-muted-foreground/50",
          )}
          disabled={selectionCount === 0 || snapMode === 'off'}
          onClick={handleQuantizeSelected}
          title={
            selectionCount === 0
              ? 'Quantize: select items first'
              : snapMode === 'off'
                ? 'Quantize: enable snap (Auto/Beat/Frame)'
                : `Quantize ${selectionCount} item${selectionCount > 1 ? 's' : ''} to ${getActiveGrid({ bpm, snapMode }).label} (Q)`
          }
          aria-label="Quantize selected items to grid"
        >
          <AlignVerticalJustifyCenter className="h-3 w-3" />
        </Button>

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
      <div className="relative h-[2px] w-full bg-muted/10">
        <div className="h-full bg-primary/40 transition-[width] duration-75" style={{ width: `${progressPct}%` }} />
      </div>

      {/* ─── Timeline tracks ─── */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-x-auto overflow-y-auto bg-surface-0/45"
        onPointerDown={handleScrubPointerDown}
        onPointerMove={handleScrubPointerMove}
        onPointerUp={endScrub}
        onPointerCancel={endScrub}
        style={{ touchAction: scrubbingRef.current ? 'none' : 'auto' }}
      >
        <div style={{ width: `${duration * pixelsPerSecond + 96}px` }}>
          <div className="flex">
            <div className="w-24 flex-shrink-0" />
            <div className="flex-1 relative">
              <TimeRuler duration={duration} pixelsPerSecond={pixelsPerSecond} scrollLeft={scrollLeft} viewportWidth={viewportWidth} />
              <TimelineGrid duration={duration} pixelsPerSecond={pixelsPerSecond} bpm={bpm} snapMode={snapMode} scrollLeft={scrollLeft} viewportWidth={viewportWidth} />
              {/* Playhead — DOM-direct updates via transient Zustand subscription (zero re-renders) */}
              <PlayheadIndicator pixelsPerSecond={pixelsPerSecond} snapMode={snapMode} onScrubPointerDown={handleScrubPointerDown} />

            </div>
          </div>
          {/* ── FIRING SYSTEMS group ── */}
          <CollapsibleTrackGroup label="FIRING SYSTEMS" defaultOpen>
            <PyroTimelineTrack pixelsPerSecond={pixelsPerSecond} duration={duration} />
            <TimelineTrackRow label="PYRO SYS" trackIndex={0} pixelsPerSecond={pixelsPerSecond} color="#FF6B35" duration={duration} scrollRef={scrollRef} />
            <TimelineTrackRow label="DRONE SYS" trackIndex={1} pixelsPerSecond={pixelsPerSecond} color="#00B4D8" duration={duration} scrollRef={scrollRef} />
            <TimelineTrackRow label="LIGHT SYS" trackIndex={2} pixelsPerSecond={pixelsPerSecond} color="#FBBF24" duration={duration} scrollRef={scrollRef} />
            <LaserTrackRow pixelsPerSecond={pixelsPerSecond} duration={duration} scrollRef={scrollRef} />
            <GenerativeTrackRow pixelsPerSecond={pixelsPerSecond} duration={duration} />
          </CollapsibleTrackGroup>
          {/* ── CHOREOGRAPHY group ── */}
          <CollapsibleTrackGroup label="CHOREOGRAPHY" defaultOpen>
            <FormationTrackRow pixelsPerSecond={pixelsPerSecond} duration={duration} scrollRef={scrollRef} />
            <DroneFXTrackRow pixelsPerSecond={pixelsPerSecond} duration={duration} scrollRef={scrollRef} />
            <WaypointTrackRow pixelsPerSecond={pixelsPerSecond} duration={duration} scrollRef={scrollRef} />
          </CollapsibleTrackGroup>
          <AudioWaveform pixelsPerSecond={pixelsPerSecond} />
        </div>
      </div>
    </div>
  );
});

export default Timeline;
