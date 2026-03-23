import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Wifi, Globe, Bluetooth, Radio, Zap, Shield, Target,
  ArrowLeft, CheckCircle2, XCircle, Flame, AlertTriangle,
  Activity, Copy, Smartphone
} from 'lucide-react';
import {
  fieldTestEngine, generateSessionCode,
  type DeviceRole, type TestTransport, type FieldTestSession, type TestLog
} from '@/services/fieldTestService';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

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
            onClick={() => setRole('controller')}
          >
            <Radio className="w-6 h-6" />
            <span className="text-xs font-bold">CONTROLADORA</span>
            <span className="text-[10px] text-muted-foreground">Envia disparos</span>
          </Button>
          <Button
            variant={role === 'module' ? 'default' : 'outline'}
            className={`h-20 flex-col gap-1 ${role === 'module' ? 'ring-2 ring-primary' : ''}`}
            onClick={() => setRole('module')}
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
              onClick={() => setTransport(t.id)}
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

// ─── Controller Console ───────────────────────────
function ControllerConsole({ session, onStop }: { session: FieldTestSession; onStop: () => void }) {
  const channels = Array.from({ length: 16 }, (_, i) => i + 1);

  return (
    <div className="space-y-3 p-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-primary" />
          <span className="text-sm font-bold text-foreground">CONTROLADORA</span>
          <Badge variant="outline" className="text-[9px]">{session.code}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant={session.peerConnected ? 'outline' : 'secondary'}
            className={`text-[9px] ${session.peerConnected ? 'border-green-500/50 text-green-400' : 'text-muted-foreground'}`}
          >
            {session.peerConnected ? '● MÓDULO ONLINE' : '○ AGUARDANDO'}
          </Badge>
          <Button variant="ghost" size="sm" onClick={onStop} className="h-6 px-2 text-xs">
            <XCircle className="w-3 h-3 mr-1" /> Sair
          </Button>
        </div>
      </div>

      {/* ARM / DISARM / E-STOP */}
      <div className="grid grid-cols-3 gap-2">
        <Button
          className={`h-14 font-bold text-sm ${session.armed
            ? 'bg-amber-600 hover:bg-amber-700 text-white'
            : 'bg-amber-600/20 hover:bg-amber-600/40 text-amber-400 border border-amber-600/50'
          }`}
          onClick={() => session.armed ? fieldTestEngine.disarm() : fieldTestEngine.arm()}
          disabled={!session.peerConnected}
        >
          <Shield className="w-5 h-5 mr-1" />
          {session.armed ? 'DISARM' : 'ARM'}
        </Button>
        <Button
          className="h-14 font-bold text-sm bg-destructive hover:bg-destructive/80 text-destructive-foreground col-span-2"
          onClick={() => fieldTestEngine.eStop()}
        >
          <AlertTriangle className="w-5 h-5 mr-1" />
          E-STOP
        </Button>
      </div>

      {/* Fire Grid */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader className="py-2 px-3">
          <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
            <Flame className="w-3 h-3" /> CANAIS DE DISPARO
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3">
          <div className="grid grid-cols-4 gap-2">
            {channels.map(ch => (
              <Button
                key={ch}
                disabled={!session.armed || !session.peerConnected}
                className={`h-12 font-mono font-bold text-sm ${
                  session.armed
                    ? 'bg-destructive/80 hover:bg-destructive text-destructive-foreground active:scale-95'
                    : 'bg-muted text-muted-foreground'
                } transition-transform`}
                onClick={() => fieldTestEngine.fire(ch)}
              >
                {String(ch).padStart(2, '0')}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      {session.stats.firesSent > 0 && (
        <Card className="bg-card/50 border-border/50">
          <CardHeader className="py-2 px-3">
            <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
              <Activity className="w-3 h-3" /> ESTATÍSTICAS
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs font-mono">
            <div className="flex justify-between"><span className="text-muted-foreground">Enviados</span><span className="font-bold">{session.stats.firesSent}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">ACKs</span><span className="font-bold text-green-400">{session.stats.acksReceived}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Latência Avg</span><span className="font-bold">{session.stats.avgLatency}ms</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Min</span><span className="font-bold">{session.stats.minLatency}ms</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Max</span><span className="font-bold">{session.stats.maxLatency}ms</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">P95</span><span className="font-bold">{session.stats.p95Latency}ms</span></div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Packet Loss</span>
              <span className={`font-bold ${session.stats.packetLoss > 1 ? 'text-destructive' : 'text-green-400'}`}>
                {session.stats.packetLoss}%
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Log */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader className="py-2 px-3">
          <CardTitle className="text-xs text-muted-foreground">LOG</CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3 max-h-48 overflow-y-auto">
          {session.logs.map(l => <LogEntry key={l.id} log={l} />)}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Module Console ───────────────────────────────
function ModuleConsole({ session, onStop }: { session: FieldTestSession; onStop: () => void }) {
  // Find last fire received
  const lastFire = session.logs.find(l => l.type === 'fire' && l.channel !== undefined);

  return (
    <div className="space-y-3 p-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-primary" />
          <span className="text-sm font-bold text-foreground">MÓDULO RECEPTOR</span>
          <Badge variant="outline" className="text-[9px]">{session.code}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant={session.peerConnected ? 'outline' : 'secondary'}
            className={`text-[9px] ${session.peerConnected ? 'border-green-500/50 text-green-400' : 'text-muted-foreground'}`}
          >
            {session.peerConnected ? '● CTRL ONLINE' : '○ AGUARDANDO'}
          </Badge>
          <Button variant="ghost" size="sm" onClick={onStop} className="h-6 px-2 text-xs">
            <XCircle className="w-3 h-3 mr-1" /> Sair
          </Button>
        </div>
      </div>

      {/* Status */}
      <Card className={`border-2 transition-colors ${
        session.armed ? 'border-amber-500/50 bg-amber-500/5' : 'border-border/50 bg-card/50'
      }`}>
        <CardContent className="py-6 flex flex-col items-center gap-2">
          <Shield className={`w-10 h-10 ${session.armed ? 'text-amber-400' : 'text-muted-foreground'}`} />
          <span className={`text-lg font-bold ${session.armed ? 'text-amber-400' : 'text-muted-foreground'}`}>
            {session.armed ? 'ARMED' : 'DISARMED'}
          </span>
        </CardContent>
      </Card>

      {/* Last Fire Visual */}
      {lastFire && (
        <Card className="border-destructive/50 bg-destructive/5 animate-pulse">
          <CardContent className="py-4 flex flex-col items-center gap-1">
            <Flame className="w-8 h-8 text-destructive" />
            <span className="text-2xl font-mono font-bold text-destructive">
              CH-{String(lastFire.channel).padStart(2, '0')}
            </span>
            {lastFire.latencyMs !== undefined && (
              <span className="text-sm font-mono text-muted-foreground">{lastFire.latencyMs}ms</span>
            )}
          </CardContent>
        </Card>
      )}

      {/* E-STOP */}
      <Button
        className="w-full h-14 font-bold text-sm bg-destructive hover:bg-destructive/80 text-destructive-foreground"
        onClick={() => fieldTestEngine.eStop()}
      >
        <AlertTriangle className="w-5 h-5 mr-1" />
        E-STOP
      </Button>

      {/* Log */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader className="py-2 px-3">
          <CardTitle className="text-xs text-muted-foreground">LOG</CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3 max-h-60 overflow-y-auto">
          {session.logs.map(l => <LogEntry key={l.id} log={l} />)}
        </CardContent>
      </Card>
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
    if (ok) toast.success(`Sessão iniciada como ${role.toUpperCase()}`);
    else toast.error('Falha ao iniciar sessão');
  }, []);

  const handleStop = useCallback(async () => {
    await fieldTestEngine.stop();
    toast.info('Sessão encerrada');
  }, []);

  return (
    <div className="bg-background min-h-screen">
      {/* Top bar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/30">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <Target className="w-4 h-4 text-destructive" />
        <span className="text-sm font-bold text-foreground">FIELD TEST</span>
        {session?.connected && (
          <Badge variant="outline" className="ml-auto text-[9px] border-green-500/50 text-green-400">
            <CheckCircle2 className="w-3 h-3 mr-1" /> CONNECTED
          </Badge>
        )}
      </div>

      {/* Content */}
      {!session ? (
        <SetupScreen onStart={handleStart} />
      ) : session.role === 'controller' ? (
        <ControllerConsole session={session} onStop={handleStop} />
      ) : (
        <ModuleConsole session={session} onStop={handleStop} />
      )}
    </div>
  );
}
