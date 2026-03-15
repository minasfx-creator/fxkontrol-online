/**
 * ─── Storyboard Panel v2 ──────────────────────────────────────────
 * Skybrush Studio-style storyboard with:
 *   - Formation purpose (Takeoff/Show/Land/Unspecified)
 *   - Transition schedule (Synchronized/Staggered)
 *   - Auto/Manual transition mapping
 *   - Recalculate transitions
 *   - Duration lock/unlock per entry
 *   - Timeline minimap with cue markers
 *   - Export storyboard as CSV
 */

import { useState, useCallback } from 'react';
import { Film, Plus, Trash2, GripVertical, Lock, Unlock, ArrowRight, Clock, RefreshCw, ChevronDown, ChevronUp, Download, Copy, RotateCcw, Target, Globe, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { useFleetStore, type StoryboardEntry } from '@/store/useFleetStore';
import { useProjectStore } from '@/store/useProjectStore';
import { generateFormation } from '@/lib/formations';
import { downloadKMZ } from '@/lib/kmzExporter';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type EntryPurpose = 'takeoff' | 'show' | 'land' | 'unspecified';
type TransitionSchedule = 'synchronized' | 'staggered';
type TransitionMapping = 'auto' | 'manual';

function framesToTime(frames: number, fps: number = 30): string {
  const seconds = frames / fps;
  const m = Math.floor(seconds / 60);
  const s = (seconds % 60).toFixed(1);
  return `${m}:${s.padStart(4, '0')}`;
}

function getPurposeColor(purpose: EntryPurpose): string {
  switch (purpose) {
    case 'takeoff': return 'text-success';
    case 'show': return 'text-primary';
    case 'land': return 'text-warning';
    default: return 'text-muted-foreground';
  }
}

function getPurposeIcon(purpose: EntryPurpose): string {
  switch (purpose) {
    case 'takeoff': return '🚀';
    case 'show': return '✨';
    case 'land': return '🛬';
    default: return '📌';
  }
}

interface StoryboardPanelProps {
  onClose?: () => void;
}

export default function StoryboardPanel({ onClose }: StoryboardPanelProps) {
  const {
    storyboardEntries, addStoryboardEntry, updateStoryboardEntry,
    removeStoryboardEntry, reorderStoryboard, recalculateStoryboardTimings,
  } = useFleetStore();

  const formations = useProjectStore(s => s.droneFormations);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [entryPurposes, setEntryPurposes] = useState<Record<string, EntryPurpose>>({});
  const [entrySchedules, setEntrySchedules] = useState<Record<string, TransitionSchedule>>({});
  const [entryMappings, setEntryMappings] = useState<Record<string, TransitionMapping>>({});
  const [showAdvanced, setShowAdvanced] = useState(false);

  const setPurpose = (id: string, purpose: EntryPurpose) =>
    setEntryPurposes(p => ({ ...p, [id]: purpose }));
  const setSchedule = (id: string, schedule: TransitionSchedule) =>
    setEntrySchedules(s => ({ ...s, [id]: schedule }));
  const setMapping = (id: string, mapping: TransitionMapping) =>
    setEntryMappings(m => ({ ...m, [id]: mapping }));

  const handleAddFromFormation = useCallback((formationId: string) => {
    const formation = formations.find(f => f.id === formationId);
    if (!formation) return;

    const lastEntry = storyboardEntries[storyboardEntries.length - 1];
    const startFrame = lastEntry
      ? lastEntry.startFrame + lastEntry.duration + lastEntry.transitionDuration
      : 0;

    const id = `sb-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
    addStoryboardEntry({
      id,
      formationId,
      formationName: formation.formationType || `Formation ${formations.indexOf(formation) + 1}`,
      startFrame,
      duration: Math.round(formation.holdDuration * 30),
      transitionType: 'linear',
      transitionDuration: Math.round(formation.transitionDuration * 30),
      locked: false,
    });

    // Auto-detect purpose
    const idx = storyboardEntries.length;
    if (idx === 0) setPurpose(id, 'takeoff');
    else setPurpose(id, 'show');

    toast.success('Added to storyboard');
  }, [formations, storyboardEntries, addStoryboardEntry]);

  const handleAddAllFormations = useCallback(() => {
    formations.forEach(f => handleAddFromFormation(f.id));
    recalculateStoryboardTimings();
    toast.success(`Added ${formations.length} formations`);
  }, [formations, handleAddFromFormation, recalculateStoryboardTimings]);

  const handleDuplicateEntry = useCallback((entry: StoryboardEntry) => {
    const id = `sb-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
    addStoryboardEntry({
      ...entry,
      id,
      locked: false,
      startFrame: entry.startFrame + entry.duration + entry.transitionDuration,
    });
    recalculateStoryboardTimings();
    toast.success('Entry duplicated');
  }, [addStoryboardEntry, recalculateStoryboardTimings]);

  const handleExportStoryboard = useCallback(() => {
    const lines = [
      'AEROSWARM NEXUS | Storyboard Export',
      `Generated: ${new Date().toISOString()}`,
      '',
      'Index,Formation,Purpose,Start Frame,Duration,Transition Type,Transition Duration,Schedule',
    ];
    storyboardEntries.forEach((e, i) => {
      lines.push([
        i + 1,
        e.formationName,
        entryPurposes[e.id] ?? 'show',
        e.startFrame,
        e.duration,
        e.transitionType,
        e.transitionDuration,
        entrySchedules[e.id] ?? 'synchronized',
      ].join(','));
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'storyboard.csv';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Storyboard exported');
  }, [storyboardEntries, entryPurposes, entrySchedules]);

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

  const totalFrames = storyboardEntries.reduce((sum, e) => sum + e.duration + e.transitionDuration, 0);
  const totalSeconds = totalFrames / 30;

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
          <span>Duration: {totalSeconds.toFixed(1)}s</span>
          <span>|</span>
          <span>{totalFrames} frames</span>
          <span>|</span>
          <span>@30fps</span>
        </div>
      </div>

      {/* Actions */}
      <div className="p-2 border-b border-border space-y-1">
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
        <div className="flex gap-1">
          <Button size="sm" variant="outline" className="h-5 text-[8px] flex-1" onClick={recalculateStoryboardTimings}>
            <RefreshCw className="w-2.5 h-2.5 mr-0.5" />Re-sync
          </Button>
          <Button size="sm" variant="outline" className="h-5 text-[8px] flex-1" onClick={handleExportStoryboard}>
            <Download className="w-2.5 h-2.5 mr-0.5" />Export
          </Button>
        </div>
        <div className="flex items-center gap-1 text-[8px]">
          <Switch
            checked={showAdvanced}
            onCheckedChange={setShowAdvanced}
            className="h-3 w-5"
          />
          <span className="text-muted-foreground">Advanced (purpose, schedule, mapping)</span>
        </div>
      </div>

      {/* Timeline Minimap */}
      {storyboardEntries.length > 0 && (
        <div className="px-2 py-1.5 border-b border-border">
          <div className="flex h-5 gap-px rounded overflow-hidden">
            {storyboardEntries.map((entry, i) => {
              const holdWidth = totalFrames > 0 ? (entry.duration / totalFrames) * 100 : 0;
              const transWidth = totalFrames > 0 ? (entry.transitionDuration / totalFrames) * 100 : 0;
              const purpose = entryPurposes[entry.id] ?? 'show';
              const purposeColors: Record<EntryPurpose, string> = {
                takeoff: 'bg-success',
                show: 'bg-primary',
                land: 'bg-warning',
                unspecified: 'bg-muted-foreground',
              };
              return (
                <div key={entry.id} className="flex relative group" style={{ width: `${holdWidth + transWidth}%` }}>
                  <div className={cn("h-full", purposeColors[purpose])} style={{ width: `${holdWidth / (holdWidth + transWidth) * 100}%` }} />
                  <div className="h-full bg-muted/50" style={{ width: `${transWidth / (holdWidth + transWidth) * 100}%` }} />
                  <div className="absolute inset-0 flex items-center justify-center text-[6px] font-bold text-background opacity-0 group-hover:opacity-100 transition-opacity truncate px-0.5">
                    {i + 1}
                  </div>
                </div>
              );
            })}
          </div>
          {/* Time markers */}
          <div className="flex justify-between text-[7px] text-muted-foreground mt-0.5">
            <span>0:00</span>
            <span>{framesToTime(totalFrames / 2)}</span>
            <span>{framesToTime(totalFrames)}</span>
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
              <p className="text-[8px] text-muted-foreground mt-1">Add formations from dropdown</p>
            </div>
          ) : (
            storyboardEntries.map((entry, index) => {
              const purpose = entryPurposes[entry.id] ?? 'show';
              const schedule = entrySchedules[entry.id] ?? 'synchronized';
              const mapping = entryMappings[entry.id] ?? 'auto';
              const isExpanded = expandedId === entry.id;

              return (
                <div
                  key={entry.id}
                  draggable={!entry.locked}
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  className={cn(
                    "rounded border transition-all",
                    isExpanded ? "border-primary bg-primary/5" : "border-border bg-background",
                    dragIndex === index && "opacity-50",
                    entry.locked && "border-warning/30"
                  )}
                >
                  {/* Entry Header */}
                  <div
                    className="flex items-center gap-1 p-1.5 cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                  >
                    <GripVertical className="w-3 h-3 text-muted-foreground cursor-grab flex-shrink-0" />
                    <span className="text-[7px]">{getPurposeIcon(purpose)}</span>
                    <span className={cn("text-[9px] font-bold w-4", getPurposeColor(purpose))}>{index + 1}</span>
                    <span className="text-[9px] text-foreground flex-1 truncate">{entry.formationName}</span>
                    <span className="text-[8px] font-mono-code text-muted-foreground">
                      {framesToTime(entry.startFrame)}
                    </span>
                    <button onClick={(e) => { e.stopPropagation(); updateStoryboardEntry(entry.id, { locked: !entry.locked }); }}>
                      {entry.locked ? <Lock className="w-3 h-3 text-warning" /> : <Unlock className="w-3 h-3 text-muted-foreground" />}
                    </button>
                    {isExpanded ? <ChevronUp className="w-3 h-3 text-muted-foreground" /> : <ChevronDown className="w-3 h-3 text-muted-foreground" />}
                  </div>

                  {/* Transition Arrow */}
                  {index < storyboardEntries.length - 1 && !isExpanded && (
                    <div className="flex items-center justify-center py-0.5 text-[7px] text-muted-foreground gap-1">
                      <ArrowRight className="w-2.5 h-2.5" />
                      <span>{framesToTime(entry.transitionDuration)}</span>
                      <Badge variant="outline" className="text-[6px] h-3 px-1">
                        {entry.transitionType === 'optimal' ? 'AUTO' : entry.transitionType.toUpperCase()}
                      </Badge>
                      <Badge variant="outline" className="text-[6px] h-3 px-1">
                        {schedule === 'staggered' ? 'STGR' : 'SYNC'}
                      </Badge>
                    </div>
                  )}

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="px-2 pb-2 space-y-2">
                      {/* Purpose (Skybrush Studio feature) */}
                      {showAdvanced && (
                        <div>
                          <Label className="text-[8px] text-muted-foreground">Purpose</Label>
                          <Select value={purpose} onValueChange={(v) => setPurpose(entry.id, v as EntryPurpose)}>
                            <SelectTrigger className="h-6 text-[9px] mt-0.5">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="takeoff" className="text-[9px]">🚀 Takeoff</SelectItem>
                              <SelectItem value="show" className="text-[9px]">✨ Show</SelectItem>
                              <SelectItem value="land" className="text-[9px]">🛬 Land</SelectItem>
                              <SelectItem value="unspecified" className="text-[9px]">📌 Unspecified</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      <div>
                        <Label className="text-[8px] text-muted-foreground">Hold Duration (frames)</Label>
                        <div className="flex items-center gap-2">
                          <Slider
                            value={[entry.duration]}
                            onValueChange={([v]) => updateStoryboardEntry(entry.id, { duration: v })}
                            min={15} max={900} step={15}
                            className="flex-1"
                          />
                          <Input
                            type="number"
                            value={entry.duration}
                            onChange={(e) => updateStoryboardEntry(entry.id, { duration: parseInt(e.target.value) || 15 })}
                            className="h-5 w-14 text-[8px] font-mono-code bg-background text-right"
                          />
                        </div>
                      </div>

                      <div>
                        <Label className="text-[8px] text-muted-foreground">Transition Duration (frames)</Label>
                        <div className="flex items-center gap-2">
                          <Slider
                            value={[entry.transitionDuration]}
                            onValueChange={([v]) => updateStoryboardEntry(entry.id, { transitionDuration: v })}
                            min={15} max={300} step={15}
                            className="flex-1"
                          />
                          <Input
                            type="number"
                            value={entry.transitionDuration}
                            onChange={(e) => updateStoryboardEntry(entry.id, { transitionDuration: parseInt(e.target.value) || 15 })}
                            className="h-5 w-14 text-[8px] font-mono-code bg-background text-right"
                          />
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
                            <SelectItem value="optimal" className="text-[9px]">Auto (optimal mapping)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Advanced: Transition Schedule & Mapping */}
                      {showAdvanced && (
                        <>
                          <div>
                            <Label className="text-[8px] text-muted-foreground">Transition Schedule</Label>
                            <Select value={schedule} onValueChange={(v) => setSchedule(entry.id, v as TransitionSchedule)}>
                              <SelectTrigger className="h-6 text-[9px] mt-0.5">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="synchronized" className="text-[9px]">
                                  Synchronized (all depart/arrive together)
                                </SelectItem>
                                <SelectItem value="staggered" className="text-[9px]">
                                  Staggered (sequential departure)
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            <Label className="text-[8px] text-muted-foreground">Marker Mapping</Label>
                            <Select value={mapping} onValueChange={(v) => setMapping(entry.id, v as TransitionMapping)}>
                              <SelectTrigger className="h-6 text-[9px] mt-0.5">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="auto" className="text-[9px]">
                                  Auto (optimal distance mapping)
                                </SelectItem>
                                <SelectItem value="manual" className="text-[9px]">
                                  Manual (preserve Outliner order)
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </>
                      )}

                      {/* Actions */}
                      <div className="flex gap-1">
                        <Button
                          size="sm" variant="outline" className="h-5 text-[8px] flex-1"
                          onClick={() => handleDuplicateEntry(entry)}
                        >
                          <Copy className="w-2.5 h-2.5 mr-0.5" />Duplicate
                        </Button>
                        <Button
                          size="sm" variant="destructive" className="h-5 text-[8px] flex-1"
                          onClick={() => { removeStoryboardEntry(entry.id); recalculateStoryboardTimings(); }}
                        >
                          <Trash2 className="w-2.5 h-2.5 mr-0.5" />Remove
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
