import { useMemo, useState } from 'react';
import { X, AlertTriangle, AlertOctagon, CheckCircle, Zap, BarChart3, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useProjectStore } from '@/store/useProjectStore';
import { analyzeFormationCollisions, type CollisionSummary } from '@/lib/collisionDetector';
import { cn } from '@/lib/utils';

export default function CollisionPanel({ onClose }: { onClose: () => void }) {
  const droneFormations = useProjectStore(s => s.droneFormations);
  const setCurrentTime = useProjectStore(s => s.setCurrentTime);
  const [sampleRate, setSampleRate] = useState(0.5);

  const analysis = useMemo<CollisionSummary | null>(() => {
    if (droneFormations.length === 0) return null;
    return analyzeFormationCollisions(droneFormations, sampleRate);
  }, [droneFormations, sampleRate]);

  return (
    <div className="h-full flex flex-col bg-surface-0 border-l border-border">
      <div className="flex items-center justify-between p-2 border-b border-border bg-surface-1">
        <div className="flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-primary" />
          <span className="text-[10px] font-bold font-mono-code text-foreground tracking-wider uppercase">Colisões</span>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {!analysis && (
          <div className="text-center py-4">
            <Zap className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-[9px] text-muted-foreground">Nenhuma formação para analisar</p>
          </div>
        )}

        {analysis && (
          <>
            {/* Summary banner */}
            <div className={cn(
              'p-2 rounded-sm border',
              analysis.totalCollisions === 0
                ? 'bg-green-500/10 border-green-500/30'
                : analysis.criticalCount > 0
                  ? 'bg-red-500/10 border-red-500/30'
                  : 'bg-yellow-500/10 border-yellow-500/30'
            )}>
              <div className="flex items-center gap-1.5 mb-1">
                {analysis.totalCollisions === 0 ? (
                  <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                ) : analysis.criticalCount > 0 ? (
                  <AlertOctagon className="w-3.5 h-3.5 text-red-500" />
                ) : (
                  <AlertTriangle className="w-3.5 h-3.5 text-yellow-400" />
                )}
                <span className={cn('text-[10px] font-bold uppercase',
                  analysis.totalCollisions === 0 ? 'text-green-400' :
                  analysis.criticalCount > 0 ? 'text-red-500' : 'text-yellow-400'
                )}>
                  {analysis.totalCollisions === 0 ? 'SEM COLISÕES' :
                   `${analysis.totalCollisions} COLISÃO${analysis.totalCollisions > 1 ? 'ÕES' : ''}`}
                </span>
              </div>
              {analysis.totalCollisions > 0 && (
                <div className="flex gap-3 text-[8px] font-mono-code">
                  <span className="text-red-400">🔴 {analysis.criticalCount} críticas</span>
                  <span className="text-yellow-400">🟡 {analysis.warningCount} alertas</span>
                  <span className="text-muted-foreground">Min: {analysis.worstDistance.toFixed(2)}m</span>
                </div>
              )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-1">
              <div className="p-1.5 rounded-sm bg-surface-2 border border-border/50 text-center">
                <p className="text-[10px] font-mono-code text-foreground">{droneFormations.length}</p>
                <p className="text-[8px] text-muted-foreground">Formações</p>
              </div>
              <div className="p-1.5 rounded-sm bg-surface-2 border border-border/50 text-center">
                <p className="text-[10px] font-mono-code text-foreground">{droneFormations[0]?.droneCount || 0}</p>
                <p className="text-[8px] text-muted-foreground">Drones</p>
              </div>
              <div className="p-1.5 rounded-sm bg-surface-2 border border-border/50 text-center">
                <p className={cn('text-[10px] font-mono-code', analysis.worstDistance > 0 && analysis.worstDistance < 1.5 ? 'text-red-400' : 'text-green-400')}>
                  {analysis.worstDistance > 0 ? `${analysis.worstDistance.toFixed(2)}m` : '—'}
                </p>
                <p className="text-[8px] text-muted-foreground">Dist. Mín.</p>
              </div>
            </div>

            {/* Min distance chart (simple text-based) */}
            {analysis.minDistanceOverTime.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <BarChart3 className="w-3 h-3 text-muted-foreground" />
                  <span className="text-[9px] text-muted-foreground font-semibold uppercase">Distância Mín. por Tempo</span>
                </div>
                <div className="h-16 bg-surface-2 rounded-sm border border-border/50 p-1 flex items-end gap-px">
                  {analysis.minDistanceOverTime.slice(0, 40).map((d, i) => {
                    const maxH = 14;
                    const h = Math.min(maxH, Math.max(1, (d.minDist / 3) * maxH));
                    return (
                      <div
                        key={i}
                        className={cn(
                          'flex-1 rounded-t-sm min-w-[2px]',
                          d.minDist < 0.8 ? 'bg-red-500' : d.minDist < 1.5 ? 'bg-yellow-500' : 'bg-green-500'
                        )}
                        style={{ height: `${(h / maxH) * 100}%` }}
                        title={`t=${d.time.toFixed(1)}s: ${d.minDist.toFixed(2)}m`}
                      />
                    );
                  })}
                </div>
                <div className="flex justify-between text-[8px] text-muted-foreground font-mono-code px-1">
                  <span>{analysis.minDistanceOverTime[0]?.time.toFixed(0)}s</span>
                  <span>{analysis.minDistanceOverTime[analysis.minDistanceOverTime.length - 1]?.time.toFixed(0)}s</span>
                </div>
              </div>
            )}

            {/* Collision list */}
            {analysis.collisions.length > 0 && (
              <div className="space-y-1">
                <span className="text-[9px] text-muted-foreground font-semibold uppercase">Detalhes</span>
                {analysis.collisions.map((c, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentTime(c.time)}
                    className="w-full flex items-center gap-1.5 p-1.5 rounded-sm border border-border/50 bg-surface-1/50 text-left hover:bg-surface-2 transition-colors"
                  >
                    {c.severity === 'critical' ? (
                      <AlertOctagon className="w-3 h-3 text-red-500 flex-shrink-0" />
                    ) : (
                      <AlertTriangle className="w-3 h-3 text-yellow-400 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-[8px] text-foreground truncate">{c.message}</p>
                      <div className="flex items-center gap-1 text-[8px] text-muted-foreground">
                        <span>t={c.time.toFixed(1)}s</span>
                        {c.formationBId && (
                          <>
                            <ArrowRight className="w-2 h-2" />
                            <span>Transição</span>
                          </>
                        )}
                      </div>
                    </div>
                    <span className={cn('text-[8px] font-mono-code',
                      c.severity === 'critical' ? 'text-red-400' : 'text-yellow-400'
                    )}>
                      {c.distance.toFixed(2)}m
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Sample rate */}
            <div className="flex items-center justify-between text-[8px] text-muted-foreground px-1">
              <span>Taxa de amostragem</span>
              <div className="flex gap-1">
                {[1, 0.5, 0.25].map(r => (
                  <button
                    key={r}
                    onClick={() => setSampleRate(r)}
                    className={cn(
                      'px-1.5 py-0.5 rounded-sm border text-[8px]',
                      sampleRate === r ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border/50 hover:text-foreground'
                    )}
                  >
                    {r}s
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
