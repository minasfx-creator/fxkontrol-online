/**
 * RemoteControlPanel — AnyDesk-style transparent command relay.
 * Master: host session, manage slaves, see action mirror, real hardware status.
 * Slave: flat command pad — connect and commands just happen on master.
 */
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  Play, Pause, SkipBack, SkipForward, Smartphone, Wifi, WifiOff,
  AlertTriangle, Flame, Snowflake, Sparkles, Wind, Undo2, Redo2,
  Move, Copy, Monitor, Radio, X, Loader2, Signal,
  LayoutGrid, Zap, Shield, ShieldCheck, ShieldOff,
  Battery, QrCode, ScanLine, Power, Crosshair,
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
import { useFireOneHardware } from '@/hooks/useFireOneHardware';
import { usePBusHardware } from '@/hooks/usePBusHardware';
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

const PANEL_SHORTCUTS = [
  { id: 'timeline', icon: '⏱', label: 'Timeline' },
  { id: 'effects', icon: '✨', label: 'Effects' },
  { id: 'positions', icon: '📍', label: 'Positions' },
  { id: 'safety', icon: '🛡', label: 'Safety' },
  { id: 'dmx', icon: '💡', label: 'DMX' },
  { id: 'show-control', icon: '🎛', label: 'Show' },
  { id: 'battery', icon: '🔋', label: 'Battery' },
  { id: 'fleet', icon: '🚁', label: 'Fleet' },
  { id: 'weather', icon: '🌤', label: 'Weather' },
  { id: 'diagnostics', icon: '🔧', label: 'Diag' },
  { id: 'script', icon: '📝', label: 'Script' },
  { id: 'reports', icon: '📊', label: 'Reports' },
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
  const connectedRef = useRef(false);
  const [wifiScanning, setWifiScanning] = useState(false);
  const [slavePermissions, setSlavePermissions] = useState<RemotePermissions>(DEFAULT_PERMISSIONS);
  const [masterPermissions, setMasterPermissions] = useState<Map<string, RemotePermissions>>(new Map());
  const [showQR, setShowQR] = useState(false);
  const [actionMirror, setActionMirror] = useState<{ action: string; sender: string; ts: number }[]>([]);

  // Multi-site
  const [multiManager] = useState(() => new MultiSessionManager());
  const [sites, setSites] = useState<{ code: string; name: string; connected: boolean }[]>([]);

  // Real hardware hooks (master only uses for status)
  const fireone = useFireOneHardware();
  const pbus = usePBusHardware();

  const touchRef = useRef<{ startX: number; startY: number; active: boolean }>({ startX: 0, startY: 0, active: false });
  const throttleRef = useRef(0);
  const stateIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wifiHandleRef = useRef<WifiDiscoveryHandle | null>(null);

  const qrSvg = useMemo(() => {
    if (!session?.code) return '';
    return generateQRCodeSVG(session.code, 160);
  }, [session?.code]);

  const controllers = devices.filter(d => d.role === 'controller');

  // Build real hardware status for state sync
  const getHardwareStatus = useCallback(() => {
    let fireoneArmed = 0;
    fireone.modules.forEach(m => { if (m.armed) fireoneArmed++; });
    let pbusArmed = 0, batterySum = 0, batteryCount = 0;
    pbus.devices.forEach(d => {
      if (d.armed) pbusArmed++;
      if (d.batteryV > 0) { batterySum += d.batteryV; batteryCount++; }
    });
    const paths: ('usb' | 'radio' | 'pbus')[] = [];
    if (fireone.connectionPath === 'wired') paths.push('usb');
    if (fireone.connectionPath === 'radio') paths.push('radio');
    if (pbus.connectionPath === 'wired') paths.push('pbus');
    if (pbus.connectionPath === 'radio') paths.push('radio');
    return {
      fireoneModules: fireone.modules.size,
      fireoneArmed,
      pbusDevices: pbus.devices.size,
      pbusArmed,
      radioDevices: 0,
      batteryAvg: batteryCount > 0 ? batterySum / batteryCount : 0,
      connectionPaths: [...new Set(paths)],
    };
  }, [fireone, pbus]);

  // Keep ref in sync with state to avoid stale closures in channel callbacks
  useEffect(() => { connectedRef.current = connected; }, [connected]);

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
        setActionMirror(prev => [
          { action: packet.action, sender: packet.senderId || 'slave', ts: Date.now() },
          ...prev,
        ].slice(0, 5));
      },
      onPresence: (devs) => {
        setDevices(devs);
        const hasController = devs.some(d => d.role === 'controller');
        if (hasController && !connectedRef.current) {
          connectedRef.current = true;
          setConnected(true);
          haptics.success();
          toast.success('🔗 Slave conectado!');
        }
      },
    }, connMode);

    setSession(s);
    setConnected(false);
    connectedRef.current = false;

    // State sync with REAL hardware status
    stateIntervalRef.current = setInterval(() => {
      const store = useProjectStore.getState() as any;
      const state: RemoteState & { ts: number } = {
        currentTime: store.currentTime ?? 0,
        isPlaying: store.isPlaying ?? false,
        activePanel: null,
        duration: store.duration ?? 300,
        selectedCount: store.selectedIds?.length ?? 0,
        hardwareStatus: getHardwareStatus(),
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
  }, [connMode, onOpenPanel, slavePermissions, getHardwareStatus]);

  /* ── Connect as Slave ──────────────────────────── */
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
        if (devs.some(d => d.role === 'receiver') && !connectedRef.current) {
          connectedRef.current = true;
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
    connectedRef.current = false;
    toast.info('Conectando...');
  }, [code, connMode, multiManager]);

  /* ── WiFi Slave ────────────────────────────────── */
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
              if (devs.some(d => d.role === 'receiver') && !connectedRef.current) {
                connectedRef.current = true;
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
    setActionMirror([]);
    toast.info('Desconectado');
  }, [session, multiManager]);

  /* ── Send command (slave) ──────────────────────── */
  const send = useCallback((action: any, payload: any) => {
    if (!session) return;
    session.sendCommand(action, payload as Record<string, unknown>);
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
            {showQR && role === 'master' && (
              <div className="flex justify-center py-2">
                <div className="w-40 h-40 text-foreground" dangerouslySetInnerHTML={{ __html: qrSvg }} />
              </div>
            )}
          </div>
        )}

        {/* ═══ MASTER CONNECTED — with real hardware + action mirror ═══ */}
        {role === 'master' && connected && (
          <div className="space-y-3">
            {/* Real Hardware Status */}
            <div className="space-y-1.5">
              <p className="text-[9px] font-semibold uppercase text-muted-foreground tracking-wider">Hardware Status</p>
              <div className="grid grid-cols-3 gap-1.5">
                <div className={cn("bg-muted/20 rounded-lg p-2 text-center border", fireone.isConnected ? "border-primary/30" : "border-border/20")}>
                  <Zap className="w-3 h-3 mx-auto text-primary mb-0.5" />
                  <p className="text-[7px] text-muted-foreground">FireOne</p>
                  <p className="text-xs font-bold text-foreground">{fireone.modules.size}</p>
                  <p className="text-[7px] text-primary">{[...fireone.modules.values()].filter(m => m.armed).length} armed</p>
                  <p className="text-[6px] text-muted-foreground/60">{fireone.connectionPath}</p>
                </div>
                <div className={cn("bg-muted/20 rounded-lg p-2 text-center border", pbus.isConnected ? "border-accent/30" : "border-border/20")}>
                  <Radio className="w-3 h-3 mx-auto text-accent mb-0.5" />
                  <p className="text-[7px] text-muted-foreground">PBUS</p>
                  <p className="text-xs font-bold text-foreground">{pbus.devices.size}</p>
                  <p className="text-[7px] text-accent">{[...pbus.devices.values()].filter(d => d.armed).length} armed</p>
                  <p className="text-[6px] text-muted-foreground/60">{pbus.connectionPath}</p>
                </div>
                <div className="bg-muted/20 rounded-lg p-2 text-center border border-border/20">
                  <Battery className="w-3 h-3 mx-auto text-emerald-400 mb-0.5" />
                  <p className="text-[7px] text-muted-foreground">Battery</p>
                  <p className="text-xs font-bold text-foreground">
                    {pbus.worstBattery !== null ? `${pbus.worstBattery.toFixed(1)}V` : '—'}
                  </p>
                  <p className="text-[6px] text-muted-foreground/60">
                    {(fireone.isConnected || pbus.isConnected) ? 'connected' : 'offline'}
                  </p>
                </div>
              </div>
            </div>

            {/* Connected Slaves */}
            <div className="space-y-1.5">
              <p className="text-[9px] font-semibold uppercase text-muted-foreground tracking-wider">Slaves ({controllers.length})</p>
              {controllers.map(dev => {
                const perms = masterPermissions.get(dev.id) || DEFAULT_PERMISSIONS;
                return (
                  <div key={dev.id} className="bg-muted/20 rounded-lg p-2 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-[10px] font-semibold text-foreground">{dev.name}</span>
                        <span className="text-[7px] text-muted-foreground font-mono">{dev.id.slice(0, 6)}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-1">
                      {([
                        ['canArm', 'ARM', Shield],
                        ['canFire', 'FIRE', Zap],
                        ['canPanic', 'PANIC', AlertTriangle],
                        ['canAccessPanels', 'PANELS', LayoutGrid],
                      ] as const).map(([key, label, Icon]) => (
                        <button
                          key={key}
                          onClick={() => togglePermission(dev.id, key)}
                          className={cn(
                            "flex items-center justify-center gap-0.5 px-1 py-1 rounded text-[7px] font-bold uppercase border transition-colors",
                            perms[key]
                              ? "bg-primary/10 border-primary/30 text-primary"
                              : "bg-muted/30 border-border/30 text-muted-foreground/50"
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

            {/* Action Mirror — shows what slaves are doing */}
            {actionMirror.length > 0 && (
              <div className="space-y-1">
                <p className="text-[9px] font-semibold uppercase text-muted-foreground tracking-wider">🎮 Action Mirror</p>
                <div className="bg-muted/20 rounded-lg p-2 space-y-1">
                  {actionMirror.map((entry, i) => (
                    <div key={i} className={cn(
                      "flex items-center justify-between px-2 py-1 rounded text-[8px] transition-opacity",
                      i === 0 ? "bg-primary/10 text-foreground font-semibold" : "text-muted-foreground/70"
                    )}>
                      <span className="font-mono uppercase">{entry.action}</span>
                      <span className="text-[7px] font-mono">{new Date(entry.ts).toLocaleTimeString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Full Command Log */}
            {log.length > 0 && (
              <div className="space-y-1">
                <p className="text-[9px] font-semibold uppercase text-muted-foreground tracking-wider">Activity Log</p>
                <div className="bg-muted/20 rounded-lg p-2 space-y-0.5 max-h-24 overflow-y-auto">
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

        {/* ═══ SLAVE CONNECTED — FLAT COMMAND PAD ═══ */}
        {role === 'slave' && connected && (
          <div className="space-y-3">
            {/* Connection Status */}
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className={cn("text-[7px]", latencyColor)}>{latency}ms</Badge>
              {Object.entries(slavePermissions).filter(([, v]) => v).map(([key]) => (
                <Badge key={key} variant="secondary" className="text-[7px]">
                  {key.replace('can', '')}
                </Badge>
              ))}
              {sites.length > 1 && (
                <Badge variant="outline" className="text-[7px]">{sites.length} sites</Badge>
              )}
            </div>

            {/* Transport Row */}
            <div className="flex items-center justify-center gap-2">
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

            {/* Timeline Scrubber */}
            {remoteState && (
              <div className="px-1">
                <Slider value={[remoteState.currentTime]} max={remoteState.duration || 300} step={0.1} onValueChange={([v]) => send('transport', { type: 'seekTo', time: v })} className="w-full" />
                <div className="flex justify-between text-[8px] text-muted-foreground mt-1 font-mono">
                  <span>{formatTime(remoteState.currentTime)}</span>
                  <span>{formatTime(remoteState.duration)}</span>
                </div>
              </div>
            )}

            {/* Quick Actions Grid — 2×4 */}
            <div className="space-y-1">
              <p className="text-[9px] font-semibold uppercase text-muted-foreground tracking-wider">Quick Actions</p>
              <div className="grid grid-cols-4 gap-1.5">
                <button
                  className={cn("flex flex-col items-center gap-0.5 p-2.5 rounded-xl border active:scale-90 transition-transform",
                    slavePermissions.canArm ? "bg-red-500/10 border-red-500/30 text-red-400" : "bg-muted/20 border-border/30 text-muted-foreground/40"
                  )}
                  disabled={!slavePermissions.canArm}
                  onClick={() => {
                    if (confirm('ARM ALL?')) { send('hardware', { target: 'fireone', action: 'arm-all' }); haptics.fire(); }
                  }}
                >
                  <ShieldCheck className="w-5 h-5" />
                  <span className="text-[7px] font-bold">ARM</span>
                </button>

                <button
                  className={cn("flex flex-col items-center gap-0.5 p-2.5 rounded-xl border active:scale-90 transition-transform",
                    slavePermissions.canArm ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-muted/20 border-border/30 text-muted-foreground/40"
                  )}
                  disabled={!slavePermissions.canArm}
                  onClick={() => { send('hardware', { target: 'fireone', action: 'disarm-all' }); haptics.tap(); }}
                >
                  <Shield className="w-5 h-5" />
                  <span className="text-[7px] font-bold">DISARM</span>
                </button>

                <button
                  className="flex flex-col items-center gap-0.5 p-2.5 rounded-xl border bg-muted/20 border-border/30 text-foreground active:scale-90 transition-transform"
                  onClick={() => { send('hardware', { target: 'fireone', action: 'scan' }); haptics.tap(); }}
                >
                  <Crosshair className="w-5 h-5" />
                  <span className="text-[7px] font-bold">SCAN</span>
                </button>

                <button
                  className="flex flex-col items-center gap-0.5 p-2.5 rounded-xl border bg-muted/20 border-border/30 text-foreground active:scale-90 transition-transform"
                  onClick={() => { send('hardware', { target: 'fireone', action: 'continuity' }); haptics.tap(); }}
                >
                  <ScanLine className="w-5 h-5" />
                  <span className="text-[7px] font-bold">CONT</span>
                </button>

                <button
                  className={cn("flex flex-col items-center gap-0.5 p-2.5 rounded-xl border active:scale-90 transition-transform",
                    slavePermissions.canArm ? "bg-blue-500/10 border-blue-500/30 text-blue-400" : "bg-muted/20 border-border/30 text-muted-foreground/40"
                  )}
                  disabled={!slavePermissions.canArm}
                  onClick={() => { send('hardware', { target: 'pbus', action: 'arm-all' }); haptics.tap(); }}
                >
                  <Power className="w-5 h-5" />
                  <span className="text-[7px] font-bold">PBUS+</span>
                </button>

                <button
                  className={cn("flex flex-col items-center gap-0.5 p-2.5 rounded-xl border active:scale-90 transition-transform",
                    slavePermissions.canArm ? "bg-blue-500/10 border-blue-500/30 text-blue-400" : "bg-muted/20 border-border/30 text-muted-foreground/40"
                  )}
                  disabled={!slavePermissions.canArm}
                  onClick={() => { send('hardware', { target: 'pbus', action: 'disarm-all' }); haptics.tap(); }}
                >
                  <Power className="w-5 h-5" />
                  <span className="text-[7px] font-bold">PBUS−</span>
                </button>

                <button
                  className="flex flex-col items-center gap-0.5 p-2.5 rounded-xl border bg-muted/20 border-border/30 text-foreground active:scale-90 transition-transform"
                  onClick={() => { send('undo', {}); haptics.tap(); }}
                >
                  <Undo2 className="w-5 h-5" />
                  <span className="text-[7px] font-bold">UNDO</span>
                </button>

                <button
                  className="flex flex-col items-center gap-0.5 p-2.5 rounded-xl border bg-muted/20 border-border/30 text-foreground active:scale-90 transition-transform"
                  onClick={() => { send('redo', {}); haptics.tap(); }}
                >
                  <Redo2 className="w-5 h-5" />
                  <span className="text-[7px] font-bold">REDO</span>
                </button>
              </div>
            </div>

            {/* SFX Triggers — single row */}
            <div className="space-y-1">
              <p className="text-[9px] font-semibold uppercase text-muted-foreground tracking-wider">SFX</p>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { type: 'flame', icon: Flame, label: 'Flame', color: 'bg-orange-500/15 text-orange-400 border-orange-500/30' },
                  { type: 'co2', icon: Snowflake, label: 'CO₂', color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
                  { type: 'spark', icon: Sparkles, label: 'Spark', color: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' },
                  { type: 'haze', icon: Wind, label: 'Haze', color: 'bg-purple-500/15 text-purple-400 border-purple-500/30' },
                ].map(fx => (
                  <button
                    key={fx.type}
                    className={cn("flex flex-col items-center gap-0.5 p-2.5 rounded-xl border active:scale-90 transition-transform", fx.color)}
                    onClick={() => { send('effect', { type: fx.type, action: 'fire' }); haptics.fire(); }}
                  >
                    <fx.icon className="w-5 h-5" />
                    <span className="text-[7px] font-bold">{fx.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Panels Quick-Launch — horizontal scroll */}
            {slavePermissions.canAccessPanels && (
              <div className="space-y-1">
                <p className="text-[9px] font-semibold uppercase text-muted-foreground tracking-wider">Panels</p>
                <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
                  {PANEL_SHORTCUTS.map(panel => (
                    <button
                      key={panel.id}
                      className="flex-shrink-0 flex flex-col items-center gap-0.5 w-12 p-1.5 rounded-lg bg-muted/20 border border-border/30 hover:bg-primary/10 hover:border-primary/30 transition-colors active:scale-95"
                      onClick={() => { send('open-panel', { panelId: panel.id }); haptics.tap(); }}
                    >
                      <span className="text-sm">{panel.icon}</span>
                      <span className="text-[6px] font-semibold text-muted-foreground truncate w-full text-center">{panel.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Camera Orbit Pad */}
            <div className="space-y-1">
              <p className="text-[9px] font-semibold uppercase text-muted-foreground tracking-wider">Câmera 3D</p>
              <div
                className="w-full h-24 bg-muted/20 border border-border/50 rounded-xl flex items-center justify-center touch-none cursor-move relative"
                onTouchStart={handleOrbitStart}
                onTouchMove={handleOrbitMove}
                onTouchEnd={handleOrbitEnd}
                onMouseDown={handleOrbitStart}
                onMouseMove={handleOrbitMove}
                onMouseUp={handleOrbitEnd}
                onMouseLeave={handleOrbitEnd}
              >
                <Move className="w-6 h-6 text-muted-foreground/30" />
                <span className="absolute bottom-1 text-[7px] text-muted-foreground/40">Arraste para orbitar</span>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="flex-1 h-7 text-[9px]" onClick={() => send('camera', { type: 'zoom', delta: -1 })}>−</Button>
                <Button size="sm" variant="outline" className="flex-1 h-7 text-[9px]" onClick={() => send('camera', { type: 'reset' })}>Reset</Button>
                <Button size="sm" variant="outline" className="flex-1 h-7 text-[9px]" onClick={() => send('camera', { type: 'zoom', delta: 1 })}>+</Button>
              </div>
            </div>

            {/* ═══ PANIC BAR — always at bottom ═══ */}
            <Button
              variant="destructive"
              className="w-full h-14 text-lg font-black uppercase tracking-widest"
              disabled={!slavePermissions.canPanic}
              onClick={() => { send('panic', {}); haptics.panic(); toast.error('🚨 PANIC — All stop!'); }}
            >
              <AlertTriangle className="w-6 h-6 mr-2" /> PANIC
            </Button>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
