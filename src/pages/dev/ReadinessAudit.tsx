/**
 * /dev/readiness-audit — Phase 0 deployment plan instrument.
 *
 * Read-only consolidated dashboard exposing the THREE engines that decide
 * whether the system is shippable today:
 *   - VerificationEngine.run()
 *   - readinessEvaluator.evaluate()
 *   - unifiedHardwareRegistry.getSystemHealth() + getAllProvenances()
 *
 * Strict honesty rules followed:
 *   - NO `Math.random()`, NO synthetic telemetry. Pure reads.
 *   - NO commands sent. NO arm/fire/dispatch path touched.
 *   - Safety surfaces (E-STOP, lockouts) are NOT modified.
 *   - Adapters are split into "Operational" vs "Not integrated (expected)"
 *     to honor the Honesty Layer separation.
 *
 * Public dev route — does not require auth so it can be opened during
 * field debugging on the iPhone PWA.
 */

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Download, RefreshCw, ArrowLeft } from "lucide-react";
import { verificationEngine } from "@/core/verification/VerificationEngine";
import { readinessEvaluator } from "@/core/hardware/ReadinessEvaluator";
import { unifiedHardwareRegistry } from "@/core/hardware/UnifiedHardwareRegistry";
import { getProvenanceBadge } from "@/core/hardware/provenance";
import {
  ADAPTER_TRIAGE,
  getTriageEntry,
  pendingRequiredAdapters,
  type AdapterTriageEntry,
} from "@/core/hardware/adapterTriage";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Snapshot = {
  capturedAt: string;
  verification: ReturnType<typeof verificationEngine.run>;
  readiness: ReturnType<typeof readinessEvaluator.evaluate>;
  health: ReturnType<typeof unifiedHardwareRegistry.getSystemHealth>;
  adapters: Array<{
    id: string;
    label: string;
    type: string;
    connection: string;
    integrationMode: string;
    evidenceLevel: string;
    transport: string;
    lastSeen: number;
    online: boolean;
    warnings: string[];
    errors: string[];
  }>;
};

function buildSnapshot(): Snapshot {
  const adapters = unifiedHardwareRegistry.getAllAdapters().map((a) => {
    const prov = a.getProvenance();
    const snap = a.getSnapshot();
    return {
      id: a.deviceId,
      label: a.label,
      type: a.deviceType,
      connection: a.getConnectionState(),
      integrationMode: prov.integration_mode,
      evidenceLevel: prov.evidence_level,
      transport: prov.transport_type,
      lastSeen: prov.last_seen_at,
      online: snap.online,
      warnings: snap.warnings,
      errors: snap.errors,
    };
  });
  return {
    capturedAt: new Date().toISOString(),
    verification: verificationEngine.run(),
    readiness: readinessEvaluator.evaluate(),
    health: unifiedHardwareRegistry.getSystemHealth(),
    adapters,
  };
}

function statusTone(status: string): string {
  if (status === "BLOCKED") return "ds-status-fail";
  if (status === "READY_FOR_HARDWARE_SYNC") return "ds-status-ok";
  if (status === "READY_FOR_LIVE_READ_ONLY") return "ds-status-ok";
  if (status === "READY_FOR_EXPORT") return "ds-status-warn";
  return "ds-status-sync";
}

export default function ReadinessAudit() {
  const [snapshot, setSnapshot] = useState<Snapshot>(() => buildSnapshot());
  const [tick, setTick] = useState(0);

  // Refresh every 2s — pure reads, no telemetry side-effects.
  useEffect(() => {
    const id = setInterval(() => {
      setSnapshot(buildSnapshot());
      setTick((t) => t + 1);
    }, 2000);
    return () => clearInterval(id);
  }, []);

  const operational = useMemo(
    () =>
      snapshot.adapters.filter(
        (a) => a.integrationMode !== "not_integrated",
      ),
    [snapshot],
  );
  const notIntegrated = useMemo(
    () =>
      snapshot.adapters.filter(
        (a) => a.integrationMode === "not_integrated",
      ),
    [snapshot],
  );
  // Re-evaluate every tick — pending is computed live from registry.
  const pending = useMemo(
    () => pendingRequiredAdapters(unifiedHardwareRegistry),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [snapshot],
  );

  const onExport = () => {
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fxk-readiness-${snapshot.capturedAt.replace(/[:.]/g, "-")}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <main className="min-h-dvh bg-background text-foreground p-6 space-y-6">
      <header className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link to="/" aria-label="Voltar">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="ds-h1">Readiness Audit</h1>
            <p className="text-sm text-muted-foreground">
              Fase 0 · Diagnóstico consolidado · Tick #{tick}
            </p>
          </div>
          {pending.length === 0 ? (
            <Badge
              variant="outline"
              className="ds-status-ok border-status-ok"
              style={{ borderColor: "hsl(var(--status-ok))", color: "hsl(var(--status-ok))" }}
            >
              ✓ Fase 0 · critério de hardware atendido
            </Badge>
          ) : (
            <Badge
              variant="outline"
              style={{ borderColor: "hsl(var(--status-warn))", color: "hsl(var(--status-warn))" }}
            >
              {pending.length} pendente(s) para sair de SIMULATION
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSnapshot(buildSnapshot())}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Recarregar
          </Button>
          <Button size="sm" onClick={onExport}>
            <Download className="h-4 w-4 mr-2" />
            Export JSON
          </Button>
        </div>
      </header>

      {/* Top status row */}
      <section className="grid gap-4 md:grid-cols-3">
        <Card className="p-4 space-y-2">
          <div className="text-xs uppercase text-muted-foreground tracking-wider">
            Readiness
          </div>
          <div className={`text-2xl font-semibold ${statusTone(snapshot.readiness.status)}`}>
            {snapshot.readiness.status}
          </div>
          <div className="text-xs text-muted-foreground">
            Modo operacional: {snapshot.readiness.mode}
          </div>
          <div className="flex flex-wrap gap-1 pt-2">
            {snapshot.readiness.allowed_operations.map((op) => (
              <Badge key={op} variant="secondary" className="text-[10px]">
                {op}
              </Badge>
            ))}
          </div>
        </Card>

        <Card className="p-4 space-y-2">
          <div className="text-xs uppercase text-muted-foreground tracking-wider">
            Verification
          </div>
          <div className={`text-2xl font-semibold ${statusTone(snapshot.verification.level)}`}>
            {snapshot.verification.level}
          </div>
          <div className="text-xs text-muted-foreground">
            {snapshot.verification.issues.filter((i) => !i.passed).length} issue(s) abertas
          </div>
        </Card>

        <Card className="p-4 space-y-2">
          <div className="text-xs uppercase text-muted-foreground tracking-wider">
            Hardware Health
          </div>
          <div className="text-2xl font-semibold">
            {snapshot.health.online}/{snapshot.health.total}
            <span className="text-sm text-muted-foreground ml-2">
              score {snapshot.health.score}
            </span>
          </div>
          <div className="text-xs text-muted-foreground">
            {snapshot.health.errors} erro(s) · {snapshot.health.warnings} aviso(s)
          </div>
        </Card>
      </section>

      {/* Verification issues */}
      <Card className="p-4 space-y-3">
        <h2 className="ds-h3">VerificationEngine · issues</h2>
        {snapshot.verification.issues.filter((i) => !i.passed).length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum bloqueio. Tudo o que importa passou.
          </p>
        ) : (
          <ul className="space-y-1 text-sm">
            {snapshot.verification.issues
              .filter((i) => !i.passed)
              .map((i, idx) => (
                <li
                  key={`${i.label}-${idx}`}
                  className="flex items-start gap-2"
                >
                  <Badge
                    variant={i.severity === "error" ? "destructive" : "secondary"}
                    className="mt-0.5"
                  >
                    {i.severity}
                  </Badge>
                  <div>
                    <div className="font-medium">{i.label}</div>
                    <div className="text-muted-foreground">{i.detail}</div>
                  </div>
                </li>
              ))}
          </ul>
        )}
      </Card>

      {/* Readiness issues */}
      <Card className="p-4 space-y-3">
        <h2 className="ds-h3">ReadinessEvaluator · issues</h2>
        {snapshot.readiness.issues.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem pendências.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {snapshot.readiness.issues.map((i, idx) => (
              <li key={`${i.source}-${idx}`} className="flex items-start gap-2">
                <Badge
                  variant={i.severity === "error" ? "destructive" : "secondary"}
                  className="mt-0.5"
                >
                  {i.severity}
                </Badge>
                <div>
                  <span className="font-medium">{i.source}</span>{" "}
                  <span className="text-muted-foreground">{i.message}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Phase 0 exit criterion — required adapters still pending */}
      <Card className="p-4 space-y-3">
        <h2 className="ds-h3">
          Pendentes para sair de SIMULATION ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Todos os adapters obrigatórios estão integrados. Critério de saída
            de hardware da Fase 0 atendido.
          </p>
        ) : (
          <ul className="space-y-2 text-sm">
            {pending.map((p) => (
              <li
                key={p.id}
                className="flex items-start justify-between gap-3 border border-border/40 rounded p-2"
              >
                <div>
                  <div className="font-medium">{p.id}</div>
                  <div className="text-xs text-muted-foreground">
                    {p.rationale}
                  </div>
                </div>
                <TriageActionButton entry={p} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Operational adapters */}
      <Card className="p-4 space-y-3">
        <h2 className="ds-h3">
          Adapters operacionais ({operational.length})
        </h2>
        {operational.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum adapter operacional ainda — esperado em Fase 0 antes do
            primeiro pareamento real.
          </p>
        ) : (
          <AdapterTable rows={operational} />
        )}
      </Card>

      {/* Not-integrated adapters (expected) */}
      <Card className="p-4 space-y-3">
        <h2 className="ds-h3">
          Não integrados (esperado) ({notIntegrated.length})
        </h2>
        <p className="text-xs text-muted-foreground">
          Adapters sem hardware presente. Conforme regra Honest Hardware Layer,
          permanecem em <code>not_integrated</code> até receberem handshake real
          via Web Serial / WebUSB / WebBLE / Art-Net.
        </p>
        <AdapterTable rows={notIntegrated} muted />
      </Card>

      <footer className="text-xs text-muted-foreground pt-4">
        Captured at {snapshot.capturedAt} · read-only · zero comandos enviados
      </footer>
    </main>
  );
}

function AdapterTable({
  rows,
  muted,
}: {
  rows: Snapshot["adapters"];
  muted?: boolean;
}) {
  return (
    <div className={muted ? "opacity-80" : ""}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Adapter</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Triagem</TableHead>
            <TableHead>Conexão</TableHead>
            <TableHead>Modo</TableHead>
            <TableHead>Evidência</TableHead>
            <TableHead>Transporte</TableHead>
            <TableHead>Online</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((a) => {
            const badge = getProvenanceBadge(
              a.integrationMode as Parameters<typeof getProvenanceBadge>[0],
            );
            const triage = getTriageEntry(a.id);
            return (
              <TableRow key={a.id}>
                <TableCell className="font-medium">{a.label}</TableCell>
                <TableCell className="text-xs">{a.type}</TableCell>
                <TableCell className="text-xs">
                  {triage ? (
                    <Badge variant="outline" className="text-[10px]">
                      {triage.class === "NOT_INTEGRATED_EXPECTED"
                        ? "esperado"
                        : triage.class === "AWAITING_HANDSHAKE"
                          ? "aguarda handshake"
                          : "bug"}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-xs">{a.connection}</TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    style={{ borderColor: badge.color, color: badge.color }}
                  >
                    {badge.label}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs">{a.evidenceLevel}</TableCell>
                <TableCell className="text-xs">{a.transport}</TableCell>
                <TableCell>
                  <span
                    className={`inline-block w-2 h-2 rounded-full ${
                      a.online ? "ds-dot-ok" : "ds-dot-fail"
                    }`}
                    style={{
                      background: a.online
                        ? "hsl(var(--status-ok))"
                        : "hsl(var(--muted-foreground))",
                    }}
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function TriageActionButton({ entry }: { entry: AdapterTriageEntry }) {
  if (entry.nextAction.kind === "route") {
    return (
      <Button asChild size="sm" variant="outline">
        <Link to={entry.nextAction.path}>{entry.nextAction.label}</Link>
      </Button>
    );
  }
  if (entry.nextAction.kind === "doc") {
    return (
      <Button asChild size="sm" variant="ghost">
        <a href={entry.nextAction.path} target="_blank" rel="noreferrer">
          {entry.nextAction.label}
        </a>
      </Button>
    );
  }
  return (
    <span className="text-xs text-muted-foreground">
      {entry.nextAction.label}
    </span>
  );
}
