/**
 * /dev/golden-shows — catálogo central dos golden seeds (Fase 1).
 *
 * Lista todos os seeds registrados em `@/lib/showSeeds/catalog`, roda
 * `verificationEngine.run()` em cada um e mostra status em tempo real.
 * Read-only — zero disparos, zero hardware, zero CommandBus.
 *
 * Por que existe: prova que a pipeline canonical→verification não está
 * acoplada a um show específico. Cada seed é uma evidência.
 */

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Sparkles, Activity, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  GOLDEN_SHOW_CATALOG,
  type GoldenShowEntry,
} from '@/lib/showSeeds/catalog';
import { verificationEngine } from '@/core/verification/VerificationEngine';
import { simulationDryRun } from '@/lib/showSeeds/simulationDryRun';
import { inspectShowPlan } from '@/lib/showSeeds/inspectShowPlan';
import { downloadGoldenShowExportZip } from '@/lib/showSeeds/goldenShowExport';
import Phase1TransitionPanel from '@/components/dev/Phase1TransitionPanel';
import Phase2TransitionPanel from '@/components/dev/Phase2TransitionPanel';

interface SeedRow {
  entry: GoldenShowEntry;
  level: string;
  errors: number;
  warnings: number;
  cuesFired: number;
  totalCues: number;
  interlockOk: boolean;
  weightKg: number;
}

function evaluate(entry: GoldenShowEntry): SeedRow {
  const sp = entry.build();
  const v = verificationEngine.run(sp);
  const dry = simulationDryRun(sp);
  const ins = inspectShowPlan(sp);
  return {
    entry,
    level: v.level,
    errors: v.summary.errors,
    warnings: v.summary.warnings,
    cuesFired: dry.cuesFired,
    totalCues: sp.pyroCues.length,
    interlockOk: ins.minChannelReuseS == null || ins.minChannelReuseS >= 1.0,
    weightKg: ins.bom.totalEstimatedWeightG / 1000,
  };
}

export default function GoldenShowsPage() {
  const { toast } = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  const rows = useMemo(() => GOLDEN_SHOW_CATALOG.map(evaluate), []);
  const allReady = rows.every(
    (r) => r.errors === 0 && (r.level === 'READY_FOR_EXPORT' || r.level === 'READY_FOR_FIELD'),
  );

  const handleExport = async (entry: GoldenShowEntry) => {
    setBusyId(entry.id);
    try {
      await downloadGoldenShowExportZip(entry.build());
      toast({ title: 'Bundle pronto', description: `${entry.name} · .fir + CSV + BoM + disclaimer.` });
    } catch (err) {
      toast({
        title: 'Falha no export',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="min-h-dvh bg-background text-foreground p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link to="/dev/readiness-audit">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Readiness audit
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-semibold flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                Golden Show Catalog
              </h1>
              <p className="text-sm text-muted-foreground">
                Fase 1 reference seeds · pure read · zero hardware.
              </p>
            </div>
          </div>
          <Badge variant={allReady ? 'default' : 'destructive'} className="text-xs">
            {allReady ? 'All seeds READY' : 'Regression detected'}
          </Badge>
        </header>

        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="h-4 w-4" />
            <h2 className="text-lg font-semibold">Phase 1 certification matrix</h2>
          </div>
          <div className="space-y-3">
            {rows.map((r) => (
              <div
                key={r.entry.id}
                className="border rounded-lg p-4 flex flex-col md:flex-row md:items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{r.entry.name}</span>
                    <Badge
                      variant={
                        r.errors === 0 &&
                        (r.level === 'READY_FOR_EXPORT' || r.level === 'READY_FOR_FIELD')
                          ? 'default'
                          : 'destructive'
                      }
                      className="text-xs"
                    >
                      {r.level}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{r.entry.description}</p>
                </div>
                <div className="grid grid-cols-3 md:grid-cols-5 gap-3 text-xs">
                  <Stat label="Cues" value={`${r.cuesFired}/${r.totalCues}`} />
                  <Stat label="Modules" value={`${r.entry.modules}`} />
                  <Stat label="Duration" value={`${r.entry.durationS}s`} />
                  <Stat label="Weight" value={`${r.weightKg.toFixed(2)} kg`} />
                  <Stat
                    label="Interlock"
                    value={r.interlockOk ? 'OK' : 'FAIL'}
                    tone={r.interlockOk ? 'ok' : 'fail'}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleExport(r.entry)}
                    disabled={busyId === r.entry.id || r.errors > 0}
                  >
                    <Package className="h-4 w-4 mr-1" />
                    {busyId === r.entry.id ? 'Empacotando…' : 'Export ZIP'}
                  </Button>
                  {r.entry.id === 'libertadores' && (
                    <Button asChild size="sm" variant="ghost">
                      <Link to="/dev/golden-shows">Open</Link>
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Phase1TransitionPanel />

        <Phase2TransitionPanel />

        <Card className="p-4 text-xs text-muted-foreground">
          Cada linha roda <code>verificationEngine.run()</code> +{' '}
          <code>simulationDryRun()</code> + <code>inspectShowPlan()</code> sobre o
          seed canônico, sem tocar em <code>ShowPlanManager</code>, hardware ou{' '}
          <code>CommandBus</code>. Adicionar um novo show: implementar{' '}
          <code>create*ShowPlan()</code> determinístico e registrar em{' '}
          <code>src/lib/showSeeds/catalog.ts</code>.
        </Card>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'ok' | 'fail';
}) {
  const valueClass =
    tone === 'fail'
      ? 'text-destructive'
      : tone === 'ok'
        ? 'text-green-500'
        : 'text-foreground';
  return (
    <div>
      <div className="text-muted-foreground">{label}</div>
      <div className={`font-mono ${valueClass}`}>{value}</div>
    </div>
  );
}
