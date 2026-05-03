/**
 * Training v2.1 — Mission Debrief Metrics Panel.
 *
 * Pure presentational layer for the post-mission debrief.
 * Consumes the pure computeDebriefMetrics() output.
 */
import { Activity, Crosshair, MapPin, AlertTriangle, Lightbulb } from 'lucide-react';
import type { DebriefMetrics, MetricRow } from '../missions/debriefMetrics';

const ICONS: Record<MetricRow['id'], React.ComponentType<{ className?: string }>> = {
  time: Activity,
  accuracy3p: Crosshair,
  positioning: MapPin,
  errors: AlertTriangle,
};

const GRADE_COLOR: Record<string, string> = {
  S: 'text-[hsl(45_100%_60%)]',
  A: 'text-emerald-400',
  B: 'text-cyan-400',
  C: 'text-amber-400',
  D: 'text-destructive',
};

export default function MissionDebriefPanel({ metrics }: { metrics: DebriefMetrics }) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border/50 bg-card/60 p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] uppercase tracking-[0.25em] font-mono text-muted-foreground">
            Métricas objetivas
          </p>
          <div className="flex items-baseline gap-2">
            <span className="text-[10px] uppercase tracking-widest font-mono text-muted-foreground">
              Geral
            </span>
            <span className={`text-2xl font-bold font-mono ${GRADE_COLOR[metrics.overallGrade]}`}>
              {metrics.overallGrade}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {metrics.rows.map((row) => {
            const Icon = ICONS[row.id];
            return (
              <div
                key={row.id}
                data-testid={`debrief-metric-${row.id}`}
                className="rounded-md border border-border/40 bg-background/40 p-3"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    <p className="text-[10px] uppercase tracking-widest font-mono text-muted-foreground">
                      {row.label}
                    </p>
                  </div>
                  <span className={`text-sm font-bold font-mono ${GRADE_COLOR[row.grade]}`}>
                    {row.grade}
                  </span>
                </div>
                <p className="text-lg font-bold font-mono text-foreground leading-tight">
                  {row.value}
                </p>
                {row.detail && (
                  <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
                    {row.detail}
                  </p>
                )}
                <div className="mt-2 h-1 rounded-full bg-border/40 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all"
                    style={{ width: `${Math.round(row.score * 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-lg border border-border/50 bg-card/60 p-4">
        <div className="flex items-center gap-2 mb-2">
          <Lightbulb className="h-4 w-4 text-[hsl(45_100%_60%)]" />
          <p className="text-xs font-bold uppercase tracking-wider text-foreground">
            Recomendações sugeridas
          </p>
        </div>
        <ul className="space-y-1.5 text-sm text-foreground/85">
          {metrics.recommendations.map((r, i) => (
            <li key={i} className="flex gap-2" data-testid={`debrief-reco-${i}`}>
              <span className="text-[hsl(45_100%_60%)]">•</span>
              <span>{r}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
