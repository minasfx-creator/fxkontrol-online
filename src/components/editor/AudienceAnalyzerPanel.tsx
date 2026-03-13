import { useState, useMemo } from 'react';
import { Eye, X, BarChart3, AlertTriangle, CheckCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useProjectStore } from '@/store/useProjectStore';
import { analyzeFormation, AUDIENCE_VIEWPOINTS, type FormationAnalysis } from '@/lib/audiencePerspective';
import { cn } from '@/lib/utils';

function ScoreBar({ score, label }: { score: number; label: string }) {
  const color = score >= 70 ? 'bg-green-500' : score >= 40 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-[8px] text-muted-foreground">
        <span>{label}</span>
        <span className="font-mono-code">{score}</span>
      </div>
      <div className="h-1 bg-surface-2 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

export default function AudienceAnalyzerPanel({ onClose }: { onClose: () => void }) {
  const droneFormations = useProjectStore(s => s.droneFormations);
  const [selectedFormIdx, setSelectedFormIdx] = useState(0);
  const [expandedVP, setExpandedVP] = useState<string | null>(null);

  const analysis: FormationAnalysis | null = useMemo(() => {
    if (droneFormations.length === 0) return null;
    const formation = droneFormations[selectedFormIdx] || droneFormations[0];
    if (!formation || formation.points.length === 0) return null;
    return analyzeFormation(formation);
  }, [droneFormations, selectedFormIdx]);

  return (
    <div className="h-full flex flex-col bg-card border-l border-border">
      <div className="px-3 py-2 border-b border-border flex items-center gap-2">
        <Eye className="h-3.5 w-3.5 text-primary" />
        <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider flex-1">Audience View</h2>
        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={onClose}>
          <X className="h-3 w-3" />
        </Button>
      </div>

      {droneFormations.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-4 text-center">
          <div>
            <Eye className="h-6 w-6 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-[10px] text-muted-foreground">Crie uma formação para analisar a visibilidade</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {/* Formation selector */}
          {droneFormations.length > 1 && (
            <div className="px-2 py-1.5 border-b border-border">
              <select
                value={selectedFormIdx}
                onChange={e => setSelectedFormIdx(parseInt(e.target.value))}
                className="w-full h-6 text-[10px] font-mono-code bg-surface-2 border border-border rounded-sm px-1"
              >
                {droneFormations.map((f, i) => (
                  <option key={f.id} value={i}>{f.formationType} ({f.droneCount} drones)</option>
                ))}
              </select>
            </div>
          )}

          {analysis && (
            <>
              {/* Overall score */}
              <div className="px-3 py-3 border-b border-border">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-semibold text-foreground uppercase tracking-wider">Score Geral</span>
                  <span className={cn(
                    "text-lg font-bold font-mono-code",
                    analysis.avgScore >= 70 ? "text-green-400" :
                    analysis.avgScore >= 40 ? "text-yellow-400" : "text-red-400"
                  )}>
                    {analysis.avgScore}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1.5 text-[9px] font-mono-code">
                  <div className="bg-surface-2 rounded-sm px-2 py-1">
                    <span className="text-muted-foreground">Melhor: </span>
                    <span className="text-green-400">{analysis.bestViewpoint}</span>
                  </div>
                  <div className="bg-surface-2 rounded-sm px-2 py-1">
                    <span className="text-muted-foreground">Pior: </span>
                    <span className="text-red-400">{analysis.worstViewpoint}</span>
                  </div>
                </div>
              </div>

              {/* Viewpoint scores */}
              <div className="px-2 py-2 space-y-1">
                {analysis.scores.map(score => {
                  const vp = AUDIENCE_VIEWPOINTS.find(v => v.id === score.viewpointId);
                  const expanded = expandedVP === score.viewpointId;
                  return (
                    <div key={score.viewpointId} className="bg-surface-2 rounded-sm overflow-hidden">
                      <button
                        className="w-full flex items-center gap-1.5 px-2 py-1.5 text-left hover:bg-surface-3 transition-colors"
                        onClick={() => setExpandedVP(expanded ? null : score.viewpointId)}
                      >
                        <span className="text-[10px]">{vp?.icon}</span>
                        <span className="text-[9px] text-foreground flex-1 truncate">{score.viewpointName}</span>
                        <span className={cn(
                          "text-[10px] font-mono-code font-bold w-6 text-right",
                          score.overallScore >= 70 ? "text-green-400" :
                          score.overallScore >= 40 ? "text-yellow-400" : "text-red-400"
                        )}>
                          {score.overallScore}
                        </span>
                        {score.issues.length > 0 && (
                          <AlertTriangle className="h-2.5 w-2.5 text-yellow-400 flex-shrink-0" />
                        )}
                        {expanded ? <ChevronDown className="h-2.5 w-2.5 text-muted-foreground" /> : <ChevronRight className="h-2.5 w-2.5 text-muted-foreground" />}
                      </button>
                      
                      {expanded && (
                        <div className="px-2 pb-2 space-y-1.5">
                          <ScoreBar score={Math.round((score.visibleDrones / score.totalDrones) * 100)} label="Visibilidade" />
                          <ScoreBar score={score.spreadScore} label="Dispersão" />
                          <ScoreBar score={score.symmetryScore} label="Simetria" />
                          <ScoreBar score={100 - score.occlusionPercent} label="Sem Oclusão" />
                          
                          <div className="text-[8px] font-mono-code text-muted-foreground">
                            {score.visibleDrones}/{score.totalDrones} visíveis · gap min: {score.minGapPixels}px
                          </div>
                          
                          {score.issues.length > 0 && (
                            <div className="space-y-0.5">
                              {score.issues.map((issue, i) => (
                                <div key={i} className="text-[8px] text-yellow-400 flex items-center gap-1">
                                  <AlertTriangle className="h-2 w-2 flex-shrink-0" />
                                  {issue}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Recommendations */}
              {analysis.recommendations.length > 0 && (
                <div className="px-2 py-2 border-t border-border space-y-1">
                  <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Recomendações</span>
                  {analysis.recommendations.map((rec, i) => (
                    <div key={i} className="text-[9px] text-foreground bg-primary/10 rounded-sm px-2 py-1">
                      💡 {rec}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
