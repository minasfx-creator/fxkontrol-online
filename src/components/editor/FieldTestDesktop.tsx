/**
 * FieldTestDesktop — 3-column desktop layout for Field Test
 * Left: Setup/Config + Module Scanner
 * Center: 32-ch Fire Grid (8×4)
 * Right: Telemetry & Diagnostics + Event Log
 */
import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  Wifi, Globe, Bluetooth, Radio, Zap, Shield, Target,
  CheckCircle2, XCircle, Flame, AlertTriangle,
  Activity, Copy, Search, Loader2,
  Play, Square, FileText, Lightbulb,
  BarChart3, RefreshCw, Maximize, Smartphone
} from 'lucide-react';
import {
  fieldTestEngine, generateSessionCode,
  type DeviceRole, type TestTransport, type FieldTestSession, type TestLog
} from '@/services/fieldTestService';
import { isWebBluetoothAvailable } from '@/services/bleFieldTransport';
import { toast } from 'sonner';
import { haptics } from '@/lib/haptics';

// ─── Transport Config ─────────────────────────────
const TRANSPORTS: { id: TestTransport; label: string; desc: string; icon: React.ReactNode; color: string }[] = [
  { id: 'realtime-lan', label: 'Wi-Fi LAN', desc: 'Mesma rede local', icon: <Wifi className="w-4 h-4" />, color: 'text-green-400' },
  { id: 'realtime-wan', label: 'Internet WAN', desc: 'Redes diferentes', icon: <Globe className="w-4 h-4" />, color: 'text-blue-400' },
  { id: 'ble', label: 'BLE', desc: 'Pareamento direto', icon: <Bluetooth className="w-4 h-4" />, color: 'text-purple-400' },
];

// ─── Log Entry ────────────────────────────────────
function LogEntry({ log }: { log: TestLog }) {
  const colors: Record<TestLog['type'], string> = {
    fire: 'text-orange-400', ack: 'text-green-400', arm: 'text-amber-400',
    disarm: 'text-muted-foreground', estop: 'text-destructive',
    info: 'text-blue-400', error: 'text-destructive',
  };
  return (
    <div className="flex items-center gap-2 text-[11px] font-mono py-0.5 border-b border-border/10">
      <span className="text-muted-foreground/60 w-16 shrink-0">
        {new Date(log.timestamp).toLocaleTimeString('pt-BR', { hour12: false })}
      </span>
      <span className={`flex-1 ${colors[log.type]}`}>{log.message}</span>
      {log.latencyMs !== undefined && (
        <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">{log.latencyMs}ms</Badge>
      )}
    </div>
  );
}

// ─── Setup Panel (Left Column, inline) ────────────
function SetupPanel({ onStart }: { onStart: (code: string, role: DeviceRole, transport: TestTransport) => void }) {
  const [role, setRole] = useState<DeviceRole | null>(null);
  const [transport, setTransport] = useState<TestTransport | null>(null);
  const [code, setCode] = useState(generateSessionCode());

  const isBLE = transport === 'ble';
  const canStart = role && transport && (isBLE || code.length >= 4);

  return (
    <div className="space-y-4 p-3">
      <div className="text-center space-y-1">
        <div className="flex items-center justify-center gap-2">
          <Target className="w-4 h-4 text-destructive" />
          <h3 className="text-sm font-bold text-foreground font-mono">FIELD TEST</h3>
        </div>
        <p className="text-[10px] text-muted-foreground">Disparo real com medição de latência</p>
      </div>

      {/* Role */}
      <div className="space-y-1.5">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider font-mono">1. Papel</p>
        <div className="grid grid-cols-2 gap-2">
          <Button variant={role === 'controller' ? 'default' : 'outline'} size="sm"
            className={cn("h-12 flex-col gap-0.5 text-[10px]", role === 'controller' && 'ring-1 ring-primary')}
            onClick={() => setRole('controller')}>
            <Radio className="w-4 h-4" />
            <span className="font-bold">CONTROLLER</span>
          </Button>
          <Button variant={role === 'module' ? 'default' : 'outline'} size="sm"
            className={cn("h-12 flex-col gap-0.5 text-[10px]", role === 'module' && 'ring-1 ring-primary')}
            onClick={() => setRole('module')}>
            <Smartphone className="w-4 h-4" />
            <span className="font-bold">MODULE</span>
          </Button>
        </div>
      </div>

      {/* Transport */}
      <div className="space-y-1.5">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider font-mono">2. Transporte</p>
        <div className="space-y-1">
          {TRANSPORTS.map(t => (
            <button key={t.id}
              className={cn(
                "w-full flex items-center gap-2 px-2 py-1.5 rounded-md border text-left transition-all text-[10px]",
                transport === t.id
                  ? "border-primary/50 bg-primary/10 ring-1 ring-primary/30"
                  : "border-border/30 hover:border-border/60"
              )}
              onClick={() => setTransport(t.id)}>
              <span className={t.color}>{t.icon}</span>
              <div>
                <span className="font-bold font-mono">{t.label}</span>
                <span className="text-muted-foreground ml-1">{t.desc}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Session Code */}
      {!isBLE && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider font-mono">3. Código</p>
          <div className="flex gap-1.5">
            <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="font-mono text-sm tracking-[0.2em] text-center uppercase h-8" maxLength={6} />
            <Button variant="outline" size="icon" className="h-8 w-8 shrink-0"
              onClick={() => { navigator.clipboard?.writeText(code); toast.success('Copiado!'); }}>
              <Copy className="w-3 h-3" />
            </Button>
          </div>
        </div>
      )}

      {isBLE && role === 'module' && (
        <div className="rounded-md border border-purple-500/20 bg-purple-500/5 p-2 text-[10px] text-muted-foreground text-center">
          <Bluetooth className="w-5 h-5 text-purple-400 mx-auto mb-1" />
          Modo BLE: módulo receptor é hardware FXK-M1
        </div>
      )}

      <Button disabled={!canStart}
        className="w-full h-10 font-bold bg-destructive hover:bg-destructive/90 text-destructive-foreground"
        onClick={() => onStart(code, role!, transport!)}>
        <Zap className="w-4 h-4 mr-1" /> INICIAR TESTE
      </Button>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// MAIN DESKTOP COMPONENT
// ═══════════════════════════════════════════════════
export default function FieldTestDesktop() {
  const [session, setSession] = useState<FieldTestSession | null>(null);
  const channels = Array.from({ length: 32 }, (_, i) => i + 1);
  const [lastFired, setLastFired] = useState<number | null>(null);
  const [channelResults, setChannelResults] = useState<Record<number, { status: 'idle' | 'fired' | 'ack'; latencyMs?: number }>>(
    Object.fromEntries(channels.map(ch => [ch, { status: 'idle' as const }]))
  );
  const [benchmarkRunning, setBenchmarkRunning] = useState(false);
  const [benchmarkChannels, setBenchmarkChannels] = useState(16);

  useEffect(() => {
    const unsub = fieldTestEngine.subscribe(setSession);
    return () => { unsub(); };
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!session) return;
      if (e.key === ' ' && session.role === 'controller') {
        e.preventDefault();
        if (session.armed) fieldTestEngine.disarm();
        else fieldTestEngine.arm();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        fieldTestEngine.eStop();
        haptics.panic();
      }
      // Number keys 1-9 for channels, 0 for ch 10
      const num = parseInt(e.key);
      if (!isNaN(num) && session.armed && session.role === 'controller') {
        const ch = num === 0 ? 10 : num;
        handleFire(ch);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [session]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleStart = useCallback(async (code: string, role: DeviceRole, transport: TestTransport) => {
    const ok = await fieldTestEngine.start(code, role, transport);
    if (ok) toast.success(`Sessão iniciada como ${role.toUpperCase()}`);
    else toast.error('Falha ao iniciar');
  }, []);

  const handleStop = useCallback(async () => {
    await fieldTestEngine.stop();
    setChannelResults(Object.fromEntries(channels.map(ch => [ch, { status: 'idle' as const }])));
    toast.info('Sessão encerrada');
  }, [channels]);

  const handleFire = useCallback((ch: number) => {
    if (!session?.armed || session.role !== 'controller') return;
    fieldTestEngine.fire(ch);
    haptics.fire();
    setLastFired(ch);
    setChannelResults(prev => ({ ...prev, [ch]: { status: 'fired' } }));
    setTimeout(() => setLastFired(null), 300);
  }, [session]);

  // Track ACKs
  useEffect(() => {
    if (!session) return;
    const ackLog = session.logs.find(l => l.type === 'ack' && l.latencyMs !== undefined);
    if (ackLog) {
      const fireLog = session.logs.find(l => l.type === 'fire' && l.channel !== undefined);
      if (fireLog?.channel) {
        setChannelResults(prev => ({
          ...prev,
          [fireLog.channel!]: { status: 'ack', latencyMs: ackLog.latencyMs },
        }));
      }
    }
  }, [session?.stats.acksReceived]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleBenchmark = async () => {
    if (!session?.armed) { toast.error('Arme primeiro'); return; }
    setBenchmarkRunning(true);
    await fieldTestEngine.runBenchmark(benchmarkChannels);
    setBenchmarkRunning(false);
    toast.success('Benchmark completo!');
  };

  const handleExport = () => {
    const report = fieldTestEngine.generateReport();
    navigator.clipboard?.writeText(report);
    toast.success('Relatório copiado!');
  };

  const handleResetChannels = () => {
    setChannelResults(Object.fromEntries(channels.map(ch => [ch, { status: 'idle' as const }])));
  };

  const suggestions = session ? fieldTestEngine.getSuggestions() : [];
  const firedCount = Object.values(channelResults).filter(r => r.status !== 'idle').length;
  const ackCount = Object.values(channelResults).filter(r => r.status === 'ack').length;

  return (
    <div className="h-full flex flex-col" style={{ background: 'hsl(220 25% 4%)' }}>
      {/* ═══ Header Bar ═══ */}
      <div className="shrink-0 flex items-center justify-between px-4 h-10"
        style={{
          background: 'linear-gradient(180deg, hsl(220 20% 10%), hsl(220 20% 6%))',
          borderBottom: '1px solid hsl(0 0% 100% / 0.06)',
        }}>
        <div className="flex items-center gap-3">
          <Target className="w-4 h-4 text-destructive" />
          <span className="text-xs font-black font-mono text-foreground tracking-wider">FIELD TEST — FXK DIAGNOSTIC CONSOLE</span>
        </div>
        <div className="flex items-center gap-2">
          {session && (
            <>
              <div className={cn("w-2 h-2 rounded-full", session.peerConnected ? "bg-green-500" : "bg-red-500")}
                style={{ boxShadow: session.peerConnected ? '0 0 6px hsl(120 70% 50%)' : '0 0 6px hsl(0 70% 50%)' }} />
              <span className="text-[9px] font-mono text-muted-foreground/60">
                {session.peerConnected ? 'PEER ONLINE' : 'WAITING'}
              </span>
              <Badge variant="outline" className="text-[8px] h-4 px-1.5 font-mono border-amber-500/30 text-amber-400">
                {session.code}
              </Badge>
              <Badge variant="outline" className="text-[8px] h-4 px-1.5 font-mono border-blue-500/30 text-blue-400">
                {session.transport.toUpperCase()}
              </Badge>
              {session.stats.firesSent > 0 && (
                <span className="text-[9px] font-mono text-muted-foreground/50">
                  AVG:<span className="text-amber-400 font-bold ml-0.5">{session.stats.avgLatency}ms</span>
                  <span className="mx-1">·</span>
                  LOSS:<span className={cn("font-bold ml-0.5", session.stats.packetLoss > 1 ? 'text-red-400' : 'text-green-400')}>{session.stats.packetLoss}%</span>
                </span>
              )}
            </>
          )}
        </div>
      </div>

      {/* ═══ 3-Column Layout ═══ */}
      <div className="flex-1 flex min-h-0">

        {/* ── LEFT PANEL: Setup / Session Info ── */}
        <div className="w-64 shrink-0 flex flex-col border-r"
          style={{ background: 'hsl(220 18% 6%)', borderColor: 'hsl(0 0% 100% / 0.05)' }}>
          <ScrollArea className="flex-1">
            {!session ? (
              <SetupPanel onStart={handleStart} />
            ) : (
              <div className="p-3 space-y-3">
                {/* Session Info */}
                <div className="space-y-2">
                  <h4 className="text-[10px] font-mono font-bold text-muted-foreground/60 uppercase tracking-wider">Sessão Ativa</h4>
                  <div className="space-y-1 text-[10px] font-mono">
                    <div className="flex justify-between"><span className="text-muted-foreground/60">Código</span><span className="text-amber-400">{session.code}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground/60">Papel</span><span className="text-foreground">{session.role.toUpperCase()}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground/60">Transporte</span><span className="text-blue-400">{session.transport.toUpperCase()}</span></div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground/60">Status</span>
                      <span className={session.armed ? 'text-amber-400' : 'text-muted-foreground'}>{session.armed ? '🔑 ARMED' : '🔒 SAFE'}</span>
                    </div>
                  </div>
                </div>

                {/* Quick Stats */}
                {session.stats.firesSent > 0 && (
                  <div className="rounded-md border border-border/20 p-2 space-y-1">
                    <h4 className="text-[9px] font-mono font-bold text-muted-foreground/50 uppercase">Resumo</h4>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] font-mono">
                      <span className="text-muted-foreground/60">Fires</span><span className="text-foreground text-right">{session.stats.firesSent}</span>
                      <span className="text-muted-foreground/60">ACKs</span><span className="text-green-400 text-right">{session.stats.acksReceived}</span>
                      <span className="text-muted-foreground/60">Loss</span>
                      <span className={cn("text-right", session.stats.packetLoss > 1 ? 'text-red-400' : 'text-green-400')}>{session.stats.packetLoss}%</span>
                    </div>
                  </div>
                )}

                {/* BLE Scanner hint */}
                {session.transport === 'ble' && (
                  <div className="rounded-md border border-purple-500/20 bg-purple-500/5 p-2">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Bluetooth className="w-3 h-3 text-purple-400" />
                      <span className="text-[9px] font-mono font-bold text-purple-400">BLE MODE</span>
                    </div>
                    <p className="text-[9px] text-muted-foreground/60">Use o scanner para conectar ao módulo hardware</p>
                  </div>
                )}

                {/* Stop Session */}
                <Button variant="outline" size="sm" className="w-full h-8 text-[10px] font-mono border-destructive/30 text-destructive hover:bg-destructive/10"
                  onClick={handleStop}>
                  <XCircle className="w-3 h-3 mr-1" /> ENCERRAR SESSÃO
                </Button>
              </div>
            )}
          </ScrollArea>
        </div>

        {/* ── CENTER: Fire Grid ── */}
        <div className="flex-1 flex flex-col min-w-0">
          {session?.role === 'controller' ? (
            <>
              {/* Control Bar */}
              <div className="shrink-0 flex items-center gap-2 px-3 py-2"
                style={{ background: 'hsl(220 20% 5%)', borderBottom: '1px solid hsl(0 0% 100% / 0.04)' }}>
                <Button size="sm"
                  className={cn("h-8 px-4 font-mono font-bold text-xs gap-1.5 transition-all",
                    session.armed
                      ? "bg-amber-600 hover:bg-amber-500 text-white shadow-[0_0_16px_hsl(32_100%_50%/0.3)]"
                      : "bg-amber-600/15 hover:bg-amber-600/25 text-amber-400 border border-amber-600/30"
                  )}
                  onClick={() => session.armed ? fieldTestEngine.disarm() : fieldTestEngine.arm()}>
                  <Shield className="w-3.5 h-3.5" />
                  {session.armed ? 'DISARM' : 'ARM'}
                </Button>

                <Button size="sm"
                  className="h-8 px-4 bg-red-700 hover:bg-red-600 text-white font-mono font-bold text-xs gap-1.5 shadow-[0_0_12px_hsl(0_70%_50%/0.2)]"
                  onClick={() => { fieldTestEngine.eStop(); haptics.panic(); }}>
                  <AlertTriangle className="w-3.5 h-3.5" /> E-STOP
                </Button>

                <div className="h-5 w-px bg-border/20 mx-1" />

                <Button variant="outline" size="sm" className="h-7 px-2 text-[10px] font-mono border-border/20"
                  onClick={handleResetChannels}>
                  <RefreshCw className="w-3 h-3 mr-1" /> RESET
                </Button>

                <div className="ml-auto flex items-center gap-2 text-[9px] font-mono">
                  <span className="text-muted-foreground/50">FIRE:<span className="text-amber-400 ml-0.5">{firedCount}</span></span>
                  <span className="text-muted-foreground/50">ACK:<span className="text-green-400 ml-0.5">{ackCount}</span></span>
                </div>

                <div className="text-[8px] text-muted-foreground/30 font-mono ml-2">
                  [Space]=ARM [Esc]=E-STOP [1-9]=Fire
                </div>
              </div>

              {/* 32-ch Grid */}
              <div className="flex-1 p-3 overflow-hidden">
                <div className="grid grid-cols-8 grid-rows-4 gap-2 h-full">
                  {channels.map(ch => {
                    const result = channelResults[ch];
                    const isFiring = lastFired === ch;
                    const isAck = result.status === 'ack';
                    const isFired = result.status === 'fired';
                    return (
                      <button key={ch}
                        disabled={!session.armed}
                        onClick={() => handleFire(ch)}
                        className={cn(
                          "relative rounded-lg font-mono font-black text-lg transition-all",
                          "border-2 flex flex-col items-center justify-center cursor-pointer",
                          "hover:scale-[1.03] active:scale-95",
                          isFiring
                            ? "bg-orange-500 border-orange-400 text-white scale-95"
                            : isAck
                              ? "bg-green-900/30 border-green-600/40 text-green-300"
                              : isFired
                                ? "bg-orange-900/20 border-orange-700/30 text-orange-300 animate-pulse"
                                : session.armed
                                  ? "bg-red-900/40 border-red-700/40 text-red-300 hover:bg-red-800/60 hover:border-red-600/60"
                                  : "bg-muted/10 border-border/20 text-muted-foreground/20"
                        )}
                        style={isFiring ? {
                          boxShadow: '0 0 24px hsl(25 100% 50% / 0.6), inset 0 0 12px hsl(25 100% 60% / 0.3)',
                        } : isAck ? {
                          boxShadow: '0 0 10px hsl(120 70% 40% / 0.2)',
                        } : session.armed ? {
                          boxShadow: '0 2px 10px hsl(0 0% 0% / 0.4), inset 0 1px 0 hsl(0 0% 100% / 0.03)',
                        } : undefined}>
                        <span className="text-[10px] opacity-40 leading-none">CH</span>
                        <span className="leading-none">{String(ch).padStart(2, '0')}</span>
                        {isAck && result.latencyMs !== undefined && (
                          <span className="absolute -top-1.5 -right-1.5 text-[8px] font-mono bg-green-600 text-white px-1.5 rounded-full leading-tight">
                            {result.latencyMs}ms
                          </span>
                        )}
                        {isAck && <CheckCircle2 className="absolute bottom-1 right-1 w-3 h-3 text-green-400" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          ) : session?.role === 'module' ? (
            /* Module View */
            <div className="flex-1 flex flex-col p-3">
              <div className="flex items-center gap-2 mb-3">
                <Smartphone className="w-4 h-4 text-primary" />
                <span className="text-xs font-bold font-mono text-foreground">MÓDULO RECEPTOR</span>
                <div className={cn("flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-mono font-bold border ml-auto",
                  session.armed ? "bg-amber-500/10 border-amber-500/30 text-amber-400" : "bg-muted/5 border-border/20 text-muted-foreground/40"
                )}>
                  <Shield className="w-3 h-3" />
                  {session.armed ? 'ARMED' : 'SAFE'}
                </div>
              </div>
              <div className="grid grid-cols-8 grid-rows-4 gap-2 flex-1">
                {channels.map(ch => (
                  <div key={ch} className={cn(
                    "rounded-lg border-2 flex flex-col items-center justify-center",
                    session.armed ? "border-red-800/30 bg-red-900/10" : "border-border/15 bg-muted/5"
                  )}>
                    <span className="text-[10px] font-mono text-muted-foreground/30">CH</span>
                    <span className="text-lg font-mono font-black text-muted-foreground/20">{String(ch).padStart(2, '0')}</span>
                  </div>
                ))}
              </div>
              <Button className="w-full h-10 mt-3 font-bold bg-destructive hover:bg-destructive/80 text-destructive-foreground"
                onClick={() => { fieldTestEngine.eStop(); haptics.panic(); }}>
                <AlertTriangle className="w-4 h-4 mr-1" /> E-STOP
              </Button>
            </div>
          ) : (
            /* No session — placeholder */
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-2">
                <Target className="w-10 h-10 text-muted-foreground/15 mx-auto" />
                <p className="text-sm font-mono text-muted-foreground/30">Configure e inicie uma sessão no painel esquerdo</p>
                <p className="text-[10px] text-muted-foreground/20 font-mono">32 canais · 8×4 grid · latência em tempo real</p>
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT PANEL: Telemetry & Diagnostics ── */}
        <div className="w-72 shrink-0 flex flex-col border-l"
          style={{ background: 'hsl(220 18% 5%)', borderColor: 'hsl(0 0% 100% / 0.05)' }}>
          <ScrollArea className="flex-1">
            <div className="p-3 space-y-3">

              {/* Network Metrics */}
              {session && session.stats.firesSent > 0 && (
                <div className="rounded-md border border-border/20 p-2.5 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-blue-400" />
                    <span className="text-[10px] font-mono font-bold text-foreground uppercase">Métricas de Rede</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: 'AVG', value: `${session.stats.avgLatency}ms`, color: 'text-amber-400' },
                      { label: 'P95', value: `${session.stats.p95Latency}ms`, color: 'text-amber-400' },
                      { label: 'MIN', value: `${session.stats.minLatency}ms`, color: 'text-green-400' },
                      { label: 'MAX', value: `${session.stats.maxLatency}ms`, color: 'text-red-400' },
                    ].map(m => (
                      <div key={m.label} className="text-center">
                        <div className={cn("text-base font-mono font-black", m.color)}>{m.value}</div>
                        <div className="text-[8px] font-mono text-muted-foreground/50">{m.label}</div>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between pt-1.5 border-t border-border/10">
                    <span className="text-[9px] font-mono text-muted-foreground/50">
                      FIRE:<span className="text-foreground ml-0.5">{session.stats.firesSent}</span> · ACK:<span className="text-green-400 ml-0.5">{session.stats.acksReceived}</span>
                    </span>
                    <span className={cn("text-[9px] font-mono font-bold", session.stats.packetLoss > 1 ? 'text-red-400' : 'text-green-400')}>
                      {session.stats.packetLoss}% LOSS
                    </span>
                  </div>
                </div>
              )}

              {/* Benchmark */}
              {session?.role === 'controller' && (
                <div className="rounded-md border border-border/20 p-2.5 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <BarChart3 className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-[10px] font-mono font-bold text-foreground uppercase">Auto Benchmark</span>
                  </div>
                  <div className="flex gap-1.5 items-center">
                    {[8, 16, 24, 32].map(n => (
                      <button key={n}
                        className={cn("text-[9px] font-mono px-2 py-1 rounded border transition-all",
                          benchmarkChannels === n
                            ? "border-amber-500/50 bg-amber-500/10 text-amber-400"
                            : "border-border/20 text-muted-foreground/40 hover:border-border/40"
                        )}
                        onClick={() => setBenchmarkChannels(n)}>{n}ch</button>
                    ))}
                    <Button size="sm"
                      className={cn("h-7 px-3 text-[10px] font-mono gap-1 ml-auto",
                        benchmarkRunning ? "bg-red-600 hover:bg-red-500" : "bg-amber-600 hover:bg-amber-500")}
                      onClick={benchmarkRunning ? () => fieldTestEngine.stopBenchmark() : handleBenchmark}
                      disabled={!session.armed && !benchmarkRunning}>
                      {benchmarkRunning ? <><Square className="w-3 h-3" /> STOP</> : <><Play className="w-3 h-3" /> RUN</>}
                    </Button>
                  </div>
                  {benchmarkRunning && <Progress value={(session.stats.firesSent / benchmarkChannels) * 100} className="h-1" />}
                </div>
              )}

              {/* Suggestions */}
              {suggestions.length > 0 && (
                <div className="rounded-md border border-border/20 p-2.5 space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-[10px] font-mono font-bold text-foreground uppercase">Recomendações</span>
                  </div>
                  {suggestions.map((tip, i) => (
                    <div key={i} className="text-[10px] font-mono text-muted-foreground/60 leading-relaxed pl-2 border-l-2 border-amber-500/20">
                      {tip}
                    </div>
                  ))}
                </div>
              )}

              {/* Export */}
              {session && session.stats.firesSent > 0 && (
                <Button variant="outline" size="sm" className="w-full h-7 text-[10px] font-mono border-border/20 gap-1"
                  onClick={handleExport}>
                  <FileText className="w-3 h-3" /> Copiar Relatório
                </Button>
              )}

              {/* Event Log */}
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <Activity className="w-3 h-3 text-muted-foreground/40" />
                  <span className="text-[10px] font-mono font-bold text-muted-foreground/50 uppercase">Event Log</span>
                </div>
                <div className="space-y-0">
                  {session ? (
                    session.logs.slice(0, 50).map(l => <LogEntry key={l.id} log={l} />)
                  ) : (
                    <p className="text-[10px] font-mono text-muted-foreground/20 text-center py-4">Nenhum evento</p>
                  )}
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
