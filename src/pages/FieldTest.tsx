import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  Wifi, Globe, Bluetooth, Radio, Zap, Shield, Target,
  ArrowLeft, CheckCircle2, XCircle, Flame, AlertTriangle,
  Activity, Copy, Smartphone, Maximize, Search, Loader2,
  Signal, Battery, Play, Square, FileText, Lightbulb,
  BarChart3, RefreshCw, Download
} from 'lucide-react';
import {
  fieldTestEngine, generateSessionCode,
  type DeviceRole, type TestTransport, type FieldTestSession, type TestLog
} from '@/services/fieldTestService';
import { isWebBluetoothAvailable, type ScannedBLEDevice } from '@/services/bleFieldTransport';
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

// ─── Enhanced BLE Scanner with multi-device list ──
function BLEScanner({ onConnected }: { onConnected: () => void }) {
  const [scanning, setScanning] = useState(false);
  const [devices, setDevices] = useState<ScannedBLEDevice[]>([]);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [connectedId, setConnectedId] = useState<string | null>(null);
  const [cdsStatus, setCdsStatus] = useState<boolean[]>(Array(32).fill(false));
  const [cdsTesting, setCdsTesting] = useState(false);
  const [cdsLastTest, setCdsLastTest] = useState<number | null>(null);
  const [cdsSimMode, setCdsSimMode] = useState(false);
  const bleAvailable = isWebBluetoothAvailable();

  const handleScan = async () => {
    setScanning(true);
    try {
      const device = await fieldTestEngine.bleScan();
      if (device) {
        setDevices(prev => {
          const exists = prev.find(d => d.id === device.id);
          if (exists) return prev.map(d => d.id === device.id ? device : d);
          return [...prev, device];
        });
        toast.success(`Encontrado: ${device.name}`);
      }
    } catch (err: any) {
      if (!err.message?.includes('cancelled')) {
        toast.error(err.message || 'Erro ao escanear');
      }
    }
    setScanning(false);
  };

  const handleConnect = async (device: ScannedBLEDevice) => {
    setConnectingId(device.id);
    try {
      const ok = await fieldTestEngine.bleConnect(device);
      if (ok) {
        setConnectedId(device.id);
        haptics.success();
        toast.success(`Conectado a ${device.name}`);
        onConnected();
      } else {
        toast.error('Falha na conexão GATT');
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro na conexão');
    }
    setConnectingId(null);
  };

  const handleTestCDS = async () => {
    setCdsTesting(true);
    if (cdsSimMode) {
      // Simulation: random channels with staggered reveal
      setTimeout(() => {
        const simulated = Array(32).fill(false).map(() => Math.random() > 0.35);
        setCdsStatus(simulated);
        setCdsLastTest(Date.now());
        setCdsTesting(false);
        const active = simulated.filter(Boolean).length;
        toast.success(`⚡ SIM CDS: ${active}/32 ignitores detectados`);
        haptics.success();
      }, 600);
    } else {
      try {
        await fieldTestEngine.bleTestCDS();
        setTimeout(() => {
          const status = fieldTestEngine.bleCdsStatus;
          setCdsStatus([...status]);
          setCdsLastTest(Date.now());
          setCdsTesting(false);
          const active = status.filter(Boolean).length;
          toast.success(`CDS: ${active}/32 ignitores detectados`);
          haptics.success();
        }, 800);
      } catch (err: any) {
        setCdsTesting(false);
        toast.error(err.message || 'Erro no teste CDS');
      }
    }
  };

  // Auto-update CDS from module status changes
  useEffect(() => {
    if (!connectedId) return;
    const interval = setInterval(() => {
      const status = fieldTestEngine.bleCdsStatus;
      setCdsStatus(prev => {
        const changed = prev.some((v, i) => v !== status[i]);
        return changed ? [...status] : prev;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [connectedId]);

  const getDeviceType = (name: string): { label: string; color: string } => {
    const n = name.toLowerCase();
    if (n.includes('ctrl') || n.includes('controller')) return { label: 'CTRL', color: 'bg-blue-600' };
    if (n.includes('m1') || n.includes('module')) return { label: 'MOD', color: 'bg-amber-600' };
    if (n.includes('relay')) return { label: 'RLY', color: 'bg-purple-600' };
    return { label: 'DEV', color: 'bg-muted' };
  };

  const getRssiStrength = (rssi: number): { bars: number; color: string } => {
    if (rssi > -50) return { bars: 4, color: 'text-green-400' };
    if (rssi > -65) return { bars: 3, color: 'text-green-400' };
    if (rssi > -80) return { bars: 2, color: 'text-amber-400' };
    return { bars: 1, color: 'text-red-400' };
  };

  if (!bleAvailable) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-center">
        <Bluetooth className="w-5 h-5 text-destructive mx-auto mb-1" />
        <p className="text-xs text-destructive font-mono">Web Bluetooth não disponível</p>
        <p className="text-[10px] text-muted-foreground mt-1">Use Chrome/Edge em desktop ou Android</p>
      </div>
    );
  }

  const activeChannels = cdsStatus.filter(Boolean).length;

  return (
    <div className="space-y-3">
      {/* Scan Controls */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          className="flex-1 h-11 gap-2 border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
          onClick={handleScan}
          disabled={scanning}
        >
          {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          {scanning ? 'Escaneando...' : 'Escanear Módulos'}
        </Button>
        {devices.length > 0 && (
          <Button variant="outline" size="icon" className="h-11 w-11 border-purple-500/30 text-purple-400"
            onClick={() => { setDevices([]); setConnectedId(null); }}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Device Count */}
      {devices.length > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
            {devices.length} dispositivo{devices.length > 1 ? 's' : ''} encontrado{devices.length > 1 ? 's' : ''}
          </span>
          <Badge variant="outline" className="text-[8px] h-4 border-purple-500/30 text-purple-400">
            <Bluetooth className="w-2.5 h-2.5 mr-0.5" /> BLE SCAN
          </Badge>
        </div>
      )}

      {/* Device List */}
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {devices.map(device => {
          const isConnected = connectedId === device.id;
          const isConnecting = connectingId === device.id;
          const devType = getDeviceType(device.name);
          const signal = getRssiStrength(device.rssi);

          return (
            <div key={device.id} className={cn(
              "rounded-lg border p-3 flex items-center gap-3 transition-all",
              isConnected
                ? "border-green-500/40 bg-green-500/5"
                : "border-purple-500/20 bg-purple-500/5 hover:border-purple-500/40"
            )}>
              {/* Device Icon & Type */}
              <div className="relative">
                <div className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center",
                  isConnected ? "bg-green-500/20" : "bg-purple-500/20"
                )}>
                  <Bluetooth className={cn("w-5 h-5", isConnected ? "text-green-400" : "text-purple-400")} />
                </div>
                <span className={cn("absolute -bottom-1 -right-1 text-[7px] font-bold px-1 rounded text-white", devType.color)}>
                  {devType.label}
                </span>
              </div>

              {/* Device Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold font-mono text-foreground truncate">{device.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {/* Signal Strength Bars */}
                  <div className="flex items-end gap-[2px] h-3">
                    {[1, 2, 3, 4].map(bar => (
                      <div key={bar} className={cn(
                        "w-[3px] rounded-sm transition-all",
                        bar <= signal.bars ? signal.color.replace('text-', 'bg-') : 'bg-muted-foreground/20'
                      )} style={{ height: `${bar * 25}%` }} />
                    ))}
                  </div>
                  <span className="text-[9px] font-mono text-muted-foreground">{device.rssi}dBm</span>

                  {isConnected && (
                    <Badge className="text-[7px] h-3.5 px-1.5 bg-green-600 text-white">
                      <CheckCircle2 className="w-2 h-2 mr-0.5" /> ONLINE
                    </Badge>
                  )}
                </div>
              </div>

              {/* Connect Button */}
              {!isConnected && (
                <Button
                  size="sm"
                  className="bg-purple-600 hover:bg-purple-500 text-white h-8 px-3 text-xs"
                  onClick={() => handleConnect(device)}
                  disabled={isConnecting || connectedId !== null}
                >
                  {isConnecting ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Conectar'}
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {devices.length === 0 && (
        <p className="text-[9px] text-muted-foreground text-center">
          Pressione "Escanear" para detectar módulos FXK e controladoras BLE próximos
        </p>
      )}

      {/* ─── CDS Continuity Visual Grid ─── */}
      {(connectedId || cdsSimMode) && (
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-black font-mono uppercase tracking-wider text-foreground">
                Continuidade (CDS)
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {/* Sim toggle */}
              <button
                className={cn(
                  "text-[7px] px-1.5 py-0.5 rounded font-mono uppercase border",
                  cdsSimMode
                    ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                    : "text-muted-foreground border-border/30"
                )}
                onClick={() => {
                  setCdsSimMode(!cdsSimMode);
                  if (!cdsSimMode) setCdsStatus(Array(32).fill(false));
                }}
              >
                {cdsSimMode ? '⚡ SIM' : '📡 HW'}
              </button>
              <Badge variant="outline" className={cn(
                "text-[8px] h-4 px-1.5 font-mono",
                activeChannels > 0 ? "border-green-500/40 text-green-400" : "border-muted-foreground/30 text-muted-foreground"
              )}>
                {activeChannels}/32 OK
              </Badge>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-[10px] gap-1 border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                onClick={handleTestCDS}
                disabled={cdsTesting}
              >
                {cdsTesting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                {cdsTesting ? 'Testando...' : 'Testar CDS'}
              </Button>
            </div>
          </div>

          {/* 32-channel grid: 8 columns × 4 rows */}
          <div className="grid grid-cols-8 gap-1">
            {cdsStatus.map((active, idx) => (
              <div
                key={idx}
                className={cn(
                  "relative aspect-square rounded flex flex-col items-center justify-center border transition-all",
                  active
                    ? "bg-green-500/20 border-green-500/50 shadow-[0_0_6px_rgba(34,197,94,0.3)]"
                    : "bg-muted/10 border-border/30"
                )}
              >
                <span className={cn(
                  "text-[9px] font-mono font-bold leading-none",
                  active ? "text-green-400" : "text-muted-foreground/40"
                )}>
                  {String(idx + 1).padStart(2, '0')}
                </span>
                {active && (
                  <div className="w-1.5 h-1.5 rounded-full bg-green-400 mt-0.5 animate-pulse" />
                )}
              </div>
            ))}
          </div>

          {/* CDS Legend */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-green-400" />
                <span className="text-[8px] text-muted-foreground">Ignitor OK</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-muted-foreground/20" />
                <span className="text-[8px] text-muted-foreground">Sem Ignitor</span>
              </div>
            </div>
            {cdsLastTest && (
              <span className="text-[8px] text-muted-foreground font-mono">
                {new Date(cdsLastTest).toLocaleTimeString('pt-BR', { hour12: false })}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Setup Screen ─────────────────────────────────
function SetupScreen({ onStart }: { onStart: (code: string, role: DeviceRole, transport: TestTransport) => void }) {
  const [role, setRole] = useState<DeviceRole | null>(null);
  const [transport, setTransport] = useState<TestTransport | null>(null);
  const [code, setCode] = useState(generateSessionCode());
  const [bleReady, setBleReady] = useState(false);

  const isBLE = transport === 'ble';
  const canStart = role && transport && (isBLE ? bleReady : code.length >= 4);

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

      {/* BLE Scanner */}
      {isBLE && role === 'controller' && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">3. Escanear Módulos BLE</p>
          <BLEScanner onConnected={() => setBleReady(true)} />
        </div>
      )}

      {/* Session Code — non-BLE */}
      {!isBLE && (
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
      )}

      {/* BLE Module role info */}
      {isBLE && role === 'module' && (
        <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-4 text-center">
          <Bluetooth className="w-8 h-8 text-purple-400 mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">
            No modo BLE, o módulo receptor é o <strong>hardware FXK-M1</strong>.
            <br />Para teste phone-to-phone, use Wi-Fi LAN ou Internet WAN.
          </p>
        </div>
      )}

      {/* Start */}
      <Button
        disabled={!canStart}
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

// ─── Diagnostics & Suggestions Panel ──────────────
function DiagnosticsPanel({ session }: { session: FieldTestSession }) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [benchmarkChannels, setBenchmarkChannels] = useState(16);
  const [benchmarkRunning, setBenchmarkRunning] = useState(false);

  useEffect(() => {
    setSuggestions(fieldTestEngine.getSuggestions());
  }, [session.stats.firesSent, session.stats.acksReceived]);

  const handleBenchmark = async () => {
    if (!session.armed) {
      toast.error('Arme o sistema antes do benchmark');
      return;
    }
    setBenchmarkRunning(true);
    haptics.tap();
    await fieldTestEngine.runBenchmark(benchmarkChannels);
    setBenchmarkRunning(false);
    haptics.success();
    toast.success('Benchmark completo!');
  };

  const handleExportReport = () => {
    const report = fieldTestEngine.generateReport();
    navigator.clipboard?.writeText(report);
    toast.success('Relatório copiado para clipboard!');
    haptics.tap();
  };

  return (
    <div className="space-y-3 px-3 pb-3">
      {/* Benchmark */}
      <div className="rounded-lg border border-border/30 bg-card/30 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <BarChart3 className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[10px] font-mono font-bold text-foreground uppercase">Auto Benchmark</span>
          </div>
          <Badge variant="outline" className="text-[8px] h-4 px-1.5 font-mono">
            {benchmarkChannels}ch
          </Badge>
        </div>
        <div className="flex gap-2">
          <div className="flex gap-1">
            {[8, 16, 24, 32].map(n => (
              <button key={n}
                className={cn(
                  "text-[9px] font-mono px-2 py-1 rounded border transition-all",
                  benchmarkChannels === n
                    ? "border-amber-500/50 bg-amber-500/10 text-amber-400"
                    : "border-border/30 text-muted-foreground hover:border-border/60"
                )}
                onClick={() => setBenchmarkChannels(n)}
              >{n}ch</button>
            ))}
          </div>
          <Button
            size="sm"
            className={cn("h-7 px-3 text-[10px] font-mono gap-1", benchmarkRunning ? "bg-red-600" : "bg-amber-600 hover:bg-amber-500")}
            onClick={benchmarkRunning ? () => fieldTestEngine.stopBenchmark() : handleBenchmark}
            disabled={!session.armed && !benchmarkRunning}
          >
            {benchmarkRunning ? <><Square className="w-3 h-3" /> PARAR</> : <><Play className="w-3 h-3" /> RUN</>}
          </Button>
        </div>
        {benchmarkRunning && (
          <Progress value={(session.stats.firesSent / benchmarkChannels) * 100} className="h-1.5" />
        )}
      </div>

      {/* Stats Summary */}
      {session.stats.firesSent > 0 && (
        <div className="rounded-lg border border-border/30 bg-card/30 p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Activity className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-[10px] font-mono font-bold text-foreground uppercase">Métricas de Rede</span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'AVG', value: `${session.stats.avgLatency}ms`, color: 'text-amber-400' },
              { label: 'P95', value: `${session.stats.p95Latency}ms`, color: 'text-amber-400' },
              { label: 'MIN', value: `${session.stats.minLatency}ms`, color: 'text-green-400' },
              { label: 'MAX', value: `${session.stats.maxLatency}ms`, color: 'text-red-400' },
            ].map(m => (
              <div key={m.label} className="text-center">
                <div className={cn("text-sm font-mono font-black", m.color)}>{m.value}</div>
                <div className="text-[8px] font-mono text-muted-foreground">{m.label}</div>
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2 pt-2 border-t border-border/20">
            <span className="text-[9px] font-mono text-muted-foreground">
              FIRE: <span className="text-foreground">{session.stats.firesSent}</span> · ACK: <span className="text-green-400">{session.stats.acksReceived}</span>
            </span>
            <span className={cn("text-[9px] font-mono font-bold", session.stats.packetLoss > 1 ? 'text-red-400' : 'text-green-400')}>
              LOSS: {session.stats.packetLoss}%
            </span>
          </div>
        </div>
      )}

      {/* Smart Suggestions */}
      {suggestions.length > 0 && (
        <div className="rounded-lg border border-border/30 bg-card/30 p-3 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[10px] font-mono font-bold text-foreground uppercase">Recomendações</span>
          </div>
          {suggestions.map((tip, i) => (
            <div key={i} className="text-[10px] font-mono text-muted-foreground leading-relaxed pl-1 border-l-2 border-amber-500/20 ml-1">
              {tip}
            </div>
          ))}
        </div>
      )}

      {/* Export Report */}
      {session.stats.firesSent > 0 && (
        <Button
          variant="outline"
          className="w-full h-9 gap-2 text-xs font-mono border-border/30"
          onClick={handleExportReport}
        >
          <FileText className="w-3.5 h-3.5" />
          Copiar Relatório de Teste
        </Button>
      )}
    </div>
  );
}

// ─── FireOne XL4 Landscape Controller Console ─────
function XL4ControllerConsole({ session, onStop }: { session: FieldTestSession; onStop: () => void }) {
  const channels = Array.from({ length: 32 }, (_, i) => i + 1);
  const [lastFired, setLastFired] = useState<number | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);

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
          {session.transport === 'ble' && (
            <Badge variant="outline" className="text-[7px] h-4 px-1.5 font-mono border-purple-500/30 text-purple-400">
              <Bluetooth className="w-2.5 h-2.5 mr-0.5" /> GATT
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {session.stats.firesSent > 0 && (
            <div className="flex items-center gap-3 text-[8px] font-mono">
              <span className="text-muted-foreground/50">AVG:<span className="text-amber-400 font-bold ml-0.5">{session.stats.avgLatency}ms</span></span>
              <span className="text-muted-foreground/50">P95:<span className="text-amber-400 font-bold ml-0.5">{session.stats.p95Latency}ms</span></span>
              <span className="text-muted-foreground/50">LOSS:<span className={cn("font-bold ml-0.5", session.stats.packetLoss > 1 ? 'text-red-400' : 'text-green-400')}>{session.stats.packetLoss}%</span></span>
            </div>
          )}
          <button onClick={() => setShowDiagnostics(!showDiagnostics)}
            className={cn("text-[8px] font-mono px-1.5 py-0.5 rounded", showDiagnostics ? "bg-amber-500/20 text-amber-400" : "text-muted-foreground/40 hover:text-muted-foreground")}>
            <BarChart3 className="w-3 h-3" />
          </button>
          <button onClick={onStop} className="text-[8px] font-mono text-muted-foreground/40 hover:text-muted-foreground px-1">
            EXIT
          </button>
        </div>
      </div>

      {/* Diagnostics Drawer */}
      {showDiagnostics && (
        <div className="shrink-0 max-h-64 overflow-y-auto" style={{ background: 'hsl(220 20% 5%)', borderBottom: '1px solid hsl(0 0% 100% / 0.05)' }}>
          <DiagnosticsPanel session={session} />
        </div>
      )}

      {/* ═══ Main XL4 Panel ═══ */}
      <div className="flex-1 flex min-h-0">

        {/* Left Control Strip */}
        <div className="w-16 shrink-0 flex flex-col items-center justify-center gap-2 py-2"
          style={{
            background: 'linear-gradient(180deg, hsl(220 18% 7%), hsl(220 18% 5%))',
            borderRight: '1px solid hsl(0 0% 100% / 0.04)',
          }}>
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

          <button
            onClick={handleEStop}
            className="w-12 h-12 rounded-lg bg-red-700 hover:bg-red-600 border-2 border-red-500/50 text-white font-mono font-black text-[8px] active:scale-90 transition-all shadow-[0_0_12px_hsl(0_70%_50%/0.3)]"
          >
            <AlertTriangle className="w-4 h-4 mx-auto mb-0.5" />
            E-STOP
          </button>

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

        {/* Fire Grid */}
        <div className="flex-1 flex flex-col min-w-0">
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

  useEffect(() => {
    const fireLog = session.logs.find(l => l.type === 'fire' && l.channel !== undefined);
    if (fireLog && fireLog.channel !== undefined) {
      if (lastFireChannel !== fireLog.channel || fireLog.timestamp > (Date.now() - 500)) {
        setLastFireChannel(fireLog.channel);
        setLastFireLatency(fireLog.latencyMs ?? null);
        setFlashActive(true);
        haptics.fire();
        setTimeout(() => setFlashActive(false), 400);
      }
    }
  }, [session.logs.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (session.armed) haptics.arm();
    else haptics.disarm();
  }, [session.armed]);

  return (
    <div className="h-[100dvh] w-screen flex flex-col overflow-hidden"
      style={{ background: 'hsl(220 25% 4%)' }}>

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

      <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
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

        <Button
          className="w-full max-w-sm h-14 font-bold text-sm bg-destructive hover:bg-destructive/80 text-destructive-foreground"
          onClick={() => { fieldTestEngine.eStop(); haptics.panic(); }}
        >
          <AlertTriangle className="w-5 h-5 mr-1" />
          E-STOP
        </Button>
      </div>

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

  if (session?.role === 'controller') {
    return <XL4ControllerConsole session={session} onStop={handleStop} />;
  }

  if (session?.role === 'module') {
    return <ModuleConsole session={session} onStop={handleStop} />;
  }

  return (
    <div className="bg-background min-h-screen">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/30">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <Target className="w-4 h-4 text-destructive" />
        <span className="text-sm font-bold text-foreground">FIELD TEST</span>
      </div>
      <SetupScreen onStart={handleStart} />
    </div>
  );
}
