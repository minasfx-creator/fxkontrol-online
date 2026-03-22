import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  Rocket, Globe, Wifi, Radio, Zap, CheckCircle2, XCircle, 
  ArrowLeft, Shield, Activity, Timer
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { runShowTest, VenueResult, TransportType, TransportMetrics } from '@/services/showTestEngine';

const TRANSPORT_LABELS: Record<TransportType, { label: string; icon: React.ReactNode; color: string }> = {
  lan: { label: 'LAN (UDP)', icon: <Wifi className="w-4 h-4" />, color: 'text-green-400' },
  wan: { label: 'WAN (IP)', icon: <Globe className="w-4 h-4" />, color: 'text-blue-400' },
  relay: { label: 'Relay (WS)', icon: <Radio className="w-4 h-4" />, color: 'text-purple-400' },
  hybrid: { label: 'Híbrido', icon: <Zap className="w-4 h-4" />, color: 'text-amber-400' },
};

const VENUE_FLAGS: Record<string, string> = {
  copacabana: '🇧🇷',
  vitoria: '🇧🇷',
  liuyang: '🇨🇳',
};

function Sparkline({ samples, max }: { samples: number[]; max: number }) {
  const w = 200;
  const h = 32;
  const step = w / Math.min(samples.length, 100);
  const subset = samples.slice(0, 100);
  const points = subset.map((v, i) => `${i * step},${h - (v / max) * h}`).join(' ');
  return (
    <svg width={w} height={h} className="opacity-70">
      <polyline points={points} fill="none" stroke="hsl(var(--primary))" strokeWidth="1.5" />
    </svg>
  );
}

function MetricRow({ label, value, unit, good }: { label: string; value: string | number; unit?: string; good?: boolean }) {
  return (
    <div className="flex justify-between items-center py-1 border-b border-border/30 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-mono font-bold ${good === false ? 'text-destructive' : good ? 'text-green-400' : 'text-foreground'}`}>
        {value}{unit && <span className="text-muted-foreground ml-0.5">{unit}</span>}
      </span>
    </div>
  );
}

function TransportCard({ metrics, maxLatency }: { metrics: TransportMetrics; maxLatency: number }) {
  const cfg = TRANSPORT_LABELS[metrics.transport];
  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader className="py-2 px-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <span className={cfg.color}>{cfg.icon}</span>
          {cfg.label}
          {metrics.nfpaCompliant ? (
            <Badge variant="outline" className="ml-auto text-[10px] border-green-500/50 text-green-400">
              <CheckCircle2 className="w-3 h-3 mr-1" /> NFPA ✓
            </Badge>
          ) : (
            <Badge variant="destructive" className="ml-auto text-[10px]">
              <XCircle className="w-3 h-3 mr-1" /> FAIL
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3 space-y-1">
        <Sparkline samples={metrics.samples} max={maxLatency} />
        <MetricRow label="Latência Média" value={metrics.latencyAvg} unit="ms" />
        <MetricRow label="Min / Max" value={`${metrics.latencyMin} / ${metrics.latencyMax}`} unit="ms" />
        <MetricRow label="P95" value={metrics.latencyP95} unit="ms" />
        <MetricRow label="P99" value={metrics.latencyP99} unit="ms" />
        <MetricRow label="Jitter (σ)" value={metrics.jitter} unit="ms" />
        <MetricRow label="Throughput" value={metrics.throughput} unit="pkt/s" />
        <MetricRow label="Packet Loss" value={metrics.packetLoss} unit="%" good={metrics.packetLoss < 1} />
        <MetricRow label="E-STOP" value={metrics.eStopResponse} unit="ms" good={metrics.nfpaCompliant} />
        <MetricRow label="Sync δt" value={metrics.syncAccuracy} unit="ms" />
      </CardContent>
    </Card>
  );
}

function VenueSection({ result }: { result: VenueResult }) {
  const v = result.venue;
  const flag = VENUE_FLAGS[v.id] || '🌍';
  const transports: TransportType[] = ['lan', 'wan', 'relay', 'hybrid'];
  const allSamples = transports.flatMap(t => result.transports[t]?.samples || []);
  const maxLatency = allSamples.length > 0 ? Math.max(...allSamples) : 100;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="text-2xl">{flag}</span>
        <div>
          <h3 className="text-lg font-bold text-foreground">{v.name}</h3>
          <p className="text-xs text-muted-foreground">{v.scenario}</p>
          <p className="text-[10px] text-muted-foreground font-mono">
            GPS: {v.gps.lat}, {v.gps.lng} • Base: {v.baseLatencyMs}ms • EF: {result.edgeFunctionLatency}ms
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {result.status === 'running' && (
            <div className="w-32">
              <Progress value={result.progress} className="h-2" />
            </div>
          )}
          {result.status === 'complete' && (
            <Badge variant="outline" className="border-green-500/50 text-green-400">
              <CheckCircle2 className="w-3 h-3 mr-1" /> COMPLETO
            </Badge>
          )}
          {result.status === 'pending' && (
            <Badge variant="secondary" className="text-xs">AGUARDANDO</Badge>
          )}
        </div>
      </div>

      {result.status === 'complete' && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {transports.map(t => result.transports[t] && (
            <TransportCard key={t} metrics={result.transports[t]} maxLatency={maxLatency} />
          ))}
        </div>
      )}
    </div>
  );
}

function ComparisonTable({ venues }: { venues: VenueResult[] }) {
  const transports: TransportType[] = ['lan', 'wan', 'relay', 'hybrid'];
  const complete = venues.filter(v => v.status === 'complete');
  if (complete.length === 0) return null;

  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-sm flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          Tabela Comparativa Final
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 overflow-x-auto">
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 text-muted-foreground">Venue</th>
              {transports.map(t => (
                <th key={t} className={`text-center py-2 ${TRANSPORT_LABELS[t].color}`}>
                  {TRANSPORT_LABELS[t].label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {complete.map(vr => (
              <tr key={vr.venue.id} className="border-b border-border/30">
                <td className="py-2 font-bold text-foreground">
                  {VENUE_FLAGS[vr.venue.id]} {vr.venue.city}
                </td>
                {transports.map(t => {
                  const m = vr.transports[t];
                  return (
                    <td key={t} className="text-center py-2">
                      <span className="text-foreground font-bold">{m?.latencyAvg ?? '—'}</span>
                      <span className="text-muted-foreground">ms</span>
                    </td>
                  );
                })}
              </tr>
            ))}
            {/* E-STOP row */}
            <tr className="border-b border-border/30 bg-muted/10">
              <td className="py-2 font-bold text-foreground">
                <Shield className="w-3 h-3 inline mr-1 text-destructive" /> E-STOP
              </td>
              {transports.map(t => {
                const worst = Math.max(...complete.map(vr => vr.transports[t]?.eStopResponse ?? 0));
                return (
                  <td key={t} className="text-center py-2">
                    <span className="font-bold">&lt;{Math.ceil(worst)}</span>
                    <span className="text-muted-foreground">ms</span>
                  </td>
                );
              })}
            </tr>
            {/* NFPA row */}
            <tr>
              <td className="py-2 font-bold text-foreground">
                <Timer className="w-3 h-3 inline mr-1 text-amber-400" /> NFPA 1123
              </td>
              {transports.map(t => {
                const allPass = complete.every(vr => vr.transports[t]?.nfpaCompliant);
                return (
                  <td key={t} className="text-center py-2">
                    {allPass ? (
                      <span className="text-green-400 font-bold">✅ PASS</span>
                    ) : (
                      <span className="text-destructive font-bold">❌ FAIL</span>
                    )}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

export default function ShowTestSimulator() {
  const navigate = useNavigate();
  const [venues, setVenues] = useState<VenueResult[]>([]);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ startedAt: string; completedAt: string | null; edgeFunctionAlive: boolean } | null>(null);

  const handleDetonate = useCallback(async () => {
    setRunning(true);
    setResult(null);
    const res = await runShowTest(setVenues);
    setResult({ startedAt: res.startedAt, completedAt: res.completedAt, edgeFunctionAlive: res.edgeFunctionAlive });
    setRunning(false);
  }, []);

  return (
    <div className="min-h-screen bg-background p-4 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Rocket className="w-6 h-6 text-primary" />
            Show Test Simulator — 50 Módulos × 3 Venues
          </h1>
          <p className="text-sm text-muted-foreground">
            Art-Net FXK-M1 • 420 cues • 12 min • LAN / WAN / Relay / Híbrido
          </p>
        </div>
        <Button
          onClick={handleDetonate}
          disabled={running}
          className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold px-6"
          size="lg"
        >
          {running ? (
            <>
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
              DETONANDO...
            </>
          ) : (
            <>
              <Rocket className="w-5 h-5 mr-2" />
              DETONAR SHOW
            </>
          )}
        </Button>
      </div>

      {/* Status bar */}
      {result && (
        <div className="flex gap-4 text-xs text-muted-foreground font-mono bg-muted/20 rounded-lg px-4 py-2">
          <span>Início: {new Date(result.startedAt).toLocaleTimeString()}</span>
          {result.completedAt && <span>Fim: {new Date(result.completedAt).toLocaleTimeString()}</span>}
          <span className={result.edgeFunctionAlive ? 'text-green-400' : 'text-destructive'}>
            Edge Function: {result.edgeFunctionAlive ? '● ONLINE' : '● OFFLINE'}
          </span>
        </div>
      )}

      {/* Venue sections */}
      {venues.map(vr => (
        <VenueSection key={vr.venue.id} result={vr} />
      ))}

      {/* Comparison table */}
      {venues.length > 0 && <ComparisonTable venues={venues} />}

      {/* Empty state */}
      {venues.length === 0 && !running && (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
          <Rocket className="w-16 h-16 text-muted-foreground/30" />
          <p className="text-muted-foreground">
            Clique em <strong>DETONAR SHOW</strong> para iniciar o teste de 50 módulos FXK-M1<br />
            em Copacabana, Vitória e Liuyang com todos os transportes Art-Net.
          </p>
        </div>
      )}
    </div>
  );
}
