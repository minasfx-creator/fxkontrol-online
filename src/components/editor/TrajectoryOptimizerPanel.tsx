import { useState, useMemo } from 'react';
import { useProjectStore } from '@/store/useProjectStore';
import {
  optimizeTrajectories,
  DEFAULT_CONSTRAINTS,
  type TrajectoryConstraints,
  type TrajectoryPoint,
  type TrajectoryViolation,
} from '@/lib/trajectoryOptimizer';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { X, Zap, AlertTriangle, CheckCircle, Play } from 'lucide-react';
import { toast } from 'sonner';

export default function TrajectoryOptimizerPanel({ onClose }: { onClose: () => void }) {
  const { droneFormations } = useProjectStore();
  const [constraints, setConstraints] = useState<TrajectoryConstraints>({ ...DEFAULT_CONSTRAINTS });
  const [result, setResult] = useState<{
    violations: TrajectoryViolation[];
    totalDistance: number;
    maxVel: number;
    maxAccel: number;
    time: number;
  } | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const droneCount = droneFormations.length > 0 ? droneFormations[0].droneCount : 0;

  // Build trajectories from formations
  const rawTrajectories = useMemo(() => {
    if (droneFormations.length < 2 || droneCount === 0) return [];

    const trajectories: TrajectoryPoint[][] = [];
    for (let d = 0; d < Math.min(droneCount, 200); d++) {
      const points: TrajectoryPoint[] = [];
      for (const f of droneFormations) {
        const pt = f.points[d];
        if (!pt) continue;
        points.push({ x: pt.x, y: f.height, z: pt.z, time: f.startTime });
        points.push({
          x: pt.x, y: f.height, z: pt.z,
          time: f.startTime + f.transitionDuration + f.holdDuration,
        });
      }
      trajectories.push(points);
    }
    return trajectories;
  }, [droneFormations, droneCount]);

  const handleAnalyze = () => {
    if (rawTrajectories.length === 0) {
      toast.error('Need at least 2 formations to analyze');
      return;
    }
    setAnalyzing(true);
    setTimeout(() => {
      const opt = optimizeTrajectories(rawTrajectories, constraints);
      setResult({
        violations: opt.violations,
        totalDistance: opt.totalDistance,
        maxVel: opt.maxVelocityUsed,
        maxAccel: opt.maxAccelerationUsed,
        time: opt.optimizationTime,
      });
      setAnalyzing(false);
      toast.success(`Analysis complete in ${opt.optimizationTime.toFixed(0)}ms`);
    }, 50);
  };

  const velViolations = result?.violations.filter(v => v.type === 'velocity') || [];
  const accelViolations = result?.violations.filter(v => v.type === 'acceleration') || [];
  const sepViolations = result?.violations.filter(v => v.type === 'separation') || [];

  return (
    <div className="h-full flex flex-col bg-surface-0 border-l border-border/50">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/40">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold text-foreground">Trajectory Optimizer</span>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 text-[10px]">
          <div className="bg-surface-1/60 rounded px-2 py-1.5">
            <span className="text-muted-foreground">Drones</span>
            <div className="text-foreground font-bold">{droneCount}</div>
          </div>
          <div className="bg-surface-1/60 rounded px-2 py-1.5">
            <span className="text-muted-foreground">Formations</span>
            <div className="text-foreground font-bold">{droneFormations.length}</div>
          </div>
        </div>

        {/* Constraints */}
        <div className="space-y-2">
          <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Constraints</h4>

          <div>
            <div className="flex justify-between text-[10px] mb-1">
              <span className="text-muted-foreground">Max Velocity</span>
              <span className="text-foreground">{constraints.maxVelocity.toFixed(1)} m/s</span>
            </div>
            <Slider
              value={[constraints.maxVelocity]}
              onValueChange={([v]) => setConstraints(c => ({ ...c, maxVelocity: v }))}
              min={1} max={20} step={0.5}
              className="h-4"
            />
          </div>

          <div>
            <div className="flex justify-between text-[10px] mb-1">
              <span className="text-muted-foreground">Max Acceleration</span>
              <span className="text-foreground">{constraints.maxAcceleration.toFixed(1)} m/s²</span>
            </div>
            <Slider
              value={[constraints.maxAcceleration]}
              onValueChange={([v]) => setConstraints(c => ({ ...c, maxAcceleration: v }))}
              min={0.5} max={10} step={0.5}
              className="h-4"
            />
          </div>

          <div>
            <div className="flex justify-between text-[10px] mb-1">
              <span className="text-muted-foreground">Min Separation</span>
              <span className="text-foreground">{constraints.minSeparation.toFixed(1)} m</span>
            </div>
            <Slider
              value={[constraints.minSeparation]}
              onValueChange={([v]) => setConstraints(c => ({ ...c, minSeparation: v }))}
              min={0.5} max={10} step={0.5}
              className="h-4"
            />
          </div>

          <div>
            <div className="flex justify-between text-[10px] mb-1">
              <span className="text-muted-foreground">Smoothing</span>
              <span className="text-foreground">{(constraints.smoothingFactor * 100).toFixed(0)}%</span>
            </div>
            <Slider
              value={[constraints.smoothingFactor]}
              onValueChange={([v]) => setConstraints(c => ({ ...c, smoothingFactor: v }))}
              min={0} max={1} step={0.05}
              className="h-4"
            />
          </div>
        </div>

        <Button
          onClick={handleAnalyze}
          disabled={analyzing || rawTrajectories.length === 0}
          className="w-full"
          size="sm"
        >
          {analyzing ? (
            <div className="w-3 h-3 border border-t-transparent rounded-full animate-spin mr-1" />
          ) : (
            <Play className="w-3 h-3 mr-1" />
          )}
          {analyzing ? 'Analyzing...' : 'Analyze Trajectories'}
        </Button>

        {/* Results */}
        {result && (
          <div className="space-y-2">
            <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Results</h4>

            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div className="bg-surface-1/60 rounded px-2 py-1.5">
                <span className="text-muted-foreground">Total Distance</span>
                <div className="text-foreground font-bold">{(result.totalDistance / 1000).toFixed(1)} km</div>
              </div>
              <div className="bg-surface-1/60 rounded px-2 py-1.5">
                <span className="text-muted-foreground">Peak Velocity</span>
                <div className="text-foreground font-bold">{result.maxVel.toFixed(1)} m/s</div>
              </div>
            </div>

            {/* Violations */}
            {result.violations.length === 0 ? (
              <div className="flex items-center gap-2 text-green-400 text-[10px] bg-green-500/10 rounded px-2 py-1.5">
                <CheckCircle className="w-3.5 h-3.5" />
                All constraints satisfied!
              </div>
            ) : (
              <div className="space-y-1.5">
                {velViolations.length > 0 && (
                  <div className="flex items-center gap-2 text-[10px]">
                    <AlertTriangle className="w-3 h-3 text-yellow-400" />
                    <span className="text-yellow-400">{velViolations.length} velocity violations</span>
                    <Badge variant="outline" className="text-[9px] px-1 py-0">
                      max {Math.max(...velViolations.map(v => v.value)).toFixed(1)} m/s
                    </Badge>
                  </div>
                )}
                {accelViolations.length > 0 && (
                  <div className="flex items-center gap-2 text-[10px]">
                    <AlertTriangle className="w-3 h-3 text-orange-400" />
                    <span className="text-orange-400">{accelViolations.length} acceleration violations</span>
                    <Badge variant="outline" className="text-[9px] px-1 py-0">
                      max {Math.max(...accelViolations.map(v => v.value)).toFixed(1)} m/s²
                    </Badge>
                  </div>
                )}
                {sepViolations.length > 0 && (
                  <div className="flex items-center gap-2 text-[10px]">
                    <AlertTriangle className="w-3 h-3 text-red-400" />
                    <span className="text-red-400">{sepViolations.length} separation violations</span>
                    <Badge variant="outline" className="text-[9px] px-1 py-0">
                      min {Math.min(...sepViolations.map(v => v.value)).toFixed(2)} m
                    </Badge>
                  </div>
                )}
              </div>
            )}

            <div className="text-[9px] text-muted-foreground text-right">
              Computed in {result.time.toFixed(0)}ms
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
