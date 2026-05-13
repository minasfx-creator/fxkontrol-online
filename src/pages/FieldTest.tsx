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

// ─── Module Scanner Types ─────────────────────────
interface DiscoveredModule {
  id: string;
  name: string;
  moduleNumber: number;
  rssi: number;
  channels: number;
  status: 'online' | 'armed' | 'offline';
  lastSeen: number;
}

// ─── Module Scanner Panel ─────────────────────────
function ModuleScannerPanel({
  modules,
  scanning,
  selectedModuleId,
  onScan,
  onSelect,
}: {
  modules: DiscoveredModule[];
  scanning: boolean;
  selectedModuleId: string | null;
  onScan: () => void;
  onSelect: (mod: DiscoveredModule) => void;
}) {
  const getRssi = (rssi: number) => {
    if (rssi > -50) return { bars: 4, color: 'text-green-400' };
    if (rssi > -65) return { bars: 3, color: 'text-green-400' };
    if (rssi > -80) return { bars: 2, color: 'text-amber-400' };
    return { bars: 1, color: 'text-red-400' };
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-2 py-1.5"
        style={{ borderBottom: '1px solid hsl(0 0% 100% / 0.05)' }}>
        <div className="flex items-center gap-1.5">
          <Search className="w-3 h-3 text-purple-400" />
          <span className="text-[8px] font-mono font-bold text-muted-foreground/60 tracking-wider uppercase">Module Scanner</span>
        </div>
        <button
          onClick={onScan}
          disabled={scanning}
          className={cn(
            "flex items-center gap-1 px-2 py-0.5 rounded text-[8px] font-mono font-bold transition-all",
            scanning
              ? "bg-purple-500/20 text-purple-400"
              : "bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 active:scale-95"
          )}
        >
          {scanning ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Search className="w-2.5 h-2.5" />}
          {scanning ? 'SCAN...' : 'SCAN'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-1.5 py-1 space-y-1">
        {modules.length === 0 && !scanning && (
          <div className="flex flex-col items-center justify-center h-full text-center px-2">
            <Radio className="w-6 h-6 text-muted-foreground/20 mb-1" />
            <p className="text-[8px] font-mono text-muted-foreground/30">
              Pressione SCAN para detectar módulos na rede
            </p>
          </div>
        )}

        {scanning && modules.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full">
            <Loader2 className="w-5 h-5 text-purple-400 animate-spin mb-1" />
            <p className="text-[8px] font-mono text-purple-400/60">Escaneando...</p>
          </div>
        )}

        {modules.map(mod => {
          const isSelected = selectedModuleId === mod.id;
          const signal = getRssi(mod.rssi);
          return (
            <button
              key={mod.id}
              onClick={() => onSelect(mod)}
              className={cn(
                "w-full rounded-md border p-2 flex items-center gap-2 transition-all text-left active:scale-[0.97]",
                isSelected
                  ? "border-primary/50 bg-primary/10 ring-1 ring-primary/30"
                  : "border-border/20 bg-muted/5 hover:border-border/40"
              )}
            >
              {/* Module icon */}
              <div className={cn(
                "w-8 h-8 rounded flex items-center justify-center shrink-0",
                isSelected ? "bg-primary/20" : "bg-muted/10"
              )}>
                <span className={cn("text-[10px] font-mono font-black", isSelected ? "text-primary" : "text-muted-foreground/50")}>
                  {String(mod.moduleNumber).padStart(2, '0')}
                </span>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <span className="text-[9px] font-mono font-bold text-foreground/80 truncate">{mod.name}</span>
                  <div className={cn(
                    "w-1.5 h-1.5 rounded-full shrink-0",
                    mod.status === 'armed' ? "bg-amber-400" : mod.status === 'online' ? "bg-green-400" : "bg-red-400"
                  )} />
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {/* RSSI bars */}
                  <div className="flex items-end gap-[1px] h-2">
                    {[1, 2, 3, 4].map(bar => (
                      <div key={bar} className={cn(
                        "w-[2px] rounded-sm",
                        bar <= signal.bars ? signal.color.replace('text-', 'bg-') : 'bg-muted-foreground/10'
                      )} style={{ height: `${bar * 25}%` }} />
                    ))}
                  </div>
                  <span className="text-[7px] font-mono text-muted-foreground/40">{mod.channels}ch</span>
                </div>
              </div>

              {isSelected && (
                <CheckCircle2 className="w-3 h-3 text-primary shrink-0" />
              )}
            </button>
          );
        })}
      </div>

      {modules.length > 0 && (
        <div className="px-2 py-1 text-[7px] font-mono text-muted-foreground/30 text-center"
          style={{ borderTop: '1px solid hsl(0 0% 100% / 0.03)' }}>
          {modules.length} módulo{modules.length > 1 ? 's' : ''} · Toque para selecionar
        </div>
      )}
    </div>
  );
}

// ─── FireOne XL4 Landscape Controller Console ─────
function XL4ControllerConsole({ session, onStop }: { session: FieldTestSession; onStop: () => void }) {
  const channels = Array.from({ length: 32 }, (_, i) => i + 1);
  const [lastFired, setLastFired] = useState<number | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [showScanner, setShowScanner] = useState(true);
  const [scanningModules, setScanningModules] = useState(false);
  const [discoveredModules, setDiscoveredModules] = useState<DiscoveredModule[]>([]);
  const [selectedModule, setSelectedModule] = useState<DiscoveredModule | null>(null);
  const [channelResults, setChannelResults] = useState<Record<number, { status: 'idle' | 'fired' | 'ack'; latencyMs?: number }>>(
    Object.fromEntries(channels.map(ch => [ch, { status: 'idle' as const }]))
  );
  const [fireAllRunning, setFireAllRunning] = useState(false);

  // Simulate module scan (BLE or Realtime discovery)
  const handleScanModules = useCallback(async () => {
    setScanningModules(true);
    haptics.tap();

    if (session.transport === 'ble') {
      try {
        const device = await fieldTestEngine.bleScan();
        if (device) {
          const mod: DiscoveredModule = {
            id: device.id,
            name: device.name,
            moduleNumber: discoveredModules.length + 1,
            rssi: device.rssi,
            channels: 32,
            status: 'online',
            lastSeen: Date.now(),
          };
          setDiscoveredModules(prev => {
            const exists = prev.find(m => m.id === mod.id);
            if (exists) return prev.map(m => m.id === mod.id ? mod : m);
            return [...prev, mod];
          });
          toast.success(`Módulo encontrado: ${device.name}`);
        }
      } catch (e: any) {
        if (!e.message?.includes('cancelled')) toast.error(e.message);
      }
    } else {
      // Realtime: simulate discovery via session peer presence
      await new Promise(r => setTimeout(r, 800));
      if (session.peerConnected) {
        const mod: DiscoveredModule = {
          id: `rt-${session.code}-${Date.now()}`,
          name: `FXK-M1 [${session.code}]`,
          moduleNumber: discoveredModules.length + 1,
          rssi: session.transport === 'realtime-lan' ? -45 : -72,
          channels: 32,
          status: 'online',
          lastSeen: Date.now(),
        };
        setDiscoveredModules(prev => {
          const hasPeer = prev.some(m => m.name.includes(session.code));
          if (hasPeer) return prev;
          return [...prev, mod];
        });
        toast.success('Módulo peer detectado');
      } else {
        toast.info('Nenhum módulo online — aguardando peer');
      }
    }
    setScanningModules(false);
  }, [session, discoveredModules.length]);

  // Auto-scan on mount if peer connected
  useEffect(() => {
    if (session.peerConnected && discoveredModules.length === 0) {
      handleScanModules();
    }
  }, [session.peerConnected]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectModule = useCallback((mod: DiscoveredModule) => {
    setSelectedModule(mod);
    haptics.select();
    setChannelResults(Object.fromEntries(channels.map(ch => [ch, { status: 'idle' as const }])));
    toast.success(`Módulo ${String(mod.moduleNumber).padStart(2, '0')} selecionado`);
  }, [channels]);

  const handleFire = useCallback((ch: number) => {
    if (!selectedModule) {
      toast.error('Selecione um módulo primeiro');
      return;
    }
    fieldTestEngine.fire(ch);
    haptics.fire();
    setLastFired(ch);
    setChannelResults(prev => ({ ...prev, [ch]: { status: 'fired' } }));
    setTimeout(() => setLastFired(null), 300);
  }, [selectedModule]);

  // Track ACKs from session logs
  useEffect(() => {
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
  }, [session.stats.acksReceived]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleArm = useCallback(() => {
    if (session.armed) { fieldTestEngine.disarm(); haptics.disarm(); }
    else { fieldTestEngine.arm(); haptics.arm(); }
  }, [session.armed]);

  const handleEStop = useCallback(() => {
    fieldTestEngine.eStop();
    haptics.panic();
  }, []);

  // Fire All Channels sequentially
  const handleFireAll = useCallback(async () => {
    if (!selectedModule || !session.armed) return;
    setFireAllRunning(true);
    haptics.tap();
    for (let ch = 1; ch <= 32; ch++) {
      if (!session.armed) break;
      await fieldTestEngine.fire(ch);
      setChannelResults(prev => ({ ...prev, [ch]: { status: 'fired' } }));
      await new Promise(r => setTimeout(r, 500));
    }
    setFireAllRunning(false);
    haptics.success();
    toast.success('Sequência completa — todos os canais disparados');
  }, [selectedModule, session.armed]);

  const handleResetChannels = useCallback(() => {
    setChannelResults(Object.fromEntries(channels.map(ch => [ch, { status: 'idle' as const }])));
    toast.success('Canais resetados');
  }, [channels]);

  const firedCount = Object.values(channelResults).filter(r => r.status !== 'idle').length;
  const ackCount = Object.values(channelResults).filter(r => r.status === 'ack').length;

  return (
    <div className="h-[100dvh] w-screen flex flex-col overflow-hidden"
      style={{ background: 'hsl(220 25% 4%)' }}>

      {/* ═══ XL4 Top Bar ═══ */}
      <div className="shrink-0 flex items-center justify-between px-3 h-9"
        style={{
          background: 'linear-gradient(180deg, hsl(220 20% 10%), hsl(220 20% 6%))',
          borderBottom: '1px solid hsl(0 0% 100% / 0.05)',
        }}>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <div className={cn("w-2 h-2 rounded-full", session.peerConnected ? "bg-green-500" : "bg-red-500")}
              style={{ boxShadow: session.peerConnected ? '0 0 6px hsl(120 70% 50%)' : '0 0 6px hsl(0 70% 50%)' }} />
            <span className="text-[8px] font-mono font-bold text-muted-foreground/60">
              {session.peerConnected ? 'PEER ONLINE' : 'WAITING'}
            </span>
          </div>
          <Badge variant="outline" className="text-[7px] h-4 px-1.5 font-mono border-amber-500/30 text-amber-400">
            {session.code}
          </Badge>
          <Badge variant="outline" className="text-[7px] h-4 px-1.5 font-mono border-blue-500/30 text-blue-400">
            {session.transport.toUpperCase()}
          </Badge>
          {selectedModule && (
            <Badge variant="outline" className="text-[7px] h-4 px-1.5 font-mono border-primary/30 text-primary">
              MOD {String(selectedModule.moduleNumber).padStart(2, '0')} · {selectedModule.name}
            </Badge>
          )}
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
              <span className="text-muted-foreground/50">LOSS:<span className={cn("font-bold ml-0.5", session.stats.packetLoss > 1 ? 'text-red-400' : 'text-green-400')}>{session.stats.packetLoss}%</span></span>
            </div>
          )}
          <button onClick={() => setShowScanner(!showScanner)}
            className={cn("text-[8px] font-mono px-1.5 py-0.5 rounded", showScanner ? "bg-purple-500/20 text-purple-400" : "text-muted-foreground/40 hover:text-muted-foreground")}>
            <Search className="w-3 h-3" />
          </button>
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

      {/* ═══ Main Panel ═══ */}
      <div className="flex-1 flex min-h-0">

        {/* Left Control Strip */}
        <div className="w-14 shrink-0 flex flex-col items-center justify-center gap-2 py-2"
          style={{
            background: 'linear-gradient(180deg, hsl(220 18% 7%), hsl(220 18% 5%))',
            borderRight: '1px solid hsl(0 0% 100% / 0.04)',
          }}>
          <button
            onClick={handleArm}
            disabled={!selectedModule}
            className={cn(
              "w-11 h-11 rounded-lg font-mono font-black text-[8px] tracking-wider border-2 transition-all active:scale-95",
              session.armed
                ? "bg-amber-600 border-amber-500 text-white shadow-[0_0_20px_hsl(32_100%_50%/0.4)]"
                : "bg-amber-600/10 border-amber-600/30 text-amber-400/60"
            )}
          >
            <Shield className="w-3.5 h-3.5 mx-auto mb-0.5" />
            {session.armed ? 'DISARM' : 'ARM'}
          </button>

          <button
            onClick={handleEStop}
            className="w-11 h-11 rounded-lg bg-red-700 hover:bg-red-600 border-2 border-red-500/50 text-white font-mono font-black text-[7px] active:scale-90 transition-all shadow-[0_0_12px_hsl(0_70%_50%/0.3)]"
          >
            <AlertTriangle className="w-3.5 h-3.5 mx-auto mb-0.5" />
            E-STOP
          </button>

          {/* Fire All */}
          <button
            onClick={fireAllRunning ? () => setFireAllRunning(false) : handleFireAll}
            disabled={!session.armed || !selectedModule}
            className={cn(
              "w-11 h-11 rounded-lg font-mono font-black text-[7px] border-2 transition-all active:scale-95",
              fireAllRunning
                ? "bg-orange-600 border-orange-500 text-white animate-pulse"
                : session.armed && selectedModule
                  ? "bg-orange-600/20 border-orange-500/30 text-orange-400 hover:bg-orange-600/40"
                  : "bg-muted/5 border-border/15 text-muted-foreground/20"
            )}
          >
            {fireAllRunning ? <Square className="w-3 h-3 mx-auto mb-0.5" /> : <Zap className="w-3.5 h-3.5 mx-auto mb-0.5" />}
            {fireAllRunning ? 'STOP' : 'ALL'}
          </button>

          <button onClick={handleResetChannels}
            className="w-8 h-8 rounded-md bg-muted/10 border border-border/15 flex items-center justify-center mt-auto">
            <RefreshCw className="w-3 h-3 text-muted-foreground/40" />
          </button>

          <button
            onClick={() => {
              if (document.fullscreenElement) document.exitFullscreen();
              else document.documentElement.requestFullscreen?.();
            }}
            className="w-8 h-8 rounded-md bg-muted/10 border border-border/15 flex items-center justify-center"
          >
            <Maximize className="w-3 h-3 text-muted-foreground/40" />
          </button>
        </div>

        {/* Fire Grid — Center */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Module target indicator */}
          {selectedModule ? (
            <div className="shrink-0 flex items-center justify-between px-3 py-1"
              style={{ background: 'hsl(220 20% 6%)', borderBottom: '1px solid hsl(0 0% 100% / 0.04)' }}>
              <div className="flex items-center gap-2">
                <Target className="w-3 h-3 text-primary" />
                <span className="text-[9px] font-mono font-bold text-foreground/80">
                  MOD {String(selectedModule.moduleNumber).padStart(2, '0')}
                </span>
                <span className="text-[8px] font-mono text-muted-foreground/40">
                  ADDR 0x{(selectedModule.moduleNumber - 1).toString(16).toUpperCase().padStart(2, '0')}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[8px] font-mono text-muted-foreground/40">
                  <span className="text-amber-400">{firedCount}</span> FIRE · <span className="text-green-400">{ackCount}</span> ACK
                </span>
                <Progress value={(ackCount / 32) * 100} className="h-1 w-16" />
              </div>
            </div>
          ) : (
            <div className="shrink-0 flex items-center justify-center px-3 py-2"
              style={{ background: 'hsl(220 20% 6%)', borderBottom: '1px solid hsl(0 0% 100% / 0.04)' }}>
              <span className="text-[9px] font-mono text-muted-foreground/30">
                ← Escaneie e selecione um módulo para disparar
              </span>
            </div>
          )}

          <div className="flex-1 p-2 overflow-hidden">
            <div className="grid grid-cols-8 grid-rows-4 gap-1 h-full">
              {channels.map(ch => {
                const result = channelResults[ch];
                const isFiring = lastFired === ch;
                const isAck = result.status === 'ack';
                const isFired = result.status === 'fired';
                return (
                  <button
                    key={ch}
                    disabled={!session.armed || !selectedModule}
                    onClick={() => handleFire(ch)}
                    className={cn(
                      "relative rounded-md font-mono font-black text-sm transition-all active:scale-90",
                      "border flex flex-col items-center justify-center",
                      isFiring
                        ? "bg-orange-500 border-orange-400 text-white scale-95"
                        : isAck
                          ? "bg-green-900/30 border-green-600/40 text-green-300"
                          : isFired
                            ? "bg-orange-900/20 border-orange-700/30 text-orange-300 animate-pulse"
                            : session.armed && selectedModule
                              ? "bg-red-900/40 border-red-700/40 text-red-300 hover:bg-red-800/60 hover:border-red-600/60"
                              : "bg-muted/10 border-border/20 text-muted-foreground/20"
                    )}
                    style={isFiring ? {
                      boxShadow: '0 0 20px hsl(25 100% 50% / 0.6), inset 0 0 10px hsl(25 100% 60% / 0.3)',
                    } : isAck ? {
                      boxShadow: '0 0 8px hsl(120 70% 40% / 0.2)',
                    } : session.armed && selectedModule ? {
                      boxShadow: '0 2px 8px hsl(0 0% 0% / 0.3), inset 0 1px 0 hsl(0 0% 100% / 0.02)',
                    } : undefined}
                  >
                    <span className="text-[10px] opacity-40 leading-none">CH</span>
                    <span className="leading-none">{String(ch).padStart(2, '0')}</span>
                    {/* ACK latency badge */}
                    {isAck && result.latencyMs !== undefined && (
                      <span className="absolute -top-1 -right-1 text-[6px] font-mono bg-green-600 text-white px-1 rounded-full leading-tight">
                        {result.latencyMs}ms
                      </span>
                    )}
                    {/* ACK check */}
                    {isAck && (
                      <CheckCircle2 className="absolute bottom-0.5 right-0.5 w-2.5 h-2.5 text-green-400" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bottom Status */}
          <div className="shrink-0 h-6 flex items-center px-3 gap-4 text-[8px] font-mono"
            style={{
              background: 'hsl(220 20% 5%)',
              borderTop: '1px solid hsl(0 0% 100% / 0.03)',
            }}>
            <span className="text-muted-foreground/40">SENT:<span className="text-foreground/60 ml-0.5">{session.stats.firesSent}</span></span>
            <span className="text-muted-foreground/40">ACK:<span className="text-green-400 ml-0.5">{session.stats.acksReceived}</span></span>
            <span className="text-muted-foreground/40">MIN:<span className="text-foreground/60 ml-0.5">{session.stats.minLatency}ms</span></span>
            <span className="text-muted-foreground/40">MAX:<span className="text-foreground/60 ml-0.5">{session.stats.maxLatency}ms</span></span>
            {selectedModule && (
              <span className="text-muted-foreground/40 ml-auto">
                TARGET: <span className="text-primary">{selectedModule.name}</span>
              </span>
            )}
          </div>
        </div>

        {/* Right Panel: Scanner or Log */}
        <div className={cn("shrink-0 flex flex-col", showScanner ? "w-48" : "w-40")}
          style={{
            background: 'hsl(220 18% 5%)',
            borderLeft: '1px solid hsl(0 0% 100% / 0.04)',
          }}>
          {showScanner ? (
            <ModuleScannerPanel
              modules={discoveredModules}
              scanning={scanningModules}
              selectedModuleId={selectedModule?.id ?? null}
              onScan={handleScanModules}
              onSelect={handleSelectModule}
            />
          ) : (
            <>
              <div className="h-5 flex items-center px-2 border-b border-border/10">
                <span className="text-[7px] font-mono font-bold text-muted-foreground/40 tracking-wider">EVENT LOG</span>
              </div>
              <div className="flex-1 overflow-y-auto px-1.5 py-1">
                {session.logs.slice(0, 50).map(l => <LogEntry key={l.id} log={l} />)}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Module Console (with Haptics + Module Selector + 32ch Grid) ───
function ModuleConsole({ session, onStop }: { session: FieldTestSession; onStop: () => void }) {
  const [moduleNumber, setModuleNumber] = useState(1);
  const [channelStates, setChannelStates] = useState<Array<'idle' | 'fired' | 'ack'>>(Array(32).fill('idle'));
  const [lastFireChannel, setLastFireChannel] = useState<number | null>(null);
  const [lastFireLatency, setLastFireLatency] = useState<number | null>(null);
  const [flashActive, setFlashActive] = useState(false);

  // Track fired channels from logs
  useEffect(() => {
    const fireLog = session.logs.find(l => l.type === 'fire' && l.channel !== undefined);
    if (fireLog && fireLog.channel !== undefined) {
      if (lastFireChannel !== fireLog.channel || fireLog.timestamp > (Date.now() - 500)) {
        const ch = fireLog.channel;
        setLastFireChannel(ch);
        setLastFireLatency(fireLog.latencyMs ?? null);
        setFlashActive(true);
        haptics.fire();
        // Mark channel as fired
        setChannelStates(prev => {
          const next = [...prev];
          if (ch >= 1 && ch <= 32) next[ch - 1] = 'fired';
          return next;
        });
        setTimeout(() => {
          setFlashActive(false);
          setChannelStates(prev => {
            const next = [...prev];
            if (ch >= 1 && ch <= 32) next[ch - 1] = 'ack';
            return next;
          });
        }, 400);
      }
    }
  }, [session.logs.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (session.armed) haptics.arm();
    else haptics.disarm();
  }, [session.armed]);

  const handleResetChannels = () => {
    setChannelStates(Array(32).fill('idle'));
    setLastFireChannel(null);
    toast.success('Canais resetados');
  };

  const firedCount = channelStates.filter(s => s !== 'idle').length;

  return (
    <div className="h-[100dvh] w-screen flex flex-col overflow-hidden"
      style={{ background: 'hsl(220 25% 4%)' }}>

      {/* ═══ Header ═══ */}
      <div className="shrink-0 flex items-center justify-between px-3 h-10"
        style={{
          background: 'linear-gradient(180deg, hsl(220 20% 8%), hsl(220 20% 5%))',
          borderBottom: '1px solid hsl(0 0% 100% / 0.05)',
        }}>
        <div className="flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-primary" />
          <span className="text-xs font-bold text-foreground font-mono tracking-wide">MÓDULO RECEPTOR</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="text-[8px] font-mono border-amber-500/30 text-amber-400">{session.code}</Badge>
          <Badge
            variant={session.peerConnected ? 'outline' : 'secondary'}
            className={cn("text-[8px]", session.peerConnected ? 'border-green-500/50 text-green-400' : 'text-muted-foreground')}
          >
            {session.peerConnected ? '● CTRL' : '○ WAIT'}
          </Badge>
          <Button variant="ghost" size="sm" onClick={onStop} className="h-7 px-2 text-xs text-muted-foreground">
            <XCircle className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* ═══ Module Selector + Status ═══ */}
      <div className="shrink-0 px-3 py-2 flex items-center gap-3"
        style={{ background: 'hsl(220 20% 6%)', borderBottom: '1px solid hsl(0 0% 100% / 0.04)' }}>
        {/* Module Number Selector */}
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-mono text-muted-foreground/60 uppercase">MOD#</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setModuleNumber(n => Math.max(1, n - 1))}
              className="w-7 h-7 rounded border border-border/30 bg-muted/10 text-foreground/60 font-mono text-sm font-bold hover:bg-muted/20 active:scale-95 transition-all"
            >−</button>
            <div className="w-12 h-7 rounded border border-primary/30 bg-primary/5 flex items-center justify-center">
              <span className="text-sm font-mono font-black text-primary">{String(moduleNumber).padStart(2, '0')}</span>
            </div>
            <button
              onClick={() => setModuleNumber(n => Math.min(99, n + 1))}
              className="w-7 h-7 rounded border border-border/30 bg-muted/10 text-foreground/60 font-mono text-sm font-bold hover:bg-muted/20 active:scale-95 transition-all"
            >+</button>
          </div>
        </div>

        {/* Module Address Hex */}
        <Badge variant="outline" className="text-[8px] font-mono border-primary/20 text-primary/70 h-5">
          ADDR 0x{(moduleNumber - 1).toString(16).toUpperCase().padStart(2, '0')}
        </Badge>

        {/* Armed Status */}
        <div className={cn(
          "flex items-center gap-1 px-2 py-1 rounded text-[9px] font-mono font-bold border",
          session.armed
            ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
            : "bg-muted/5 border-border/20 text-muted-foreground/40"
        )}>
          <Shield className="w-3 h-3" />
          {session.armed ? 'ARMED' : 'SAFE'}
        </div>

        {/* Stats */}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[8px] font-mono text-muted-foreground/50">
            {firedCount}/32 <span className="text-amber-400">FIRED</span>
          </span>
          <button onClick={handleResetChannels}
            className="text-[8px] font-mono text-muted-foreground/30 hover:text-muted-foreground px-1">
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* ═══ 32-Channel Grid ═══ */}
      <div className="flex-1 flex flex-col min-h-0 px-3 py-2">
        <div className="grid grid-cols-8 grid-rows-4 gap-1.5 flex-1">
          {channelStates.map((state, idx) => {
            const ch = idx + 1;
            const isFiring = flashActive && lastFireChannel === ch;
            return (
              <div
                key={idx}
                className={cn(
                  "relative rounded-lg border-2 flex flex-col items-center justify-center transition-all",
                  state === 'fired' || isFiring
                    ? "border-orange-500/80 bg-orange-500/15"
                    : state === 'ack'
                      ? "border-green-500/40 bg-green-500/8"
                      : session.armed
                        ? "border-red-800/30 bg-red-900/10"
                        : "border-border/15 bg-muted/5"
                )}
                style={isFiring ? {
                  boxShadow: '0 0 16px hsl(25 100% 50% / 0.5), inset 0 0 8px hsl(25 100% 60% / 0.2)',
                } : state === 'ack' ? {
                  boxShadow: '0 0 8px hsl(120 70% 40% / 0.15)',
                } : undefined}
              >
                {/* Channel Number */}
                <span className={cn(
                  "text-[8px] font-mono leading-none",
                  state === 'idle' ? "text-muted-foreground/30" : "text-muted-foreground/60"
                )}>CH</span>
                <span className={cn(
                  "text-base font-mono font-black leading-none",
                  isFiring ? "text-orange-400"
                    : state === 'ack' ? "text-green-400"
                      : state === 'fired' ? "text-orange-300"
                        : session.armed ? "text-red-400/40" : "text-muted-foreground/20"
                )}>{String(ch).padStart(2, '0')}</span>

                {/* Status indicator */}
                {state !== 'idle' && (
                  <div className={cn(
                    "w-2 h-2 rounded-full mt-0.5",
                    isFiring ? "bg-orange-400 animate-pulse"
                      : state === 'ack' ? "bg-green-400"
                        : "bg-orange-400 animate-pulse"
                  )} />
                )}

                {/* Latency badge on last fired */}
                {state === 'ack' && lastFireChannel === ch && lastFireLatency !== null && (
                  <span className="absolute -top-1 -right-1 text-[6px] font-mono bg-green-600 text-white px-1 rounded-full">
                    {lastFireLatency}ms
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
              <span className="text-[8px] text-muted-foreground font-mono">Disparando</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-green-400" />
              <span className="text-[8px] text-muted-foreground font-mono">Confirmado</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded border border-border/30" />
              <span className="text-[8px] text-muted-foreground font-mono">Idle</span>
            </div>
          </div>
          <span className="text-[8px] font-mono text-muted-foreground/40">
            MOD {String(moduleNumber).padStart(2, '0')} · 32CH
          </span>
        </div>
      </div>

      {/* ═══ E-STOP + Last Fire ═══ */}
      <div className="shrink-0 px-3 pb-3 space-y-2">
        {/* Last fire summary */}
        {lastFireChannel !== null && (
          <div className={cn(
            "rounded-lg border px-3 py-2 flex items-center gap-3 transition-all",
            flashActive
              ? "border-orange-500/60 bg-orange-500/10"
              : "border-border/20 bg-card/20"
          )}>
            <Flame className={cn("w-5 h-5 shrink-0", flashActive ? "text-orange-400 animate-pulse" : "text-destructive/50")} />
            <div className="flex-1 min-w-0">
              <span className="text-lg font-mono font-black text-foreground">CH-{String(lastFireChannel).padStart(2, '0')}</span>
              <span className="text-[9px] font-mono text-muted-foreground/50 ml-2">MOD {String(moduleNumber).padStart(2, '0')}</span>
            </div>
            {lastFireLatency !== null && (
              <Badge variant="outline" className="text-xs font-mono border-amber-500/30 text-amber-400">
                {lastFireLatency}ms
              </Badge>
            )}
          </div>
        )}

        <Button
          className="w-full h-12 font-bold text-sm bg-destructive hover:bg-destructive/80 text-destructive-foreground"
          onClick={() => { fieldTestEngine.eStop(); haptics.panic(); }}
        >
          <AlertTriangle className="w-5 h-5 mr-1" />
          E-STOP
        </Button>
      </div>

      {/* ═══ Event Log ═══ */}
      <div className="shrink-0 max-h-24 overflow-y-auto px-3 py-1"
        style={{
          background: 'hsl(220 20% 4%)',
          borderTop: '1px solid hsl(0 0% 100% / 0.04)',
        }}>
        {session.logs.slice(0, 15).map(l => <LogEntry key={l.id} log={l} />)}
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
    <div className="bg-background min-h-[100dvh]">
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
