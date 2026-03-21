/**
 * RemoteControlPanel — AnyDesk-style full remote control system.
 * Master: host session, manage slaves, set permissions.
 * Slave: tabbed UI (Dashboard/Transport/Hardware/Panels/SFX).
 * Multi-site: connect to multiple masters from one slave.
 */
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  Play, Pause, SkipBack, SkipForward, Smartphone, Wifi, WifiOff,
  AlertTriangle, Flame, Snowflake, Sparkles, Wind, Undo2, Redo2,
  Move, Copy, Monitor, Radio, X, Loader2, Signal,
  LayoutGrid, Zap, Shield, ShieldCheck, ShieldOff,
  Battery, Activity, QrCode, Plus, Trash2,
  Crosshair, ScanLine, Power, ToggleLeft, ToggleRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  executeRemoteCommand,
  generateQRCodeSVG,
  MultiSessionManager,
  DEFAULT_PERMISSIONS,
  type RemoteSession,
  type RemoteState,
  type RemoteDevice,
  type RemotePermissions,
  type ConnectionMode,
  type WifiDiscoveryHandle,
  type HardwareCommandPayload,
} from '@/lib/remoteCommandEngine';

interface RemoteControlPanelProps {
  onClose?: () => void;
  onOpenPanel?: (id: string) => void;
  initialMode?: ConnectionMode;
}

type Role = 'master' | 'slave';

const AVAILABLE_PANELS = [
  { id: 'timeline', label: 'Timeline', icon: '⏱' },
  { id: 'effects', label: 'Effects', icon: '✨' },
  { id: 'positions', label: 'Positions', icon: '📍' },
  { id: 'safety', label: 'Safety', icon: '🛡' },
  { id: 'dmx', label: 'DMX', icon: '💡' },
  { id: 'show-control', label: 'Show Control', icon: '🎛' },
  { id: 'battery', label: 'Battery', icon: '🔋' },
  { id: 'fleet', label: 'Fleet', icon: '🚁' },
  { id: 'weather', label: 'Weather', icon: '🌤' },
  { id: 'diagnostics', label: 'Diagnostics', icon: '🔧' },
  { id: 'script', label: 'Script', icon: '📝' },
  { id: 'reports', label: 'Reports', icon: '📊' },
];

function getDefaultRole(): Role {
  return window.innerWidth >= 768 ? 'master' : 'slave';
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export default function RemoteControlPanel({ onClose, onOpenPanel, initialMode = 'cloud' }: RemoteControlPanelProps) {
  const [role, setRole] = useState<Role>(getDefaultRole);
  const [connMode, setConnMode] = useState<ConnectionMode>(initialMode);
  const [code, setCode] = useState('');
  const [session, setSession] = useState<RemoteSession | null>(null);
  const [connected, setConnected] = useState(false);
  const [remoteState, setRemoteState] = useState<RemoteState | null>(null);
  const [devices, setDevices] = useState<RemoteDevice[]>([]);
  const [latency, setLatency] = useState(0);
  const [log, setLog] = useState<{ action: string; ts: number; sender?: string }[]>([]);
  const [wifiScanning, setWifiScanning] = useState(false);
  const [slavePermissions, setSlavePermissions] = useState<RemotePermissions>(DEFAULT_PERMISSIONS);
  const [masterPermissions, setMasterPermissions] = useState<Map<string, RemotePermissions>>(new Map());
  const [showQR, setShowQR] = useState(false);
  const [activeSlaveTab, setActiveSlaveTab] = useState('dashboard');

  // Multi-site
  const [multiManager] = useState(() => new MultiSessionManager());
  const [sites, setSites] = useState<{ code: string; name: string; connected: boolean }[]>([]);

  const touchRef = useRef<{ startX: number; startY: number; active: boolean }>({ startX: 0, startY: 0, active: false });
  const throttleRef = useRef(0);
  const stateIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wifiHandleRef = useRef<WifiDiscoveryHandle | null>(null);

  const qrSvg = useMemo(() => {
    if (!session?.code) return '';
    return generateQRCodeSVG(session.code, 160);
  }, [session?.code]);

  /* ── Connect as Master ────────────────────────── */
  const startMaster = useCallback(() => {
    const newCode = generateSessionCode();
    setCode(newCode);

    const s = createRemoteSession(newCode, 'receiver', {
      onCommand: (packet) => {
        executeRemoteCommand(packet, {
          projectStore: useProjectStore.getState(),
          sfxStore: useLiveSfxStore.getState(),
          undoStore: useUndoStore.getState(),
          onOpenPanel,
          onHardwareCommand: (hw) => {
            window.dispatchEvent(new CustomEvent('remote-hardware', { detail: hw }));
          },
        });
        setLog(prev => [{ action: packet.action, ts: packet.ts, sender: packet.senderId }, ...prev].slice(0, 20));
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

    stateIntervalRef.current = setInterval(() => {
      const store = useProjectStore.getState() as any;
      const state: RemoteState & { ts: number } = {
        currentTime: store.currentTime ?? 0,
        isPlaying: store.isPlaying ?? false,
        activePanel: null,
        duration: store.duration ?? 300,
        selectedCount: store.selectedIds?.length ?? 0,
        hardwareStatus: {
          fireoneModules: 0, fireoneArmed: 0,
          pbusDevices: 0, pbusArmed: 0,
          radioDevices: 0, batteryAvg: 0,
          connectionPaths: [],
        },
        permissions: slavePermissions,
        ts: Date.now(),
      };
      s.sendState(state);
    }, 500);

    toast.success(`📡 Sessão Master: ${newCode}`);

    if (connMode === 'wifi-auto') {
      setWifiScanning(true);
      wifiHandleRef.current = startWifiDiscovery('receiver', newCode, {
        onDeviceFound: () => setWifiScanning(false),
        onLost: () => {},
      });
    }
  }, [connMode, connected, onOpenPanel, slavePermissions]);

  /* ── Connect as Slave — Cloud ──────────────────── */
  const connectSlave = useCallback(() => {
    if (!code || code.length !== 6) {
      toast.error('Insira o código de 6 dígitos');
      return;
    }

    const s = createRemoteSession(code, 'controller', {
      onState: (state) => {
        setRemoteState(state);
        setLatency(Date.now() - ((state as any).ts || Date.now()));
        if (state.permissions) setSlavePermissions(state.permissions);
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
      onPermissions: (perms) => setSlavePermissions(perms),
    }, connMode);

    setSession(s);
    multiManager.add(s);
    setSites(prev => [...prev, { code, name: `Site ${prev.length + 1}`, connected: true }]);
    setConnected(false);
    toast.info('Conectando...');
  }, [code, connected, connMode, multiManager]);

  /* ── Connect as Slave — WiFi ───────────────────── */
  const startWifiSlave = useCallback(() => {
    setWifiScanning(true);
    const tempCode = generateSessionCode();

    wifiHandleRef.current = startWifiDiscovery('controller', tempCode, {
      onDeviceFound: (device) => {
        setWifiScanning(false);
        if (device.sessionCode) {
          setCode(device.sessionCode);
          const s = createRemoteSession(device.sessionCode, 'controller', {
            onState: (state) => {
              setRemoteState(state);
              setLatency(Date.now() - ((state as any).ts || Date.now()));
              if (state.permissions) setSlavePermissions(state.permissions);
            },
            onPresence: (devs) => {
              setDevices(devs);
              if (devs.some(d => d.role === 'receiver')) {
                setConnected(true);
                haptics.success();
                toast.success('🔗 Conectado via WiFi!');
              }
            },
            onPermissions: (perms) => setSlavePermissions(perms),
          }, 'wifi-auto');
          setSession(s);
          multiManager.add(s);
        }
      },
      onLost: () => {},
    });
  }, [multiManager]);

  /* ── Disconnect ────────────────────────────────── */
  const disconnect = useCallback(() => {
    session?.destroy();
    wifiHandleRef.current?.destroy();
    multiManager.destroyAll();
    if (stateIntervalRef.current) clearInterval(stateIntervalRef.current);
    setSession(null);
    setConnected(false);
    setRemoteState(null);
    setDevices([]);
    setLog([]);
    setCode('');
    setSites([]);
    setWifiScanning(false);
    toast.info('Desconectado');
  }, [session, multiManager]);

  /* ── Send (slave) ──────────────────────────────── */
  const send = useCallback((action: any, payload: Record<string, unknown>) => {
    if (!session) return;
    session.sendCommand(action, payload);
    haptics.tap();
  }, [session]);

  /* ── Camera orbit ──────────────────────────────── */
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

  const handleOrbitEnd = useCallback(() => { touchRef.current.active = false; }, []);

  /* ── Permission toggle (master) ────────────────── */
  const togglePermission = useCallback((deviceId: string, key: keyof RemotePermissions) => {
    setMasterPermissions(prev => {
      const next = new Map(prev);
      const current = next.get(deviceId) || { ...DEFAULT_PERMISSIONS };
      current[key] = !current[key];
      next.set(deviceId, current);
      if (session) session.sendPermissions(deviceId, current);
      return next;
    });
  }, [session]);

  useEffect(() => {
    return () => {
      session?.destroy();
      wifiHandleRef.current?.destroy();
      if (stateIntervalRef.current) clearInterval(stateIntervalRef.current);
    };
  }, [session]);

  const isPlaying = remoteState?.isPlaying ?? false;
  const latencyColor = latency < 30 ? 'text-emerald-400' : latency < 100 ? 'text-yellow-400' : 'text-red-400';
  const hwStatus = remoteState?.hardwareStatus;
  const controllers = devices.filter(d => d.role === 'controller');

  return (
    <ScrollArea className="h-full">
      <div className="p-3 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-primary" />
            <h3 className="text-xs font-black uppercase tracking-wider text-foreground">Remote Control</h3>
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

        {/* ═══ PRE-CONNECTION ═══ */}
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
            </div>

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
                    <p className="text-[7px] opacity-60">Controla</p>
                  </div>
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            {role === 'master' ? (
              <Button onClick={startMaster} className="w-full h-11 font-bold text-xs gap-2">
                <Signal className="w-4 h-4" /> Iniciar Sessão Master
              </Button>
            ) : connMode === 'cloud' ? (
              <div className="space-y-2">
                <p className="text-[10px] text-muted-foreground">Código do Master:</p>
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
                <Wifi className="w-4 h-4" /> Buscar Master
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
            <p className="text-[10px] text-muted-foreground">Buscando...</p>
            <Button size="sm" variant="outline" onClick={() => { wifiHandleRef.current?.destroy(); setWifiScanning(false); }} className="text-[9px]">
              Cancelar
            </Button>
          </div>
        )}

        {/* Session Info Bar */}
        {session && !wifiScanning && (
          <div className="bg-muted/30 rounded-lg p-2.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[8px] font-mono">
                  {role === 'master' ? '👑 Master' : '🎮 Slave'}
                </Badge>
                <span className="font-mono text-xs font-bold text-primary tracking-[0.2em]">{session.code}</span>
                {connected && <span className={cn('text-[9px] font-mono', latencyColor)}>{latency}ms</span>}
              </div>
              <div className="flex items-center gap-1">
                {role === 'master' && (
                  <Button size="icon" variant="ghost" className="w-6 h-6" onClick={() => setShowQR(!showQR)} title="QR Code">
                    <QrCode className="w-3 h-3" />
                  </Button>
                )}
                <Button size="icon" variant="ghost" className="w-6 h-6" onClick={() => { navigator.clipboard.writeText(session.code); toast.success('Copiado'); }}>
                  <Copy className="w-3 h-3" />
                </Button>
                <Button size="icon" variant="ghost" className="w-6 h-6 text-destructive" onClick={disconnect}>
                  <X className="w-3 h-3" />
                </Button>
              </div>
            </div>
            <p className="text-[8px] text-muted-foreground">{devices.length} dispositivo(s)</p>

            {/* QR Code */}
            {showQR && role === 'master' && (
              <div className="flex justify-center py-2">
                <div
                  className="w-40 h-40 text-foreground"
                  dangerouslySetInnerHTML={{ __html: qrSvg }}
                />
              </div>
            )}
          </div>
        )}

        {/* ═══ MASTER CONNECTED VIEW ═══ */}
        {role === 'master' && connected && (
          <div className="space-y-3">
            {/* Connected Slaves */}
            <div className="space-y-1.5">
              <p className="text-[9px] font-semibold uppercase text-muted-foreground tracking-wider">Dispositivos Conectados</p>
              {controllers.map(dev => {
                const perms = masterPermissions.get(dev.id) || DEFAULT_PERMISSIONS;
                return (
                  <div key={dev.id} className="bg-muted/20 rounded-lg p-2 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Smartphone className="w-3 h-3 text-primary" />
                        <span className="text-[10px] font-semibold text-foreground">{dev.name}</span>
                        <span className="text-[7px] text-muted-foreground font-mono">{dev.id.slice(0, 8)}</span>
                      </div>
                      <Button size="icon" variant="ghost" className="w-5 h-5 text-destructive/60 hover:text-destructive" onClick={() => toast.info('Revogado')}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                    {/* Permission Toggles */}
                    <div className="grid grid-cols-3 gap-1">
                      {([
                        ['canArm', 'ARM', Shield],
                        ['canFire', 'FIRE', Zap],
                        ['canPanic', 'PANIC', AlertTriangle],
                      ] as const).map(([key, label, Icon]) => (
                        <button
                          key={key}
                          onClick={() => togglePermission(dev.id, key)}
                          className={cn(
                            "flex items-center gap-1 px-1.5 py-1 rounded text-[7px] font-bold uppercase border transition-colors",
                            perms[key]
                              ? "bg-primary/10 border-primary/30 text-primary"
                              : "bg-muted/30 border-border/30 text-muted-foreground"
                          )}
                        >
                          <Icon className="w-2.5 h-2.5" />
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Command Log */}
            {log.length > 0 && (
              <div className="space-y-1">
                <p className="text-[9px] font-semibold uppercase text-muted-foreground tracking-wider">Activity Log</p>
                <div className="bg-muted/20 rounded-lg p-2 space-y-0.5 max-h-32 overflow-y-auto">
                  {log.slice(0, 10).map((entry, i) => (
                    <div key={i} className="flex items-center justify-between text-[7px] text-muted-foreground/70">
                      <span className="font-mono uppercase">{entry.action}</span>
                      <span className="font-mono">{new Date(entry.ts).toLocaleTimeString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Master Waiting */}
        {role === 'master' && session && !connected && !wifiScanning && (
          <div className="flex flex-col items-center py-6 gap-3 text-center">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="text-xs text-muted-foreground">Aguardando Slave...</p>
            <p className="text-[10px] text-muted-foreground">
              Código: <span className="font-mono font-bold text-primary text-lg">{session.code}</span>
            </p>
          </div>
        )}

        {/* ═══ SLAVE CONNECTED — TABBED UI ═══ */}
        {role === 'slave' && connected && (
          <Tabs value={activeSlaveTab} onValueChange={setActiveSlaveTab} className="w-full">
            <TabsList className="w-full grid grid-cols-5 h-8">
              <TabsTrigger value="dashboard" className="text-[8px] px-1">
                <Activity className="w-3 h-3" />
              </TabsTrigger>
              <TabsTrigger value="transport" className="text-[8px] px-1">
                <Play className="w-3 h-3" />
              </TabsTrigger>
              <TabsTrigger value="hardware" className="text-[8px] px-1">
                <Zap className="w-3 h-3" />
              </TabsTrigger>
              <TabsTrigger value="panels" className="text-[8px] px-1">
                <LayoutGrid className="w-3 h-3" />
              </TabsTrigger>
              <TabsTrigger value="sfx" className="text-[8px] px-1">
                <Flame className="w-3 h-3" />
              </TabsTrigger>
            </TabsList>

            {/* ── Dashboard Tab ──────────────── */}
            <TabsContent value="dashboard" className="space-y-3 mt-3">
              {/* Show Status */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-muted/20 rounded-lg p-2 text-center">
                  <p className="text-[7px] text-muted-foreground uppercase">Status</p>
                  <p className={cn("text-sm font-black", isPlaying ? "text-emerald-400" : "text-muted-foreground")}>
                    {isPlaying ? '▶ PLAYING' : '⏸ PAUSED'}
                  </p>
                </div>
                <div className="bg-muted/20 rounded-lg p-2 text-center">
                  <p className="text-[7px] text-muted-foreground uppercase">Time</p>
                  <p className="text-sm font-mono font-bold text-foreground">{formatTime(remoteState?.currentTime ?? 0)}</p>
                </div>
              </div>

              {/* Hardware Status */}
              {hwStatus && (
                <div className="space-y-1.5">
                  <p className="text-[9px] font-semibold uppercase text-muted-foreground tracking-wider">Hardware</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    <div className="bg-muted/20 rounded-lg p-2 text-center">
                      <Zap className="w-3 h-3 mx-auto text-primary mb-0.5" />
                      <p className="text-[7px] text-muted-foreground">FireOne</p>
                      <p className="text-xs font-bold text-foreground">{hwStatus.fireoneModules}</p>
                      <p className="text-[7px] text-primary">{hwStatus.fireoneArmed} armed</p>
                    </div>
                    <div className="bg-muted/20 rounded-lg p-2 text-center">
                      <Radio className="w-3 h-3 mx-auto text-accent mb-0.5" />
                      <p className="text-[7px] text-muted-foreground">PBUS</p>
                      <p className="text-xs font-bold text-foreground">{hwStatus.pbusDevices}</p>
                      <p className="text-[7px] text-accent">{hwStatus.pbusArmed} armed</p>
                    </div>
                    <div className="bg-muted/20 rounded-lg p-2 text-center">
                      <Battery className="w-3 h-3 mx-auto text-emerald-400 mb-0.5" />
                      <p className="text-[7px] text-muted-foreground">Battery</p>
                      <p className="text-xs font-bold text-foreground">{hwStatus.batteryAvg.toFixed(1)}V</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Latency */}
              <div className="bg-muted/20 rounded-lg p-2 flex items-center justify-between">
                <span className="text-[9px] text-muted-foreground">Latência</span>
                <span className={cn("font-mono text-sm font-bold", latencyColor)}>{latency}ms</span>
              </div>

              {/* Permissions */}
              <div className="space-y-1">
                <p className="text-[9px] font-semibold uppercase text-muted-foreground tracking-wider">Permissões</p>
                <div className="flex flex-wrap gap-1">
                  {Object.entries(slavePermissions).map(([key, val]) => (
                    <Badge key={key} variant={val ? 'default' : 'secondary'} className="text-[7px]">
                      {val ? <ShieldCheck className="w-2 h-2 mr-0.5" /> : <ShieldOff className="w-2 h-2 mr-0.5" />}
                      {key.replace('can', '')}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Multi-Site */}
              {sites.length > 1 && (
                <div className="space-y-1">
                  <p className="text-[9px] font-semibold uppercase text-muted-foreground tracking-wider">Multi-Site</p>
                  {sites.map(site => (
                    <div key={site.code} className="flex items-center justify-between bg-muted/20 rounded px-2 py-1">
                      <span className="text-[9px] font-semibold">{site.name}</span>
                      <Badge variant={site.connected ? 'default' : 'secondary'} className="text-[7px]">
                        {site.code}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* ── Transport Tab ──────────────── */}
            <TabsContent value="transport" className="space-y-3 mt-3">
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

              {/* Camera Orbit */}
              <div className="space-y-1.5">
                <p className="text-[9px] font-semibold uppercase text-muted-foreground tracking-wider">Câmera 3D</p>
                <div
                  className="w-full h-28 bg-muted/20 border border-border/50 rounded-xl flex items-center justify-center touch-none cursor-move relative"
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
                  <Button size="sm" variant="outline" className="flex-1 h-7 text-[9px]" onClick={() => send('camera', { type: 'zoom', delta: -1 })}>Zoom −</Button>
                  <Button size="sm" variant="outline" className="flex-1 h-7 text-[9px]" onClick={() => send('camera', { type: 'reset' })}>Reset</Button>
                  <Button size="sm" variant="outline" className="flex-1 h-7 text-[9px]" onClick={() => send('camera', { type: 'zoom', delta: 1 })}>Zoom +</Button>
                </div>
              </div>

              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="flex-1 h-8 text-[9px]" onClick={() => send('undo', {})}>
                  <Undo2 className="w-3 h-3 mr-1" /> Undo
                </Button>
                <Button size="sm" variant="outline" className="flex-1 h-8 text-[9px]" onClick={() => send('redo', {})}>
                  <Redo2 className="w-3 h-3 mr-1" /> Redo
                </Button>
              </div>
            </TabsContent>

            {/* ── Hardware Tab ────────────────── */}
            <TabsContent value="hardware" className="space-y-3 mt-3">
              {!slavePermissions.canArm && !slavePermissions.canFire ? (
                <div className="flex flex-col items-center py-6 gap-2 text-center">
                  <ShieldOff className="w-8 h-8 text-muted-foreground/40" />
                  <p className="text-[10px] text-muted-foreground">Sem permissão de hardware</p>
                  <p className="text-[8px] text-muted-foreground/60">Solicite acesso ao Master</p>
                </div>
              ) : (
                <>
                  {/* ARM / DISARM */}
                  {slavePermissions.canArm && (
                    <div className="space-y-1.5">
                      <p className="text-[9px] font-semibold uppercase text-muted-foreground tracking-wider">Armamento</p>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          variant="outline"
                          className="h-12 text-[10px] font-bold border-red-500/30 text-red-400 hover:bg-red-500/10"
                          onClick={() => {
                            if (confirm('ARM ALL modules?')) {
                              send('hardware', { target: 'fireone', action: 'arm-all' } as HardwareCommandPayload);
                              haptics.fire();
                            }
                          }}
                        >
                          <ShieldCheck className="w-4 h-4 mr-1" /> ARM ALL
                        </Button>
                        <Button
                          variant="outline"
                          className="h-12 text-[10px] font-bold border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                          onClick={() => {
                            send('hardware', { target: 'fireone', action: 'disarm-all' } as HardwareCommandPayload);
                            haptics.tap();
                          }}
                        >
                          <Shield className="w-4 h-4 mr-1" /> DISARM ALL
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Continuity / Scan */}
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" className="h-10 text-[9px] gap-1" onClick={() => send('hardware', { target: 'fireone', action: 'continuity' } as HardwareCommandPayload)}>
                      <ScanLine className="w-3 h-3" /> Continuity
                    </Button>
                    <Button variant="outline" className="h-10 text-[9px] gap-1" onClick={() => send('hardware', { target: 'fireone', action: 'scan' } as HardwareCommandPayload)}>
                      <Crosshair className="w-3 h-3" /> Scan
                    </Button>
                  </div>

                  {/* Fire Per Module */}
                  {slavePermissions.canFire && (
                    <div className="space-y-1.5">
                      <p className="text-[9px] font-semibold uppercase text-muted-foreground tracking-wider">Disparo Manual</p>
                      <div className="grid grid-cols-4 gap-1.5">
                        {Array.from({ length: 8 }, (_, i) => (
                          <Button
                            key={i}
                            variant="outline"
                            className="h-10 text-[9px] font-mono font-bold border-orange-500/20 text-orange-400 hover:bg-orange-500/10 active:scale-90 transition-transform"
                            onClick={() => {
                              if (confirm(`FIRE Module ${i + 1}?`)) {
                                send('hardware', { target: 'fireone', action: 'fire', moduleAddr: i + 1, cuePosition: 1, duration: 500 } as HardwareCommandPayload);
                                haptics.fire();
                              }
                            }}
                          >
                            M{i + 1}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* PBUS */}
                  <div className="space-y-1.5">
                    <p className="text-[9px] font-semibold uppercase text-muted-foreground tracking-wider">PBUS</p>
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="outline" className="h-10 text-[9px] gap-1" onClick={() => send('hardware', { target: 'pbus', action: 'arm-all' } as HardwareCommandPayload)}>
                        <Power className="w-3 h-3" /> PBUS Arm
                      </Button>
                      <Button variant="outline" className="h-10 text-[9px] gap-1" onClick={() => send('hardware', { target: 'pbus', action: 'disarm-all' } as HardwareCommandPayload)}>
                        <Power className="w-3 h-3" /> PBUS Disarm
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </TabsContent>

            {/* ── Panels Tab ─────────────────── */}
            <TabsContent value="panels" className="space-y-2 mt-3">
              {!slavePermissions.canAccessPanels ? (
                <div className="flex flex-col items-center py-6 gap-2 text-center">
                  <ShieldOff className="w-8 h-8 text-muted-foreground/40" />
                  <p className="text-[10px] text-muted-foreground">Acesso a painéis bloqueado</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {AVAILABLE_PANELS.map(panel => (
                    <button
                      key={panel.id}
                      className="flex flex-col items-center gap-1 p-2.5 rounded-xl bg-muted/20 border border-border/30 hover:bg-primary/10 hover:border-primary/30 transition-colors active:scale-95"
                      onClick={() => { send('open-panel', { panelId: panel.id }); haptics.tap(); }}
                    >
                      <span className="text-lg">{panel.icon}</span>
                      <span className="text-[7px] font-semibold text-muted-foreground">{panel.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* ── SFX Tab ────────────────────── */}
            <TabsContent value="sfx" className="space-y-3 mt-3">
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
            </TabsContent>

            {/* ═══ PANIC BAR — always visible ═══ */}
            <div className="pt-2">
              <Button
                variant="destructive"
                className="w-full h-14 text-lg font-black uppercase tracking-widest"
                disabled={!slavePermissions.canPanic}
                onClick={() => { send('panic', {}); haptics.panic(); toast.error('🚨 PANIC — All stop!'); }}
              >
                <AlertTriangle className="w-6 h-6 mr-2" /> PANIC
              </Button>
            </div>
          </Tabs>
        )}
      </div>
    </ScrollArea>
  );
}
