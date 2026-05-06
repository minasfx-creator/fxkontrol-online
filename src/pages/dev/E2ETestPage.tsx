/**
 * ─── E2E Test — Dev page ─────────────────────────────────────────
 * Mounts useFireOneFleet and runs `runE2ETest` against the live fleet.
 * Streams every step into a console panel + final pass/fail summary.
 *
 * SAFETY:
 *   • "Disparo dry-run" (default) — emite intenção FIRE sem energizar.
 *   • "Disparo real" — exige Hold-to-Confirm 1.2s e workMode=real_operation.
 *
 * NUNCA chama fieldBus / pyroExecutor direto. 100% via uiCommandGateway.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Play, AlertTriangle, CheckCircle2, XCircle, Clock, RefreshCw, Zap } from 'lucide-react';
import { useFireOneFleet } from '@/features/fieldbus/useFireOneFleet';
import {
  runE2ETest,
  type E2ETestStep,
  type E2ETestRunResult,
} from '@/core/diagnostics/e2eTestRunner';
import { workMode, useWorkMode } from '@/core/safety/workMode';
import { cn } from '@/lib/utils';

export default function E2ETestPage() {
  const fleet = useFireOneFleet();
  const mode = useWorkMode();
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<E2ETestStep[]>([]);
  const [result, setResult] = useState<E2ETestRunResult | null>(null);
  const [liveFire, setLiveFire] = useState(false);
  const [holdMs, setHoldMs] = useState(0);
  const holdRef = useRef<number | null>(null);

  // Snapshot fleet via ref so the runner sees current state without re-binding.
  const fleetRef = useRef(fleet.state);
  useEffect(() => { fleetRef.current = fleet.state; }, [fleet.state]);

  const knownModules = useMemo(
    () => Object.keys(fleet.state.modules).map(Number).sort((a, b) => a - b),
    [fleet.state.modules],
  );

  const start = useCallback(async () => {
    if (running) return;
    setSteps([]);
    setResult(null);
    setRunning(true);
    try {
      const res = await runE2ETest(
        {
          getFleet: () => fleetRef.current,
          onStep: (s) => setSteps((prev) => {
            const i = prev.findIndex((x) => x.id === s.id);
            if (i >= 0) {
              const next = prev.slice();
              next[i] = { ...s };
              return next;
            }
            return [...prev, { ...s }];
          }),
        },
        { liveFire, source: 'E2ETestPage' },
      );
      setResult(res);
    } finally {
      setRunning(false);
    }
  }, [liveFire, running]);

  // Hold-to-Confirm (1.2s) para habilitar liveFire.
  const holdDown = useCallback(() => {
    if (mode !== 'real_operation') return;
    const start = Date.now();
    holdRef.current = window.setInterval(() => {
      const ms = Date.now() - start;
      setHoldMs(ms);
      if (ms >= 1200) {
        if (holdRef.current) { window.clearInterval(holdRef.current); holdRef.current = null; }
        setLiveFire(true);
        setHoldMs(0);
      }
    }, 30);
  }, [mode]);
  const holdUp = useCallback(() => {
    if (holdRef.current) { window.clearInterval(holdRef.current); holdRef.current = null; }
    setHoldMs(0);
  }, []);
  useEffect(() => () => { if (holdRef.current) window.clearInterval(holdRef.current); }, []);

  return (
    <div className="min-h-screen bg-background text-foreground p-6 space-y-6">
      <header className="space-y-2">
        <h1 className="text-ds-h2 ds-mono">E2E Test — Descoberta · Roteamento · Disparo</h1>
        <p className="text-ds-label text-muted-foreground">
          Sequência ordenada com confirmação por telemetria. Toda comunicação passa pelo
          <span className="ds-mono"> uiCommandGateway</span>. WorkMode atual:&nbsp;
          <span className={cn(
            'ds-mono px-2 py-0.5 rounded',
            mode === 'real_operation' ? 'bg-destructive/20 text-destructive' : 'bg-muted',
          )}>{mode}</span>
        </p>
      </header>

      {/* Controls */}
      <section className="rounded-md border border-border bg-card p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={running}
            onClick={start}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2 rounded-md text-ds-label',
              'bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50',
            )}
          >
            {running ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {running ? 'Executando…' : 'Executar sequência'}
          </button>

          <div className="flex items-center gap-2 text-ds-label">
            <span className="text-muted-foreground">Módulos detectados:</span>
            <span className="ds-mono">
              {knownModules.length > 0 ? knownModules.join(', ') : '—'}
            </span>
          </div>

          <div className="flex items-center gap-2 text-ds-label">
            <span className="text-muted-foreground">Cable:</span>
            <span className={cn('ds-mono', fleet.state.cable.state === 'connected' ? 'text-status-ok' : 'text-muted-foreground')}>
              {fleet.state.cable.state}
            </span>
            <span className="text-muted-foreground">/ Radio:</span>
            <span className={cn('ds-mono', fleet.state.radio.state === 'connected' ? 'text-status-ok' : 'text-muted-foreground')}>
              {fleet.state.radio.state}
            </span>
          </div>
        </div>

        {/* Live fire arming */}
        <div className="flex items-center gap-3 pt-2 border-t border-border/50">
          <label className="flex items-center gap-2 text-ds-label">
            <input
              type="checkbox"
              checked={liveFire}
              disabled={mode !== 'real_operation'}
              onChange={(e) => setLiveFire(e.target.checked)}
            />
            <span>Disparo real (canal 1, 100ms)</span>
          </label>
          {mode !== 'real_operation' && (
            <span className="inline-flex items-center gap-1 text-ds-caption text-amber-500">
              <AlertTriangle className="w-3 h-3" />
              Disponível apenas em real_operation
            </span>
          )}
          {mode === 'real_operation' && !liveFire && (
            <button
              type="button"
              onMouseDown={holdDown}
              onMouseUp={holdUp}
              onMouseLeave={holdUp}
              onTouchStart={holdDown}
              onTouchEnd={holdUp}
              className="relative inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-destructive/50 text-destructive text-ds-label"
            >
              <Zap className="w-3 h-3" />
              Segurar 1.2s para armar disparo real
              <span
                className="absolute left-0 bottom-0 h-0.5 bg-destructive transition-all"
                style={{ width: `${Math.min(100, (holdMs / 1200) * 100)}%` }}
              />
            </button>
          )}
          {liveFire && (
            <button
              type="button"
              onClick={() => setLiveFire(false)}
              className="text-ds-caption text-muted-foreground underline"
            >Cancelar</button>
          )}
        </div>
      </section>

      {/* Step log */}
      <section className="rounded-md border border-border bg-card p-4">
        <h2 className="text-ds-label ds-mono mb-2">Log de etapas</h2>
        {steps.length === 0 ? (
          <p className="text-ds-caption text-muted-foreground">Nenhuma execução ainda.</p>
        ) : (
          <ol className="space-y-1.5">
            {steps.map((s) => (
              <li key={s.id} className="flex items-start gap-2 text-ds-caption ds-mono">
                <StatusIcon status={s.status} />
                <span className="text-muted-foreground w-24 shrink-0">{s.kind}</span>
                <span className="text-muted-foreground w-12 shrink-0">
                  {s.moduleAddress != null ? `m${s.moduleAddress}` : '—'}
                </span>
                <span className="flex-1">{s.label}</span>
                <span className="text-muted-foreground">
                  {s.detail ?? ''}
                </span>
                <span className="text-muted-foreground w-14 text-right">
                  {s.endedAt ? `${s.endedAt - s.startedAt}ms` : '…'}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* Summary */}
      {result && (
        <section className={cn(
          'rounded-md border p-4',
          result.ok ? 'border-status-ok/40 bg-status-ok/10' : 'border-destructive/40 bg-destructive/10',
        )}>
          <div className="flex items-center gap-2">
            {result.ok
              ? <CheckCircle2 className="w-4 h-4 text-status-ok" />
              : <XCircle className="w-4 h-4 text-destructive" />}
            <span className="text-ds-label ds-mono">
              {result.ok ? 'PASS' : 'FAIL'} — {result.steps.length} etapa(s),
              módulos: {result.modulesTested.join(', ') || '—'},
              duração: {result.endedAt - result.startedAt}ms
            </span>
          </div>
        </section>
      )}
    </div>
  );
}

function StatusIcon({ status }: { status: E2ETestStep['status'] }) {
  if (status === 'pass') return <CheckCircle2 className="w-3.5 h-3.5 text-status-ok shrink-0" />;
  if (status === 'fail') return <XCircle className="w-3.5 h-3.5 text-destructive shrink-0" />;
  if (status === 'timeout') return <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />;
  if (status === 'skipped') return <AlertTriangle className="w-3.5 h-3.5 text-muted-foreground shrink-0" />;
  return <RefreshCw className="w-3.5 h-3.5 text-primary animate-spin shrink-0" />;
}
