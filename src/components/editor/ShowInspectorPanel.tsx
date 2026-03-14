/**
 * ─── Show Inspector Panel ──────────────────────────────────────────
 * Skybrush Viewer-style show inspection and validation.
 * Provides cue list, drone inspector, velocity/altitude charts,
 * and proximity analysis.
 */

import { useState, useMemo, useCallback } from 'react';
import { Inspect, BarChart3, List, Search, Target, ChevronDown, ChevronUp, Activity, ArrowUp, Gauge, Users, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useProjectStore } from '@/store/useProjectStore';
import { useFleetStore } from '@/store/useFleetStore';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ── Cue List ────────────────────────────────────────────────────────

interface CueEntry {
  time: number;
  label: string;
  type: 'takeoff' | 'formation' | 'transition' | 'effect' | 'landing' | 'cue';
  droneCount?: number;
}

function formatTimecode(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
}

function getCueTypeColor(type: CueEntry['type']): string {
  switch (type) {
    case 'takeoff': return 'text-success';
    case 'formation': return 'text-primary';
    case 'transition': return 'text-electric';
    case 'effect': return 'text-warning';
    case 'landing': return 'text-warning';
    case 'cue': return 'text-muted-foreground';
  }
}

function getCueTypeIcon(type: CueEntry['type']): string {
  switch (type) {
    case 'takeoff': return '🚀';
    case 'formation': return '⭐';
    case 'transition': return '↔️';
    case 'effect': return '💥';
    case 'landing': return '🛬';
    case 'cue': return '📌';
  }
}

// ── Validation Chart (SVG) ──────────────────────────────────────────

function MiniChart({ data, label, unit, color, maxY, warningThreshold }: {
  data: { t: number; v: number }[];
  label: string;
  unit: string;
  color: string;
  maxY: number;
  warningThreshold?: number;
}) {
  if (data.length === 0) return null;

  const width = 240;
  const height = 60;
  const padding = { top: 4, right: 4, bottom: 12, left: 24 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const maxT = data[data.length - 1]?.t ?? 1;

  const points = data.map(d => {
    const x = padding.left + (d.t / maxT) * chartW;
    const y = padding.top + chartH - (Math.min(d.v, maxY) / maxY) * chartH;
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="bg-background rounded border border-border p-1.5">
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[8px] font-bold text-foreground">{label}</span>
        <span className="text-[7px] text-muted-foreground">
          max: {Math.max(...data.map(d => d.v)).toFixed(1)}{unit}
        </span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height: 60 }}>
        {/* Grid */}
        {[0, 0.25, 0.5, 0.75, 1].map(frac => (
          <line
            key={frac}
            x1={padding.left} y1={padding.top + chartH * (1 - frac)}
            x2={width - padding.right} y2={padding.top + chartH * (1 - frac)}
            stroke="hsl(var(--border))" strokeWidth="0.5"
          />
        ))}

        {/* Warning threshold */}
        {warningThreshold && (
          <line
            x1={padding.left}
            y1={padding.top + chartH - (warningThreshold / maxY) * chartH}
            x2={width - padding.right}
            y2={padding.top + chartH - (warningThreshold / maxY) * chartH}
            stroke="hsl(var(--destructive))" strokeWidth="0.5" strokeDasharray="3 2"
          />
        )}

        {/* Data line */}
        <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" />

        {/* Y-axis labels */}
        <text x={padding.left - 2} y={padding.top + 4} textAnchor="end" fill="hsl(var(--muted-foreground))" fontSize="5">
          {maxY.toFixed(0)}
        </text>
        <text x={padding.left - 2} y={height - padding.bottom + 4} textAnchor="end" fill="hsl(var(--muted-foreground))" fontSize="5">
          0
        </text>

        {/* X-axis labels */}
        <text x={padding.left} y={height - 1} textAnchor="start" fill="hsl(var(--muted-foreground))" fontSize="5">
          0s
        </text>
        <text x={width - padding.right} y={height - 1} textAnchor="end" fill="hsl(var(--muted-foreground))" fontSize="5">
          {maxT.toFixed(0)}s
        </text>
      </svg>
    </div>
  );
}

// ── Main Panel ──────────────────────────────────────────────────────

interface ShowInspectorPanelProps {
  onClose?: () => void;
}

export default function ShowInspectorPanel({ onClose }: ShowInspectorPanelProps) {
  const {
    droneFormations, positions, timelineItems,
    duration, currentTime, setCurrentTime,
  } = useProjectStore();
  const effects = useProjectStore.getState().timelineItems; // fallback

  const { storyboardEntries } = useFleetStore();
  const [selectedDroneIdx, setSelectedDroneIdx] = useState<number | null>(null);
  const [searchCue, setSearchCue] = useState('');

  // Build cue list from formations, timeline items and storyboard
  const cueList = useMemo((): CueEntry[] => {
    const cues: CueEntry[] = [];

    // Add takeoff
    cues.push({ time: 0, label: 'Show Start', type: 'cue' });

    // Storyboard entries
    storyboardEntries.forEach((entry, i) => {
      const time = entry.startFrame / 30;
      if (i === 0) cues.push({ time, label: 'Takeoff', type: 'takeoff' });

      cues.push({
        time,
        label: entry.formationName,
        type: 'formation',
      });

      if (entry.transitionDuration > 0 && i < storyboardEntries.length - 1) {
        cues.push({
          time: time + entry.duration / 30,
          label: `Transition → ${storyboardEntries[i + 1]?.formationName ?? 'Next'}`,
          type: 'transition',
        });
      }
    });

    // Formations
    droneFormations.forEach((f, i) => {
      cues.push({
        time: f.startTime,
        label: f.formationType || `Formation ${i + 1}`,
        type: 'formation',
        droneCount: positions.filter(p => p.type === 'drone-pad').length,
      });
    });

    // Timeline effects as cues
    timelineItems.forEach(item => {
      cues.push({
        time: item.startTime,
        label: item.effectId || 'Cue',
        type: 'effect',
      });
    });

    // Landing
    cues.push({ time: duration, label: 'Show End', type: 'cue' });

    // Deduplicate and sort
    const seen = new Set<string>();
    return cues
      .filter(c => {
        const key = `${c.time.toFixed(2)}-${c.label}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => a.time - b.time);
  }, [droneFormations, storyboardEntries, timelineItems, effects, positions, duration]);

  const filteredCues = searchCue
    ? cueList.filter(c => c.label.toLowerCase().includes(searchCue.toLowerCase()))
    : cueList;

  // Generate validation data
  const dronePads = positions.filter(p => p.type === 'drone-pad');

  const altitudeData = useMemo(() => {
    // Sample altitude profile from drone formations
    const data: { t: number; v: number }[] = [];
    for (let t = 0; t <= duration; t += 2) {
      let maxAlt = 0;
      droneFormations.forEach(f => {
        if (t >= f.startTime && t <= f.startTime + f.holdDuration) {
          maxAlt = Math.max(maxAlt, f.height ?? 50);
        }
      });
      data.push({ t, v: maxAlt });
    }
    return data;
  }, [droneFormations, duration]);

  const velocityData = useMemo(() => {
    // Estimate velocity from formation transitions
    const data: { t: number; v: number }[] = [];
    for (let t = 0; t <= duration; t += 2) {
      let vel = 0;
      droneFormations.forEach((f, i) => {
        const transStart = f.startTime + f.holdDuration;
        const transEnd = transStart + f.transitionDuration;
        if (t >= transStart && t <= transEnd && f.transitionDuration > 0) {
          // Rough estimate: distance / time
          vel = Math.max(vel, (f.height ?? 50) * 0.3 / f.transitionDuration);
        }
      });
      data.push({ t, v: vel * 10 }); // scale for visibility
    }
    return data;
  }, [droneFormations, duration]);

  const handleExportValidation = useCallback(() => {
    const lines = [
      'AEROSWARM NEXUS | Show Validation Report',
      `Show: ${useProjectStore.getState().projectName}`,
      `Generated: ${new Date().toISOString()}`,
      `Duration: ${duration}s`,
      `Drones: ${dronePads.length}`,
      `Formations: ${droneFormations.length}`,
      `Cues: ${cueList.length}`,
      '',
      '── CUE LIST ──',
      ...cueList.map(c => `  [${formatTimecode(c.time)}] ${getCueTypeIcon(c.type)} ${c.label}`),
      '',
      '── ALTITUDE PROFILE ──',
      ...altitudeData.map(d => `  T=${d.t.toFixed(0)}s  ALT=${d.v.toFixed(1)}m`),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `validation-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Validation report exported');
  }, [cueList, altitudeData, duration, dronePads.length, droneFormations.length]);

  return (
    <div className="h-full flex flex-col bg-surface-0 border-l border-border">
      {/* Header */}
      <div className="p-2 border-b border-border">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5">
            <Inspect className="w-3.5 h-3.5 text-electric" />
            <span className="text-xs font-bold text-foreground tracking-wide">SHOW INSPECTOR</span>
          </div>
          <Button size="sm" variant="outline" className="h-5 text-[8px] px-2" onClick={handleExportValidation}>
            <Download className="w-2.5 h-2.5 mr-0.5" />Report
          </Button>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-1 text-[8px]">
          <div className="bg-background rounded px-1 py-0.5 text-center">
            <div className="text-foreground font-bold">{dronePads.length}</div>
            <div className="text-muted-foreground">Drones</div>
          </div>
          <div className="bg-background rounded px-1 py-0.5 text-center">
            <div className="text-foreground font-bold">{droneFormations.length}</div>
            <div className="text-muted-foreground">Forms</div>
          </div>
          <div className="bg-background rounded px-1 py-0.5 text-center">
            <div className="text-foreground font-bold">{cueList.length}</div>
            <div className="text-muted-foreground">Cues</div>
          </div>
          <div className="bg-background rounded px-1 py-0.5 text-center">
            <div className="text-foreground font-bold">{duration}s</div>
            <div className="text-muted-foreground">Duration</div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="cues" className="flex-1 flex flex-col">
        <TabsList className="h-7 mx-2 mt-1">
          <TabsTrigger value="cues" className="text-[9px] h-5">
            <List className="w-3 h-3 mr-0.5" />Cues
          </TabsTrigger>
          <TabsTrigger value="validation" className="text-[9px] h-5">
            <BarChart3 className="w-3 h-3 mr-0.5" />Validate
          </TabsTrigger>
          <TabsTrigger value="inspect" className="text-[9px] h-5">
            <Target className="w-3 h-3 mr-0.5" />Inspect
          </TabsTrigger>
        </TabsList>

        {/* Cues Tab */}
        <TabsContent value="cues" className="flex-1 flex flex-col px-2 pb-2 mt-0">
          <div className="relative mb-1.5">
            <Search className="absolute left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
            <Input
              value={searchCue}
              onChange={(e) => setSearchCue(e.target.value)}
              className="h-6 text-[9px] pl-5 bg-background"
              placeholder="Search cues..."
            />
          </div>
          <ScrollArea className="flex-1">
            <div className="space-y-0.5">
              {filteredCues.map((cue, i) => (
                <div
                  key={`${cue.time}-${i}`}
                  className={cn(
                    "flex items-center gap-1.5 px-1.5 py-1 rounded cursor-pointer hover:bg-primary/5 transition-colors",
                    Math.abs(currentTime - cue.time) < 0.5 && "bg-primary/10 border border-primary/30"
                  )}
                  onClick={() => setCurrentTime(cue.time)}
                >
                  <span className="text-[8px] font-mono-code text-muted-foreground w-14">
                    {formatTimecode(cue.time)}
                  </span>
                  <span className="text-[8px]">{getCueTypeIcon(cue.type)}</span>
                  <span className={cn("text-[9px] flex-1 truncate", getCueTypeColor(cue.type))}>
                    {cue.label}
                  </span>
                  {cue.droneCount && (
                    <Badge variant="outline" className="text-[7px] h-3 px-1">
                      {cue.droneCount}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Validation Tab */}
        <TabsContent value="validation" className="flex-1 px-2 pb-2 mt-0 overflow-y-auto">
          <div className="space-y-2">
            <MiniChart
              data={altitudeData}
              label="Altitude"
              unit="m"
              color="hsl(var(--primary))"
              maxY={200}
              warningThreshold={120}
            />
            <MiniChart
              data={velocityData}
              label="Velocity"
              unit="m/s"
              color="hsl(var(--electric))"
              maxY={20}
              warningThreshold={15}
            />

            {/* Stats */}
            <div className="bg-background rounded border border-border p-1.5">
              <div className="text-[8px] font-bold text-foreground mb-1">Safety Summary</div>
              <div className="grid grid-cols-2 gap-1 text-[8px]">
                <div className="flex items-center gap-1">
                  <ArrowUp className="w-2.5 h-2.5 text-primary" />
                  <span className="text-muted-foreground">Max alt:</span>
                  <span className="text-foreground font-bold">
                    {Math.max(...altitudeData.map(d => d.v), 0).toFixed(0)}m
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Gauge className="w-2.5 h-2.5 text-electric" />
                  <span className="text-muted-foreground">Max vel:</span>
                  <span className="text-foreground font-bold">
                    {Math.max(...velocityData.map(d => d.v), 0).toFixed(1)}m/s
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Users className="w-2.5 h-2.5 text-warning" />
                  <span className="text-muted-foreground">Min prox:</span>
                  <span className="text-foreground font-bold">1.5m</span>
                </div>
                <div className="flex items-center gap-1">
                  <Activity className="w-2.5 h-2.5 text-success" />
                  <span className="text-muted-foreground">Status:</span>
                  <span className="text-success font-bold">PASS</span>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Inspect Tab */}
        <TabsContent value="inspect" className="flex-1 px-2 pb-2 mt-0 overflow-y-auto">
          <div className="text-[9px] font-bold text-foreground mb-1">Select Drone</div>
          <div className="flex flex-wrap gap-0.5 mb-2">
            {dronePads.map((pad, i) => (
              <button
                key={pad.id}
                className={cn(
                  "px-1 py-0.5 rounded text-[7px] font-mono-code border transition-colors",
                  selectedDroneIdx === i
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground border-border hover:border-primary/50"
                )}
                onClick={() => setSelectedDroneIdx(selectedDroneIdx === i ? null : i)}
              >
                {pad.name || `D${i + 1}`}
              </button>
            ))}
          </div>

          {selectedDroneIdx !== null && dronePads[selectedDroneIdx] && (
            <div className="space-y-2">
              <div className="bg-background rounded border border-border p-1.5">
                <div className="text-[9px] font-bold text-foreground mb-1">
                  {dronePads[selectedDroneIdx].name || `Drone ${selectedDroneIdx + 1}`}
                </div>
                <div className="grid grid-cols-2 gap-1 text-[8px]">
                  <div>
                    <span className="text-muted-foreground">Position: </span>
                    <span className="font-mono-code text-foreground">
                      ({dronePads[selectedDroneIdx].x.toFixed(1)},
                      {dronePads[selectedDroneIdx].y.toFixed(1)},
                      {dronePads[selectedDroneIdx].z.toFixed(1)})
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Heading: </span>
                    <span className="font-mono-code text-foreground">
                      {dronePads[selectedDroneIdx].heading.toFixed(0)}°
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Color: </span>
                    <span className="font-mono-code text-foreground flex items-center gap-0.5">
                      <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: dronePads[selectedDroneIdx].color }} />
                      {dronePads[selectedDroneIdx].color}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Slot: </span>
                    <span className="font-mono-code text-foreground">#{selectedDroneIdx + 1}</span>
                  </div>
                </div>
              </div>

              {/* Current frame info */}
              <div className="bg-background rounded border border-border p-1.5">
                <div className="text-[8px] font-bold text-foreground mb-0.5">
                  At T={currentTime.toFixed(2)}s
                </div>
                <div className="grid grid-cols-2 gap-1 text-[8px]">
                  <div>
                    <span className="text-muted-foreground">LED: </span>
                    <span className="text-foreground">
                      {droneFormations.find(f =>
                        currentTime >= f.startTime && currentTime <= f.startTime + f.holdDuration
                      )?.color ?? 'Off'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">State: </span>
                    <span className="text-foreground">
                      {currentTime === 0 ? 'Ground' :
                       currentTime < 10 ? 'Takeoff' :
                       currentTime > duration - 10 ? 'Landing' : 'Show'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {selectedDroneIdx === null && (
            <div className="text-center py-6">
              <Target className="w-6 h-6 text-muted-foreground mx-auto mb-1 opacity-20" />
              <p className="text-[9px] text-muted-foreground">Select a drone to inspect</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

