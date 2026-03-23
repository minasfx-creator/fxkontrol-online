import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Wifi, Globe, Bluetooth, Radio, Zap, Shield, Target,
  ArrowLeft, CheckCircle2, XCircle, Flame, AlertTriangle,
  Activity, Copy, Smartphone, Maximize
} from 'lucide-react';
import {
  fieldTestEngine, generateSessionCode,
  type DeviceRole, type TestTransport, type FieldTestSession, type TestLog
} from '@/services/fieldTestService';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { haptics } from '@/lib/haptics';
import { cn } from '@/lib/utils';

// ─── Transport Config ─────────────────────────────
const TRANSPORTS: { id: TestTransport; label: string; desc: string; icon: React.ReactNode; color: string }[] = [
  { id: 'realtime-lan', label: 'Wi-Fi LAN', desc: 'Mesma rede local', icon: <Wifi className="w-5 h-5" />, color: 'text-green-400' },
  { id: 'realtime-wan', label: 'Internet WAN', desc: 'Redes diferentes / Relay', icon: <Globe className="w-5 h-5" />, color: 'text-blue-400' },
  { id: 'ble', label: 'Bluetooth BLE', desc: 'Pareamento direto', icon: <Bluetooth className="w-5 h-5" />, color: 'text-purple-400' },
];

// ─── Setup Screen ─────────────────────────────────
function SetupScreen({ onStart }: { onStart: (code: string, role: DeviceRole, transport: TestTransport) => void }) {
  const [role, setRole] = useState<DeviceRole | null>(null);
  const [transport, setTransport] = useState<TestTransport | null>(null);
  const [code, setCode] = useState(generateSessionCode());

  return (
    <div className="space-y-6 p-4 max-w-lg mx-auto">
      <div className="text-center space-y-1">
        <h2 className="text-xl font-bold text-foreground flex items-center justify-center gap-2">
          <Target className="w-5 h-5 text-destructive" />
          FIELD TEST — Disparo Real
        </h2>
        <p className="text-xs text-muted-foreground">
          Teste de disparo entre dois dispositivos com medição de latência
        </p>
      </div>

      {/* Role Selection */}
      <div className="space-y-2">
        <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">1. Papel deste device</p>
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant={role === 'controller' ? 'default' : 'outline'}
            className={`h-20 flex-col gap-1 ${role === 'controller' ? 'ring-2 ring-primary' : ''}`}
            onClick={() => { setRole('controller'); haptics.tap(); }}
          >
            <Radio className="w-6 h-6" />
            <span className="text-xs font-bold">CONTROLADORA</span>
            <span className="text-[10px] text-muted-foreground">Envia disparos</span>
          </Button>
          <Button
            variant={role === 'module' ? 'default' : 'outline'}
            className={`h-20 flex-col gap-1 ${role === 'module' ? 'ring-2 ring-primary' : ''}`}
            onClick={() => { setRole('module'); haptics.tap(); }}
          >
            <Smartphone className="w-6 h-6" />
            <span className="text-xs font-bold">MÓDULO</span>
            <span className="text-[10px] text-muted-foreground">Recebe disparos</span>
          </Button>
        </div>
      </div>

      {/* Transport Selection */}
      <div className="space-y-2">
        <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">2. Transporte</p>
        <div className="space-y-2">
          {TRANSPORTS.map(t => (
            <Button
              key={t.id}
              variant={transport === t.id ? 'default' : 'outline'}
              className={`w-full justify-start h-12 gap-3 ${transport === t.id ? 'ring-2 ring-primary' : ''}`}
              onClick={() => { setTransport(t.id); haptics.select(); }}
            >
              <span className={t.color}>{t.icon}</span>
              <div className="text-left">
                <span className="text-sm font-bold">{t.label}</span>
                <span className="text-[10px] text-muted-foreground ml-2">{t.desc}</span>
              </div>
            </Button>
          ))}
        </div>
      </div>

      {/* Session Code */}
      <div className="space-y-2">
        <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">3. Código da sessão</p>
        <div className="flex gap-2">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            className="font-mono text-lg tracking-[0.3em] text-center uppercase"
            maxLength={6}
          />
          <Button variant="outline" size="icon" onClick={() => {
            navigator.clipboard?.writeText(code);
            toast.success('Código copiado!');
          }}>
            <Copy className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground text-center">
          Ambos os devices devem usar o mesmo código
        </p>
      </div>

      {/* Start */}
      <Button
        disabled={!role || !transport || code.length < 4}
        className="w-full h-14 text-lg font-bold bg-destructive hover:bg-destructive/90 text-destructive-foreground"
        onClick={() => onStart(code, role!, transport!)}
      >
        <Zap className="w-5 h-5 mr-2" />
        INICIAR TESTE
      </Button>
    </div>
  );
}

// ─── Log Entry ────────────────────────────────────
function LogEntry({ log }: { log: TestLog }) {
  const colors: Record<TestLog['type'], string> = {
    fire: 'text-orange-400',
    ack: 'text-green-400',
    arm: 'text-amber-400',
    disarm: 'text-muted-foreground',
    estop: 'text-destructive',
    info: 'text-blue-400',
    error: 'text-destructive',
  };
  return (
    <div className="flex items-center gap-2 text-[11px] font-mono py-0.5 border-b border-border/20">
      <span className="text-muted-foreground w-16 shrink-0">
        {new Date(log.timestamp).toLocaleTimeString('pt-BR', { hour12: false })}
      </span>
      <span className={`flex-1 ${colors[log.type]}`}>{log.message}</span>
      {log.latencyMs !== undefined && (
        <Badge variant="outline" className="text-[9px] px-1 py-0">
          {log.latencyMs}ms
        </Badge>
      )}
    </div>
  );
}

// ─── FireOne XL4 Landscape Controller Console ─────
function XL4ControllerConsole({ session, onStop }: { session: FieldTestSession; onStop: () => void }) {
  const channels = Array.from({ length: 32 }, (_, i) => i + 1);
  const [lastFired, setLastFired] = useState<number | null>(null);

  const handleFire = useCallback((ch: number) => {
    fieldTestEngine.fire(ch);
    haptics.fire();
    setLastFired(ch);
    setTimeout(() => setLastFired(null), 300);
  }, []);

  const handleArm = useCallback(() => {
    if (session.armed) {
      fieldTestEngine.disarm();
      haptics.disarm();
    } else {
      fieldTestEngine.arm();
      haptics.arm();
    }
  }, [session.armed]);

  const handleEStop = useCallback(() => {
    fieldTestEngine.eStop();
    haptics.panic();
  }, []);

  return (
    <div className="h-[100dvh] w-screen flex flex-col overflow-hidden"
      style={{ background: 'hsl(220 25% 4%)' }}>

      {/* ═══ XL4 Top Bar ═══ */}
      <div className="shrink-0 flex items-center justify-between px-3 h-8"
        style={{
          background: 'linear-gradient(180deg, hsl(220 20% 10%), hsl(220 20% 6%))',
          borderBottom: '1px solid hsl(0 0% 100% / 0.05)',
        }}>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <div className={cn("w-2 h-2 rounded-full", session.peerConnected ? "bg-green-500" : "bg-red-500")}
              style={{ boxShadow: session.peerConnected ? '0 0 6px hsl(120 70% 50%)' : '0 0 6px hsl(0 70% 50%)' }} />
            <span className="text-[8px] font-mono font-bold text-muted-foreground/60">
              {session.peerConnected ? 'MODULE ONLINE' : 'WAITING'}
            </span>
          </div>
          <Badge variant="outline" className="text-[7px] h-4 px-1.5 font-mono border-amber-500/30 text-amber-400">
            {session.code}
          </Badge>
          <Badge variant="outline" className="text-[7px] h-4 px-1.5 font-mono border-blue-500/30 text-blue-400">
            {session.transport.toUpperCase()}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {/* Stats inline */}
          {session.stats.firesSent > 0 && (
            <div className="flex items-center gap-3 text-[8px] font-mono">
              <span className="text-muted-foreground/50">AVG:<span className="text-amber-400 font-bold ml-0.5">{session.stats.avgLatency}ms</span></span>
              <span className="text-muted-foreground/50">P95:<span className="text-amber-400 font-bold ml-0.5">{session.stats.p95Latency}ms</span></span>
              <span className="text-muted-foreground/50">LOSS:<span className={cn("font-bold ml-0.5", session.stats.packetLoss > 1 ? 'text-red-400' : 'text-green-400')}>{session.stats.packetLoss}%</span></span>
            </div>
          )}
          <button onClick={onStop} className="text-[8px] font-mono text-muted-foreground/40 hover:text-muted-foreground px-1">
            EXIT
          </button>
        </div>
      </div>

      {/* ═══ Main XL4 Panel ═══ */}
      <div className="flex-1 flex min-h-0">

        {/* Left Control Strip */}
        <div className="w-16 shrink-0 flex flex-col items-center justify-center gap-2 py-2"
          style={{
            background: 'linear-gradient(180deg, hsl(220 18% 7%), hsl(220 18% 5%))',
            borderRight: '1px solid hsl(0 0% 100% / 0.04)',
          }}>
          {/* ARM Key */}
          <button
            onClick={handleArm}
            disabled={!session.peerConnected}
            className={cn(
              "w-12 h-12 rounded-lg font-mono font-black text-[9px] tracking-wider border-2 transition-all active:scale-95",
              session.armed
                ? "bg-amber-600 border-amber-500 text-white shadow-[0_0_20px_hsl(32_100%_50%/0.4)]"
                : "bg-amber-600/10 border-amber-600/30 text-amber-400/60"
            )}
          >
            <Shield className="w-4 h-4 mx-auto mb-0.5" />
            {session.armed ? 'DISARM' : 'ARM'}
          </button>

          {/* E-STOP */}
          <button
            onClick={handleEStop}
            className="w-12 h-12 rounded-lg bg-red-700 hover:bg-red-600 border-2 border-red-500/50 text-white font-mono font-black text-[8px] active:scale-90 transition-all shadow-[0_0_12px_hsl(0_70%_50%/0.3)]"
          >
            <AlertTriangle className="w-4 h-4 mx-auto mb-0.5" />
            E-STOP
          </button>

          {/* Fullscreen */}
          <button
            onClick={() => {
              if (document.fullscreenElement) document.exitFullscreen();
              else document.documentElement.requestFullscreen?.();
            }}
            className="w-8 h-8 rounded-md bg-muted/20 border border-border/20 flex items-center justify-center mt-auto"
          >
            <Maximize className="w-3 h-3 text-muted-foreground/50" />
          </button>
        </div>

        {/* Fire Grid — XL4 Style */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Channel Grid */}
          <div className="flex-1 p-2 overflow-hidden">
            <div className="grid grid-cols-8 grid-rows-4 gap-1 h-full">
              {channels.map(ch => {
                const isFiring = lastFired === ch;
                return (
                  <button
                    key={ch}
                    disabled={!session.armed || !session.peerConnected}
                    onClick={() => handleFire(ch)}
                    className={cn(
                      "relative rounded-md font-mono font-black text-sm transition-all active:scale-90",
                      "border flex flex-col items-center justify-center",
                      session.armed
                        ? isFiring
                          ? "bg-orange-500 border-orange-400 text-white scale-95"
                          : "bg-red-900/40 border-red-700/40 text-red-300 hover:bg-red-800/60 hover:border-red-600/60"
                        : "bg-muted/10 border-border/20 text-muted-foreground/20"
                    )}
                    style={isFiring ? {
                      boxShadow: '0 0 20px hsl(25 100% 50% / 0.6), inset 0 0 10px hsl(25 100% 60% / 0.3)',
                    } : session.armed ? {
                      boxShadow: '0 2px 8px hsl(0 0% 0% / 0.3), inset 0 1px 0 hsl(0 0% 100% / 0.02)',
                    } : undefined}
                  >
                    <span className="text-[10px] opacity-40 leading-none">CH</span>
                    <span className="leading-none">{String(ch).padStart(2, '0')}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bottom Status Strip */}
          <div className="shrink-0 h-6 flex items-center px-3 gap-4 text-[8px] font-mono"
            style={{
              background: 'hsl(220 20% 5%)',
              borderTop: '1px solid hsl(0 0% 100% / 0.03)',
            }}>
            <span className="text-muted-foreground/40">SENT:<span className="text-foreground/60 ml-0.5">{session.stats.firesSent}</span></span>
            <span className="text-muted-foreground/40">ACK:<span className="text-green-400 ml-0.5">{session.stats.acksReceived}</span></span>
            <span className="text-muted-foreground/40">MIN:<span className="text-foreground/60 ml-0.5">{session.stats.minLatency}ms</span></span>
            <span className="text-muted-foreground/40">MAX:<span className="text-foreground/60 ml-0.5">{session.stats.maxLatency}ms</span></span>
          </div>
        </div>

        {/* Right Log Panel */}
        <div className="w-44 shrink-0 flex flex-col"
          style={{
            background: 'hsl(220 18% 5%)',
            borderLeft: '1px solid hsl(0 0% 100% / 0.04)',
          }}>
          <div className="h-5 flex items-center px-2 border-b border-border/10">
            <span className="text-[7px] font-mono font-bold text-muted-foreground/40 tracking-wider">EVENT LOG</span>
          </div>
          <div className="flex-1 overflow-y-auto px-1.5 py-1">
            {session.logs.slice(0, 50).map(l => <LogEntry key={l.id} log={l} />)}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Module Console (with Haptics) ───────────────
function ModuleConsole({ session, onStop }: { session: FieldTestSession; onStop: () => void }) {
  const [lastFireChannel, setLastFireChannel] = useState<number | null>(null);
  const [lastFireLatency, setLastFireLatency] = useState<number | null>(null);
  const [flashActive, setFlashActive] = useState(false);

  // Watch for new fire events and trigger haptics
  useEffect(() => {
    const fireLog = session.logs.find(l => l.type === 'fire' && l.channel !== undefined);
    if (fireLog && fireLog.channel !== undefined) {
      if (lastFireChannel !== fireLog.channel || fireLog.timestamp > (Date.now() - 500)) {
        setLastFireChannel(fireLog.channel);
        setLastFireLatency(fireLog.latencyMs ?? null);
        setFlashActive(true);
        // Trigger haptic feedback on fire receive
        haptics.fire();
        setTimeout(() => setFlashActive(false), 400);
      }
    }
  }, [session.logs.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Haptics on arm/disarm changes
  useEffect(() => {
    if (session.armed) {
      haptics.arm();
    } else {
      haptics.disarm();
    }
  }, [session.armed]);

  return (
    <div className="h-[100dvh] w-screen flex flex-col overflow-hidden"
      style={{ background: 'hsl(220 25% 4%)' }}>

      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 h-10"
        style={{
          background: 'linear-gradient(180deg, hsl(220 20% 8%), hsl(220 20% 5%))',
          borderBottom: '1px solid hsl(0 0% 100% / 0.05)',
        }}>
        <div className="flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-primary" />
          <span className="text-sm font-bold text-foreground font-mono">MÓDULO RECEPTOR</span>
          <Badge variant="outline" className="text-[8px] font-mono">{session.code}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant={session.peerConnected ? 'outline' : 'secondary'}
            className={cn("text-[8px]", session.peerConnected ? 'border-green-500/50 text-green-400' : 'text-muted-foreground')}
          >
            {session.peerConnected ? '● CTRL ONLINE' : '○ AGUARDANDO'}
          </Badge>
          <Button variant="ghost" size="sm" onClick={onStop} className="h-7 px-2 text-xs">
            <XCircle className="w-3 h-3 mr-1" /> Sair
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">

        {/* Armed Status */}
        <div className={cn(
          "w-full max-w-sm rounded-xl border-2 p-6 flex flex-col items-center gap-2 transition-all",
          session.armed
            ? "border-amber-500/50 bg-amber-500/5"
            : "border-border/30 bg-card/30"
        )}>
          <Shield className={cn("w-12 h-12", session.armed ? "text-amber-400" : "text-muted-foreground/30")} />
          <span className={cn("text-xl font-black font-mono tracking-wider",
            session.armed ? "text-amber-400" : "text-muted-foreground/30"
          )}>
            {session.armed ? 'ARMED' : 'DISARMED'}
          </span>
        </div>

        {/* Last Fire Visual — big center display */}
        <div className={cn(
          "w-full max-w-sm rounded-xl border-2 p-8 flex flex-col items-center gap-2 transition-all",
          flashActive
            ? "border-orange-500/80 bg-orange-500/10"
            : lastFireChannel !== null
              ? "border-destructive/30 bg-destructive/5"
              : "border-border/20 bg-card/20"
        )}
        style={flashActive ? {
          boxShadow: '0 0 40px hsl(25 100% 50% / 0.3), inset 0 0 20px hsl(25 100% 50% / 0.1)',
        } : undefined}>
          {lastFireChannel !== null ? (
            <>
              <Flame className={cn("w-10 h-10", flashActive ? "text-orange-400 animate-pulse" : "text-destructive/60")} />
              <span className="text-4xl font-mono font-black text-destructive">
                CH-{String(lastFireChannel).padStart(2, '0')}
              </span>
              {lastFireLatency !== null && (
                <span className="text-sm font-mono text-muted-foreground">{lastFireLatency}ms</span>
              )}
            </>
          ) : (
            <>
              <Activity className="w-8 h-8 text-muted-foreground/20" />
              <span className="text-sm font-mono text-muted-foreground/30">AGUARDANDO DISPARO</span>
            </>
          )}
        </div>

        {/* E-STOP */}
        <Button
          className="w-full max-w-sm h-14 font-bold text-sm bg-destructive hover:bg-destructive/80 text-destructive-foreground"
          onClick={() => { fieldTestEngine.eStop(); haptics.panic(); }}
        >
          <AlertTriangle className="w-5 h-5 mr-1" />
          E-STOP
        </Button>
      </div>

      {/* Bottom Log */}
      <div className="shrink-0 max-h-32 overflow-y-auto px-4 py-2"
        style={{
          background: 'hsl(220 20% 4%)',
          borderTop: '1px solid hsl(0 0% 100% / 0.04)',
        }}>
        {session.logs.slice(0, 20).map(l => <LogEntry key={l.id} log={l} />)}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────
export default function FieldTest() {
  const navigate = useNavigate();
  const [session, setSession] = useState<FieldTestSession | null>(null);

  useEffect(() => {
    const unsub = fieldTestEngine.subscribe(setSession);
    return () => { unsub(); };
  }, []);

  const handleStart = useCallback(async (code: string, role: DeviceRole, transport: TestTransport) => {
    const ok = await fieldTestEngine.start(code, role, transport);
    if (ok) {
      haptics.success();
      toast.success(`Sessão iniciada como ${role.toUpperCase()}`);
    } else {
      toast.error('Falha ao iniciar sessão');
    }
  }, []);

  const handleStop = useCallback(async () => {
    await fieldTestEngine.stop();
    toast.info('Sessão encerrada');
  }, []);

  // Controller in landscape fullscreen XL4 mode
  if (session?.role === 'controller') {
    return <XL4ControllerConsole session={session} onStop={handleStop} />;
  }

  // Module fullscreen
  if (session?.role === 'module') {
    return <ModuleConsole session={session} onStop={handleStop} />;
  }

  return (
    <div className="bg-background min-h-screen">
      {/* Top bar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/30">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <Target className="w-4 h-4 text-destructive" />
        <span className="text-sm font-bold text-foreground">FIELD TEST</span>
      </div>

      {/* Setup */}
      <SetupScreen onStart={handleStart} />
    </div>
  );
}
