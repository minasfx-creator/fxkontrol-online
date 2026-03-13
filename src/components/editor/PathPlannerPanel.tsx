/**
 * Path Planner Panel — Define obstacles & plan obstacle-avoiding formation paths
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useProjectStore } from '@/store/useProjectStore';
import { type Obstacle, type PlanResult, planFormationPaths, createDefaultObstacles } from '@/lib/pathPlanner';
import { Plus, Trash2, Navigation, AlertTriangle, CheckCircle } from 'lucide-react';

interface PathPlannerPanelProps {
  onClose?: () => void;
}

export default function PathPlannerPanel({ onClose }: PathPlannerPanelProps) {
  const [obstacles, setObstacles] = useState<Obstacle[]>(createDefaultObstacles());
  const [result, setResult] = useState<PlanResult | null>(null);
  const [planning, setPlanning] = useState(false);
  const formations = useProjectStore(s => s.droneFormations);

  const addObstacle = () => {
    setObstacles(prev => [...prev, {
      id: `obs-${Date.now()}`,
      type: 'sphere',
      position: [0, 5, 0],
      size: [3, 3, 3],
      label: `Obstacle ${prev.length + 1}`,
    }]);
  };

  const removeObstacle = (id: string) => {
    setObstacles(prev => prev.filter(o => o.id !== id));
  };

  const updateObstacle = (id: string, updates: Partial<Obstacle>) => {
    setObstacles(prev => prev.map(o => o.id === id ? { ...o, ...updates } : o));
  };

  const runPlanner = () => {
    if (formations.length < 2) return;
    setPlanning(true);

    setTimeout(() => {
      const f1 = formations[formations.length - 2];
      const f2 = formations[formations.length - 1];
      const starts = f1.positions.map(p => [p.x, p.y, p.z] as [number, number, number]);
      const goals = f2.positions.map(p => [p.x, p.y, p.z] as [number, number, number]);
      const res = planFormationPaths(starts, goals, obstacles);
      setResult(res);
      setPlanning(false);
    }, 50);
  };

  return (
    <div className="h-full flex flex-col bg-surface-1 border-l border-border/60">
      <div className="px-3 py-2 border-b border-border/40 flex items-center justify-between">
        <h3 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <Navigation className="w-3.5 h-3.5 text-primary" />
          Path Planner
        </h3>
        {onClose && <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xs">✕</button>}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-3">
          {/* Obstacles */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Obstacles</Label>
              <Button size="sm" variant="ghost" onClick={addObstacle} className="h-5 px-1.5 text-[10px]">
                <Plus className="w-3 h-3 mr-0.5" /> Add
              </Button>
            </div>

            <div className="space-y-2">
              {obstacles.map(obs => (
                <div key={obs.id} className="bg-surface-2/60 rounded p-2 space-y-1.5 border border-border/30">
                  <div className="flex items-center justify-between">
                    <Input
                      value={obs.label}
                      onChange={e => updateObstacle(obs.id, { label: e.target.value })}
                      className="h-5 text-[10px] bg-transparent border-none p-0 font-medium"
                    />
                    <button onClick={() => removeObstacle(obs.id)} className="text-destructive/60 hover:text-destructive">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>

                  <Select value={obs.type} onValueChange={v => updateObstacle(obs.id, { type: v as Obstacle['type'] })}>
                    <SelectTrigger className="h-5 text-[10px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sphere">Sphere</SelectItem>
                      <SelectItem value="box">Box</SelectItem>
                      <SelectItem value="cylinder">Cylinder</SelectItem>
                    </SelectContent>
                  </Select>

                  <div className="grid grid-cols-3 gap-1">
                    {['X', 'Y', 'Z'].map((axis, ai) => (
                      <div key={axis}>
                        <span className="text-[8px] text-muted-foreground">{axis}</span>
                        <Input
                          type="number"
                          value={obs.position[ai]}
                          onChange={e => {
                            const pos = [...obs.position] as [number, number, number];
                            pos[ai] = parseFloat(e.target.value) || 0;
                            updateObstacle(obs.id, { position: pos });
                          }}
                          className="h-5 text-[10px]"
                        />
                      </div>
                    ))}
                  </div>

                  <div>
                    <span className="text-[8px] text-muted-foreground">Size</span>
                    <Slider
                      value={[obs.size[0]]}
                      min={1}
                      max={20}
                      step={0.5}
                      onValueChange={([v]) => updateObstacle(obs.id, { size: [v, v, v] })}
                      className="mt-1"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Plan button */}
          <Button
            onClick={runPlanner}
            disabled={planning || formations.length < 2}
            className="w-full text-[11px] h-7"
            size="sm"
          >
            {planning ? 'Planning...' : 'Plan Paths'}
          </Button>

          {formations.length < 2 && (
            <p className="text-[9px] text-muted-foreground text-center">
              Need at least 2 formations to plan paths
            </p>
          )}

          {/* Results */}
          {result && (
            <div className="bg-surface-2/60 rounded p-2 space-y-2 border border-border/30">
              <h4 className="text-[10px] font-semibold text-foreground flex items-center gap-1">
                <CheckCircle className="w-3 h-3 text-green-400" /> Plan Results
              </h4>
              <div className="grid grid-cols-2 gap-1 text-[9px]">
                <div className="text-muted-foreground">Paths:</div>
                <div className="text-foreground font-mono-code">{result.paths.length}</div>
                <div className="text-muted-foreground">Total dist:</div>
                <div className="text-foreground font-mono-code">{result.totalDistance.toFixed(1)} m</div>
                <div className="text-muted-foreground">Avoided:</div>
                <div className="text-foreground font-mono-code">{result.obstaclesAvoided} obstacles</div>
                <div className="text-muted-foreground">Compute:</div>
                <div className="text-foreground font-mono-code">{result.computeTimeMs.toFixed(1)} ms</div>
              </div>

              {result.obstaclesAvoided > 0 && (
                <div className="flex items-center gap-1 text-[9px] text-yellow-400">
                  <AlertTriangle className="w-3 h-3" />
                  {result.obstaclesAvoided} drone(s) rerouted around obstacles
                </div>
              )}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
