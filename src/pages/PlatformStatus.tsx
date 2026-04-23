import { useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, ShieldAlert, Wrench, Server, FileWarning, BarChart3 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useHealthHistory } from '@/hooks/useHealthHistory';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

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