/**
 * ─── Transition Planner Panel ───────────────────────────────────────
 * Skybrush Studio-style transition planning between formations.
 * Uses Hungarian algorithm for optimal drone-to-slot assignment.
 * NOW connected to real formation data from the project store.
 */

import { useState, useMemo, useCallback } from 'react';
import { ArrowRightLeft, Zap, ChevronDown, AlertTriangle } from 'lucide-react';
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
import { useProjectStore } from '@/store/useProjectStore';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface TransitionPlannerPanelProps {
  onClose?: () => void;
}

export default function TransitionPlannerPanel({ onClose }: TransitionPlannerPanelProps) {
  const droneFormations = useProjectStore((s) => s.droneFormations);
  const updateDroneFormation = useProjectStore((s) => s.updateDroneFormation);

  const [config, setConfig] = useState<TransitionConfig>({ ...DEFAULT_TRANSITION_CONFIG });
  const [selectedPairIdx, setSelectedPairIdx] = useState(0);
  const [plans, setPlans] = useState<Map<number, TransitionPlan>>(new Map());

  // Build transition pairs from real formations
  const pairs = useMemo(() => {
    const result: { idx: number; fromName: string; toName: string; source: TransitionSlot[]; target: TransitionSlot[] }[] = [];
    for (let i = 0; i < droneFormations.length - 1; i++) {
      const from = droneFormations[i];
      const to = droneFormations[i + 1];
      const count = Math.min(from.points.length, to.points.length);

      const source: TransitionSlot[] = from.points.slice(0, count).map((p, j) => ({
        id: `d-${j}`, x: p.x, y: from.height, z: p.z,
      }));
      const target: TransitionSlot[] = to.points.slice(0, count).map((p, j) => ({
        id: `s-${j}`, x: p.x, y: to.height, z: p.z,
      }));

      result.push({
        idx: i,
        fromName: `#${i + 1} ${from.formationType}`,
        toName: `#${i + 2} ${to.formationType}`,
        source,
        target,
      });
    }
    return result;
  }, [droneFormations]);

  const activePair = pairs[selectedPairIdx] || null;
  const activePlan = plans.get(selectedPairIdx) || null;

  const handlePlanOne = useCallback(() => {
    if (!activePair) return;
    const t0 = performance.now();
    const result = planTransition(activePair.source, activePair.target, config);
    const elapsed = performance.now() - t0;
    setPlans(prev => new Map(prev).set(selectedPairIdx, result));

    // Apply optimized transition duration to the target formation
    const targetFormation = droneFormations[selectedPairIdx + 1];
    if (targetFormation && Math.abs(result.transitionDuration - targetFormation.transitionDuration) > 0.5) {
      updateDroneFormation(targetFormation.id, { transitionDuration: Math.ceil(result.transitionDuration) });
    }

    toast.success(`Transição ${selectedPairIdx + 1}→${selectedPairIdx + 2} otimizada em ${elapsed.toFixed(0)}ms`, {
      description: `${result.transitionDuration.toFixed(1)}s · max ${result.maxDistance.toFixed(1)}m · avg ${result.avgDistance.toFixed(1)}m`,
    });
  }, [activePair, config, selectedPairIdx, droneFormations, updateDroneFormation]);

  const handlePlanAll = useCallback(() => {
    const t0 = performance.now();
    const newPlans = new Map<number, TransitionPlan>();
    for (const pair of pairs) {
      const result = planTransition(pair.source, pair.target, config);
      newPlans.set(pair.idx, result);

      const targetFormation = droneFormations[pair.idx + 1];
      if (targetFormation) {
        updateDroneFormation(targetFormation.id, { transitionDuration: Math.ceil(result.transitionDuration) });
      }
    }
    setPlans(newPlans);
    const elapsed = performance.now() - t0;
    toast.success(`${pairs.length} transições otimizadas em ${elapsed.toFixed(0)}ms`);
  }, [pairs, config, droneFormations, updateDroneFormation]);

  // SVG bounds for 2D preview
  const svgData = useMemo(() => {
    if (!activePair) return null;
    const allSlots = [...activePair.source, ...activePair.target];
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    allSlots.forEach(s => {
      minX = Math.min(minX, s.x); maxX = Math.max(maxX, s.x);
      minZ = Math.min(minZ, s.z); maxZ = Math.max(maxZ, s.z);
    });
    const pad = 5;
    return { x: minX - pad, z: minZ - pad, w: maxX - minX + pad * 2, h: maxZ - minZ + pad * 2 };
  }, [activePair]);

  if (droneFormations.length < 2) {
    return (
      <div className="h-full flex flex-col bg-surface-0 border-l border-border">
        <div className="p-2 border-b border-border">
          <div className="flex items-center gap-1.5">
            <ArrowRightLeft className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-bold text-foreground tracking-wide">TRANSITION PLANNER</span>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center space-y-2">
            <AlertTriangle className="w-6 h-6 text-muted-foreground mx-auto" />
            <p className="text-xs text-muted-foreground">Adicione pelo menos 2 formações para planejar transições.</p>
            <p className="text-[9px] text-muted-foreground">Use o SwarmGPT ou Formation Builder.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-surface-0 border-l border-border">
      <div className="p-2 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <ArrowRightLeft className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-bold text-foreground tracking-wide">TRANSITION PLANNER</span>
          </div>
          <Badge variant="outline" className="text-[8px]">{pairs.length} transições</Badge>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-3">
          {/* Transition pair selector */}
          <div>
            <Label className="text-[10px] text-muted-foreground mb-1 block">Transição</Label>
            <Select value={String(selectedPairIdx)} onValueChange={(v) => setSelectedPairIdx(Number(v))}>
              <SelectTrigger className="h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pairs.map((p) => (
                  <SelectItem key={p.idx} value={String(p.idx)}>
                    {p.fromName} → {p.toName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Preview SVG */}
          {activePair && svgData && (
            <div className="bg-background rounded border border-border p-1">
              <svg
                viewBox={`${svgData.x} ${svgData.z} ${svgData.w} ${svgData.h}`}
                className="w-full h-36"
              >
                {/* Assignment lines */}
                {activePlan?.assignments.map((a, i) => (
                  <line
                    key={i}
                    x1={a.fromSlot.x} y1={a.fromSlot.z}
                    x2={a.toSlot.x} y2={a.toSlot.z}
                    stroke={`hsl(${Math.max(0, 120 - (a.distance / (activePlan.maxDistance || 1)) * 120)}, 80%, 50%)`}
                    strokeWidth={0.3}
                    opacity={0.6}
                  />
                ))}

                {/* Source positions */}
                {activePair.source.map((p, i) => (
                  <circle key={`s-${i}`} cx={p.x} cy={p.z} r={0.6} fill="hsl(var(--primary))" opacity={0.7} />
                ))}

                {/* Target positions */}
                {activePair.target.map((p, i) => (
                  <rect
                    key={`t-${i}`}
                    x={p.x - 0.5} y={p.z - 0.5}
                    width={1} height={1}
                    fill="hsl(var(--accent))"
                    opacity={0.7}
                    rx={0.15}
                  />
                ))}
              </svg>
              <div className="flex justify-center gap-4 mt-1">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                  <span className="text-[8px] text-muted-foreground">{activePair.fromName}</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-sm bg-accent" />
                  <span className="text-[8px] text-muted-foreground">{activePair.toName}</span>
                </div>
              </div>
            </div>
          )}

          {/* Stats */}
          {activePlan && (
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { label: 'Duração', value: `${activePlan.transitionDuration.toFixed(1)}s` },
                { label: 'Total', value: `${activePlan.totalDistance.toFixed(0)}m` },
                { label: 'Max', value: `${activePlan.maxDistance.toFixed(1)}m` },
                { label: 'Avg', value: `${activePlan.avgDistance.toFixed(1)}m` },
              ].map((s) => (
                <div key={s.label} className="bg-background rounded p-1.5 text-center">
                  <div className="text-[8px] text-muted-foreground">{s.label}</div>
                  <div className="text-[10px] font-bold text-foreground">{s.value}</div>
                </div>
              ))}
            </div>
          )}

          {/* Controls */}
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-[10px] text-muted-foreground">Velocidade Máx.</Label>
                <span className="text-[10px] font-mono text-foreground">{config.maxVelocity.toFixed(1)} m/s</span>
              </div>
              <Slider value={[config.maxVelocity]} onValueChange={([v]) => setConfig(c => ({ ...c, maxVelocity: v }))} min={0.5} max={15} step={0.1} className="h-4" />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-[10px] text-muted-foreground">Stagger Delay</Label>
                <span className="text-[10px] font-mono text-foreground">{config.staggerDelay.toFixed(2)}s</span>
              </div>
              <Slider value={[config.staggerDelay]} onValueChange={([v]) => setConfig(c => ({ ...c, staggerDelay: v }))} min={0} max={1} step={0.01} className="h-4" />
            </div>

            <div>
              <Label className="text-[10px] text-muted-foreground mb-1 block">Stagger Mode</Label>
              <Select value={config.staggerMode} onValueChange={(v) => setConfig(c => ({ ...c, staggerMode: v as TransitionConfig['staggerMode'] }))}>
                <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  <SelectItem value="distance">Por Distância</SelectItem>
                  <SelectItem value="angle">Por Ângulo</SelectItem>
                  <SelectItem value="spiral">Espiral</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-[10px] text-muted-foreground">Raio de Colisão</Label>
                <span className="text-[10px] font-mono text-foreground">{config.collisionRadius.toFixed(1)}m</span>
              </div>
              <Slider value={[config.collisionRadius]} onValueChange={([v]) => setConfig(c => ({ ...c, collisionRadius: v }))} min={0.5} max={5} step={0.1} className="h-4" />
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-[10px] text-muted-foreground">Inner Transition</Label>
              <Switch checked={config.innerTransition} onCheckedChange={v => setConfig(c => ({ ...c, innerTransition: v }))} />
            </div>
          </div>

          {/* Action buttons */}
          <div className="space-y-1.5">
            <Button size="sm" className="w-full h-8 text-xs gap-1.5" onClick={handlePlanOne} disabled={!activePair}>
              <Zap className="w-3.5 h-3.5" />
              Otimizar Transição Selecionada
            </Button>
            <Button size="sm" variant="outline" className="w-full h-8 text-xs gap-1.5" onClick={handlePlanAll} disabled={pairs.length === 0}>
              <ArrowRightLeft className="w-3.5 h-3.5" />
              Otimizar Todas ({pairs.length})
            </Button>
          </div>

          {/* All transitions overview */}
          {plans.size > 0 && (
            <div className="border-t border-border pt-2 space-y-1">
              <div className="text-[10px] font-bold text-muted-foreground">Resumo</div>
              {pairs.map((p) => {
                const plan = plans.get(p.idx);
                return (
                  <div
                    key={p.idx}
                    onClick={() => setSelectedPairIdx(p.idx)}
                    className={cn(
                      "flex items-center justify-between text-[9px] px-2 py-1 rounded cursor-pointer transition-colors",
                      selectedPairIdx === p.idx ? "bg-primary/10 text-primary" : "bg-background hover:bg-surface-2 text-foreground"
                    )}
                  >
                    <span className="font-mono">#{p.idx + 1}→#{p.idx + 2}</span>
                    {plan ? (
                      <div className="flex gap-2 text-muted-foreground">
                        <span>{plan.transitionDuration.toFixed(1)}s</span>
                        <span>{plan.maxDistance.toFixed(0)}m max</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Assignment List */}
          {activePlan && (
            <div className="border-t border-border pt-2">
              <div className="text-[10px] font-bold text-muted-foreground mb-1">Atribuições ({activePlan.assignments.length})</div>
              <div className="max-h-40 overflow-y-auto space-y-0.5">
                {activePlan.assignments.slice(0, 50).map((a, i) => (
                  <div key={i} className="flex items-center justify-between text-[9px] px-1 py-0.5 bg-background rounded">
                    <span className="text-foreground font-mono">{a.droneId}</span>
                    <span className="text-muted-foreground">{a.distance.toFixed(1)}m</span>
                    <span className="text-muted-foreground">+{a.delay.toFixed(1)}s</span>
                  </div>
                ))}
                {activePlan.assignments.length > 50 && (
                  <div className="text-[9px] text-muted-foreground text-center">
                    ...e mais {activePlan.assignments.length - 50}
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
