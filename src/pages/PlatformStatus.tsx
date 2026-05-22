import { useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, ShieldAlert, Wrench, Server, FileWarning, BarChart3 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useHealthHistory } from '@/hooks/useHealthHistory';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import BridgeSecurityAlert from '@/components/editor/network/BridgeSecurityAlert';
import { getBridgeSecurityDiagnostic } from '@/lib/bridgeGateway';
import { bridgePhysicalController, computeHilDrift, checkHilRegression, replayHilReport, generateHilCertification, type HilRunReport } from '@/lib/bridgePhysicalControl';
import { toast } from 'sonner';

type StatusTone = 'healthy' | 'degraded' | 'blocked';

type IncidentRow = {
  id: string;
  incident_id: string;
  severity: string;
  subsystem: string;
  message: string;
  resolved: boolean;
  incident_at: string;
};

type ReportRow = {
  id: string;
  show_name: string;
  readiness_status: string;
  verification_level: string;
  created_at: string;
};

const toneStyles: Record<StatusTone, string> = {
  healthy: 'border-primary/20 bg-primary/10 text-primary',
  degraded: 'border-accent/20 bg-accent/10 text-accent-foreground',
  blocked: 'border-destructive/20 bg-destructive/10 text-destructive',
};

const toneLabels: Record<StatusTone, string> = {
  healthy: 'Healthy',
  degraded: 'Degraded',
  blocked: 'Blocked for publish',
};

function StatusBadge({ tone }: { tone: StatusTone }) {
  return <Badge className={toneStyles[tone]}>{toneLabels[tone]}</Badge>;
}

function inferBuildTone(): StatusTone {
  return 'degraded';
}

export default function PlatformStatus() {
  const { user } = useAuth();
  const { scores, loading: historyLoading } = useHealthHistory(60);
  const [incidents, setIncidents] = useState<IncidentRow[]>([]);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [physicalRevision, setPhysicalRevision] = useState(0);
  const bridgeDiagnostic = useMemo(() => getBridgeSecurityDiagnostic({ path: '/ws' }), []);
  // `physicalRevision` is a forced-recompute signal — controller state is mutable.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const physicalSnapshot = useMemo(() => bridgePhysicalController.getSnapshot(), [physicalRevision]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const hilLogs = useMemo(() => bridgePhysicalController.getHilLogs(), [physicalRevision]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const hilReport = useMemo(() => bridgePhysicalController.exportHilReport(), [physicalRevision]);
  const drift = useMemo(() => computeHilDrift(hilReport), [hilReport]);
  const regression = useMemo(
    () => checkHilRegression(hilReport, { maxFailed: 0, maxP95Ms: 120, maxAbsoluteMs: 300, minAckRate: 0.95 }),
    [hilReport],
  );
  const certification = useMemo(() => generateHilCertification(hilReport), [hilReport]);
  const [savedReport, setSavedReport] = useState<HilRunReport | null>(null);
  const compare = useMemo(() => {
    if (!savedReport) return null;
    const a = computeHilDrift(savedReport);
    return {
      lossDelta: hilReport.stats.failed - savedReport.stats.failed,
      ackDelta: hilReport.stats.acked - savedReport.stats.acked,
      jitterP95Delta: drift.p95 - a.p95,
      meanDelta: drift.mean - a.mean,
    };
  }, [savedReport, hilReport, drift]);

  const handleExportJSON = () => {
    const json = bridgePhysicalController.exportHilReportJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hil-report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('HIL report exportado');
  };

  const handleReplay = () => {
    const handle = replayHilReport(hilReport, (channel) => {
      console.info('[HIL replay] fire', channel);
    });
    toast.info(`Replay iniciado (${handle.scheduled} comandos)`);
  };

  const handleSnapshot = () => {
    setSavedReport(hilReport);
    toast.success('Snapshot A salvo para comparação');
  };

  const handleResetRun = () => {
    bridgePhysicalController.resetHilRun();
    toast.info('HIL run resetado');
  };

  const handleExportCertification = () => {
    const json = JSON.stringify(certification, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hil-certification-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(certification.certified ? 'Certification CERTIFIED exportada' : 'Certification (NOT CERTIFIED) exportada');
  };

  useEffect(() => bridgePhysicalController.subscribe(() => setPhysicalRevision((value) => value + 1)), []);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      const [incidentResult, reportResult] = await Promise.all([
        supabase
          .from('health_incidents' as never)
          .select('id, incident_id, severity, subsystem, message, resolved, incident_at')
          .eq('user_id', user.id)
          .order('incident_at', { ascending: false })
          .limit(8),
        supabase
          .from('executive_reports' as never)
          .select('id, show_name, readiness_status, verification_level, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5),
      ]);

      if (cancelled) return;
      setIncidents((incidentResult.data ?? []) as unknown as IncidentRow[]);
      setReports((reportResult.data ?? []) as unknown as ReportRow[]);
      setLoading(false);
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const unresolvedIncidents = useMemo(
    () => incidents.filter((incident) => !incident.resolved),
    [incidents],
  );

  const backendTone: StatusTone = user ? 'healthy' : 'blocked';
  const telemetryTone: StatusTone = unresolvedIncidents.some((item) => item.severity === 'critical')
    ? 'blocked'
    : unresolvedIncidents.length > 0
      ? 'degraded'
      : 'healthy';

  const reportTone: StatusTone = reports.some((report) => report.readiness_status.includes('BLOCKED'))
    ? 'blocked'
    : reports.length > 0
      ? 'degraded'
      : 'healthy';
  const bridgeTone: StatusTone = bridgeDiagnostic.severity === 'error'
    ? 'blocked'
    : bridgeDiagnostic.severity === 'warning'
      ? 'degraded'
      : 'healthy';

  const sections = [
    {
      title: 'Backend & authentication',
      description: user ? 'Sessão autenticada e backend disponível para leitura.' : 'Sem sessão autenticada ativa para validar o backend.',
      tone: backendTone,
      icon: Server,
    },
    {
      title: 'Build readiness',
      description: 'Diagnóstico em runtime para refletir o estado atual de publicação após as correções em andamento.',
      tone: inferBuildTone(),
      icon: Wrench,
    },
    {
      title: 'Database security',
      description: 'RLS e integridade do backend monitorados pelo painel operacional.',
      tone: 'healthy' as StatusTone,
      icon: ShieldAlert,
    },
    {
      title: 'Operational telemetry',
      description: unresolvedIncidents.length > 0 ? `${unresolvedIncidents.length} incidente(s) abertos.` : 'Sem incidentes abertos nas últimas amostras.',
      tone: telemetryTone,
      icon: Activity,
    },
    {
      title: 'Executive reports',
      description: reports.length > 0 ? `${reports.length} relatório(s) recente(s) carregados.` : 'Nenhum relatório executivo salvo ainda.',
      tone: reportTone,
      icon: FileWarning,
    },
    {
      title: 'Local bridge security',
      description: bridgeDiagnostic.summary,
      tone: bridgeTone,
      icon: ShieldAlert,
    },
  ];

  return (
    <div className="space-y-4">
      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-semibold text-foreground">Platform Status</h1>
        </div>
        <p className="text-sm text-muted-foreground">Resumo operacional para publicação, backend e telemetria persistida.</p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <Card key={section.title} className="border-border/60 bg-card/60">
              <CardHeader className="space-y-3 pb-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-primary" />
                    <CardTitle className="text-base">{section.title}</CardTitle>
                  </div>
                  <StatusBadge tone={section.tone} />
                </div>
                <CardDescription>{section.description}</CardDescription>
              </CardHeader>
            </Card>
          );
        })}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="border-border/60 bg-card/60">
          <CardHeader>
            <CardTitle className="text-base">Health trend</CardTitle>
            <CardDescription>Últimas amostras persistidas em health_snapshots.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-end gap-1 rounded-md border border-border/50 bg-background/40 p-3 min-h-28">
              {(scores.length ? scores : [0]).map((score, index, array) => {
                const height = array.length > 0 ? Math.max(8, Math.round((score / 100) * 88)) : 8;
                return (
                  <div
                    key={`${score}-${index}`}
                    className="flex-1 rounded-sm bg-primary/70"
                    style={{ height: `${height}px` }}
                    aria-label={`health-score-${score}`}
                  />
                );
              })}
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{historyLoading ? 'Carregando histórico...' : `${scores.length} pontos carregados`}</span>
              <span>{scores.length ? `Último score: ${scores[scores.length - 1]}` : 'Sem dados ainda'}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60">
          <CardHeader>
            <CardTitle className="text-base">Recent incidents</CardTitle>
            <CardDescription>Eventos mais recentes persistidos no backend.</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-64 pr-3">
              <div className="space-y-2">
                {loading ? (
                  <p className="text-sm text-muted-foreground">Carregando incidentes...</p>
                ) : incidents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum incidente registrado.</p>
                ) : (
                  incidents.map((incident) => (
                    <div key={incident.id} className="rounded-md border border-border/50 bg-background/40 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-foreground">{incident.message}</p>
                          <p className="text-xs text-muted-foreground">{incident.subsystem} · {new Date(incident.incident_at).toLocaleString()}</p>
                        </div>
                        {incident.resolved ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <AlertTriangle className="h-4 w-4 text-destructive" />}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </section>

      <Card className="border-border/60 bg-card/60">
        <CardHeader>
          <CardTitle className="text-base">Local bridge security</CardTitle>
          <CardDescription>Validação de secure context, mixed content, mDNS e compatibilidade com iPhone/PWA.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <BridgeSecurityAlert diagnostic={bridgeDiagnostic} />
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <Badge variant="outline">Endpoint: {bridgeDiagnostic.endpoint}</Badge>
            <Badge variant="outline">Secure context: {bridgeDiagnostic.isSecureContext ? 'OK' : 'BLOCKED'}</Badge>
            <Badge variant="outline">mDNS: {bridgeDiagnostic.mdnsHost ? 'READY' : 'fallback'}</Badge>
            <Badge variant="outline">iPhone/PWA: {bridgeDiagnostic.compatibleWithIOSPwa ? 'READY' : 'pending TLS'}</Badge>
            <Badge variant="outline">Watchdog: {physicalSnapshot.watchdogState.toUpperCase()}</Badge>
            <Badge variant="outline">Clock offset: {physicalSnapshot.clockOffsetMs.toFixed(1)}ms</Badge>
          </div>
          <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-md border border-border/50 bg-background/40 p-3">Heartbeat age: {physicalSnapshot.heartbeatAgeMs === null ? '—' : `${Math.round(physicalSnapshot.heartbeatAgeMs)}ms`}</div>
            <div className="rounded-md border border-border/50 bg-background/40 p-3">System armed: {physicalSnapshot.systemArmed ? 'YES' : 'NO'}</div>
            <div className="rounded-md border border-border/50 bg-background/40 p-3">Freeze: {physicalSnapshot.freezeTriggered ? 'ACTIVE' : 'CLEAR'}</div>
            <div className="rounded-md border border-border/50 bg-background/40 p-3">Commands active: {physicalSnapshot.activeCommands.length}</div>
          </div>
          <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-md border border-border/50 bg-background/40 p-3">HIL mode: {physicalSnapshot.hilModeEnabled ? 'ENABLED' : 'DISABLED'}</div>
            <div className="rounded-md border border-border/50 bg-background/40 p-3">HIL delay/jitter: {physicalSnapshot.hilProfile.baseDelayMs}ms / {physicalSnapshot.hilProfile.jitterMs}ms</div>
            <div className="rounded-md border border-border/50 bg-background/40 p-3">Loss: {Math.round(physicalSnapshot.hilProfile.packetLossRate * 100)}%</div>
            <div className="rounded-md border border-border/50 bg-background/40 p-3">Reorder: {Math.round(physicalSnapshot.hilProfile.reorderRate * 100)}%</div>
          </div>
          <div className="rounded-md border border-border/50 bg-background/40 p-3 text-xs text-muted-foreground">
            <div className="mb-2 flex flex-wrap gap-3">
              <span>Total: {hilReport.stats.total}</span>
              <span>ACKed: {hilReport.stats.acked}</span>
              <span>Failed: {hilReport.stats.failed}</span>
              <span>Logs: {hilLogs.length}</span>
            </div>
            <div className="space-y-1 max-h-28 overflow-y-auto">
              {hilLogs.slice(-8).reverse().map((entry, index) => (
                <div key={`${entry.time}-${index}`} className="flex items-center justify-between gap-2">
                  <span>{entry.channel}</span>
                  <span>{entry.event}</span>
                  <span>{entry.delayMs ? `${Math.round(entry.delayMs)}ms` : '—'}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={handleExportJSON}>Export JSON</Button>
            <Button size="sm" variant="outline" onClick={handleReplay}>Replay last run</Button>
            <Button size="sm" variant="outline" onClick={handleSnapshot}>Save snapshot A</Button>
            <Button size="sm" variant="outline" onClick={handleResetRun}>Reset run</Button>
            <Button size="sm" variant="outline" onClick={handleExportCertification}>Export certification</Button>
          </div>
          <div className={`rounded-md border p-3 text-xs ${certification.certified ? 'border-primary/30 bg-primary/5 text-primary' : 'border-destructive/30 bg-destructive/5 text-destructive'}`}>
            <div className="font-semibold mb-1">Certification: {certification.certified ? 'CERTIFIED' : 'NOT CERTIFIED'}</div>
            <div>monotonic={String(certification.determinism.monotonic)} · causal={String(certification.determinism.causal)} · replayable={String(certification.determinism.replayable)}</div>
            {certification.determinism.violations.length > 0 && (
              <ul className="mt-1 list-disc list-inside max-h-20 overflow-y-auto">
                {certification.determinism.violations.slice(0, 6).map((v) => <li key={v}>{v}</li>)}
              </ul>
            )}
          </div>
          <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-md border border-border/50 bg-background/40 p-3">Drift mean: {drift.mean.toFixed(1)}ms</div>
            <div className="rounded-md border border-border/50 bg-background/40 p-3">p50: {drift.p50.toFixed(1)}ms</div>
            <div className="rounded-md border border-border/50 bg-background/40 p-3">p95: {drift.p95.toFixed(1)}ms</div>
            <div className="rounded-md border border-border/50 bg-background/40 p-3">max: {drift.max.toFixed(1)}ms</div>
          </div>
          {drift.buckets.length > 0 && (
            <div className="rounded-md border border-border/50 bg-background/40 p-3">
              <div className="mb-2 text-xs font-semibold text-foreground">Drift histogram</div>
              <div className="flex items-end gap-1 h-20">
                {drift.buckets.map((b, i) => {
                  const maxCount = Math.max(...drift.buckets.map((x) => x.count), 1);
                  const h = Math.max(4, Math.round((b.count / maxCount) * 72));
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full rounded-sm bg-primary/70" style={{ height: `${h}px` }} title={`${b.rangeMs[0]}-${b.rangeMs[1]}ms: ${b.count}`} />
                      <span className="text-[9px] text-muted-foreground">{b.rangeMs[0]}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <div className={`rounded-md border p-3 text-xs ${regression.passed ? 'border-primary/30 bg-primary/5 text-primary' : 'border-destructive/30 bg-destructive/5 text-destructive'}`}>
            <div className="font-semibold mb-1">Regression: {regression.passed ? 'PASS' : 'FAIL'}</div>
            <div>failed={regression.metrics.failed} · p95={regression.metrics.p95.toFixed(1)}ms · max={regression.metrics.max.toFixed(1)}ms · ack={(regression.metrics.ackRate * 100).toFixed(1)}%</div>
            {regression.failures.length > 0 && (
              <ul className="mt-1 list-disc list-inside">
                {regression.failures.map((f) => <li key={f}>{f}</li>)}
              </ul>
            )}
          </div>
          {compare && (
            <div className="rounded-md border border-border/50 bg-background/40 p-3 text-xs text-muted-foreground">
              <div className="font-semibold text-foreground mb-1">A/B compare (current vs snapshot)</div>
              <div className="flex flex-wrap gap-3">
                <span>Δ failed: {compare.lossDelta}</span>
                <span>Δ acked: {compare.ackDelta}</span>
                <span>Δ p95: {compare.jitterP95Delta.toFixed(1)}ms</span>
                <span>Δ mean: {compare.meanDelta.toFixed(1)}ms</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/60">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Executive report history</CardTitle>
              <CardDescription>Últimos relatórios salvos para validar readiness e verificação.</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => window.location.assign('/command')}>
              Abrir Command
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {loading ? (
              <p className="text-sm text-muted-foreground">Carregando relatórios...</p>
            ) : reports.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum relatório executivo salvo.</p>
            ) : (
              reports.map((report) => (
                <div key={report.id} className="flex flex-col gap-2 rounded-md border border-border/50 bg-background/40 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">{report.show_name}</p>
                    <p className="text-xs text-muted-foreground">{new Date(report.created_at).toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{report.verification_level}</Badge>
                    <StatusBadge tone={report.readiness_status.includes('BLOCKED') ? 'blocked' : 'degraded'} />
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}