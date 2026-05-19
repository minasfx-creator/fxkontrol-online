/**
 * Pyrotechnic Timeline Visualizer
 * Shows pyro cues as colored bars grouped by formation, synchronized with the main timeline.
 * Each bar represents a timeline item (pyro effect) with color-coded category indicators.
 */
import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { useProjectStore } from '@/store/useProjectStore';
import { type TimelineItem } from '@/types/projectTypes';
import { type Effect } from '@/data/effectLibrary';
import { getEffectById } from '@/data/effectsLibraries/lookup';
import { cn } from '@/lib/utils';
import { Flame, ChevronDown, ChevronRight } from 'lucide-react';

function snapToBeatTime(time: number, bpm: number | null, snapEnabled: boolean, pixelsPerSecond: number): number {
  if (!snapEnabled || !bpm) return time;
  const beatInterval = 60 / bpm;
  const nearestBeat = Math.round(time / beatInterval) * beatInterval;
  const threshold = 8 / pixelsPerSecond;
  return Math.abs(time - nearestBeat) < threshold ? nearestBeat : time;
}


/** Color map for pyro part types */
const PYRO_TYPE_COLORS: Record<string, string> = {
  shell:       'hsl(45, 95%, 55%)',   // gold
  cake:        'hsl(15, 90%, 55%)',   // orange-red
  mine:        'hsl(0, 80%, 60%)',    // red
  comet:       'hsl(180, 90%, 55%)',  // cyan
  candle:      'hsl(330, 80%, 60%)',  // pink
  fan:         'hsl(120, 60%, 50%)',  // green
  gerb:        'hsl(35, 95%, 55%)',   // amber
  flame:       'hsl(10, 95%, 50%)',   // fire
  waterfall:   'hsl(210, 70%, 60%)',  // steel blue
  ground:      'hsl(25, 60%, 45%)',   // brown
  single_shot: 'hsl(60, 90%, 55%)',   // yellow
  rocket:      'hsl(280, 70%, 55%)',  // purple
  strobe:      'hsl(0, 0%, 85%)',     // white
  set_piece:   'hsl(50, 70%, 50%)',   // dark gold
};

function getTypeColor(effect: Effect): string {
  return PYRO_TYPE_COLORS[effect.partType || ''] || 'hsl(var(--accent))';
}

/** Category icon for each pyro type */
const PYRO_TYPE_ICONS: Record<string, string> = {
  shell: '💥', cake: '🎂', mine: '⛏️', comet: '☄️', candle: '🕯️',
  fan: '🪭', gerb: '⛲', flame: '🔥', waterfall: '🌊', ground: '💢',
  single_shot: '🎯', rocket: '🚀', strobe: '⚡', set_piece: '🎪',
};

interface PyroFormationGroup {
  formationId: string;
  formationName: string;
  formationColor: string;
  startTime: number;
  endTime: number;
  items: { item: TimelineItem; effect: Effect }[];
}

/** Pyro playhead — DOM-direct, zero re-renders */
function PyroPlayheadIndicator({ pixelsPerSecond }: { pixelsPerSecond: number }) {
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
    <div ref={ref} className="absolute top-0 bottom-0 w-px bg-primary/40 pointer-events-none z-30" style={{ transform: 'translateX(0px)' }} />
  );
}

export default function PyroTimelineTrack({
  pixelsPerSecond,
  duration,
}: {
  pixelsPerSecond: number;
  duration: number;
}) {
    const timelineItems = useProjectStore(s => s.timelineItems);
  const droneFormations = useProjectStore(s => s.droneFormations);
  const currentTime = useProjectStore(s => s.currentTime);
  const selectTimelineItem = useProjectStore(s => s.selectTimelineItem);
  const selectedTimelineItemId = useProjectStore(s => s.selectedTimelineItemId);
  const addTimelineItem = useProjectStore(s => s.addTimelineItem);
  const bpm = useProjectStore(s => s.bpm);
  const snapToBeat = useProjectStore(s => s.snapToBeat);
  const positions = useProjectStore(s => s.positions);
  const selectedPositionId = useProjectStore(s => s.selectedPositionId);
  const selectedPositionIds = useProjectStore(s => s.selectedPositionIds);
  const [expanded, setExpanded] = useState(true);
  const [isDragOver, setIsDragOver] = useState(false);

  // Get all pyro timeline items (firework type)
  const pyroItems = useMemo(() => {
    return timelineItems
      .filter(item => {
        const effect = getEffectById(item.effectId);
        return effect?.type === 'firework';
      })
      .map(item => ({
        item,
        effect: getEffectById(item.effectId)!,
      }))
      .sort((a, b) => a.item.startTime - b.item.startTime);
  }, [timelineItems]);

  // Group pyro items by which formation time window they fall into
  const groups = useMemo(() => {
    const result: PyroFormationGroup[] = [];

    // Create formation windows
    const formationWindows = droneFormations.map((f, i) => ({
      id: f.id,
      name: `${f.formationType} #${i + 1}`,
      color: f.color,
      start: f.startTime,
      end: f.startTime + f.transitionDuration + f.holdDuration,
    }));

    // Group items into formations
    const ungrouped: { item: TimelineItem; effect: Effect }[] = [];

    for (const pi of pyroItems) {
      const t = pi.item.startTime;
      const formation = formationWindows.find(fw => t >= fw.start && t <= fw.end);
      if (formation) {
        let group = result.find(g => g.formationId === formation.id);
        if (!group) {
          group = {
            formationId: formation.id,
            formationName: formation.name,
            formationColor: formation.color,
            startTime: formation.start,
            endTime: formation.end,
            items: [],
          };
          result.push(group);
        }
        group.items.push(pi);
      } else {
        ungrouped.push(pi);
      }
    }

    // Add ungrouped items as "Standalone" group
    if (ungrouped.length > 0) {
      const minT = ungrouped[0].item.startTime;
      const maxT = ungrouped[ungrouped.length - 1].item.startTime + (ungrouped[ungrouped.length - 1].effect.duration || 2);
      result.push({
        formationId: '__standalone__',
        formationName: 'Standalone',
        formationColor: 'hsl(var(--accent))',
        startTime: minT,
        endTime: maxT,
        items: ungrouped,
      });
    }

    return result.sort((a, b) => a.startTime - b.startTime);
  }, [pyroItems, droneFormations]);

  // Stats
  const totalCues = pyroItems.length;
  const typeBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const pi of pyroItems) {
      const t = pi.effect.partType || 'unknown';
      counts[t] = (counts[t] || 0) + 1;
    }
    return counts;
  }, [pyroItems]);

  // Drop handler — accept firework effects dragged from EffectLibrary,
  // create a TimelineItem on track 0 (PYRO SYS) at the drop X position.
  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('application/effect-id')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setIsDragOver(true);
  }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragOver(false);
  }, []);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const effectId = e.dataTransfer.getData('application/effect-id');
    if (!effectId) return;
    const effect = getEffectById(effectId);
    if (!effect || effect.type !== 'firework') return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = snapToBeatTime(Math.max(0, x / pixelsPerSecond), bpm, snapToBeat, pixelsPerSecond);

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
          effectId: effect.id, startTime: time, trackIndex: 0,
          position: { x: pos.x, y: pos.y, z: pos.z },
          positionId: posId, positionName: pos.name,
        });
      });
    } else {
      addTimelineItem({
        id: `tl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        effectId: effect.id, startTime: time, trackIndex: 0,
        position: { x: (Math.random() - 0.5) * 16, y: effect.heightMeters ?? 60, z: (Math.random() - 0.5) * 8 },
      });
    }
  }, [pixelsPerSecond, bpm, snapToBeat, addTimelineItem, positions, selectedPositionId, selectedPositionIds]);

  // Empty state — render a thin drop strip so the user can always drop here.
  if (totalCues === 0) {
    return (
      <div className="border-b border-border/50">
        <div className="flex items-center border-b border-border/30">
          <div className="w-28 flex-shrink-0 flex items-center px-3 py-1 border-r border-border/50 bg-surface-1 gap-1">
            <Flame className="h-3 w-3 text-accent/60 mr-1" />
            <span className="text-[10px] font-medium text-accent/60 uppercase tracking-wider">Pyro Cues</span>
          </div>
          <div
            className={cn(
              "flex-1 h-7 flex items-center px-3 transition-colors",
              isDragOver ? "bg-accent/15 ring-1 ring-inset ring-accent/40" : "bg-surface-0/30"
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <span className="text-[9px] font-mono text-muted-foreground/60">
              {isDragOver ? '↓ Solte para adicionar fogo' : 'Arraste efeitos da biblioteca aqui'}
            </span>
          </div>
        </div>
      </div>
    );
  }


  return (
    <div className="border-b border-border/50">
      {/* Header */}
      <div className="flex items-center border-b border-border/30">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-28 flex-shrink-0 flex items-center px-3 py-1 border-r border-border/50 bg-surface-1 hover:bg-surface-2 transition-colors cursor-pointer gap-1"
        >
          {expanded ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
          <Flame className="h-3 w-3 text-accent mr-1" />
          <span className="text-[10px] font-medium text-accent uppercase tracking-wider">Pyro Cues</span>
        </button>
        <div className="flex-1 flex items-center px-2 py-0.5 gap-2 bg-surface-0/50">
          <span className="text-[9px] font-mono text-muted-foreground">
            {totalCues} cues · {groups.length} groups
          </span>
          {/* Mini type breakdown chips */}
          <div className="flex gap-1">
            {Object.entries(typeBreakdown).slice(0, 6).map(([type, count]) => (
              <span
                key={type}
                className="text-[8px] font-mono px-1.5 py-0.5 rounded-full"
                style={{
                  backgroundColor: `${PYRO_TYPE_COLORS[type] || 'hsl(var(--muted))'}22`,
                  color: PYRO_TYPE_COLORS[type] || 'hsl(var(--muted-foreground))',
                  border: `1px solid ${PYRO_TYPE_COLORS[type] || 'hsl(var(--border))'}44`,
                }}
              >
                {PYRO_TYPE_ICONS[type] || '🔹'} {count}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Expanded: formation group rows */}
      {expanded && groups.map((group) => (
        <div key={group.formationId} className="flex border-b border-border/20">
          {/* Group label */}
          <div className="w-28 flex-shrink-0 flex items-center px-3 border-r border-border/50 bg-surface-1/80">
            <div
              className="w-1.5 h-4 rounded-full mr-2 flex-shrink-0"
              style={{ backgroundColor: group.formationColor }}
            />
            <span className="text-[9px] font-mono text-muted-foreground truncate">
              {group.formationName}
            </span>
          </div>

          {/* Cue bars */}
          <div className="flex-1 relative h-8 bg-surface-0/30">
            {/* Formation time window background */}
            <div
              className="absolute top-0 bottom-0 opacity-[0.06] rounded-sm"
              style={{
                left: `${group.startTime * pixelsPerSecond}px`,
                width: `${(group.endTime - group.startTime) * pixelsPerSecond}px`,
                backgroundColor: group.formationColor,
              }}
            />

            {/* Individual pyro cue bars */}
            {group.items.map(({ item, effect }) => {
              const isSelected = selectedTimelineItemId === item.id;
              const leftPx = item.startTime * pixelsPerSecond;
              const widthPx = Math.max(effect.duration * pixelsPerSecond, 6);
              const typeColor = getTypeColor(effect);
              const isActive = currentTime >= item.startTime && currentTime <= item.startTime + effect.duration;
              const tooltipText = `${effect.name} · ${formatCueTime(item.startTime)} · ${effect.duration}s${effect.caliber ? ` · ${effect.caliber}"` : ''}${effect.heightMeters ? ` · ${effect.heightMeters}m` : ''}${effect.pattern ? ` · Pattern: ${effect.pattern}` : ''}`;

              return (
                <button
                  key={item.id}
                  title={tooltipText}
                  onClick={(e) => { e.stopPropagation(); selectTimelineItem(item.id); }}
                  className={cn(
                    "absolute top-1 h-6 rounded-[3px] flex items-center px-1 text-[8px] font-mono transition-all cursor-pointer border overflow-hidden",
                    isSelected
                      ? "border-primary shadow-[0_0_8px_hsl(var(--electric)/0.3)] z-20"
                      : "border-transparent hover:border-border/60 z-10",
                    isActive && "ring-1 ring-accent/50"
                  )}
                  style={{
                    left: `${leftPx}px`,
                    width: `${widthPx}px`,
                    backgroundColor: `${typeColor}${isActive ? '55' : '33'}`,
                  }}
                >
                  {/* Left accent bar */}
                  <div
                    className="w-[3px] h-full rounded-l-[2px] flex-shrink-0 -ml-1"
                    style={{ backgroundColor: typeColor }}
                  />
                  {/* Icon + label */}
                  <span className="ml-1 truncate" style={{ color: typeColor }}>
                    {PYRO_TYPE_ICONS[effect.partType || ''] || '🔹'}
                    {widthPx > 40 && (
                      <span className="ml-0.5 opacity-80">{effect.caliber ? `${effect.caliber}"` : ''}</span>
                    )}
                  </span>
                  {/* Intensity indicator for active cues */}
                  {isActive && (
                    <div
                      className="absolute inset-0 animate-pulse rounded-[3px] pointer-events-none"
                      style={{ backgroundColor: `${typeColor}15` }}
                    />
                  )}
                </button>
              );
            })}

            {/* Playhead — DOM-direct (zero re-renders) */}
            <PyroPlayheadIndicator pixelsPerSecond={pixelsPerSecond} />
          </div>
        </div>
      ))}
    </div>
  );
}

function formatCueTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${m}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
}
