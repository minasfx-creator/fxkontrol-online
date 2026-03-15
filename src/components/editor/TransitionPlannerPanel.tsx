/**
 * ─── Transition Planner Panel ───────────────────────────────────────
 * Skybrush Studio-style transition planning between formations.
 * Uses Hungarian algorithm for optimal drone-to-slot assignment.
 */

import { useState, useMemo, useCallback } from 'react';
import { ArrowRightLeft, Zap, Timer, Route, BarChart3, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import {
  planTransition,
  type TransitionSlot,
  type TransitionConfig,
  type TransitionPlan,
  DEFAULT_TRANSITION_CONFIG,
} from '@/lib/transitionPlanner';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface TransitionPlannerPanelProps {
  onClose?: () => void;
}

// Demo data for visualization
function generateDemoFormation(count: number, radius: number, yOffset: number): TransitionSlot[] {
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2;
    return {
      id: `drone-${i}`,
      x: Math.cos(angle) * radius,
      y: yOffset,
      z: Math.sin(angle) * radius,
    };
  });
}

export default function TransitionPlannerPanel({ onClose }: TransitionPlannerPanelProps) {
  const [config, setConfig] = useState<TransitionConfig>({ ...DEFAULT_TRANSITION_CONFIG });
  const [demoCount, setDemoCount] = useState(24);
  const [plan, setPlan] = useState<TransitionPlan | null>(null);

  const sourcePositions = useMemo(() => generateDemoFormation(demoCount, 15, 30), [demoCount]);
  const targetPositions = useMemo(() => {
    // Target: grid pattern
    const cols = Math.ceil(Math.sqrt(demoCount));
    return Array.from({ length: demoCount }, (_, i) => ({
      id: `slot-${i}`,
      x: (i % cols - cols / 2) * 3,
      y: 40,
      z: (Math.floor(i / cols) - cols / 2) * 3,
    }));
  }, [demoCount]);

  const handlePlan = useCallback(() => {
    const t0 = performance.now();
    const result = planTransition(sourcePositions, targetPositions, config);
    const elapsed = performance.now() - t0;
    setPlan(result);
    toast.success(`Transition planned in ${elapsed.toFixed(1)}ms — ${result.transitionDuration.toFixed(1)}s total`);
  }, [sourcePositions, targetPositions, config]);

  // SVG bounds for 2D preview
  const svgBounds = useMemo(() => {
    const allSlots = [...sourcePositions, ...targetPositions];
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    allSlots.forEach(s => {
      minX = Math.min(minX, s.x); maxX = Math.max(maxX, s.x);
      minZ = Math.min(minZ, s.z); maxZ = Math.max(maxZ, s.z);
    });
    const pad = 5;
    return { x: minX - pad, z: minZ - pad, w: maxX - minX + pad * 2, h: maxZ - minZ + pad * 2 };
  }, [sourcePositions, targetPositions]);

  return (
    <div className="h-full flex flex-col bg-surface-0 border-l border-border">
      <div className="p-2 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <ArrowRightLeft className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-bold text-foreground tracking-wide">TRANSITION PLANNER</span>
          </div>
          <Badge variant="outline" className="text-[8px]">Skybrush</Badge>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-4">
          {/* Preview SVG */}
          <div className="bg-background rounded border border-border p-1">
            <svg
              viewBox={`${svgBounds.x} ${svgBounds.z} ${svgBounds.w} ${svgBounds.h}`}
              className="w-full h-36"
            >
              {/* Assignment lines */}
              {plan?.assignments.map((a, i) => (
                <line
                  key={i}
                  x1={a.fromSlot.x} y1={a.fromSlot.z}
                  x2={a.toSlot.x} y2={a.toSlot.z}
                  stroke={`hsl(${(a.distance / (plan.maxDistance || 1)) * 60}, 80%, 50%)`}
                  strokeWidth={0.3}
                  opacity={0.6}
                />
              ))}

              {/* Source positions */}
              {sourcePositions.map(p => (
                <circle key={`s-${p.id}`} cx={p.x} cy={p.z} r={0.8} fill="hsl(var(--primary))" opacity={0.7} />
              ))}

              {/* Target positions */}
              {targetPositions.map(p => (
                <rect
                  key={`t-${p.id}`}
                  x={p.x - 0.6} y={p.z - 0.6}
                  width={1.2} height={1.2}
                  fill="hsl(var(--accent))"
                  opacity={0.7}
                  rx={0.2}
                />
              ))}
            </svg>
            <div className="flex justify-center gap-4 mt-1">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-primary" />
                <span className="text-[8px] text-muted-foreground">Source</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-sm bg-accent" />
                <span className="text-[8px] text-muted-foreground">Target</span>
              </div>
            </div>
          </div>

          {/* Stats */}
          {plan && (
            <div className="grid grid-cols-4 gap-1.5">
              <div className="bg-background rounded p-1.5 text-center">
                <div className="text-[8px] text-muted-foreground">Duration</div>
                <div className="text-[10px] font-bold text-foreground">{plan.transitionDuration.toFixed(1)}s</div>
              </div>
              <div className="bg-background rounded p-1.5 text-center">
                <div className="text-[8px] text-muted-foreground">Total</div>
                <div className="text-[10px] font-bold text-foreground">{plan.totalDistance.toFixed(0)}m</div>
              </div>
              <div className="bg-background rounded p-1.5 text-center">
                <div className="text-[8px] text-muted-foreground">Max</div>
                <div className="text-[10px] font-bold text-foreground">{plan.maxDistance.toFixed(1)}m</div>
              </div>
              <div className="bg-background rounded p-1.5 text-center">
                <div className="text-[8px] text-muted-foreground">Avg</div>
                <div className="text-[10px] font-bold text-foreground">{plan.avgDistance.toFixed(1)}m</div>
              </div>
            </div>
          )}

          {/* Controls */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-[10px] text-muted-foreground">Drone Count (demo)</Label>
              <span className="text-[10px] font-mono text-foreground">{demoCount}</span>
            </div>
            <Slider
              value={[demoCount]}
              onValueChange={([v]) => setDemoCount(v)}
              min={4}
              max={200}
              step={1}
              className="h-4"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-[10px] text-muted-foreground">Max Velocity</Label>
              <span className="text-[10px] font-mono text-foreground">{config.maxVelocity.toFixed(1)} m/s</span>
            </div>
            <Slider
              value={[config.maxVelocity]}
              onValueChange={([v]) => setConfig(c => ({ ...c, maxVelocity: v }))}
              min={0.5}
              max={10}
              step={0.1}
              className="h-4"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-[10px] text-muted-foreground">Stagger Delay</Label>
              <span className="text-[10px] font-mono text-foreground">{config.staggerDelay.toFixed(2)}s</span>
            </div>
            <Slider
              value={[config.staggerDelay]}
              onValueChange={([v]) => setConfig(c => ({ ...c, staggerDelay: v }))}
              min={0}
              max={1}
              step={0.01}
              className="h-4"
            />
          </div>

          <div>
            <Label className="text-[10px] text-muted-foreground mb-1 block">Stagger Mode</Label>
            <Select
              value={config.staggerMode}
              onValueChange={(v) => setConfig(c => ({ ...c, staggerMode: v as TransitionConfig['staggerMode'] }))}
            >
              <SelectTrigger className="h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="distance">By Distance</SelectItem>
                <SelectItem value="angle">By Angle</SelectItem>
                <SelectItem value="spiral">Spiral</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-[10px] text-muted-foreground">Collision Radius</Label>
              <span className="text-[10px] font-mono text-foreground">{config.collisionRadius.toFixed(1)}m</span>
            </div>
            <Slider
              value={[config.collisionRadius]}
              onValueChange={([v]) => setConfig(c => ({ ...c, collisionRadius: v }))}
              min={1}
              max={5}
              step={0.1}
              className="h-4"
            />
          </div>

          <div className="flex items-center justify-between">
            <Label className="text-[10px] text-muted-foreground">Inner Transition</Label>
            <Switch
              checked={config.innerTransition}
              onCheckedChange={v => setConfig(c => ({ ...c, innerTransition: v }))}
            />
          </div>

          {/* Plan Button */}
          <Button size="sm" className="w-full h-8 text-xs gap-1.5" onClick={handlePlan}>
            <Zap className="w-3.5 h-3.5" />
            Plan Transition (Hungarian)
          </Button>

          {/* Assignment List */}
          {plan && (
            <div className="border-t border-border pt-2">
              <div className="text-[10px] font-bold text-muted-foreground mb-1">Assignments ({plan.assignments.length})</div>
              <div className="max-h-40 overflow-y-auto space-y-0.5">
                {plan.assignments.slice(0, 50).map((a, i) => (
                  <div key={i} className="flex items-center justify-between text-[9px] px-1 py-0.5 bg-background rounded">
                    <span className="text-foreground font-mono">{a.droneId}</span>
                    <span className="text-muted-foreground">{a.distance.toFixed(1)}m</span>
                    <span className="text-muted-foreground">+{a.delay.toFixed(1)}s</span>
                  </div>
                ))}
                {plan.assignments.length > 50 && (
                  <div className="text-[9px] text-muted-foreground text-center">
                    ...and {plan.assignments.length - 50} more
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
