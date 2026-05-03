/**
 * Phase2TransitionPanel — Read-only gate UI for Phase 1 → Phase 2.
 *
 * Mounted on /dev/golden-shows. Evaluates `evaluatePhase2Gate` every
 * 2s against the live registry / SSM / readiness, and exposes a
 * Hold-to-Confirm (1200ms) that records the transition into the audit
 * log. NEVER mutates workMode, NEVER touches CommandBus / FieldBus /
 * SafetyStateMachine. The actual workMode flip is left to the operator
 * via the dedicated WorkMode switch in MainLayout — this panel only
 * authorises that flip with an audit trail.
 */
import { useEffect, useMemo, useState } from 'react';
import { ShieldAlert, ShieldCheck, RefreshCw, History, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { useHoldToConfirm } from '@/hooks/useHoldToConfirm';
import { GOLDEN_SHOW_CATALOG, type GoldenShowEntry } from '@/lib/showSeeds/catalog';
import { unifiedHardwareRegistry } from '@/core/hardware/UnifiedHardwareRegistry';
import { safetyStateMachine } from '@/core/safety/SafetyStateMachine';
import { readinessEvaluator } from '@/core/hardware/ReadinessEvaluator';
import { useWorkMode } from '@/core/safety/workMode';
import {
  evaluatePhase2Gate,
  recordPhase2Transition,
  getPhase2AuditLog,
  explainPhase2Reason,
  type Phase2GateResult,
  type Phase2AuditEntry,
} from '@/lib/showSeeds/phase2Transition';

export default function Phase2TransitionPanel() {
  const { toast } = useToast();
  const wm = useWorkMode();
  const [selectedId, setSelectedId] = useState<string>(GOLDEN_SHOW_CATALOG[0]?.id ?? '');
  const [tick, setTick] = useState(0);
  const [auditLog, setAuditLog] = useState<Phase2AuditEntry[]>(() => getPhase2AuditLog());

  const selected: GoldenShowEntry | undefined = useMemo(
    () => GOLDEN_SHOW_CATALOG.find((s) => s.id === selectedId),
    [selectedId],
  );

  // Re-evaluate every 2s — pure reads.
  const gate: Phase2GateResult | null = useMemo(() => {
    if (!selected) return null;
    // operatorConfirmed=false here — the Hold-to-Confirm is the
    // explicit confirmation, not the auto-poll.
    return evaluatePhase2Gate(selected, {
      registry: unifiedHardwareRegistry,
      ssm: safetyStateMachine,
      readiness: readinessEvaluator,
      currentWorkMode: wm,
      operatorConfirmed: false,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, tick, wm]);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 2000);
    return () => clearInterval(id);
  }, []);

  const handleConfirm = () => {
    if (!selected) return;
    const r = evaluatePhase2Gate(selected, {
      registry: unifiedHardwareRegistry,
      ssm: safetyStateMachine,
      readiness: readinessEvaluator,
      currentWorkMode: wm,
      operatorConfirmed: true,
    });
    const recorded = recordPhase2Transition(r);
    setAuditLog(getPhase2AuditLog());
    toast({
      title: recorded.granted ? 'Fase 2 autorizada' : 'Fase 2 negada',
      description: recorded.granted
        ? 'Operador pode alternar workMode → real_operation manualmente.'
        : recorded.reasons.map(explainPhase2Reason).join(' · '),
      variant: recorded.granted ? 'default' : 'destructive',
    });
  };

  // 1200ms Hold-to-Confirm — stricter than Phase-1's instant Open button
  // because this gate authorises the path to physical hardware writes.
  const { progress, isHolding, startHold, cancelHold } = useHoldToConfirm({
    duration: 1200,
    onConfirm: handleConfirm,
    hapticOnConfirm: 'arm',
  });

  if (!selected || !gate) {
    return (
      <Card className="p-5 text-sm text-muted-foreground">
        Nenhum golden seed disponível.
      </Card>
    );
  }

  const granted = gate.ok;

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {granted ? (
            <ShieldCheck className="h-5 w-5 text-emerald-500" />
          ) : (
            <ShieldAlert className="h-5 w-5 text-amber-500" />
          )}
          <h2 className="text-lg font-semibold">Phase 2 transition gate</h2>
          <Badge variant={granted ? 'default' : 'destructive'} className="text-xs">
            {granted ? 'AUTHORISED' : 'BLOCKED'}
          </Badge>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setTick((t) => t + 1)}>
          <RefreshCw className="h-4 w-4 mr-1" /> Recheck
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {GOLDEN_SHOW_CATALOG.map((s) => (
          <Button
            key={s.id}
            size="sm"
            variant={s.id === selectedId ? 'default' : 'outline'}
            onClick={() => setSelectedId(s.id)}
          >
            {s.name}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        <Stat label="Phase 1" value={gate.phase1.ok ? 'OK' : 'BLOCKED'} tone={gate.phase1.ok ? 'ok' : 'fail'} />
        <Stat label="Work mode" value={gate.workMode} tone={gate.workMode === 'simulation' ? 'ok' : 'fail'} />
        <Stat
          label="Safety"
          value={gate.safetyState}
          tone={gate.safetyState === 'IDLE' || gate.safetyState === 'LOCKED' ? 'ok' : 'fail'}
        />
        <Stat
          label="Readiness"
          value={gate.readinessStatus.replace('READY_FOR_', '')}
          tone={gate.readinessStatus === 'READY_FOR_HARDWARE_SYNC' ? 'ok' : 'fail'}
        />
      </div>

      {gate.unverifiedRequired.length > 0 && (
        <div className="text-xs border border-amber-500/30 bg-amber-500/5 rounded p-3">
          <div className="font-semibold text-amber-500 mb-1">Required adapters not verified</div>
          <ul className="list-disc pl-5 space-y-0.5 text-muted-foreground">
            {gate.unverifiedRequired.map((id) => <li key={id}>{id}</li>)}
          </ul>
        </div>
      )}

      {!granted && (
        <div className="text-xs space-y-1">
          {gate.reasons.map((r) => (
            <div key={r} className="flex gap-2">
              <span className="text-amber-500">●</span>
              <span className="text-muted-foreground">{explainPhase2Reason(r)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="border-t pt-3 space-y-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Lock className="h-3 w-3" />
          Hold 1.2 s para registrar a autorização. Esta UI NÃO altera workMode.
        </div>
        <Button
          variant={granted ? 'default' : 'destructive'}
          className="w-full"
          disabled={!granted}
          onPointerDown={startHold}
          onPointerUp={cancelHold}
          onPointerLeave={cancelHold}
        >
          {isHolding ? `Confirmando… ${Math.round(progress * 100)}%` : 'Hold to authorise Phase 2'}
        </Button>
        {isHolding && <Progress value={progress * 100} />}
      </div>

      {auditLog.length > 0 && (
        <div className="border-t pt-3">
          <div className="flex items-center gap-2 text-xs font-semibold mb-2">
            <History className="h-3 w-3" /> Recent transitions
          </div>
          <div className="space-y-1 text-[11px] font-mono max-h-40 overflow-y-auto">
            {auditLog.slice(0, 10).map((e) => (
              <div key={e.id} className="flex gap-2">
                <span className={e.granted ? 'text-emerald-500' : 'text-amber-500'}>
                  {e.granted ? '✓' : '✗'}
                </span>
                <span className="text-muted-foreground">{new Date(e.at).toLocaleTimeString()}</span>
                <span>{e.seedId}</span>
                <span className="text-muted-foreground truncate">
                  {e.granted ? 'authorised' : e.reasons.join(',')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'ok' | 'fail' }) {
  const cls = tone === 'fail' ? 'text-destructive' : tone === 'ok' ? 'text-emerald-500' : 'text-foreground';
  return (
    <div className="border rounded p-2">
      <div className="text-muted-foreground">{label}</div>
      <div className={`font-mono ${cls}`}>{value}</div>
    </div>
  );
}
