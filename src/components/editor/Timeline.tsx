import { useRef, useState, useCallback, useMemo } from 'react';
import { Play, Pause, SkipBack, SkipForward, Square, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useProjectStore, EFFECT_LIBRARY } from '@/store/useProjectStore';
import { cn } from '@/lib/utils';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
}

function TimeRuler({ duration, pixelsPerSecond }: { duration: number; pixelsPerSecond: number }) {
  const marks = [];
  const step = pixelsPerSecond >= 15 ? 1 : pixelsPerSecond >= 5 ? 5 : 10;
  for (let i = 0; i <= duration; i += step) {
    marks.push(
      <div
        key={i}
        className="absolute top-0 flex flex-col items-center"
        style={{ left: `${i * pixelsPerSecond}px` }}
      >
        <div className={cn("w-px", i % 10 === 0 ? "h-3 bg-muted-foreground/60" : "h-2 bg-border")} />
        {i % 10 === 0 && (
          <span className="text-[9px] font-mono-code text-muted-foreground mt-0.5">{formatTime(i)}</span>
        )}
      </div>
    );
  }
  return <div className="relative h-5 border-b border-border">{marks}</div>;
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
  const { timelineItems, selectedTimelineItemId, selectTimelineItem, addTimelineItem } = useProjectStore();
  const [isDragOver, setIsDragOver] = useState(false);
  const items = timelineItems.filter((i) => i.trackIndex === trackIndex);

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
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const effectId = e.dataTransfer.getData('application/effect-id');
    if (!effectId) return;
    const effect = EFFECT_LIBRARY.find((ef) => ef.id === effectId);
    if (!effect) return;
    // Validate track match
    if (effect.type === 'firework' && trackIndex !== 0) return;
    if (effect.type === 'drone' && trackIndex !== 1) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = Math.max(0, Math.min(x / pixelsPerSecond, duration));

    addTimelineItem({
      id: `tl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      effectId: effect.id,
      startTime: time,
      trackIndex,
      position: {
        x: (Math.random() - 0.5) * 16,
        y: effect.type === 'firework' ? 8 + Math.random() * 6 : 5 + Math.random() * 10,
        z: (Math.random() - 0.5) * 8,
      },
    });
  }, [pixelsPerSecond, duration, trackIndex, addTimelineItem]);

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
          return (
            <button
              key={item.id}
              onClick={() => selectTimelineItem(item.id)}
              className={cn(
                "absolute top-1 h-8 rounded-sm flex items-center px-1.5 text-[10px] font-medium transition-all cursor-pointer border",
                isSelected
                  ? "border-primary shadow-[0_0_8px_hsl(var(--electric)/0.3)] z-10"
                  : "border-transparent hover:border-border"
              )}
              style={{
                left: `${item.startTime * pixelsPerSecond}px`,
                width: `${Math.max(effect.duration * pixelsPerSecond, 20)}px`,
                backgroundColor: `${effect.color}22`,
              }}
            >
              <div className="w-1 h-full rounded-full mr-1 flex-shrink-0" style={{ backgroundColor: effect.color }} />
              <span className="truncate text-secondary-foreground">{effect.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function Timeline() {
  const {
    isPlaying, setPlaying, currentTime, setCurrentTime, duration,
    selectedTimelineItemId, removeTimelineItem, timelineItems,
  } = useProjectStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const pixelsPerSecond = 12;

  const totalCost = useMemo(() => {
    return timelineItems.reduce((sum, item) => {
      const effect = EFFECT_LIBRARY.find((e) => e.id === item.effectId);
      return sum + (effect?.cost ?? 0);
    }, 0);
  }, [timelineItems]);

  const handleTrackClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const scrollLeft = scrollRef.current?.scrollLeft ?? 0;
      const x = e.clientX - rect.left + scrollLeft - 112; // subtract label width
      if (x < 0) return;
      const time = Math.max(0, Math.min(x / pixelsPerSecond, duration));
      setCurrentTime(time);
    },
    [duration, pixelsPerSecond, setCurrentTime]
  );

  const handleDeleteSelected = () => {
    if (selectedTimelineItemId) removeTimelineItem(selectedTimelineItemId);
  };

  return (
    <div className="flex flex-col bg-card border-t border-border">
      {/* Transport controls */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-border bg-surface-1">
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setCurrentTime(0)}>
          <SkipBack className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-primary hover:text-primary"
          onClick={() => setPlaying(!isPlaying)}
        >
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

        <div className="flex-1" />

        {/* Stats */}
        <div className="flex items-center gap-3 text-[10px] font-mono-code text-muted-foreground mr-2">
          <span>Units: <span className="text-foreground">{timelineItems.length}</span></span>
          <span>Cost: <span className="text-safety">${totalCost.toFixed(2)}</span></span>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-destructive hover:text-destructive"
          onClick={handleDeleteSelected}
          disabled={!selectedTimelineItemId}
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
              {/* Playhead */}
              <div
                className="absolute top-0 bottom-0 w-px bg-primary z-20 pointer-events-none"
                style={{ left: `${currentTime * pixelsPerSecond}px` }}
              >
                <div className="w-2 h-2 bg-primary rounded-full -translate-x-[3px] -translate-y-[1px]" />
              </div>
            </div>
          </div>
          <TimelineTrackRow label="Fireworks" trackIndex={0} pixelsPerSecond={pixelsPerSecond} color="#FF6B35" duration={duration} scrollRef={scrollRef} />
          <TimelineTrackRow label="Drones" trackIndex={1} pixelsPerSecond={pixelsPerSecond} color="#00B4D8" duration={duration} scrollRef={scrollRef} />
          <TimelineTrackRow label="Audio" trackIndex={2} pixelsPerSecond={pixelsPerSecond} color="#7B68EE" duration={duration} scrollRef={scrollRef} />
        </div>
      </div>
    </div>
  );
}
