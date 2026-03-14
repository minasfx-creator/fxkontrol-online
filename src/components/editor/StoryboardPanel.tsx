/**
 * ─── Storyboard Panel ──────────────────────────────────────────────
 * Skybrush Studio-style storyboard for managing formation sequences.
 * Drag-and-drop reordering, auto-transitions, timing control.
 */

import { useState, useCallback } from 'react';
import { Film, Plus, Trash2, GripVertical, Lock, Unlock, ArrowRight, Clock, RefreshCw, ChevronDown, Play, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { useFleetStore, type StoryboardEntry } from '@/store/useFleetStore';
import { useProjectStore } from '@/store/useProjectStore';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

function framesToTime(frames: number, fps: number = 30): string {
  const seconds = frames / fps;
  const m = Math.floor(seconds / 60);
  const s = (seconds % 60).toFixed(1);
  return `${m}:${s.padStart(4, '0')}`;
}

interface StoryboardPanelProps {
  onClose?: () => void;
}

export default function StoryboardPanel({ onClose }: StoryboardPanelProps) {
  const {
    storyboardEntries,
    addStoryboardEntry,
    updateStoryboardEntry,
    removeStoryboardEntry,
    reorderStoryboard,
    recalculateStoryboardTimings,
  } = useFleetStore();

  const formations = useProjectStore(s => s.droneFormations);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const handleAddFromFormation = useCallback((formationId: string) => {
    const formation = formations.find(f => f.id === formationId);
    if (!formation) return;

    const lastEntry = storyboardEntries[storyboardEntries.length - 1];
    const startFrame = lastEntry
      ? lastEntry.startFrame + lastEntry.duration + lastEntry.transitionDuration
      : 0;

    addStoryboardEntry({
      id: `sb-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      formationId,
      formationName: formation.formationType || `Formation ${formations.indexOf(formation) + 1}`,
      startFrame,
      duration: Math.round(formation.holdDuration * 30),
      transitionType: 'linear',
      transitionDuration: Math.round(formation.transitionDuration * 30),
      locked: false,
    });
    toast.success('Added to storyboard');
  }, [formations, storyboardEntries, addStoryboardEntry]);

  const handleAddAllFormations = useCallback(() => {
    formations.forEach(f => handleAddFromFormation(f.id));
    recalculateStoryboardTimings();
    toast.success(`Added ${formations.length} formations to storyboard`);
  }, [formations, handleAddFromFormation, recalculateStoryboardTimings]);

  const handleDragStart = (index: number) => setDragIndex(index);
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex !== null && dragIndex !== index) {
      reorderStoryboard(dragIndex, index);
      setDragIndex(index);
    }
  };
  const handleDragEnd = () => {
    setDragIndex(null);
    recalculateStoryboardTimings();
  };

  const totalFrames = storyboardEntries.reduce(
    (sum, e) => sum + e.duration + e.transitionDuration, 0
  );

  return (
    <div className="h-full flex flex-col bg-surface-0 border-l border-border">
      {/* Header */}
      <div className="p-2 border-b border-border">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            <Film className="w-3.5 h-3.5 text-electric" />
            <span className="text-xs font-bold text-foreground tracking-wide">STORYBOARD</span>
          </div>
          <Badge variant="outline" className="text-[8px]">
            {storyboardEntries.length} entries
          </Badge>
        </div>

        <div className="flex items-center gap-2 text-[8px] text-muted-foreground">
          <span>Total: {framesToTime(totalFrames)}</span>
          <span>|</span>
          <span>{totalFrames} frames</span>
        </div>
      </div>

      {/* Actions */}
      <div className="p-2 border-b border-border">
        <div className="flex gap-1">
          <Select onValueChange={handleAddFromFormation}>
            <SelectTrigger className="h-6 text-[9px] flex-1">
              <SelectValue placeholder="Add formation..." />
            </SelectTrigger>
            <SelectContent>
              {formations.map((f, i) => (
                <SelectItem key={f.id} value={f.id} className="text-[9px]">
                  {f.formationType || `Formation ${i + 1}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" className="h-6 text-[8px] px-2" onClick={handleAddAllFormations}>
            <Plus className="w-3 h-3" />All
          </Button>
        </div>
        <div className="flex gap-1 mt-1">
          <Button size="sm" variant="outline" className="h-5 text-[8px] flex-1" onClick={recalculateStoryboardTimings}>
            <RefreshCw className="w-2.5 h-2.5 mr-0.5" />Re-sync
          </Button>
        </div>
      </div>

      {/* Timeline Minimap */}
      {storyboardEntries.length > 0 && (
        <div className="px-2 py-1.5 border-b border-border">
          <div className="flex h-4 gap-px rounded overflow-hidden">
            {storyboardEntries.map((entry, i) => {
              const holdWidth = totalFrames > 0 ? (entry.duration / totalFrames) * 100 : 0;
              const transWidth = totalFrames > 0 ? (entry.transitionDuration / totalFrames) * 100 : 0;
              const colors = ['bg-primary', 'bg-electric', 'bg-success', 'bg-warning', 'bg-accent'];
              return (
                <div key={entry.id} className="flex" style={{ width: `${holdWidth + transWidth}%` }}>
                  <div className={cn("h-full", colors[i % colors.length])} style={{ width: `${holdWidth / (holdWidth + transWidth) * 100}%` }} />
                  <div className="h-full bg-muted" style={{ width: `${transWidth / (holdWidth + transWidth) * 100}%` }} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Entries List */}
      <ScrollArea className="flex-1 p-2">
        <div className="space-y-1">
          {storyboardEntries.length === 0 ? (
            <div className="text-center py-8">
              <Film className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-20" />
              <p className="text-[10px] text-muted-foreground">No storyboard entries</p>
              <p className="text-[8px] text-muted-foreground mt-1">Add formations from the dropdown above</p>
            </div>
          ) : (
            storyboardEntries.map((entry, index) => (
              <div
                key={entry.id}
                draggable={!entry.locked}
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                className={cn(
                  "rounded border transition-all",
                  expandedId === entry.id ? "border-primary bg-primary/5" : "border-border bg-background",
                  dragIndex === index && "opacity-50",
                  entry.locked && "border-warning/30"
                )}
              >
                {/* Entry Header */}
                <div
                  className="flex items-center gap-1 p-1.5 cursor-pointer"
                  onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                >
                  <GripVertical className="w-3 h-3 text-muted-foreground cursor-grab flex-shrink-0" />
                  <span className="text-[9px] font-bold text-electric w-4">{index + 1}</span>
                  <span className="text-[9px] text-foreground flex-1 truncate">{entry.formationName}</span>
                  <span className="text-[8px] font-mono-code text-muted-foreground">
                    {framesToTime(entry.startFrame)}
                  </span>
                  <button onClick={(e) => {
                    e.stopPropagation();
                    updateStoryboardEntry(entry.id, { locked: !entry.locked });
                  }}>
                    {entry.locked
                      ? <Lock className="w-3 h-3 text-warning" />
                      : <Unlock className="w-3 h-3 text-muted-foreground" />
                    }
                  </button>
                  {expandedId === entry.id
                    ? <ChevronUp className="w-3 h-3 text-muted-foreground" />
                    : <ChevronDown className="w-3 h-3 text-muted-foreground" />
                  }
                </div>

                {/* Transition Arrow */}
                {index < storyboardEntries.length - 1 && expandedId !== entry.id && (
                  <div className="flex items-center justify-center py-0.5 text-[7px] text-muted-foreground">
                    <ArrowRight className="w-2.5 h-2.5 mr-0.5" />
                    {framesToTime(entry.transitionDuration)} transition
                  </div>
                )}

                {/* Expanded Details */}
                {expandedId === entry.id && (
                  <div className="px-2 pb-2 space-y-2">
                    <div>
                      <Label className="text-[8px] text-muted-foreground">Hold Duration (frames)</Label>
                      <div className="flex items-center gap-2">
                        <Slider
                          value={[entry.duration]}
                          onValueChange={([v]) => updateStoryboardEntry(entry.id, { duration: v })}
                          min={15}
                          max={900}
                          step={15}
                          className="flex-1"
                        />
                        <span className="text-[9px] font-mono-code text-foreground w-10 text-right">
                          {entry.duration}
                        </span>
                      </div>
                    </div>

                    <div>
                      <Label className="text-[8px] text-muted-foreground">Transition Duration (frames)</Label>
                      <div className="flex items-center gap-2">
                        <Slider
                          value={[entry.transitionDuration]}
                          onValueChange={([v]) => updateStoryboardEntry(entry.id, { transitionDuration: v })}
                          min={15}
                          max={300}
                          step={15}
                          className="flex-1"
                        />
                        <span className="text-[9px] font-mono-code text-foreground w-10 text-right">
                          {entry.transitionDuration}
                        </span>
                      </div>
                    </div>

                    <div>
                      <Label className="text-[8px] text-muted-foreground">Transition Type</Label>
                      <Select
                        value={entry.transitionType}
                        onValueChange={(v) => updateStoryboardEntry(entry.id, { transitionType: v as StoryboardEntry['transitionType'] })}
                      >
                        <SelectTrigger className="h-6 text-[9px] mt-0.5">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="linear" className="text-[9px]">Linear</SelectItem>
                          <SelectItem value="bezier" className="text-[9px]">Bezier (smooth)</SelectItem>
                          <SelectItem value="optimal" className="text-[9px]">Optimal (min distance)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="destructive"
                        className="h-5 text-[8px] flex-1"
                        onClick={() => {
                          removeStoryboardEntry(entry.id);
                          recalculateStoryboardTimings();
                        }}
                      >
                        <Trash2 className="w-2.5 h-2.5 mr-0.5" />Remove
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
