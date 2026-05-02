/**
 * /dev/libertadores — Fase 1 golden show inspector & exporter.
 *
 * Read-only dev route que carrega o ShowPlan canônico do Libertadores
 * (`createLibertadoresShowPlan`) e expõe:
 *   - Resumo determinístico (cues, módulos, posições, peso estimado).
 *   - Chave de safety constraints (NFPA, dual-key, continuidade).
 *   - Min channel-reuse (interlock anti cross-fire).
 *   - Botões para baixar PDF técnico + ZIP honest export.
 *
 * Honesty:
 *   - Nenhum disparo. Nenhum CommandBus. Nenhum hardware.
 *   - WorkMode permanece como o usuário deixou; esta rota nunca toca em
 *     `setWorkMode` nem `safetyStateMachine`. É puramente diagnóstico.
 *   - Claim policy de tudo que sai daqui está embutido no PDF e no ZIP.
 *
 * Público (sem auth) para alinhar com `/dev/readiness-audit` e permitir
 * debug em campo (iPhone PWA).
 */

import { lazy, Suspense, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, FileDown, Package, RefreshCw, Activity, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  createLibertadoresShowPlan,
  summarizeLibertadores,
} from '@/lib/showSeeds/libertadores';
import { inspectShowPlan } from '@/lib/showSeeds/inspectShowPlan';
import {
  renderShowPlanPdf,
  downloadShowPlanPdf,
} from '@/lib/showSeeds/showPlanPdf';
import { downloadLibertadoresExportZip } from '@/lib/showSeeds/libertadoresExport';
import { simulationDryRun } from '@/lib/showSeeds/simulationDryRun';
import { useWorkMode } from '@/core/safety/workMode';
import { verificationEngine } from '@/core/verification/VerificationEngine';
import { canonicalToEnginePlan } from '@/lib/showSeeds/canonicalToEnginePlan';

const ShowEngineHost = lazy(() => import('@/components/show-engine/ShowEngineHost'));

export default function LibertadoresPage() {
  const { toast } = useToast();
  const [seed, setSeed] = useState(0); // forces re-memo on "Refresh"
  const [busy, setBusy] = useState<null | 'pdf' | 'zip'>(null);
  const [engineMounted, setEngineMounted] = useState(false);

  const sp = useMemo(() => createLibertadoresShowPlan(), [seed]);
  const summary = useMemo(() => summarizeLibertadores(sp), [sp]);
  const inspection = useMemo(() => inspectShowPlan(sp), [sp]);
  const dryRun = useMemo(() => simulationDryRun(sp), [sp]);
  const verification = useMemo(() => verificationEngine.run(sp), [sp]);
  const workMode = useWorkMode();

  const handleDownloadPdf = async () => {
    setBusy('pdf');
    try {
      const bytes = await renderShowPlanPdf(sp, { inspection });
      downloadShowPlanPdf(bytes, 'fxk_libertadores_technical.pdf');
      toast({ title: 'PDF pronto', description: 'Relatório técnico baixado.' });
    } catch (err) {
      toast({
        title: 'Falha ao gerar PDF',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    } finally {
      setBusy(null);
    }
  };

  const handleDownloadZip = async () => {
    setBusy('zip');
    try {
      await downloadLibertadoresExportZip(sp, 'fxk_libertadores_export.zip');
      toast({
        title: 'Bundle pronto',
        description: '.fir + CSV + BoM + disclaimer.',
      });
    } catch (err) {
      toast({
        title: 'Falha ao gerar bundle',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    } finally {
      setBusy(null);
    }
  };

  const interlockOk =
    inspection.minChannelReuseS == null || inspection.minChannelReuseS >= 1.0;

  return (
    <div className="min-h-dvh bg-background text-foreground p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link to="/dev/readiness-audit">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Readiness audit
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-semibold">Libertadores · Golden Show</h1>
              <p className="text-sm text-muted-foreground">
                Fase 1 reference. Pure read · zero disparos · zero hardware.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant={
                verification.level === 'READY_FOR_FIELD'
                  ? 'default'
                  : verification.level === 'READY_FOR_EXPORT'
                    ? 'default'
                    : 'destructive'
              }
              className="text-xs"
            >
              Phase 1 · {verification.level}
            </Badge>
            <Button variant="outline" size="sm" onClick={() => setSeed((n) => n + 1)}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Recompute
            </Button>
          </div>
        </header>

        {/* Verification (Phase 1 exit) */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Verification · Phase 1 exit</h2>
            <div className="flex gap-2 text-xs">
              <Badge variant={verification.summary.errors === 0 ? 'default' : 'destructive'}>
                {verification.summary.errors} errors
              </Badge>
              <Badge variant="secondary">{verification.summary.warnings} warnings</Badge>
              <Badge variant="outline">{verification.summary.passed} passed</Badge>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mb-3">
            <code>VerificationEngine.run(sp)</code> direto no golden seed (sem
            ShowPlanManager). Critério Fase 1 = <code>READY_FOR_EXPORT</code> ou superior.
          </p>
          {verification.summary.errors > 0 && (
            <div className="text-sm text-destructive space-y-1">
              {verification.issues
                .filter((i) => !i.passed && i.severity === 'error')
                .slice(0, 5)
                .map((i) => (
                  <div key={i.id} className="font-mono text-xs">
                    ✗ {i.id}: {i.detail}
                  </div>
                ))}
            </div>
          )}
        </Card>

        {/* Summary */}
        <Card className="p-5">
          <h2 className="text-lg font-semibold mb-4">Show summary</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <Stat label="Duration" value={`${summary.duration.toFixed(0)}s`} />
            <Stat label="Modules" value={`${summary.modules}`} />
            <Stat label="Positions" value={`${summary.positions}`} />
            <Stat label="Total cues" value={`${summary.totalCues}`} />
            <Stat label="Lows" value={`${summary.lowCount}`} />
            <Stat label="Highs" value={`${summary.highCount}`} />
            <Stat label="Comets" value={`${summary.cometCount}`} />
            <Stat
              label="Est. weight"
              value={`${(inspection.bom.totalEstimatedWeightG / 1000).toFixed(2)} kg`}
              hint="marketing_hypothesis"
            />
          </div>
        </Card>

        {/* Safety + interlock */}
        <Card className="p-5">
          <h2 className="text-lg font-semibold mb-4">Safety constraints & interlock</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <Stat
              label="NFPA min distance"
              value={`${sp.safetyConstraints.nfpaMinDistance} m`}
            />
            <Stat
              label="Max wind"
              value={`${sp.safetyConstraints.maxWindSpeed} m/s`}
            />
            <Stat label="Max caliper" value={`${sp.safetyConstraints.maxCaliper} mm`} />
            <Stat
              label="Continuity check"
              value={
                sp.safetyConstraints.requireContinuityCheck ? 'REQUIRED' : 'optional'
              }
            />
            <Stat
              label="Dual key"
              value={sp.safetyConstraints.requireDualKey ? 'REQUIRED' : 'optional'}
            />
            <div>
              <div className="text-muted-foreground text-xs uppercase tracking-wider">
                Min channel reuse
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-base font-medium tabular-nums">
                  {inspection.minChannelReuseS == null
                    ? 'n/a'
                    : `${inspection.minChannelReuseS.toFixed(3)} s`}
                </span>
                <Badge variant={interlockOk ? 'default' : 'destructive'}>
                  {interlockOk ? 'OK ≥ 1s' : 'TIGHT < 1s'}
                </Badge>
              </div>
            </div>
          </div>
          {!interlockOk && (
            <p className="text-sm text-destructive mt-3">
              Cross-fire risk: {inspection.tightReuseChannels.length} canal(is) reusam em &lt;1s.
            </p>
          )}
        </Card>

        {/* BoM preview */}
        <Card className="p-5">
          <h2 className="text-lg font-semibold mb-4">Bill of Materials (top SKUs)</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground uppercase tracking-wider">
                <tr className="text-left">
                  <th className="py-2">Effect</th>
                  <th className="py-2">Cal (mm)</th>
                  <th className="py-2">Qty</th>
                  <th className="py-2">Sections</th>
                  <th className="py-2 text-right">Weight (g)</th>
                </tr>
              </thead>
              <tbody>
                {inspection.bom.rows.map((r) => (
                  <tr key={`${r.effectId}-${r.caliber}`} className="border-t border-border">
                    <td className="py-2 font-mono text-xs">{r.effectId}</td>
                    <td className="py-2 tabular-nums">{r.caliber}</td>
                    <td className="py-2 tabular-nums">{r.count}</td>
                    <td className="py-2 text-xs text-muted-foreground">
                      {r.sections.join(', ') || '—'}
                    </td>
                    <td className="py-2 tabular-nums text-right">
                      {r.estimatedTotalWeightG}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Simulation dry-run */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Simulation play loop · dry-run
            </h2>
            <Badge variant={workMode === 'real_operation' ? 'destructive' : 'secondary'}>
              workMode: {workMode}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Walk determinístico do <code>play</code> loop em <code>simulation</code>.
            Sem CommandBus, sem fieldBus, sem Three.js — apenas certifica que o
            ShowPlan é consumível pela coreografia.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
            <Stat label="Cues fired" value={`${dryRun.cuesFired} / ${dryRun.totalCues}`} />
            <Stat label="Peak concurrent" value={`${dryRun.peakConcurrentBurns}`} hint="burns simultâneos" />
            <Stat
              label="Avg load"
              value={`${dryRun.avgLoadCuesPerSec.toFixed(2)} cps`}
              hint="cues/segundo"
            />
            <Stat
              label="Frames sampled"
              value={`${dryRun.framesSampled}`}
              hint="60Hz tick"
            />
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Interlock breaches:</span>
            <Badge variant={dryRun.interlockBreaches.length === 0 ? 'default' : 'destructive'}>
              {dryRun.interlockBreaches.length === 0
                ? 'NONE · ≥1s respeitado'
                : `${dryRun.interlockBreaches.length} canal(is) <1s`}
            </Badge>
          </div>
          {/* Sparkline */}
          <div className="mt-4 h-16 w-full bg-muted/30 rounded relative overflow-hidden">
            <svg viewBox={`0 0 ${dryRun.trace.length} 100`} preserveAspectRatio="none" className="w-full h-full">
              <polyline
                fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
                points={dryRun.trace
                  .map((f, i) => {
                    const peak = Math.max(1, dryRun.peakConcurrentBurns);
                    const y = 100 - (f.activeBurns / peak) * 95;
                    return `${i},${y}`;
                  })
                  .join(' ')}
              />
            </svg>
            <div className="absolute bottom-1 left-2 text-[10px] text-muted-foreground">
              0s
            </div>
            <div className="absolute bottom-1 right-2 text-[10px] text-muted-foreground">
              {dryRun.durationS.toFixed(0)}s
            </div>
          </div>
        </Card>


        <Card className="p-5">
          <h2 className="text-lg font-semibold mb-2">Honest exports</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Conteúdo do ShowPlan = <code>validated</code>. Aceitação automática FireOne 2.0
            e estimativas de peso = <code>marketing_hypothesis</code>. Disclaimer completo
            embutido em cada artefato.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button onClick={handleDownloadPdf} disabled={busy !== null}>
              <FileDown className="h-4 w-4 mr-2" />
              {busy === 'pdf' ? 'Gerando…' : 'PDF técnico'}
            </Button>
            <Button onClick={handleDownloadZip} disabled={busy !== null} variant="secondary">
              <Package className="h-4 w-4 mr-2" />
              {busy === 'zip' ? 'Compactando…' : 'Bundle ZIP (.fir + CSV + BoM)'}
            </Button>
          </div>
        </Card>

        <p className="text-xs text-muted-foreground text-center">
          Pure read · Esta rota não autoriza disparo. Autorização real continua exclusiva
          do CommandBus → SafetyStateMachine em <code>real_operation</code>.
        </p>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div>
      <div className="text-muted-foreground text-xs uppercase tracking-wider">{label}</div>
      <div className="text-base font-medium tabular-nums">{value}</div>
      {hint && <div className="text-[10px] text-muted-foreground">{hint}</div>}
    </div>
  );
}
