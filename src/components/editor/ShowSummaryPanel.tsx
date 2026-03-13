import { useMemo } from 'react';
import { FileBarChart, Clock, Layers, Zap, DollarSign, MapPin, Shield } from 'lucide-react';
import { useProjectStore, EFFECT_LIBRARY } from '@/store/useProjectStore';
import { cn } from '@/lib/utils';

/**
 * ShowSummaryPanel — Finale 3D–style show overview with statistics,
 * timeline breakdown, safety metrics, and cost summary.
 */
export default function ShowSummaryPanel({ onClose }: { onClose: () => void }) {
  const { projectName, timelineItems, positions, droneFormations, duration, trajectories } = useProjectStore();

  const stats = useMemo(() => {
    // Effect counts by type
    const effectCounts: Record<string, number> = {};
    let totalCost = 0;
    let totalDevices = 0;
    const calibers: Record<number, number> = {};
    const usedPositions = new Set<string>();

    for (const item of timelineItems) {
      const effect = EFFECT_LIBRARY.find(e => e.id === item.effectId);
      if (!effect) continue;
      const cat = effect.category;
      effectCounts[cat] = (effectCounts[cat] || 0) + 1;
      totalCost += effect.cost;
      totalDevices++;
      if (effect.caliber) {
        calibers[effect.caliber] = (calibers[effect.caliber] || 0) + 1;
      }
      if (item.positionId) usedPositions.add(item.positionId);
    }

    // Drone stats
    const droneCount = droneFormations.length > 0 ? droneFormations[0].droneCount : 0;
    const showDuration = droneFormations.length > 0
      ? droneFormations.reduce((max, f) => Math.max(max, f.startTime + f.transitionDuration + f.holdDuration), 0)
      : duration;

    // Safety: max caliber determines safety distance
    const maxCaliber = Object.keys(calibers).map(Number).sort((a, b) => b - a)[0] || 0;
    const safetyRadius = maxCaliber >= 8 ? 210 : maxCaliber >= 6 ? 175 : maxCaliber >= 5 ? 140 : maxCaliber >= 4 ? 100 : maxCaliber >= 3 ? 70 : 30;

    return {
      effectCounts,
      totalCost,
      totalDevices,
      calibers,
      usedPositions: usedPositions.size,
      totalPositions: positions.length,
      droneCount,
      formationCount: droneFormations.length,
      trajectoryCount: trajectories.length,
      showDuration,
      maxCaliber,
      safetyRadius,
    };
  }, [timelineItems, positions, droneFormations, duration, trajectories]);

  const CATEGORY_LABELS: Record<string, { label: string; emoji: string }> = {
    morteiros: { label: 'Shells', emoji: '💥' },
    peonias: { label: 'Aerial', emoji: '🎆' },
    mines: { label: 'Mines', emoji: '⛏️' },
    roman_candles: { label: 'Roman Candles', emoji: '🕯️' },
    waterfalls: { label: 'Waterfalls', emoji: '🌊' },
    cakes_batteries: { label: 'Cakes', emoji: '🎂' },
    drones: { label: 'Drones', emoji: '🤖' },
    sfx: { label: 'SFX', emoji: '🔊' },
    lasers: { label: 'Lasers', emoji: '⚡' },
    iluminacao: { label: 'Lights', emoji: '💡' },
  };

  return (
    <div className="h-full flex flex-col bg-surface-0 border-l border-border">
      <div className="flex items-center justify-between p-2 border-b border-border bg-surface-1">
        <div className="flex items-center gap-1.5">
          <FileBarChart className="w-3.5 h-3.5 text-primary" />
          <span className="text-[10px] font-bold font-mono-code text-foreground tracking-wider uppercase">
            Show Summary
          </span>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xs">✕</button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        {/* Project info */}
        <div className="bg-surface-2 rounded-sm p-2 space-y-1">
          <span className="text-[10px] font-semibold text-foreground">{projectName}</span>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[9px] font-mono-code">
            <div className="flex items-center gap-1 text-muted-foreground">
              <Clock className="w-2.5 h-2.5" />
              <span>Duration</span>
            </div>
            <span className="text-foreground text-right">{stats.showDuration.toFixed(0)}s ({(stats.showDuration / 60).toFixed(1)}min)</span>

            <div className="flex items-center gap-1 text-muted-foreground">
              <Layers className="w-2.5 h-2.5" />
              <span>Formations</span>
            </div>
            <span className="text-foreground text-right">{stats.formationCount}</span>

            <div className="flex items-center gap-1 text-muted-foreground">
              <Zap className="w-2.5 h-2.5" />
              <span>Drones</span>
            </div>
            <span className="text-foreground text-right">{stats.droneCount}</span>

            <div className="flex items-center gap-1 text-muted-foreground">
              <MapPin className="w-2.5 h-2.5" />
              <span>Positions</span>
            </div>
            <span className="text-foreground text-right">{stats.usedPositions}/{stats.totalPositions}</span>

            <div className="flex items-center gap-1 text-muted-foreground">
              <Shield className="w-2.5 h-2.5" />
              <span>Safety Radius</span>
            </div>
            <span className={cn("text-right", stats.maxCaliber >= 6 ? "text-destructive" : "text-foreground")}>
              {stats.safetyRadius}m (max {stats.maxCaliber}"")
            </span>
          </div>
        </div>

        {/* Pyro breakdown */}
        {stats.totalDevices > 0 && (
          <div className="space-y-1">
            <span className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider">Pyro Breakdown</span>
            <div className="space-y-0.5">
              {Object.entries(stats.effectCounts).sort(([, a], [, b]) => b - a).map(([cat, count]) => {
                const info = CATEGORY_LABELS[cat] || { label: cat, emoji: '📦' };
                const pct = (count / stats.totalDevices) * 100;
                return (
                  <div key={cat} className="flex items-center gap-1.5 text-[9px]">
                    <span className="w-4 text-center">{info.emoji}</span>
                    <span className="text-muted-foreground flex-1">{info.label}</span>
                    <span className="font-mono-code text-foreground w-6 text-right">{count}</span>
                    <div className="w-16 h-1.5 bg-surface-3 rounded-full overflow-hidden">
                      <div className="h-full bg-primary/60 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Caliber distribution */}
        {Object.keys(stats.calibers).length > 0 && (
          <div className="space-y-1">
            <span className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider">Caliber Distribution</span>
            <div className="flex gap-1 flex-wrap">
              {Object.entries(stats.calibers).sort(([a], [b]) => Number(a) - Number(b)).map(([cal, count]) => (
                <div key={cal} className="px-1.5 py-0.5 rounded-sm bg-surface-2 border border-border/50 text-[9px] font-mono-code">
                  <span className="text-primary">{cal}"</span>
                  <span className="text-muted-foreground ml-1">×{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Cost summary */}
        <div className="bg-surface-2 rounded-sm p-2 space-y-1">
          <div className="flex items-center gap-1.5">
            <DollarSign className="w-3 h-3 text-muted-foreground" />
            <span className="text-[9px] font-semibold text-muted-foreground uppercase">Cost Estimate</span>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[9px] font-mono-code">
            <span className="text-muted-foreground">Total Devices</span>
            <span className="text-foreground text-right">{stats.totalDevices}</span>
            <span className="text-muted-foreground">Est. Materials</span>
            <span className="text-foreground text-right">${stats.totalCost.toLocaleString()}</span>
            <span className="text-muted-foreground">Trajectories</span>
            <span className="text-foreground text-right">{stats.trajectoryCount}</span>
          </div>
        </div>

        {/* Formation timeline */}
        {stats.formationCount > 0 && (
          <div className="space-y-1">
            <span className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider">Formation Timeline</span>
            <div className="space-y-0.5">
              {useProjectStore.getState().droneFormations.map((f, i) => {
                const endTime = f.startTime + f.transitionDuration + f.holdDuration;
                return (
                  <div key={f.id} className="flex items-center gap-1 text-[8px] font-mono-code px-1 py-0.5 rounded-sm bg-surface-2">
                    <span className="text-muted-foreground w-3">{i + 1}</span>
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: f.color }} />
                    <span className="text-foreground flex-1 truncate">{f.formationType}</span>
                    <span className="text-muted-foreground">{f.startTime.toFixed(0)}→{endTime.toFixed(0)}s</span>
                    <span className="text-muted-foreground">{f.height}m</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty state */}
        {stats.totalDevices === 0 && stats.formationCount === 0 && (
          <div className="text-center py-8">
            <FileBarChart className="w-6 h-6 text-muted-foreground/20 mx-auto mb-2" />
            <p className="text-[10px] text-muted-foreground/60">Add effects or drone formations to see show summary</p>
          </div>
        )}
      </div>
    </div>
  );
}
