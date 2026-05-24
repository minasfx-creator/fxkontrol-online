/**
 * Phase1TransitionPanel — Live gate UI for the Phase 0 → Phase 1
 * transition, mounted on /dev/golden-shows.
 *
 * Shows, for the selected golden seed:
 *  - VerificationEngine.run() level + error count (live)
 *  - simulationDryRun cues fired vs total
 *  - pendingRequiredAdapters() against the live registry
 *  - Aggregate gate verdict (granted / denied + reasons)
 *
 * Actions:
 *  - "Open & Validate (Phase 1)" — records the gate result into the
 *    audit log and (when granted) mounts the real Show3DEngine preview
 *    inline against the seed via canonicalToEnginePlan.
 *  - "Recheck" — re-runs the gate immediately.
 *  - Recent audit history table (last 10 transitions, granted+denied).
 *
 * Honesty:
 *  - Pure reads. Never sends commands, never changes workMode.
 *  - The engine preview is the same `ShowEngineHost` used everywhere
 *    else; it auto-plays the show with Particle Explosions / Light
 *    Points (visual-only, no hardware).
 */
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, AlertTriangle, RefreshCw, PlayCircle, History, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { GOLDEN_SHOW_CATALOG, type GoldenShowEntry } from '@/lib/showSeeds/catalog';
import { unifiedHardwareRegistry } from '@/core/hardware/UnifiedHardwareRegistry';
import {
  evaluatePhase1Gate,
  recordPhase1Transition,
  getPhase1AuditLog,
  explainBlockReason,
  type Phase1GateResult,
  type Phase1AuditEntry,
} from '@/lib/showSeeds/phase1Transition';
import { canonicalToEnginePlan } from '@/lib/showSeeds/canonicalToEnginePlan';

const ShowEngineHost = lazy(() => import('@/components/show-engine/ShowEngineHost'));

export default function Phase1TransitionPanel() {
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState<string>(GOLDEN_SHOW_CATALOG[0]?.id ?? '');
  const [tick, setTick] = useState(0);
  const [auditLog, setAuditLog] = useState<Phase1AuditEntry[]>(() => getPhase1AuditLog());
  const [openedSeedId, setOpenedSeedId] = useState<string | null>(null);

  const selected: GoldenShowEntry | undefined = useMemo(
    () => GOLDEN_SHOW_CATALOG.find((s) => s.id === selectedId),
    [selectedId],
  );

  // Re-evaluate the gate every 2s — pure reads against the live registry.
  const gate: Phase1GateResult | null = useMemo(() => {
    if (!selected) return null;
    return evaluatePhase1Gate(selected, unifiedHardwareRegistry);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, tick]);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 2000);
    return () => clearInterval(id);
  }, []);

  const enginePlan = useMemo(() => {
    if (!openedSeedId) return null;
    const entry = GOLDEN_SHOW_CATALOG.find((s) => s.id === openedSeedId);
    if (!entry) return null;
    return canonicalToEnginePlan(entry.build());
  }, [openedSeedId]);

  const handleOpen = () => {
    if (!selected || !gate) return;
    const recorded = recordPhase1Transition(gate);
    setAuditLog(getPhase1AuditLog());
    if (recorded.granted) {
      setOpenedSeedId(selected.id);
      toast({
        title: 'Fase 1 autorizada',
        description: `${selected.name} aberto no engine real (preview).`,
      });
    } else {
      toast({
        title: 'Transição bloqueada',
        description: `${recorded.reasons.length} bloqueio(s) registrado(s) no audit.`,
        variant: 'destructive',
      });
    }
  };

  if (!selected || !gate) {
    return (
      <Card className="p-4 text-sm text-muted-foreground">
        Catálogo de golden shows vazio.
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              {gate.ok ? (
                <CheckCircle2 className="h-5 w-5 text-status-ok" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-status-warn" />
              )}
              Phase 0 → Phase 1 transition gate
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Avaliado em {new Date(gate.evaluatedAt).toLocaleTimeString()} · tick #{tick}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              aria-label="Selecionar golden seed"
              value={selectedId}
              onChange={(e) => {
                setSelectedId(e.target.value);
                setOpenedSeedId(null);
              }}
              className="h-9 rounded-md border border-border bg-background px-2 text-sm"
            >
              {GOLDEN_SHOW_CATALOG.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <Button size="sm" variant="outline" onClick={() => setTick((t) => t + 1)}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Recheck
            </Button>
            <Button size="sm" onClick={handleOpen} disabled={!selected}>
              <PlayCircle className="h-4 w-4 mr-1" />
              Open &amp; Validate (Phase 1)
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <Stat
            label="Verification"
            value={gate.verificationLevel}
            tone={
              gate.verificationLevel === 'READY_FOR_EXPORT' ||
              gate.verificationLevel === 'READY_FOR_FIELD'
                ? 'ok'
                : 'warn'
            }
          />
          <Stat
            label="Verification errors"
            value={`${gate.verificationErrors}`}
            tone={gate.verificationErrors === 0 ? 'ok' : 'fail'}
          />
          <Stat
            label="Cues fired (dry run)"
            value={`${gate.cuesFired}/${gate.totalCues}`}
            tone={gate.cuesFired === gate.totalCues ? 'ok' : 'warn'}
          />
          <Stat
            label="Pending required adapters"
            value={`${gate.pending.length}`}
            tone={gate.pending.length === 0 ? 'ok' : 'warn'}
          />
        </div>

        {gate.pending.length > 0 && (
          <div className="border border-border/40 rounded p-3">
            <div className="text-xs uppercase text-muted-foreground tracking-wider mb-2">
              Adapters obrigatórios pendentes (Fase 0)
            </div>
            <ul className="space-y-1 text-sm">
              {gate.pending.map((p) => (
                <li key={p.id} className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">
                    {p.transport}
                  </Badge>
                  <span className="font-mono text-xs">{p.id}</span>
                  <span className="text-xs text-muted-foreground truncate">
                    · {p.rationale}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {gate.reasons.length > 0 && (
          <div className="border border-status-warn/40 rounded p-3 bg-status-warn/5">
            <div className="text-xs uppercase text-status-warn tracking-wider mb-2">
              Bloqueios da transição
            </div>
            <ul className="space-y-1 text-sm">
              {gate.reasons.map((r) => (
                <li key={r} className="text-foreground">
                  • {explainBlockReason(r)}
                </li>
              ))}
            </ul>
          </div>
        )}

        {gate.ok && (
          <div className="text-xs text-status-ok">
            Critério de Fase 1 atendido. Clique em <strong>Open &amp; Validate</strong>{' '}
            para registrar o evento e abrir o seed no engine 3D real.
          </div>
        )}
      </Card>

      {openedSeedId && enginePlan && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">
              Live Show3DEngine · {selected.name}
            </h3>
            <Button size="sm" variant="ghost" onClick={() => setOpenedSeedId(null)}>
              <X className="h-4 w-4 mr-1" />
              Fechar preview
            </Button>
          </div>
          <div className="h-96 w-full rounded border border-border overflow-hidden bg-[#050810]">
            <Suspense
              fallback={
                <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground">
                  Carregando engine…
                </div>
              }
            >
              <ShowEngineHost plan={enginePlan} hideSegmentToolbar autoPlay />
            </Suspense>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            Preview cinematográfico · Particle Explosions (pyro) + Light Points (drone).
            Zero CommandBus, zero hardware. Auto-play ON.
          </p>
        </Card>
      )}

      <Card className="p-4 space-y-2">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <History className="h-4 w-4" />
          Audit trail (últimas 10 transições)
        </h3>
        {auditLog.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Nenhuma transição registrada nesta sessão.
          </p>
        ) : (
          <ul className="space-y-1 text-xs">
            {auditLog.slice(0, 10).map((e) => (
              <li
                key={e.id}
                className="flex items-center justify-between gap-2 border border-border/40 rounded px-2 py-1.5"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Badge
                    variant={e.granted ? 'default' : 'destructive'}
                    className="text-[10px]"
                  >
                    {e.granted ? 'GRANTED' : 'DENIED'}
                  </Badge>
                  <span className="font-mono">{e.seedId}</span>
                  <span className="text-muted-foreground">
                    {new Date(e.at).toLocaleTimeString()}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span>
                    cues {e.cuesFired}/{e.totalCues}
                  </span>
                  <span>
                    pend {e.pendingIds.length}
                  </span>
                  {!e.granted && (
                    <Badge variant="outline" className="text-[10px]">
                      {e.reasons[0]}
                    </Badge>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
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
  tone?: 'ok' | 'warn' | 'fail';
}) {
  const colorClass =
    tone === 'fail'
      ? 'text-destructive'
      : tone === 'warn'
        ? 'text-status-warn'
        : tone === 'ok'
          ? 'text-status-ok'
          : 'text-foreground';
  return (
    <div className="border border-border/40 rounded p-2">
      <div className="text-[10px] uppercase text-muted-foreground tracking-wider">
        {label}
      </div>
      <div className={`font-mono text-sm ${colorClass}`}>{value}</div>
    </div>
  );
}
