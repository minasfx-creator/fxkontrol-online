/**
 * RemoteControlPanel — Universal remote control for PC, Tablet, and Mobile.
 * Master (Host) generates a code and receives commands.
 * Slave (Controller) enters a code and sends commands.
 * Supports Cloud (6-digit code) and WiFi (auto-discovery) modes.
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Play, Pause, SkipBack, SkipForward, Smartphone, Wifi, WifiOff,
  AlertTriangle, Flame, Snowflake, Sparkles, Wind, Undo2, Redo2,
  Move, Copy, Monitor, Radio, X, Loader2, Signal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { haptics } from '@/lib/haptics';
import { useProjectStore } from '@/store/useProjectStore';
import { useLiveSfxStore } from '@/store/useLiveSfxStore';
import { useUndoStore } from '@/store/useUndoStore';
import {
  generateSessionCode,
  createRemoteSession,
  startWifiDiscovery,
  type RemoteSession,
  type RemoteState,
  type RemoteDevice,
  type CommandPacket,
  type ConnectionMode,
  type WifiDiscoveryHandle,
} from '@/lib/remoteCommandEngine';

interface RemoteControlPanelProps {
  onClose?: () => void;
  initialMode?: ConnectionMode;
}

type Role = 'master' | 'slave';

function getDefaultRole(): Role {
  return window.innerWidth >= 768 ? 'master' : 'slave';
}

export default function RemoteControlPanel({ onClose, initialMode = 'cloud' }: RemoteControlPanelProps) {
  const [role, setRole] = useState<Role>(getDefaultRole);
  const [connMode, setConnMode] = useState<ConnectionMode>(initialMode);
  const [code, setCode] = useState('');
  const [session, setSession] = useState<RemoteSession | null>(null);
  const [connected, setConnected] = useState(false);
  const [remoteState, setRemoteState] = useState<RemoteState | null>(null);
  const [devices, setDevices] = useState<RemoteDevice[]>([]);
  const [latency, setLatency] = useState(0);
  const [log, setLog] = useState<{ action: string; ts: number }[]>([]);
  const [wifiScanning, setWifiScanning] = useState(false);

  const touchRef = useRef<{ startX: number; startY: number; active: boolean }>({ startX: 0, startY: 0, active: false });
  const throttleRef = useRef(0);
  const stateIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wifiHandleRef = useRef<WifiDiscoveryHandle | null>(null);

  /* ── Master: execute incoming commands ─────────── */
  const executeCommand = useCallback((packet: CommandPacket) => {
    const store = useProjectStore.getState() as any;
    const sfx = useLiveSfxStore.getState();
    const undo = useUndoStore.getState();

    switch (packet.action) {
      case 'transport': {
        const { type, delta, time } = packet.payload as any;
        if (type === 'play') store.setPlaying?.(true);
        else if (type === 'pause') store.setPlaying?.(false);
        else if (type === 'stop') { store.setPlaying?.(false); store.setCurrentTime?.(0); }
        else if (type === 'seek') store.setCurrentTime?.((store.currentTime ?? 0) + (delta || 0));
        else if (type === 'seekTo') store.setCurrentTime?.(time ?? 0);
        break;
      }
      case 'camera':
        window.dispatchEvent(new CustomEvent('remote-camera', { detail: packet.payload }));
        break;
      case 'effect': {
        const { type: fxType, action: fxAction } = packet.payload as any;
        if (fxAction === 'fire') {
          sfx.fireEffect({ id: `remote-${Date.now()}`, type: fxType, position: [0, 0, 0], color: '#ffffff', intensity: 255, startedAt: performance.now(), duration: 2000 });
        }
        break;
      }
      case 'undo': undo.undo?.(); break;
      case 'redo': undo.redo?.(); break;
      case 'panic': {
        store.setPlaying?.(false);
        sfx.clearAll();
        toast.error('🚨 PANIC remoto — tudo parado');
        break;
      }
    }
  }, []);

  /* ── Connect as Master (receiver) ──────────────── */
  const startMaster = useCallback(() => {
    const newCode = generateSessionCode();
    setCode(newCode);

    const s = createRemoteSession(newCode, 'receiver', {
      onCommand: (packet) => {
        executeCommand(packet);
        setLog(prev => [{ action: packet.action, ts: packet.ts }, ...prev].slice(0, 8));
      },
      onPresence: (devs) => {
        setDevices(devs);
        const hasController = devs.some(d => d.role === 'controller');
        if (hasController && !connected) {
          setConnected(true);
          haptics.success();
          toast.success('🔗 Slave conectado!');
        }
      },
    }, connMode);

    setSession(s);
    setConnected(false);

    // State sync
    stateIntervalRef.current = setInterval(() => {
      const store = useProjectStore.getState() as any;
      const state: RemoteState & { ts: number } = {
        currentTime: store.currentTime ?? 0,
        isPlaying: store.isPlaying ?? false,
        activePanel: null,
        duration: store.duration ?? 300,
        selectedCount: store.selectedIds?.length ?? 0,
        ts: Date.now(),
      };
      s.sendState(state);
    }, 500);

    toast.success(`📡 Sessão Master: ${newCode}`);

    // If WiFi mode, also broadcast discovery
    if (connMode === 'wifi-auto') {
      setWifiScanning(true);
      wifiHandleRef.current = startWifiDiscovery('receiver', newCode, {
        onDeviceFound: () => { setWifiScanning(false); },
        onLost: () => {},
      });
    }
  }, [connMode, connected, executeCommand]);

  /* ── Connect as Slave (controller) — Cloud ─────── */
  const connectSlave = useCallback(() => {
    if (!code || code.length !== 6) {
      toast.error('Insira o código de 6 dígitos');
      return;
    }

    const s = createRemoteSession(code, 'controller', {
      onState: (state) => {
        setRemoteState(state);
        setLatency(Date.now() - ((state as any).ts || Date.now()));
      },
      onPresence: (devs) => {
        setDevices(devs);
        const hasReceiver = devs.some(d => d.role === 'receiver');
        if (hasReceiver && !connected) {
          setConnected(true);
          haptics.success();
          toast.success('🔗 Conectado ao Master!');
        }
      },
    }, connMode);

    setSession(s);
    setConnected(false);
    toast.info('Conectando...');
  }, [code, connected, connMode]);

  /* ── Connect as Slave — WiFi auto ──────────────── */
  const startWifiSlave = useCallback(() => {
    setWifiScanning(true);
    const tempCode = generateSessionCode();

    wifiHandleRef.current = startWifiDiscovery('controller', tempCode, {
      onDeviceFound: (device) => {
        setWifiScanning(false);
        // Auto-connect using the master's session code
        if (device.sessionCode) {
          setCode(device.sessionCode);
          const s = createRemoteSession(device.sessionCode, 'controller', {
            onState: (state) => {
              setRemoteState(state);
              setLatency(Date.now() - ((state as any).ts || Date.now()));
            },
            onPresence: (devs) => {
              setDevices(devs);
              const hasReceiver = devs.some(d => d.role === 'receiver');
              if (hasReceiver) {
                setConnected(true);
                haptics.success();
                toast.success('🔗 Conectado via WiFi!');
              }
            },
          }, 'wifi-auto');

          setSession(s);
        }
      },
      onLost: () => {},
    });
  }, []);

  /* ── Disconnect ────────────────────────────────── */
  const disconnect = useCallback(() => {
    session?.destroy();
    wifiHandleRef.current?.destroy();
    if (stateIntervalRef.current) clearInterval(stateIntervalRef.current);
    setSession(null);
    setConnected(false);
    setRemoteState(null);
    setDevices([]);
    setLog([]);
    setCode('');
    setWifiScanning(false);
    toast.info('Desconectado');
  }, [session]);

  /* ── Send (slave) ──────────────────────────────── */
  const send = useCallback((action: any, payload: Record<string, unknown>) => {
    if (!session) return;
    session.sendCommand(action, payload);
    haptics.tap();
  }, [session]);

  /* ── Camera orbit touch ────────────────────────── */
  const handleOrbitStart = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    const pos = 'touches' in e ? e.touches[0] : e;
    touchRef.current = { startX: pos.clientX, startY: pos.clientY, active: true };
  }, []);

  const handleOrbitMove = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (!touchRef.current.active || !session) return;
    const now = Date.now();
    if (now - throttleRef.current < 50) return;
    throttleRef.current = now;
    const pos = 'touches' in e ? e.touches[0] : e;
    const dx = (pos.clientX - touchRef.current.startX) * 0.5;
    const dy = (pos.clientY - touchRef.current.startY) * 0.5;
    touchRef.current.startX = pos.clientX;
    touchRef.current.startY = pos.clientY;
    send('camera', { type: 'orbit', dx, dy });
  }, [session, send]);

  const handleOrbitEnd = useCallback(() => {
    touchRef.current.active = false;
  }, []);

  useEffect(() => {
    return () => {
      session?.destroy();
      wifiHandleRef.current?.destroy();
      if (stateIntervalRef.current) clearInterval(stateIntervalRef.current);
    };
  }, [session]);

  const isPlaying = remoteState?.isPlaying ?? false;
  const latencyColor = latency < 30 ? 'text-emerald-400' : latency < 100 ? 'text-yellow-400' : 'text-red-400';

  return (
    <ScrollArea className="h-full">
      <div className="p-3 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-primary" />
            <h3 className="text-xs font-black uppercase tracking-wider text-foreground">Remote Command</h3>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={connected ? 'default' : 'secondary'} className="text-[9px]">
              {connected ? <><Wifi className="w-3 h-3 mr-1" />Online</> : <><WifiOff className="w-3 h-3 mr-1" />Offline</>}
            </Badge>
            {onClose && (
              <Button size="icon" variant="ghost" className="w-6 h-6" onClick={onClose}>
                <X className="w-3 h-3" />
              </Button>
            )}
          </div>
        </div>

        {/* Connection Mode Toggle */}
        {!session && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <p className="text-[9px] font-semibold uppercase text-muted-foreground tracking-wider">Modo de Conexão</p>
              <ToggleGroup type="single" value={connMode} onValueChange={(v) => v && setConnMode(v as ConnectionMode)} className="w-full">
                <ToggleGroupItem value="cloud" className="flex-1 h-9 text-[10px] gap-1.5 data-[state=on]:bg-primary/15 data-[state=on]:text-primary">
                  <Radio className="w-3 h-3" /> Cloud
                </ToggleGroupItem>
                <ToggleGroupItem value="wifi-auto" className="flex-1 h-9 text-[10px] gap-1.5 data-[state=on]:bg-accent/15 data-[state=on]:text-accent">
                  <Wifi className="w-3 h-3" /> WiFi
                </ToggleGroupItem>
              </ToggleGroup>
              <p className="text-[8px] text-muted-foreground text-center">
                {connMode === 'cloud' ? 'Qualquer rede — código de 6 dígitos' : 'Mesma rede WiFi — pareamento automático'}
              </p>
            </div>

            {/* Role Selector */}
            <div className="space-y-1.5">
              <p className="text-[9px] font-semibold uppercase text-muted-foreground tracking-wider">Função</p>
              <ToggleGroup type="single" value={role} onValueChange={(v) => v && setRole(v as Role)} className="w-full">
                <ToggleGroupItem value="master" className="flex-1 h-10 text-[10px] gap-1.5 data-[state=on]:bg-primary/15 data-[state=on]:text-primary">
                  <Monitor className="w-3.5 h-3.5" />
                  <div className="text-left">
                    <p className="font-bold">MASTER</p>
                    <p className="text-[7px] opacity-60">Host / Recebe</p>
                  </div>
                </ToggleGroupItem>
                <ToggleGroupItem value="slave" className="flex-1 h-10 text-[10px] gap-1.5 data-[state=on]:bg-accent/15 data-[state=on]:text-accent">
                  <Smartphone className="w-3.5 h-3.5" />
                  <div className="text-left">
                    <p className="font-bold">SLAVE</p>
                    <p className="text-[7px] opacity-60">Controla / Envia</p>
                  </div>
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            {/* Start / Connect Button */}
            {role === 'master' ? (
              <Button onClick={startMaster} className="w-full h-11 font-bold text-xs gap-2">
                <Signal className="w-4 h-4" /> Iniciar Sessão Master
              </Button>
            ) : connMode === 'cloud' ? (
              <div className="space-y-2">
                <p className="text-[10px] text-muted-foreground">Insira o código do Master:</p>
                <div className="flex gap-2">
                  <Input
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    className="font-mono text-center text-lg tracking-[0.3em] h-12"
                    maxLength={6}
                  />
                  <Button onClick={connectSlave} className="h-12 px-6" disabled={code.length !== 6}>
                    Conectar
                  </Button>
                </div>
              </div>
            ) : (
              <Button onClick={startWifiSlave} className="w-full h-11 font-bold text-xs gap-2">
                <Wifi className="w-4 h-4" /> Buscar Master na WiFi
              </Button>
            )}
          </div>
        )}

        {/* WiFi Scanning */}
        {wifiScanning && (
          <div className="flex flex-col items-center py-6 gap-3">
            <div className="relative">
              <div className="w-16 h-16 rounded-full border-2 border-accent/30 flex items-center justify-center">
                <Wifi className="w-6 h-6 text-accent animate-pulse" />
              </div>
              <div className="absolute inset-0 rounded-full border-2 border-accent/20 animate-ping" />
            </div>
            <p className="text-[10px] text-muted-foreground">Buscando dispositivos na rede...</p>
            <Button size="sm" variant="outline" onClick={() => { wifiHandleRef.current?.destroy(); setWifiScanning(false); }} className="text-[9px]">
              Cancelar
            </Button>
          </div>
        )}

        {/* Active Session Info */}
        {session && !wifiScanning && (
          <div className="bg-muted/30 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[8px] uppercase font-mono">
                    {role === 'master' ? '👑 Master' : '🎮 Slave'}
                  </Badge>
                  <Badge variant="outline" className="text-[8px]">
                    {connMode === 'wifi-auto' ? '📶 WiFi' : '☁️ Cloud'}
                  </Badge>
                </div>
                <p className="text-[9px] text-muted-foreground mt-1">
                  Sessão: <span className="font-mono text-foreground">{session.code}</span>
                </p>
                <p className="text-[9px] text-muted-foreground">
                  {devices.length} dispositivo(s)
                  {connected && <span className={cn('ml-2 font-mono', latencyColor)}>· {latency}ms</span>}
                </p>
              </div>
              <div className="flex flex-col gap-1">
                {role === 'master' && (
                  <Button size="sm" variant="ghost" className="h-6 text-[8px] gap-1" onClick={() => { navigator.clipboard.writeText(session.code); toast.success('Código copiado'); }}>
                    <Copy className="w-3 h-3" /> Copiar
                  </Button>
                )}
                <Button size="sm" variant="outline" className="h-6 text-[8px]" onClick={disconnect}>
                  Desconectar
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Master — Command Log */}
        {role === 'master' && connected && log.length > 0 && (
          <div className="space-y-1">
            <p className="text-[9px] font-semibold uppercase text-muted-foreground tracking-wider">Log de Comandos</p>
            <div className="bg-muted/20 rounded-lg p-2 space-y-0.5">
              {log.slice(0, 6).map((entry, i) => (
                <div key={i} className="flex items-center justify-between text-[8px] text-muted-foreground/70">
                  <span className="font-mono uppercase">{entry.action}</span>
                  <span className="font-mono">{new Date(entry.ts).toLocaleTimeString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Slave Controls — visible when connected as slave */}
        {role === 'slave' && connected && (
          <>
            {/* Transport */}
            <div className="space-y-2">
              <p className="text-[9px] font-semibold uppercase text-muted-foreground tracking-wider">Transporte</p>
              <div className="flex items-center justify-center gap-3">
                <Button size="icon" variant="outline" className="w-12 h-12 rounded-full" onClick={() => send('transport', { type: 'seek', delta: -5 })}>
                  <SkipBack className="w-5 h-5" />
                </Button>
                <Button size="icon" className={cn("w-16 h-16 rounded-full", isPlaying ? "bg-destructive" : "bg-primary")} onClick={() => send('transport', { type: isPlaying ? 'pause' : 'play' })}>
                  {isPlaying ? <Pause className="w-7 h-7" /> : <Play className="w-7 h-7 ml-1" />}
                </Button>
                <Button size="icon" variant="outline" className="w-12 h-12 rounded-full" onClick={() => send('transport', { type: 'seek', delta: 5 })}>
                  <SkipForward className="w-5 h-5" />
                </Button>
              </div>

              {remoteState && (
                <div className="px-2">
                  <Slider value={[remoteState.currentTime]} max={remoteState.duration || 300} step={0.1} onValueChange={([v]) => send('transport', { type: 'seekTo', time: v })} className="w-full" />
                  <div className="flex justify-between text-[8px] text-muted-foreground mt-1 font-mono">
                    <span>{formatTime(remoteState.currentTime)}</span>
                    <span>{formatTime(remoteState.duration)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Camera Orbit Pad */}
            <div className="space-y-2">
              <p className="text-[9px] font-semibold uppercase text-muted-foreground tracking-wider">Câmera 3D</p>
              <div
                className="w-full h-32 bg-muted/20 border border-border/50 rounded-xl flex items-center justify-center touch-none cursor-move relative overflow-hidden"
                onTouchStart={handleOrbitStart}
                onTouchMove={handleOrbitMove}
                onTouchEnd={handleOrbitEnd}
                onMouseDown={handleOrbitStart}
                onMouseMove={handleOrbitMove}
                onMouseUp={handleOrbitEnd}
                onMouseLeave={handleOrbitEnd}
              >
                <Move className="w-8 h-8 text-muted-foreground/30" />
                <span className="absolute bottom-1 text-[8px] text-muted-foreground/40">Arraste para orbitar</span>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="flex-1 h-8 text-[9px]" onClick={() => send('camera', { type: 'zoom', delta: -1 })}>Zoom −</Button>
                <Button size="sm" variant="outline" className="flex-1 h-8 text-[9px]" onClick={() => send('camera', { type: 'reset' })}>Reset</Button>
                <Button size="sm" variant="outline" className="flex-1 h-8 text-[9px]" onClick={() => send('camera', { type: 'zoom', delta: 1 })}>Zoom +</Button>
              </div>
            </div>

            {/* SFX Triggers */}
            <div className="space-y-2">
              <p className="text-[9px] font-semibold uppercase text-muted-foreground tracking-wider">Live FX</p>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { type: 'flame', icon: Flame, label: 'Flame', color: 'bg-orange-500/20 text-orange-400' },
                  { type: 'co2', icon: Snowflake, label: 'CO₂', color: 'bg-blue-500/20 text-blue-400' },
                  { type: 'spark', icon: Sparkles, label: 'Spark', color: 'bg-yellow-500/20 text-yellow-400' },
                  { type: 'haze', icon: Wind, label: 'Haze', color: 'bg-purple-500/20 text-purple-400' },
                ].map(fx => (
                  <button
                    key={fx.type}
                    className={cn("flex flex-col items-center gap-1 p-3 rounded-xl border border-border/30 active:scale-90 transition-transform", fx.color)}
                    onClick={() => { send('effect', { type: fx.type, action: 'fire' }); haptics.fire(); }}
                  >
                    <fx.icon className="w-6 h-6" />
                    <span className="text-[8px] font-semibold">{fx.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1 h-9 text-[9px]" onClick={() => send('undo', {})}>
                <Undo2 className="w-3 h-3 mr-1" /> Undo
              </Button>
              <Button size="sm" variant="outline" className="flex-1 h-9 text-[9px]" onClick={() => send('redo', {})}>
                <Redo2 className="w-3 h-3 mr-1" /> Redo
              </Button>
            </div>

            {/* PANIC */}
            <Button
              variant="destructive"
              className="w-full h-14 text-lg font-black uppercase tracking-widest"
              onClick={() => { send('panic', {}); haptics.panic(); toast.error('🚨 PANIC — All stop!'); }}
            >
              <AlertTriangle className="w-6 h-6 mr-2" /> PANIC
            </Button>
          </>
        )}

        {/* Master waiting state */}
        {role === 'master' && session && !connected && !wifiScanning && (
          <div className="flex flex-col items-center py-6 gap-3 text-center">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            </div>
            <p className="text-xs text-muted-foreground">Aguardando Slave conectar...</p>
            <p className="text-[10px] text-muted-foreground">Compartilhe o código: <span className="font-mono font-bold text-primary text-lg">{session.code}</span></p>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}
