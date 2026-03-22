/**
 * PyroFireOnePanel — FXK-PYRO style pyrotechnic firing panel
 * Full XL4 replica: 99 modules × 32 igniters, continuity, safety interlocks,
 * Manual / Step / Timecode / Test modes, AutoFire bridge
 * Includes DEDICATED FULLSCREEN mode replicating the real XL4 10.1" display
 */
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { haptics } from '@/lib/haptics';
import { createPortal } from 'react-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Shield, ShieldAlert, Hand, AlertTriangle, Zap, Radio,
  ChevronLeft, ChevronRight, RotateCcw, Play, Square, SkipForward,
  CheckCircle2, XCircle, Clock, Activity, Battery, Signal,
  Lock, Unlock, Search, Download, Upload, Maximize2, Minimize2, X,
  Wifi, WifiOff, Usb, ScanLine, Info, Globe
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { SFXChannel, AutoFireCue } from './types';
import { DEMO_CUES } from './AutoFirePanel';
import { formatTimecode } from './constants';
import { useFireOneHardware } from '@/hooks/useFireOneHardware';
import { parseFireOneCSV, parseFireOneFIR, exportFireOneCSV, downloadFile, autoDetectAndParse } from '@/lib/fireoneScriptParser';
import type { WirelessConnectionMode } from '@/lib/fireoneProtocol';
import { artnetModuleService } from '@/services/artnetModuleService';

interface FireLogEntry {
  cueId: string;
  expectedMs: number;
  actualMs: number;
  delta: number;
  status: 'OK' | 'LATE' | 'EARLY';
}

interface PyroFireOnePanelProps {
  fs: boolean;
  fireChannel: (id: string) => void;
  channels: SFXChannel[];
  pyroArm: boolean;
  dmxArm: boolean;
  handlePanic: () => void;
  artNetConnected: boolean;
  relayConnected: boolean;
}

type PyroMode = 'manual' | 'step' | 'timecode' | 'test';

interface FieldModule {
  address: number;
  connected: boolean;
  armed: boolean;
  batteryVoltage: number;
  signalStrength: number;
  temperature: number;
  igniters: IgniterState[];
  connectionMode?: WirelessConnectionMode;
  rssiDbm?: number;
  wirelessChannel?: number;
  packetLoss?: number;
  linkQuality?: number;
}

interface IgniterState {
  position: number;
  connected: boolean;
  fired: boolean;
  resistance: number;
  misfire: boolean;
}

function createSimModule(addr: number, connected: boolean, wireless = false): FieldModule {
  const rssi = wireless ? -(40 + Math.random() * 40) : undefined;
  return {
    address: addr,
    connected,
    armed: false,
    batteryVoltage: connected ? 11.2 + Math.random() * 1.6 : 0,
    signalStrength: connected ? 60 + Math.random() * 40 : 0,
    temperature: connected ? 18 + Math.random() * 12 : 0,
    connectionMode: wireless ? 'wireless' : 'wired',
    rssiDbm: rssi,
    wirelessChannel: wireless ? 1 + Math.floor(Math.random() * 16) : undefined,
    packetLoss: wireless ? Math.floor(Math.random() * 5) : undefined,
    linkQuality: wireless ? 80 + Math.floor(Math.random() * 20) : undefined,
    igniters: Array.from({ length: 32 }, (_, i) => ({
      position: i + 1,
      connected: connected && Math.random() > 0.15,
      fired: false,
      resistance: connected ? (Math.random() > 0.15 ? 1.2 + Math.random() * 8 : 0) : 0,
      misfire: false,
    })),
  };
}

export default function PyroFireOnePanel({
  fs, fireChannel, channels, pyroArm, dmxArm, handlePanic, artNetConnected, relayConnected,
}: PyroFireOnePanelProps) {
  const isMobile = useIsMobile();
  const hardware = useFireOneHardware();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pyroMode, setPyroMode] = useState<PyroMode>('manual');
  const [modules, setModules] = useState<FieldModule[]>(() => {
    const mods: FieldModule[] = [];
    for (let i = 1; i <= 4; i++) mods.push(createSimModule(i, true, false));
    for (let i = 5; i <= 6; i++) mods.push(createSimModule(i, true, true));
    return mods;
  });
  const [selectedModule, setSelectedModule] = useState(1);
  const [masterKeyOn, setMasterKeyOn] = useState(false);
  const [simMode, setSimMode] = useState(true);
  const [pyroFullscreen, setPyroFullscreen] = useState(false);
  const [artnetLinking, setArtnetLinking] = useState(false);
  const [artnetLinkedModules, setArtnetLinkedModules] = useState<Set<number>>(new Set());
  const [artnetLatencies, setArtnetLatencies] = useState<Map<number, number>>(new Map());

  // Simulate latency polling for linked modules
  useEffect(() => {
    if (artnetLinkedModules.size === 0) return;
    const iv = setInterval(() => {
      setArtnetLatencies(prev => {
        const next = new Map(prev);
        artnetLinkedModules.forEach(addr => {
          const mod = modules.find(m => m.address === addr);
          const base = mod?.connectionMode === 'wireless' ? 8 : 2;
          const jitter = Math.random() * 6;
          next.set(addr, Math.round(base + jitter));
        });
        return next;
      });
    }, 2000);
    return () => clearInterval(iv);
  }, [artnetLinkedModules, modules]);

  // Step mode
  const [stepIndex, setStepIndex] = useState(0);
  const [stepCues, setStepCues] = useState<AutoFireCue[]>([]);

  // Timecode mode
  const [tcRunning, setTcRunning] = useState(false);
  const [tcTimeMs, setTcTimeMs] = useState(0);
  const [tcCues, setTcCues] = useState<AutoFireCue[]>([]);
  const tcTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const tcFiredSet = useRef<Set<string>>(new Set());

  const currentModule = useMemo(() => modules.find(m => m.address === selectedModule), [modules, selectedModule]);

  const canFire = masterKeyOn && (pyroArm || dmxArm);

  // Fire confirmation log for timecode mode
  const [fireLog, setFireLog] = useState<FireLogEntry[]>([]);

  // Mobile hold-to-fire state
  const [holdingIgniter, setHoldingIgniter] = useState<{ moduleAddr: number; pos: number } | null>(null);
  const [holdProgress, setHoldProgress] = useState(0);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdAnimRef = useRef<number | null>(null);
  const holdStartRef = useRef<number>(0);

  // Module scanner state
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);

  // Mission clock
  const [missionClock, setMissionClock] = useState('00:00:00');
  useEffect(() => {
    const iv = setInterval(() => {
      const now = new Date();
      setMissionClock(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`);
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  // Hold-to-fire handlers for mobile
  const startHoldFire = useCallback((moduleAddr: number, pos: number) => {
    setHoldingIgniter({ moduleAddr, pos });
    holdStartRef.current = performance.now();
    const animate = () => {
      const elapsed = performance.now() - holdStartRef.current;
      const progress = Math.min(elapsed / 300, 1);
      setHoldProgress(progress);
      if (progress < 1) {
        holdAnimRef.current = requestAnimationFrame(animate);
      } else {
        // Fire!
        fireIgniter(moduleAddr, pos);
        setHoldingIgniter(null);
        setHoldProgress(0);
      }
    };
    holdAnimRef.current = requestAnimationFrame(animate);
  }, []);

  const cancelHoldFire = useCallback(() => {
    if (holdAnimRef.current) cancelAnimationFrame(holdAnimRef.current);
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    setHoldingIgniter(null);
    setHoldProgress(0);
  }, []);

  // Module scan animation
  const handleModuleScan = useCallback(async () => {
    setScanning(true);
    setScanProgress(0);
    const steps = 20;
    for (let i = 0; i <= steps; i++) {
      await new Promise(r => setTimeout(r, 100));
      setScanProgress((i / steps) * 100);
    }
    if (hardware.isConnected) {
      await hardware.discoverModules(30);
      toast.success(`Scan complete — ${hardware.modules.size} modules found`);
    } else {
      toast.success(`SIM Scan — ${modules.filter(m => m.connected).length} modules online`);
    }
    setScanning(false);
  }, [hardware, modules]);

  // Lock body scroll when fullscreen
  useEffect(() => {
    if (!pyroFullscreen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [pyroFullscreen]);

  // Browser fullscreen API sync
  useEffect(() => {
    if (pyroFullscreen) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    }
    return () => {
      if (pyroFullscreen && document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {});
      }
    };
  }, [pyroFullscreen]);

  useEffect(() => {
    const onFsChange = () => {
      if (!document.fullscreenElement && pyroFullscreen) setPyroFullscreen(false);
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, [pyroFullscreen]);

  // Sync hardware modules → local state when in HARDWARE mode
  useEffect(() => {
    if (simMode || !hardware.isConnected) return;
    const hwModules = Array.from(hardware.modules.values());
    if (hwModules.length === 0) return;
    setModules(hwModules.map(hm => ({
      address: hm.moduleAddress,
      connected: true,
      armed: hm.armed,
      batteryVoltage: hm.batteryVoltage,
      signalStrength: hm.signalStrength,
      temperature: hm.temperature,
      connectionMode: hm.connectionMode,
      rssiDbm: hm.rssiDbm,
      wirelessChannel: hm.wirelessChannel,
      packetLoss: hm.packetLoss,
      linkQuality: hm.linkQuality,
      igniters: hm.igniters.map(ig => ({
        position: ig.position,
        connected: ig.connected,
        fired: ig.fired,
        resistance: ig.resistance,
        misfire: false,
      })),
    })));
  }, [simMode, hardware.isConnected, hardware.modules]);

  // Import pyro cues from AutoFire
  const importPyroCues = useCallback(() => {
    const pyroCues = DEMO_CUES.filter(c => c.device === 'pyro');
    setTcCues(pyroCues);
    setStepCues(pyroCues);
    setStepIndex(0);
    toast.success(`Imported ${pyroCues.length} pyro cues from AutoFire`);
    supabase.channel('fxc-pyro-sync').send({
      type: 'broadcast', event: 'pyro-cues-sync',
      payload: { cues: pyroCues },
    }).catch(() => {});
  }, []);

  // Import FireOne CSV/FIR file
  const handleFileImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const { cues, source } = autoDetectAndParse(text, file.name);
      if (cues.length === 0) {
        toast.error('No valid cues found in file');
        return;
      }
      setTcCues(cues);
      setStepCues(cues);
      setStepIndex(0);
      toast.success(`Imported ${cues.length} cues from ${source} (${file.name})`);
    };
    reader.readAsText(file);
    e.target.value = '';
  }, []);

  // Export current cues to FireOne CSV
  const handleExportCSV = useCallback(() => {
    const allCues = tcCues.length > 0 ? tcCues : stepCues;
    if (allCues.length === 0) {
      toast.error('No cues to export');
      return;
    }
    const csv = exportFireOneCSV(allCues);
    downloadFile(csv, 'fireone_script.csv');
    toast.success(`Exported ${allCues.length} cues to FireOne CSV`);
  }, [tcCues, stepCues]);

  // Hardware connect/disconnect
  const handleHardwareConnect = useCallback(async () => {
    try {
      await hardware.connect();
      setSimMode(false);
      toast.success('🔌 Connected to RS-485 bus');
    } catch (err: any) {
      toast.error(err.message || 'Failed to connect');
    }
  }, [hardware]);

  const handleHardwareDisconnect = useCallback(async () => {
    await hardware.disconnect();
    setSimMode(true);
    toast.info('Disconnected from hardware');
  }, [hardware]);

  // Hardware module scan
  const handleScan = useCallback(async () => {
    if (!hardware.isConnected) {
      toast.error('Connect to hardware first');
      return;
    }
    toast.info('Scanning RS-485 bus for IFMx-i32Q modules...');
    await hardware.discoverModules(30);
    toast.success(`Scan complete — ${hardware.modules.size} modules found`);
  }, [hardware]);

  // ARM module — routes through hardware when not SIM
  const armModule = useCallback((addr: number, armed: boolean) => {
    if (!masterKeyOn) { toast.error('Master Key must be ON to arm'); return; }
    if (!simMode && hardware.isConnected) {
      (armed ? hardware.armModule(addr) : hardware.disarmModule(addr)).catch(() => {});
    }
    setModules(prev => prev.map(m => m.address === addr ? { ...m, armed } : m));
    toast.info(`Module FM-${String(addr).padStart(2, '0')} ${armed ? 'ARMED' : 'DISARMED'}`);
  }, [masterKeyOn, simMode, hardware]);

  const armAll = useCallback((armed: boolean) => {
    if (!masterKeyOn) { toast.error('Master Key must be ON'); return; }
    if (!simMode && hardware.isConnected) {
      (armed ? hardware.armAll() : hardware.disarmAll()).catch(() => {});
    }
    setModules(prev => prev.map(m => m.connected ? { ...m, armed } : m));
    toast.warning(armed ? '⚠️ ALL MODULES ARMED' : 'All modules disarmed');
  }, [masterKeyOn, simMode, hardware]);

  // Fire igniter — routes through hardware when not SIM
  const fireIgniter = useCallback((moduleAddr: number, igniterPos: number) => {
    if (!canFire) return;
    const mod = modules.find(m => m.address === moduleAddr);
    if (!mod?.armed || !mod.connected) return;
    const ig = mod.igniters.find(i => i.position === igniterPos);
    if (!ig?.connected || ig.fired) return;

    haptics.fire();

    // Route through hardware when connected
    if (!simMode && hardware.isConnected) {
      hardware.fireIgniter(moduleAddr, igniterPos, 500).catch(() => {
        toast.error(`Misfire: No ACK from FM-${String(moduleAddr).padStart(2, '0')}`);
        setModules(prev => prev.map(m => {
          if (m.address !== moduleAddr) return m;
          return { ...m, igniters: m.igniters.map(i => i.position === igniterPos ? { ...i, misfire: true } : i) };
        }));
      });
    }

    setModules(prev => prev.map(m => {
      if (m.address !== moduleAddr) return m;
      return {
        ...m,
        igniters: m.igniters.map(i => {
          if (i.position !== igniterPos) return i;
          const misfire = simMode ? Math.random() < 0.03 : false;
          return { ...i, fired: !misfire, misfire, resistance: misfire ? i.resistance : 0 };
        }),
      };
    }));

    const chIdx = (moduleAddr - 1) * 32 + (igniterPos - 1);
    if (chIdx < channels.length) fireChannel(channels[chIdx].id);

    supabase.channel('fxc-mobile-link').send({
      type: 'broadcast', event: 'fxc-fire',
      payload: { channelId: chIdx < channels.length ? channels[chIdx].id : null, module: moduleAddr, igniter: igniterPos, source: 'pyro-panel' },
    }).catch(() => {});

    toast.success(`FIRE FM-${String(moduleAddr).padStart(2, '0')} · I-${String(igniterPos).padStart(2, '0')}`, { duration: 1500 });
  }, [canFire, modules, channels, fireChannel, simMode, hardware]);

  // Step mode
  const stepFire = useCallback(() => {
    if (!canFire || stepCues.length === 0) return;
    const cue = stepCues[stepIndex];
    if (!cue) return;
    const addrs = cue.addresses.split(':').map(Number);
    addrs.forEach(a => {
      const modAddr = Math.floor(a / 32) + 1;
      const igPos = (a % 32) + 1;
      fireIgniter(modAddr, igPos);
    });
    setStepIndex(prev => Math.min(prev + 1, stepCues.length - 1));
  }, [canFire, stepCues, stepIndex, fireIgniter]);

  // Timecode mode
  useEffect(() => {
    if (!tcRunning) return;
    tcTimer.current = setInterval(() => {
      setTcTimeMs(prev => {
        const next = prev + 100;
        tcCues.forEach(cue => {
          if (!tcFiredSet.current.has(cue.id) && next >= cue.timecodeMs) {
            tcFiredSet.current.add(cue.id);
            const addrs = cue.addresses.split(':').map(Number);
            addrs.forEach(a => {
              const modAddr = Math.floor(a / 32) + 1;
              const igPos = (a % 32) + 1;
              fireIgniter(modAddr, igPos);
            });
          }
        });
        return next;
      });
    }, 100);
    return () => { if (tcTimer.current) clearInterval(tcTimer.current); };
  }, [tcRunning, tcCues, fireIgniter]);

  const resetTimecode = useCallback(() => {
    setTcRunning(false);
    setTcTimeMs(0);
    tcFiredSet.current.clear();
    if (tcTimer.current) clearInterval(tcTimer.current);
  }, []);

  // Continuity test — routes through hardware when not SIM
  const runContinuityTest = useCallback(() => {
    if (!currentModule?.connected) return;
    toast.info(`Testing FM-${String(selectedModule).padStart(2, '0')} continuity...`);
    if (!simMode && hardware.isConnected) {
      hardware.requestContinuity(selectedModule).catch(() => {});
      return; // Hardware response will update state via useFireOneHardware
    }
    setTimeout(() => {
      setModules(prev => prev.map(m => {
        if (m.address !== selectedModule) return m;
        return {
          ...m,
          igniters: m.igniters.map(ig => ({
            ...ig,
            resistance: ig.connected ? 1.5 + Math.random() * 6 : 0,
          })),
        };
      }));
      const mod = modules.find(m => m.address === selectedModule);
      const good = mod?.igniters.filter(i => i.connected).length || 0;
      toast.success(`Continuity: ${good}/32 OK`);
    }, 1200);
  }, [currentModule, selectedModule, modules, simMode, hardware]);

  // ── ArtNet Link: discover and connect Art-Net modules ──
  const handleArtnetLink = useCallback(async () => {
    setArtnetLinking(true);
    toast.info('ARTNET LINK: Scanning for Art-Net modules...');
    try {
      // Init controller if needed
      let ctrl = artnetModuleService.getController();
      if (!ctrl) {
        ctrl = artnetModuleService.initController({ name: 'FXK-PYRO ARTNET BRIDGE' });
      }
      // Discover via ArtPoll
      await artnetModuleService.discoverModules();
      // For each XL4 field module, register in Art-Net service if not already
      const registered = new Set<number>();
      for (const m of modules) {
        if (!m.connected) continue;
        const existing = ctrl.modules.find(am => am.moduleAddress === m.address);
        if (!existing) {
          artnetModuleService.addModule({
            name: `FM-${String(m.address).padStart(2, '0')}`,
            moduleAddress: m.address,
            ip: '192.168.1.' + (100 + m.address),
            transport: 'lan',
            channelCount: 32,
            dmxStartAddress: (m.address - 1) * 32 + 1,
            label: `XL4 Module ${m.address}`,
          });
        }
        registered.add(m.address);
      }
      // Connect all registered modules
      await artnetModuleService.connectAllModules();
      setArtnetLinkedModules(registered);
      toast.success(`ARTNET LINK: ${registered.size} modules linked via Art-Net`);
    } catch (err: any) {
      toast.error(`ARTNET LINK failed: ${err.message}`);
    } finally {
      setArtnetLinking(false);
    }
  }, [modules]);

  const handleModuleArtnetLink = useCallback(async (moduleAddr: number) => {
    try {
      let ctrl = artnetModuleService.getController();
      if (!ctrl) {
        ctrl = artnetModuleService.initController({ name: 'FXK-PYRO ARTNET BRIDGE' });
      }
      const existing = ctrl.modules.find(am => am.moduleAddress === moduleAddr);
      if (existing) {
        // Already registered — toggle connect/disconnect
        const state = artnetModuleService.getModuleState(existing.id);
        if (state === 'connected') {
          artnetModuleService.disconnectModule(existing.id);
          setArtnetLinkedModules(prev => { const n = new Set(prev); n.delete(moduleAddr); return n; });
          toast.info(`FM-${String(moduleAddr).padStart(2, '0')}: Art-Net unlinked`);
        } else {
          await artnetModuleService.connectModule(existing.id);
          setArtnetLinkedModules(prev => new Set(prev).add(moduleAddr));
          toast.success(`FM-${String(moduleAddr).padStart(2, '0')}: Art-Net linked`);
        }
      } else {
        const mod = artnetModuleService.addModule({
          name: `FM-${String(moduleAddr).padStart(2, '0')}`,
          moduleAddress: moduleAddr,
          ip: '192.168.1.' + (100 + moduleAddr),
          transport: 'lan',
          channelCount: 32,
          dmxStartAddress: (moduleAddr - 1) * 32 + 1,
          label: `XL4 Module ${moduleAddr}`,
        });
        await artnetModuleService.connectModule(mod.id);
        setArtnetLinkedModules(prev => new Set(prev).add(moduleAddr));
        toast.success(`FM-${String(moduleAddr).padStart(2, '0')}: Art-Net linked`);
      }
    } catch (err: any) {
      toast.error(`Art-Net link failed: ${err.message}`);
    }
  }, []);

  const connectedCount = modules.filter(m => m.connected).length;
  const armedModCount = modules.filter(m => m.armed).length;
  const totalIgniters = modules.reduce((sum, m) => sum + m.igniters.filter(i => i.connected && !i.fired).length, 0);
  const firedCount = modules.reduce((sum, m) => sum + m.igniters.filter(i => i.fired).length, 0);
  const misfireCount = modules.reduce((sum, m) => sum + m.igniters.filter(i => i.misfire).length, 0);
  const wirelessCount = modules.filter(m => m.connectionMode === 'wireless' || m.connectionMode === 'fallback').length;
  const wiredCount = modules.filter(m => m.connectionMode === 'wired' || !m.connectionMode).length;
  const fallbackCount = modules.filter(m => m.connectionMode === 'fallback').length;

  // RSSI color helper
  const rssiColor = (rssi?: number) => {
    if (rssi === undefined) return 'text-muted-foreground/30';
    if (rssi > -60) return 'text-green-400';
    if (rssi > -75) return 'text-amber-400';
    return 'text-red-400';
  };
  const rssiIcon = (rssi?: number) => {
    if (rssi === undefined) return 'bg-muted-foreground/20';
    if (rssi > -60) return 'bg-green-500';
    if (rssi > -75) return 'bg-amber-400';
    return 'bg-red-500';
  };
  const connectionModeIcon = (mode?: WirelessConnectionMode) => {
    if (mode === 'wireless') return Wifi;
    if (mode === 'fallback') return WifiOff;
    return Usb;
  };
  const connectionModeBadge = (mode?: WirelessConnectionMode) => {
    if (mode === 'wireless') return { text: 'WIRELESS', cls: 'text-cyan-400 bg-cyan-400/10 border-cyan-500/20' };
    if (mode === 'fallback') return { text: 'FALLBACK', cls: 'text-amber-400 bg-amber-400/10 border-amber-500/20 animate-pulse' };
    return { text: 'WIRED', cls: 'text-green-400/70 bg-green-400/10 border-green-500/15' };
  };

  // ── Determine sizing: xl = dedicated fullscreen, fs = parent fullscreen, default = panel
  const xl = pyroFullscreen;
  const mob = isMobile;
  const sz = xl ? 'xl' : fs ? 'fs' : 'sm';

  // ── Hidden file input for CSV/FIR import ──
  const renderFileInput = () => (
    <input ref={fileInputRef} type="file" accept=".csv,.fir,.sem,.ses" onChange={handleFileImport} className="hidden" />
  );

  // ── Render: Hardware connection bar ──
  const renderConnectionBar = () => (
    <div className={cn(
      "flex items-center gap-2 border-b border-border/10",
      sz === 'xl' ? "px-6 py-1.5" : sz === 'fs' ? "px-4 py-1" : "px-2 py-0.5"
    )} style={{ background: 'hsl(220 12% 5%)' }}>
      {/* Connection status */}
      <div className={cn("flex items-center gap-1.5",
        sz === 'xl' ? "text-[10px]" : sz === 'fs' ? "text-[8px]" : "text-[8px]"
      )}>
        {hardware.isConnected ? (
          <Usb className={cn(sz === 'xl' ? "w-3.5 h-3.5" : "w-2.5 h-2.5", "text-green-400")} />
        ) : (
          <WifiOff className={cn(sz === 'xl' ? "w-3.5 h-3.5" : "w-2.5 h-2.5", "text-muted-foreground/30")} />
        )}
        <span className={cn("font-mono font-bold",
          hardware.isConnected ? "text-green-400/80" : "text-muted-foreground/30"
        )}>
          {hardware.isConnected ? 'HARDWARE' : 'DISCONNECTED'}
        </span>
      </div>

      {/* Wireless / Wired module counts */}
      <div className={cn("flex items-center gap-1.5 font-mono",
        sz === 'xl' ? "text-[9px]" : "text-[8px]"
      )}>
        {wirelessCount > 0 && (
          <span className="flex items-center gap-0.5 text-cyan-400/60">
            <Wifi className={cn(sz === 'xl' ? "w-3 h-3" : "w-2 h-2")} />{wirelessCount}
          </span>
        )}
        {fallbackCount > 0 && (
          <span className="flex items-center gap-0.5 text-amber-400/70 animate-pulse">
            <WifiOff className={cn(sz === 'xl' ? "w-3 h-3" : "w-2 h-2")} />{fallbackCount}
          </span>
        )}
        <span className="flex items-center gap-0.5 text-green-400/40">
          <Usb className={cn(sz === 'xl' ? "w-3 h-3" : "w-2 h-2")} />{wiredCount}
        </span>
      </div>

      {/* TX/RX counters (when connected) */}
      {hardware.isConnected && (
        <span className={cn("font-mono text-muted-foreground/25",
          sz === 'xl' ? "text-[9px]" : "text-[8px]"
        )}>TX:{hardware.txBytes} RX:{hardware.rxBytes}</span>
      )}

      <div className="ml-auto flex items-center gap-1">
        {/* Connect / Disconnect */}
        {hardware.isConnected ? (
          <button onClick={handleHardwareDisconnect}
            className={cn("rounded border font-bold uppercase transition-all",
              sz === 'xl' ? "px-3 py-1 text-[9px]" : "px-2 py-0.5 text-[8px]",
              "bg-red-600/10 border-red-500/20 text-red-400/70"
            )}>DISCONNECT</button>
        ) : (
          <button onClick={handleHardwareConnect}
            className={cn("rounded border font-bold uppercase transition-all",
              sz === 'xl' ? "px-3 py-1 text-[9px]" : "px-2 py-0.5 text-[8px]",
              "bg-green-600/10 border-green-500/20 text-green-400/70 hover:bg-green-600/15"
            )}>CONNECT RS-485</button>
        )}

        {/* Scan */}
        {hardware.isConnected && (
          <button onClick={handleScan} disabled={hardware.scanning}
            className={cn("rounded border font-bold uppercase transition-all",
              sz === 'xl' ? "px-3 py-1 text-[9px]" : "px-2 py-0.5 text-[8px]",
              hardware.scanning
                ? "bg-cyan-600/10 border-cyan-500/20 text-cyan-400/70 animate-pulse"
                : "bg-cyan-600/10 border-cyan-500/15 text-cyan-400/50 hover:text-cyan-400/70"
            )}>
            <ScanLine className={cn(sz === 'xl' ? "w-3 h-3 inline mr-1" : "w-2 h-2 inline mr-0.5")} />
            {hardware.scanning ? 'SCANNING...' : 'SCAN'}
          </button>
        )}

        {/* ARTNET LINK */}
        <button onClick={handleArtnetLink} disabled={artnetLinking}
          className={cn("rounded border font-bold uppercase transition-all",
            sz === 'xl' ? "px-3 py-1 text-[9px]" : "px-2 py-0.5 text-[8px]",
            artnetLinking
              ? "bg-violet-600/15 border-violet-500/30 text-violet-400/80 animate-pulse"
              : artnetLinkedModules.size > 0
                ? "bg-violet-600/15 border-violet-500/25 text-violet-400/70"
                : "bg-violet-600/10 border-violet-500/15 text-violet-400/50 hover:text-violet-400/70"
          )}>
          <Globe className={cn(sz === 'xl' ? "w-3 h-3 inline mr-1" : "w-2 h-2 inline mr-0.5")} />
          {artnetLinking ? 'LINKING...' : artnetLinkedModules.size > 0 ? `ARTNET ✓${artnetLinkedModules.size}` : 'ARTNET LINK'}
        </button>

        {/* Import / Export */}
        <button onClick={() => fileInputRef.current?.click()}
          className={cn("rounded border font-bold uppercase transition-all",
            sz === 'xl' ? "px-3 py-1 text-[9px]" : "px-2 py-0.5 text-[8px]",
            "bg-amber-600/10 border-amber-500/15 text-amber-400/50 hover:text-amber-400/70"
          )}>
          <Upload className={cn(sz === 'xl' ? "w-3 h-3 inline mr-1" : "w-2 h-2 inline mr-0.5")} />CSV
        </button>
        <button onClick={handleExportCSV}
          className={cn("rounded border font-bold uppercase transition-all",
            sz === 'xl' ? "px-3 py-1 text-[9px]" : "px-2 py-0.5 text-[8px]",
            "border-border/10 text-muted-foreground/30 hover:text-muted-foreground/50"
          )}>
          <Download className={cn(sz === 'xl' ? "w-3 h-3 inline mr-1" : "w-2 h-2 inline mr-0.5")} />CSV
        </button>
      </div>
    </div>
  );

  // ── Render: Header — XL4+ 2.0 Heritage (FireOne XL4+ LCD + brushed metal) ──
  const renderHeader = () => {
    // Output group indicators (A=1-8, B=9-16, C=17-24, D=25-32)
    const outputGroups = ['A', 'B', 'C', 'D'].map((label, gi) => {
      const groupMods = modules.filter(m => m.address >= gi * 8 + 1 && m.address <= (gi + 1) * 8);
      const groupConnected = groupMods.filter(m => m.connected).length;
      const groupArmed = groupMods.filter(m => m.armed).length;
      return { label, connected: groupConnected, armed: groupArmed, total: groupMods.length };
    });

    return (
      <div className={cn(
        "border-b flex flex-col",
      )} style={{ background: 'linear-gradient(180deg, hsl(0 5% 12%) 0%, hsl(0 5% 8%) 100%)' }}>
        {/* Amber accent line at top — BR2049 */}
        <div className="h-[2px]" style={{
          background: 'linear-gradient(90deg, transparent, hsl(32 100% 50% / 0.6), hsl(38 100% 58% / 0.8), hsl(32 100% 50% / 0.6), transparent)',
          boxShadow: '0 0 8px hsl(32 100% 50% / 0.3)',
        }} />
        {/* Dark glass header bar — BR2049 */}
        <div className={cn(
          "flex items-center justify-between",
          sz === 'xl' ? "px-6 py-2.5" : sz === 'fs' ? "px-4 py-2" : "px-2 py-1"
        )} style={{
          background: 'linear-gradient(180deg, hsl(220 18% 7% / 0.95) 0%, hsl(220 20% 4% / 0.98) 100%)',
          borderBottom: '1px solid hsl(32 100% 50% / 0.15)',
        }}>
          <div className="flex items-center gap-3">
            {/* Key switch graphic */}
            <div className={cn(
              "rounded-full flex items-center justify-center shrink-0 transition-transform duration-300",
              sz === 'xl' ? "w-10 h-10" : "w-7 h-7"
            )} style={{
              background: 'radial-gradient(circle at 40% 35%, hsl(0 0% 55%), hsl(0 0% 30%) 60%, hsl(0 0% 20%) 100%)',
              border: '2px solid hsl(0 0% 40%)',
              boxShadow: masterKeyOn ? '0 0 12px rgba(255,50,30,0.4), inset 0 0 6px rgba(0,0,0,0.5)' : 'inset 0 0 6px rgba(0,0,0,0.5)',
            }}>
              <div className={cn(sz === 'xl' ? "w-4 h-0.5" : "w-3 h-[1px]")} style={{
                background: masterKeyOn ? 'hsl(0 80% 55%)' : 'hsl(0 0% 50%)',
                transform: masterKeyOn ? 'rotate(45deg)' : 'rotate(0deg)',
                transition: 'transform 0.3s ease, background 0.3s ease',
                boxShadow: masterKeyOn ? '0 0 4px rgba(255,80,50,0.6)' : 'none',
              }} />
            </div>
            <div>
              <div className={cn("font-black tracking-[0.2em]",
                sz === 'xl' ? "text-sm" : sz === 'fs' ? "text-xs" : "text-[9px]"
              )} style={{ color: 'hsl(32 100% 55%)', textShadow: '0 0 12px hsl(32 100% 50% / 0.3)' }}>FXK-PYRO</div>
              <div className={cn("font-mono tracking-[0.15em]",
                sz === 'xl' ? "text-[9px]" : "text-[7px]",
              )} style={{ color: 'hsl(32 100% 50% / 0.4)' }}>NEXUS FIELD CONTROLLER</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* LCD-style counters — green phosphor on black */}
            {[
              { label: 'MOD', value: connectedCount, color: 'hsl(120 100% 45%)' },
              { label: 'IG', value: totalIgniters, color: 'hsl(120 100% 45%)' },
              { label: 'FIRE', value: firedCount, color: firedCount > 0 ? 'hsl(0 80% 50%)' : 'hsl(120 100% 45%)' },
              ...(misfireCount > 0 ? [{ label: 'FAIL', value: misfireCount, color: 'hsl(0 80% 50%)' }] : []),
            ].map(c => (
              <div key={c.label} className={cn(
                "rounded-sm font-mono text-center",
                sz === 'xl' ? "px-3 py-1.5 min-w-[52px]" : sz === 'fs' ? "px-2 py-1 min-w-[40px]" : "px-1.5 py-0.5 min-w-[32px]"
              )} style={{
                background: 'hsl(120 5% 4%)',
                border: '1px solid hsl(120 10% 12%)',
                boxShadow: 'inset 0 1px 4px rgba(0,0,0,0.6)',
                backgroundImage: 'repeating-linear-gradient(0deg, transparent 0px, transparent 1px, hsl(120 5% 6%) 1px, hsl(120 5% 6%) 2px)',
                backgroundSize: '100% 2px',
              }}>
                <div className={cn("font-bold",
                  sz === 'xl' ? "text-sm" : sz === 'fs' ? "text-[10px]" : "text-[9px]"
                )} style={{
                  color: c.color,
                  textShadow: `0 0 8px ${c.color}`,
                  fontFamily: 'monospace',
                }}>{c.value}</div>
                <div className={cn("uppercase",
                  sz === 'xl' ? "text-[7px]" : "text-[6px]"
                )} style={{ color: 'hsl(120 30% 25%)' }}>{c.label}</div>
              </div>
            ))}

            {/* SIM/LIVE + Fullscreen */}
            <div className="flex items-center gap-1.5">
              <span className={cn("font-mono font-bold",
                sz === 'xl' ? "text-[10px]" : "text-[8px]",
                simMode ? "text-amber-400/70" : "text-green-400/70"
              )}>{simMode ? 'SIM' : 'LIVE'}</span>
              <Switch checked={!simMode} onCheckedChange={(v) => {
                if (v && !hardware.isConnected) { toast.error('Connect to RS-485 hardware first'); return; }
                setSimMode(!v);
              }} className="scale-75" />
            </div>
            <button onClick={() => setPyroFullscreen(!pyroFullscreen)}
              className="text-muted-foreground/40 hover:text-foreground transition-colors rounded p-1">
              {pyroFullscreen
                ? <Minimize2 className={cn(sz === 'xl' ? "w-5 h-5" : "w-3 h-3")} />
                : <Maximize2 className={cn(sz === 'xl' ? "w-5 h-5" : sz === 'fs' ? "w-4 h-4" : "w-3 h-3")} />
              }
            </button>
          </div>
        </div>

        {/* Yellow caution stripe — like physical panel labeling */}
        <div className="h-[3px]" style={{
          background: 'repeating-linear-gradient(90deg, hsl(45 90% 50%) 0px, hsl(45 90% 50%) 8px, hsl(0 0% 10%) 8px, hsl(0 0% 10%) 16px)',
        }} />

        {/* 4 Output Port LEDs — physical glass dome indicators */}
        <div className={cn(
          "flex items-center gap-1",
          sz === 'xl' ? "px-6 py-1.5" : sz === 'fs' ? "px-4 py-1" : "px-2 py-0.5"
        )} style={{ background: 'hsl(0 5% 6%)' }}>
          {outputGroups.map(g => (
            <div key={g.label} className={cn(
              "flex items-center gap-1.5 rounded-sm border font-mono",
              sz === 'xl' ? "px-3 py-1 text-[9px]" : sz === 'fs' ? "px-2 py-0.5 text-[8px]" : "px-1.5 py-0.5 text-[7px]",
              g.armed > 0 ? "border-red-500/30 bg-red-500/5" : "border-border/10 bg-transparent"
            )}>
              <span className={cn("font-black",
                g.armed > 0 ? "text-red-400" : g.connected > 0 ? "text-foreground/50" : "text-muted-foreground/15"
              )} style={{ textShadow: g.armed > 0 ? '0 0 4px rgba(239,68,68,0.3)' : 'none' }}>OUTPUT {g.label}</span>
              {/* Glass dome LED */}
              <div className={cn(
                "rounded-full shrink-0",
                sz === 'xl' ? "w-3 h-3" : "w-2 h-2",
              )} style={{
                background: g.armed > 0
                  ? 'radial-gradient(circle at 40% 35%, hsl(0 90% 65%), hsl(0 80% 45%) 60%, hsl(0 70% 30%))'
                  : g.connected > 0
                    ? 'radial-gradient(circle at 40% 35%, hsl(120 90% 65%), hsl(120 70% 40%) 60%, hsl(120 60% 25%))'
                    : 'radial-gradient(circle at 40% 35%, hsl(0 0% 30%), hsl(0 0% 15%) 60%, hsl(0 0% 10%))',
                boxShadow: g.armed > 0
                  ? '0 0 8px rgba(239,68,68,0.6), inset 0 -1px 2px rgba(0,0,0,0.3)'
                  : g.connected > 0
                    ? '0 0 6px rgba(34,197,94,0.4), inset 0 -1px 2px rgba(0,0,0,0.3)'
                    : 'inset 0 -1px 2px rgba(0,0,0,0.3)',
              }} />
            </div>
          ))}
          <div className="flex-1" />
          {/* Physical LED status dots for DMX + UDP */}
          <div className="flex items-center gap-2">
            {[
              { label: 'RS-485', active: hardware.isConnected, color: 'hsl(120 80% 45%)' },
              { label: 'DMX', active: artNetConnected, color: 'hsl(120 80% 45%)' },
              { label: 'UDP', active: relayConnected, color: 'hsl(180 80% 50%)' },
            ].map(led => (
              <div key={led.label} className="flex items-center gap-1">
                <div className={cn("rounded-full", sz === 'xl' ? "w-2.5 h-2.5" : "w-1.5 h-1.5")} style={{
                  background: led.active
                    ? `radial-gradient(circle at 40% 35%, ${led.color}, hsl(120 50% 25%) 80%)`
                    : 'radial-gradient(circle at 40% 35%, hsl(0 0% 25%), hsl(0 0% 12%))',
                  boxShadow: led.active ? `0 0 6px ${led.color}` : 'none',
                }} />
                <span className={cn("font-mono", led.active ? "text-green-400/70" : "text-muted-foreground/30",
                  sz === 'xl' ? "text-[10px]" : "text-[8px]"
                )}>{led.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // ── Render: Master Key + ARM controls ──
  const renderMasterArm = () => (
    <div className={cn(
      "border-b flex items-center gap-3",
      sz === 'xl' ? (mob ? "px-4 py-2.5 flex-wrap" : "px-6 py-3") : sz === 'fs' ? "px-4 py-2" : "px-2 py-1",
      masterKeyOn ? "border-red-800/30" : "border-border/15"
    )} style={{ background: masterKeyOn ? 'hsl(0 30% 8%)' : 'hsl(0 10% 6%)' }}>
      <button onClick={() => { setMasterKeyOn(!masterKeyOn); haptics[masterKeyOn ? 'disarm' : 'arm'](); }}
        className={cn(
          "flex items-center gap-2 rounded border-2 font-black uppercase transition-all min-w-[64px]",
          sz === 'xl' ? (mob ? "px-5 py-3 text-xs flex-1" : "px-6 py-3 text-sm") : sz === 'fs' ? "px-4 py-2 text-[10px]" : "px-3 py-1.5 text-[8px]",
          masterKeyOn
            ? "bg-red-600/20 border-red-500/50 text-red-400"
            : "bg-[hsl(0_8%_10%)] border-border/20 text-muted-foreground/40"
        )} style={masterKeyOn ? {
          boxShadow: 'inset 0 0 12px rgba(255,50,30,0.1), 0 0 20px rgba(255,50,30,0.15)',
          animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        } : {}}>
        {masterKeyOn
          ? <Unlock className={cn(sz === 'xl' ? "w-5 h-5" : "w-3 h-3")} style={{ transform: 'rotate(45deg)', transition: 'transform 0.3s ease' }} />
          : <Lock className={cn(sz === 'xl' ? "w-5 h-5" : "w-3 h-3")} style={{ transform: 'rotate(0deg)', transition: 'transform 0.3s ease' }} />}
        MASTER KEY {masterKeyOn ? 'ON' : 'OFF'}
      </button>
      <div className="flex items-center gap-1.5">
        <button onClick={() => armAll(true)} disabled={!masterKeyOn}
          className={cn("rounded border font-bold uppercase transition-all min-h-[48px]",
            sz === 'xl' ? "px-4 py-2.5 text-[11px]" : sz === 'fs' ? "px-3 py-1.5 text-[9px]" : "px-2 py-1 text-[8px]",
            masterKeyOn ? "bg-red-600/15 border-red-500/30 text-red-400/80" : "border-border/10 text-muted-foreground/20"
          )}>ARM ALL</button>
        <button onClick={() => armAll(false)} disabled={!masterKeyOn}
          className={cn("rounded border font-bold uppercase transition-all min-h-[48px]",
            sz === 'xl' ? "px-4 py-2.5 text-[11px]" : sz === 'fs' ? "px-3 py-1.5 text-[9px]" : "px-2 py-1 text-[8px]",
            masterKeyOn ? "bg-green-600/10 border-green-500/30 text-green-400/80" : "border-border/10 text-muted-foreground/20"
          )}>DISARM ALL</button>
      </div>
      <span className={cn("font-mono ml-auto",
        sz === 'xl' ? "text-xs" : sz === 'fs' ? "text-[9px]" : "text-[8px]",
        armedModCount > 0 ? "text-red-400 font-bold" : "text-muted-foreground/30"
      )}>{armedModCount}/{connectedCount} ARMED</span>
    </div>
  );

  // ── Render: Status strip ──
  const renderStatusStrip = () => (
    (firedCount > 0 || misfireCount > 0) ? (
      <div className={cn("flex items-center gap-3 border-b border-border/10",
        sz === 'xl' ? "px-6 py-1.5" : sz === 'fs' ? "px-4 py-1" : "px-2 py-0.5"
      )} style={{ background: 'hsl(0 8% 5%)' }}>
        <span className={cn("font-mono text-green-400/70", sz === 'xl' ? "text-xs" : sz === 'fs' ? "text-[9px]" : "text-[8px]")}>✓ {firedCount} fired</span>
        {misfireCount > 0 && <span className={cn("font-mono text-red-400 font-bold animate-pulse", sz === 'xl' ? "text-xs" : sz === 'fs' ? "text-[9px]" : "text-[8px]")}>⚠ {misfireCount} misfire</span>}
      </div>
    ) : null
  );

  // ── Render: Mode tabs — XL4+ Physical Membrane Keypad ──
  const renderModeTabs = () => (
    <div className={cn("flex border-b gap-0.5",
      sz === 'xl' ? "px-4 py-1.5" : sz === 'fs' ? "px-3 py-1" : "px-2 py-0.5"
    )} style={{ background: 'hsl(0 0% 10%)', borderColor: 'hsl(0 0% 15%)' }}>
      {([
        { key: 'manual' as PyroMode, label: 'MANUAL', sub: 'Direct' },
        { key: 'step' as PyroMode, label: 'STEP', sub: 'Sequential' },
        { key: 'timecode' as PyroMode, label: 'TIMECODE', sub: 'LTC/GPS' },
        { key: 'test' as PyroMode, label: 'TEST', sub: 'Continuity' },
      ]).map(m => (
        <button key={m.key} onClick={() => setPyroMode(m.key)}
          className={cn(
            "flex-1 font-mono font-black uppercase tracking-[0.15em] transition-all min-h-[48px]",
            sz === 'xl' ? "py-3 text-[11px]" : sz === 'fs' ? "py-2 text-[9px]" : "py-1.5 text-[8px]",
            pyroMode === m.key
              ? "text-white/90"
              : "text-white/30 hover:text-white/50"
          )} style={{
            /* Membrane button: flat gray with embossed double-border */
            background: pyroMode === m.key ? 'hsl(0 0% 22%)' : 'hsl(0 0% 18%)',
            border: pyroMode === m.key
              ? '2px solid hsl(0 0% 30%)'
              : '1px solid hsl(0 0% 12%)',
            borderRadius: '2px',
            /* Physical membrane emboss: outer dark, inner light highlight */
            boxShadow: pyroMode === m.key
              ? 'inset 0 1px 0 hsl(0 0% 28%), inset 0 -1px 0 hsl(0 0% 10%), 0 0 8px hsl(0 70% 40% / 0.2)'
              : 'inset 0 1px 0 hsl(0 0% 22%), inset 0 -1px 0 hsl(0 0% 8%), 0 1px 2px rgba(0,0,0,0.3)',
          }}>
          <div>{m.label}</div>
          {sz !== 'sm' && <div className="font-normal text-[6px]" style={{ color: pyroMode === m.key ? 'hsl(0 0% 50%)' : 'hsl(0 0% 30%)' }}>{m.sub}</div>}
        </button>
      ))}
    </div>
  );

  // ── Render: Module selector ──
  const renderModuleSelector = () => (
    <div className={cn("flex items-center gap-1.5 border-b border-border/10 overflow-x-auto scrollbar-thin",
      sz === 'xl' ? "px-5 py-2" : sz === 'fs' ? "px-3 py-1.5" : "px-2 py-1"
    )} style={{ background: 'hsl(0 8% 5%)' }}>
      {modules.map(m => {
        const ModeIcon = connectionModeIcon(m.connectionMode);
        const isLinked = artnetLinkedModules.has(m.address);
        return (
          <div key={m.address} className="flex items-center gap-0.5 shrink-0">
            <button onClick={() => setSelectedModule(m.address)}
              className={cn(
                "rounded border font-mono font-bold shrink-0 transition-all flex items-center gap-1 min-h-[48px]",
                sz === 'xl' ? "px-3.5 py-2 text-xs" : sz === 'fs' ? "px-2.5 py-1.5 text-[9px]" : "px-2 py-1 text-[8px]",
                selectedModule === m.address
                  ? m.armed ? "bg-red-600/20 border-red-500/40 text-red-400" : "bg-primary/15 border-primary/40 text-primary"
                  : m.armed ? "bg-red-600/10 border-red-800/20 text-red-400/50"
                  : m.connected ? "bg-[hsl(0_8%_10%)] border-border/15 text-foreground/50" : "bg-[hsl(0_8%_6%)] border-border/5 text-muted-foreground/15"
              )}>
              <ModeIcon className={cn(
                sz === 'xl' ? "w-3 h-3" : "w-2 h-2",
                m.connectionMode === 'wireless' ? rssiColor(m.rssiDbm) :
                m.connectionMode === 'fallback' ? "text-amber-400 animate-pulse" : "text-green-400/40"
              )} />
              FM-{String(m.address).padStart(2, '0')}
              {m.armed && <span className="ml-0.5 text-red-400">●</span>}
              {isLinked && (
                <>
                  <Globe className={cn(sz === 'xl' ? "w-2.5 h-2.5" : "w-2 h-2", "text-violet-400")} />
                  {artnetLatencies.has(m.address) && (
                    <span className="text-[8px] font-mono text-violet-300">{artnetLatencies.get(m.address)}ms</span>
                  )}
                </>
              )}
              {m.connectionMode === 'wireless' && m.rssiDbm !== undefined && !isLinked && (
                <span className={cn("text-[8px]", rssiColor(m.rssiDbm))}>{m.rssiDbm}dB</span>
              )}
            </button>
            {m.connected && (
              <button
                onClick={() => handleModuleArtnetLink(m.address)}
                className={cn(
                  "rounded border shrink-0 transition-all flex items-center gap-0.5",
                  sz === 'xl' ? "p-2 min-w-[44px] min-h-[44px] justify-center" : "p-1 min-w-[32px] min-h-[32px] justify-center",
                  isLinked
                    ? "bg-violet-600/15 border-violet-500/30 text-violet-400"
                    : "border-border/10 text-muted-foreground/30 hover:text-violet-400/60 hover:border-violet-500/20"
                )}
                title={`ArtNet Link FM-${String(m.address).padStart(2, '0')}`}
              >
                <Globe className={cn(sz === 'xl' ? "w-4 h-4" : "w-3 h-3")} />
                {isLinked && artnetLatencies.has(m.address) && (
                  <span className={cn("font-mono text-violet-300", "text-[8px]")}>{artnetLatencies.get(m.address)}ms</span>
                )}
              </button>
            )}
          </div>
        );
      })}
      <button onClick={importPyroCues}
        className={cn("rounded border shrink-0 transition-all font-bold",
          sz === 'xl' ? "px-3.5 py-2 text-[10px]" : sz === 'fs' ? "px-2.5 py-1.5 text-[8px]" : "px-2 py-1 text-[8px]",
          "bg-amber-600/10 border-amber-500/20 text-amber-400/70"
        )}>
        <Download className={cn(sz === 'xl' ? "w-4 h-4 inline mr-1" : "w-3 h-3 inline mr-0.5")} />Import
      </button>
    </div>
  );

  // ── Render: Module info bar ──
  const renderModuleInfo = () => (
    currentModule ? (
      <div className={cn("flex items-center gap-3 border-b border-border/10",
        sz === 'xl' ? "px-6 py-2" : sz === 'fs' ? "px-4 py-1" : "px-2 py-0.5"
      )} style={{ background: 'hsl(220 10% 8%)' }}>
        {/* Connection mode badge */}
        {(() => {
          const badge = connectionModeBadge(currentModule.connectionMode);
          return (
            <span className={cn("rounded border font-bold uppercase font-mono",
              sz === 'xl' ? "px-2 py-0.5 text-[8px]" : "px-1.5 py-0.5 text-[8px]",
              badge.cls
            )}>{badge.text}</span>
          );
        })()}
        {/* RSSI for wireless modules */}
        {(currentModule.connectionMode === 'wireless' || currentModule.connectionMode === 'fallback') && currentModule.rssiDbm !== undefined && (
          <div className="flex items-center gap-1">
            <div className={cn("rounded-full", sz === 'xl' ? "w-2.5 h-2.5" : "w-1.5 h-1.5", rssiIcon(currentModule.rssiDbm))}
              style={currentModule.rssiDbm > -60 ? { boxShadow: '0 0 4px rgba(34,197,94,0.4)' } : undefined} />
            <span className={cn("font-mono", rssiColor(currentModule.rssiDbm),
              sz === 'xl' ? "text-[10px]" : sz === 'fs' ? "text-[8px]" : "text-[8px]"
            )}>{currentModule.rssiDbm}dBm</span>
          </div>
        )}
        {currentModule.wirelessChannel !== undefined && (
          <span className={cn("font-mono text-muted-foreground/30", sz === 'xl' ? "text-[9px]" : "text-[8px]")}>
            Ch{currentModule.wirelessChannel}
          </span>
        )}
        {currentModule.packetLoss !== undefined && currentModule.packetLoss > 0 && (
          <span className={cn("font-mono text-amber-400/60", sz === 'xl' ? "text-[9px]" : "text-[8px]")}>
            {currentModule.packetLoss}% loss
          </span>
        )}
        <div className="flex items-center gap-1">
          <Battery className={cn(sz === 'xl' ? "w-4 h-4" : "w-3 h-3", currentModule.batteryVoltage > 11 ? "text-green-400/70" : "text-amber-400")} />
          <span className={cn("font-mono text-muted-foreground/50", sz === 'xl' ? "text-[10px]" : sz === 'fs' ? "text-[8px]" : "text-[8px]")}>{currentModule.batteryVoltage.toFixed(1)}V</span>
        </div>
        <div className="flex items-center gap-1">
          <Activity className={cn(sz === 'xl' ? "w-4 h-4" : "w-3 h-3", "text-muted-foreground/40")} />
          <span className={cn("font-mono text-muted-foreground/50", sz === 'xl' ? "text-[10px]" : sz === 'fs' ? "text-[8px]" : "text-[8px]")}>{Math.round(currentModule.temperature)}°C</span>
        </div>
        <button onClick={() => armModule(currentModule.address, !currentModule.armed)} disabled={!masterKeyOn}
          className={cn("ml-auto rounded border font-bold uppercase transition-all",
            sz === 'xl' ? "px-4 py-2 text-xs" : sz === 'fs' ? "px-2.5 py-1 text-[8px]" : "px-2 py-0.5 text-[8px]",
            currentModule.armed ? "bg-red-600/20 border-red-500/40 text-red-400" : masterKeyOn ? "border-border/20 text-muted-foreground/50" : "border-border/10 text-muted-foreground/15"
          )}>
          {currentModule.armed ? '● ARMED' : 'ARM'}
        </button>
      </div>
    ) : null
  );

  // ── Render: Igniter grid (Manual mode) ──
  const renderIgniterGrid = () => {
    if (!currentModule) return null;
    // In XL fullscreen: 8 cols, larger cells. Mobile XL: 4 cols, huge touch targets
    const cols = xl && mob ? 'grid-cols-4' : 'grid-cols-8';
    const cellSize = xl && mob ? 'min-h-[80px] rounded-xl' : xl ? 'min-h-[72px] rounded-lg' : fs ? 'min-h-[56px] rounded-lg' : 'min-h-[40px]';

    return (
      <div className={cn(sz === 'xl' ? "p-4" : sz === 'fs' ? "p-3" : "p-2")}>
        {!canFire && (masterKeyOn || pyroArm || dmxArm) && (
          <div className={cn("text-center text-amber-400/50 font-bold uppercase mb-2",
            sz === 'xl' ? "text-sm py-2" : sz === 'fs' ? "text-[10px]" : "text-[8px]"
          )}>
            {!masterKeyOn ? 'Turn Master Key ON' : 'ARM system to fire'}
          </div>
        )}
        <div className={cn("grid", cols, sz === 'xl' ? "gap-2" : sz === 'fs' ? "gap-1.5" : "gap-1")}>
          {currentModule.igniters.map(ig => {
            const ok = ig.connected && !ig.fired && ig.resistance > 0;
            const canFireIg = canFire && currentModule.armed && ok;
            return (
              <button key={ig.position}
                onMouseDown={() => canFireIg && fireIgniter(currentModule.address, ig.position)}
                onTouchStart={(e) => { e.preventDefault(); if (canFireIg) fireIgniter(currentModule.address, ig.position); }}
                disabled={!canFireIg && !ig.fired}
                className={cn(
                  "relative flex flex-col items-center justify-center rounded border transition-all select-none",
                  cellSize,
                  ig.fired ? "bg-muted-foreground/10 border-border/10" :
                  ig.misfire ? "bg-red-600/20 border-red-500/40 animate-pulse" :
                  canFireIg ? "bg-[hsl(220_10%_12%)] border-border/30 hover:bg-red-700/20 active:scale-[0.93] active:bg-red-600/30 cursor-pointer" :
                  ig.connected ? "bg-[hsl(220_10%_10%)] border-border/15" :
                  "bg-[hsl(220_10%_6%)] border-border/5"
                )}>
                {/* Continuity LED */}
                <div className={cn("absolute rounded-full",
                  sz === 'xl' ? "w-3 h-3 top-1.5 right-1.5" : sz === 'fs' ? "w-2 h-2 top-1 right-1" : "w-1.5 h-1.5 top-0.5 right-0.5",
                  ig.fired ? "bg-muted-foreground/20" :
                  ig.misfire ? "bg-red-500" :
                  ok ? "bg-green-500" :
                  ig.connected ? "bg-amber-400" : "bg-muted-foreground/10"
                )} style={ok && !ig.fired ? { boxShadow: '0 0 4px rgba(34,197,94,0.4)' } : ig.misfire ? { boxShadow: '0 0 6px rgba(239,68,68,0.6)' } : undefined} />
                <span className={cn("font-mono font-bold",
                  sz === 'xl' ? (mob ? "text-base" : "text-sm") : sz === 'fs' ? "text-[10px]" : "text-[8px]",
                  ig.fired ? "text-muted-foreground/20" : ig.misfire ? "text-red-400" : ok ? "text-foreground/60" : "text-muted-foreground/15"
                )}>{String(ig.position).padStart(2, '0')}</span>
                <span className={cn("font-mono",
                  sz === 'xl' ? "text-[10px]" : sz === 'fs' ? "text-[8px]" : "text-[8px]",
                  ig.fired ? "text-muted-foreground/15" : ok ? "text-green-400/50" : "text-muted-foreground/15"
                )}>{ig.resistance > 0 ? `${ig.resistance.toFixed(1)}Ω` : '—'}</span>
                {/* Firing flash on mobile xl */}
                {ig.fired && xl && (
                  <div className="absolute inset-0 rounded-xl pointer-events-none bg-gradient-radial from-red-500/10 to-transparent" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  // ── Render: Step mode ──
  const renderStepMode = () => (
    <div className={cn(sz === 'xl' ? "p-5" : sz === 'fs' ? "p-3" : "p-2")}>
      {stepCues.length === 0 ? (
        <div className={cn("text-center text-muted-foreground/30 py-8", sz === 'xl' ? "text-base" : sz === 'fs' ? "text-sm" : "text-[10px]")}>
          No pyro cues. Tap <strong>Import</strong> to load from AutoFire.
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-2">
            <span className={cn("font-bold text-foreground/60", sz === 'xl' ? "text-sm" : sz === 'fs' ? "text-xs" : "text-[9px]")}>
              Step {stepIndex + 1} / {stepCues.length}
            </span>
            <button onClick={() => { setStepIndex(0); toast.info('Step reset'); }}
              className={cn("rounded text-muted-foreground/40 hover:text-foreground/60",
                sz === 'xl' ? "text-xs px-3 py-1.5" : sz === 'fs' ? "text-[9px] px-2 py-1" : "text-[8px] px-1.5 py-0.5"
              )}>
              <RotateCcw className={cn(sz === 'xl' ? "w-4 h-4 inline mr-1" : "w-3 h-3 inline mr-0.5")} />Reset
            </button>
          </div>
          {stepCues[stepIndex] && (
            <div className={cn("rounded border mb-3",
              sz === 'xl' ? "p-4 border-red-500/25" : sz === 'fs' ? "p-3 border-red-500/20" : "p-2 border-border/15"
            )} style={{ background: 'hsl(0 20% 8%)' }}>
              <div className={cn("font-bold text-red-400/80", sz === 'xl' ? "text-base" : sz === 'fs' ? "text-sm" : "text-[9px]")}>{stepCues[stepIndex].name}</div>
              <div className={cn("font-mono text-muted-foreground/40", sz === 'xl' ? "text-xs mt-1" : sz === 'fs' ? "text-[9px]" : "text-[8px]")}>
                TC: {formatTimecode(stepCues[stepIndex].timecodeMs)} · Addr: {stepCues[stepIndex].addresses} · {stepCues[stepIndex].effect}
              </div>
            </div>
          )}
          <button onClick={stepFire} disabled={!canFire}
            className={cn(
              "w-full rounded-lg font-black uppercase transition-all border-2 flex items-center justify-center gap-2",
              sz === 'xl' ? "py-5 text-lg rounded-xl" : sz === 'fs' ? "py-4 text-base" : "py-3 text-sm",
              canFire
                ? "bg-gradient-to-b from-red-600 to-red-800 text-white border-red-500/50 active:scale-[0.97]"
                : "bg-[hsl(220_10%_10%)] text-muted-foreground/20 border-border/10"
            )}>
            <SkipForward className={cn(sz === 'xl' ? "w-6 h-6" : "w-5 h-5")} />
            NEXT FIRE
          </button>
          <div className={cn("mt-3 space-y-0.5")}>
            {stepCues.map((cue, i) => (
              <div key={cue.id} className={cn(
                "flex items-center gap-2 rounded border transition-colors",
                sz === 'xl' ? "px-4 py-2 text-xs" : sz === 'fs' ? "px-3 py-1.5 text-[9px]" : "px-2 py-1 text-[8px]",
                i === stepIndex ? "bg-red-600/10 border-red-500/20 text-foreground/80" :
                i < stepIndex ? "border-border/5 text-muted-foreground/20" :
                "border-border/10 text-muted-foreground/40"
              )}>
                <span className="font-mono w-5">{cue.cueNumber}</span>
                <span className="font-bold flex-1 truncate">{cue.name}</span>
                <span className="font-mono">{formatTimecode(cue.timecodeMs)}</span>
                {i < stepIndex && <CheckCircle2 className={cn(sz === 'xl' ? "w-4 h-4" : "w-3 h-3", "text-green-400/50")} />}
                {i === stepIndex && <Zap className={cn(sz === 'xl' ? "w-4 h-4" : "w-3 h-3", "text-red-400")} />}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );

  // ── Render: Timecode mode ──
  const renderTimecodeMode = () => (
    <div className={cn(sz === 'xl' ? "p-5" : sz === 'fs' ? "p-3" : "p-2")}>
      <div className={cn("text-center font-mono font-black mb-3",
        sz === 'xl' ? "text-4xl py-2" : sz === 'fs' ? "text-2xl" : "text-lg",
        tcRunning ? "text-red-400" : "text-foreground/60"
      )}>{formatTimecode(tcTimeMs)}</div>
      {tcCues.length === 0 ? (
        <div className={cn("text-center text-muted-foreground/30 py-4", sz === 'xl' ? "text-base" : sz === 'fs' ? "text-sm" : "text-[10px]")}>
          No pyro cues. Tap <strong>Import</strong> to load from AutoFire.
        </div>
      ) : (
        <>
          <div className="flex items-center justify-center gap-3 mb-3">
            <Button variant="ghost" size="sm" onClick={resetTimecode} className={cn(sz === 'xl' ? "h-10 text-xs" : "h-8 text-[9px]")}>
              <RotateCcw className="w-3 h-3 mr-1" /> Reset
            </Button>
            <button onClick={() => { if (!canFire && !tcRunning) { toast.error('ARM system to fire'); return; } setTcRunning(!tcRunning); }}
              disabled={!canFire && !tcRunning}
              className={cn(
                "rounded-lg font-black uppercase transition-all border-2 flex items-center gap-2",
                sz === 'xl' ? "px-8 py-3 text-base rounded-xl" : sz === 'fs' ? "px-6 py-2.5 text-sm" : "px-4 py-2 text-[10px]",
                tcRunning
                  ? "bg-red-600/30 border-red-500/40 text-red-400"
                  : canFire
                    ? "bg-green-600/20 border-green-500/40 text-green-400"
                    : "bg-[hsl(220_10%_10%)] border-border/10 text-muted-foreground/20"
              )}>
              {tcRunning ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              {tcRunning ? 'STOP' : 'RUN'}
            </button>
          </div>
          <div className={cn("w-full rounded-full overflow-hidden mb-3", sz === 'xl' ? "h-3" : sz === 'fs' ? "h-2" : "h-1")} style={{ background: 'hsl(220 10% 12%)' }}>
            <div className="h-full rounded-full transition-all" style={{
              width: `${Math.min(100, tcCues.length > 0 ? (tcTimeMs / Math.max(...tcCues.map(c => c.timecodeMs + c.duration * 1000))) * 100 : 0)}%`,
              background: 'linear-gradient(90deg, hsl(0 80% 50%), hsl(30 80% 50%))',
            }} />
          </div>
          <div className="space-y-0.5">
            {tcCues.map(cue => {
              const fired = tcFiredSet.current.has(cue.id);
              return (
                <div key={cue.id} className={cn(
                  "flex items-center gap-2 rounded border",
                  sz === 'xl' ? "px-4 py-2 text-xs" : sz === 'fs' ? "px-3 py-1 text-[9px]" : "px-2 py-0.5 text-[8px]",
                  fired ? "border-border/5 text-muted-foreground/20" :
                  tcTimeMs >= cue.timecodeMs - 2000 ? "border-amber-500/20 bg-amber-600/5 text-amber-400/70" :
                  "border-border/10 text-muted-foreground/40"
                )}>
                  <span className="font-mono w-5">{cue.cueNumber}</span>
                  <span className="font-bold flex-1 truncate">{cue.name}</span>
                  <span className="font-mono">{formatTimecode(cue.timecodeMs)}</span>
                  {fired && <CheckCircle2 className="w-3 h-3 text-green-400/50" />}
                </div>
              );
            })}
          </div>
          {/* Fire Confirmation Log */}
          {fireLog.length > 0 && (
            <div className="mt-3 border-t border-primary/10 pt-2">
              <div className={cn("font-mono font-bold text-primary/50 uppercase mb-1", sz === 'xl' ? "text-[10px]" : "text-[8px]")}>
                FIRE CONFIRMATION LOG
              </div>
              <div className="space-y-0.5">
                {fireLog.slice(-10).reverse().map((entry, i) => (
                  <div key={i} className={cn(
                    "flex items-center gap-2 rounded border font-mono",
                    sz === 'xl' ? "px-3 py-1 text-[10px]" : "px-2 py-0.5 text-[8px]",
                    entry.status === 'OK' ? "border-green-500/15 bg-green-500/5 text-green-400/70" :
                    entry.status === 'LATE' ? "border-amber-400/15 bg-amber-400/5 text-amber-400/70" :
                    "border-red-500/15 bg-red-500/5 text-red-400/70"
                  )}>
                    <span className="w-8">{entry.cueId}</span>
                    <span className="text-muted-foreground/40">EXP:{formatTimecode(entry.expectedMs)}</span>
                    <span>ACT:{formatTimecode(entry.actualMs)}</span>
                    <span className={cn("font-bold",
                      entry.status === 'OK' ? "text-green-400" : entry.status === 'LATE' ? "text-amber-400" : "text-red-400"
                    )}>Δ{entry.delta > 0 ? '+' : ''}{entry.delta}ms</span>
                    <span className="ml-auto font-bold">{entry.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );

  // ── Render: Test mode ──
  const renderTestMode = () => {
    if (!currentModule) return null;
    return (
      <div className={cn(sz === 'xl' ? "p-5" : sz === 'fs' ? "p-3" : "p-2")}>
        <div className="flex items-center justify-between mb-3">
          <span className={cn("font-bold text-foreground/60 uppercase", sz === 'xl' ? "text-sm" : sz === 'fs' ? "text-xs" : "text-[9px]")}>
            Continuity Test — FM-{String(selectedModule).padStart(2, '0')}
          </span>
          <button onClick={runContinuityTest} disabled={!currentModule.connected}
            className={cn("rounded border font-bold uppercase transition-all flex items-center gap-1",
              sz === 'xl' ? "px-4 py-2 text-xs" : sz === 'fs' ? "px-3 py-1.5 text-[9px]" : "px-2 py-1 text-[8px]",
              currentModule.connected ? "bg-cyan-600/15 border-cyan-500/30 text-cyan-400" : "border-border/10 text-muted-foreground/15"
            )}>
            <Search className={cn(sz === 'xl' ? "w-4 h-4" : "w-3 h-3")} /> TEST
          </button>
        </div>
        <div className={cn("grid", xl && mob ? "grid-cols-4" : "grid-cols-8", sz === 'xl' ? "gap-2" : sz === 'fs' ? "gap-1.5" : "gap-1")}>
          {currentModule.igniters.map(ig => (
            <div key={ig.position} className={cn(
              "flex flex-col items-center justify-center rounded border",
              sz === 'xl' ? "py-3 min-h-[64px]" : sz === 'fs' ? "py-2 min-h-[48px]" : "py-1.5 min-h-[36px]",
              ig.connected && ig.resistance > 0 && ig.resistance < 30 ? "bg-green-600/10 border-green-500/20" :
              ig.connected && ig.resistance >= 30 ? "bg-amber-600/10 border-amber-500/20" :
              ig.connected ? "bg-red-600/10 border-red-500/20" :
              "bg-[hsl(220_10%_6%)] border-border/5"
            )}>
              <span className={cn("font-mono font-bold",
                sz === 'xl' ? "text-sm" : sz === 'fs' ? "text-[9px]" : "text-[8px]",
                ig.connected ? "text-foreground/50" : "text-muted-foreground/15"
              )}>{String(ig.position).padStart(2, '0')}</span>
              <span className={cn("font-mono",
                sz === 'xl' ? "text-[10px]" : sz === 'fs' ? "text-[8px]" : "text-[8px]",
                ig.connected && ig.resistance > 0 && ig.resistance < 30 ? "text-green-400/70" :
                ig.connected && ig.resistance >= 30 ? "text-amber-400/70" :
                ig.connected ? "text-red-400/50" : "text-muted-foreground/10"
              )}>
                {ig.resistance > 0 ? `${ig.resistance.toFixed(1)}Ω` : ig.connected ? 'OPEN' : '—'}
              </span>
              {ig.connected && ig.resistance > 0 && ig.resistance < 30
                ? <CheckCircle2 className={cn(sz === 'xl' ? "w-3.5 h-3.5" : "w-2.5 h-2.5", "text-green-400/50 mt-0.5")} />
                : ig.connected
                  ? <XCircle className={cn(sz === 'xl' ? "w-3.5 h-3.5" : "w-2.5 h-2.5", "text-red-400/50 mt-0.5")} />
                  : null
              }
            </div>
          ))}
        </div>
        {/* Summary */}
        <div className={cn("mt-3 rounded border border-border/10 flex items-center justify-around",
          sz === 'xl' ? "px-6 py-3" : sz === 'fs' ? "px-4 py-2" : "px-2 py-1"
        )} style={{ background: 'hsl(220 10% 7%)' }}>
          {[
            { label: 'Good', count: currentModule.igniters.filter(i => i.connected && i.resistance > 0 && i.resistance < 30).length, color: 'text-green-400' },
            { label: 'Suspect', count: currentModule.igniters.filter(i => i.connected && i.resistance >= 30).length, color: 'text-amber-400' },
            { label: 'Open', count: currentModule.igniters.filter(i => i.connected && i.resistance === 0).length, color: 'text-red-400' },
            { label: 'Empty', count: currentModule.igniters.filter(i => !i.connected).length, color: 'text-muted-foreground/30' },
          ].map(s => (
            <div key={s.label} className="text-center">
              <div className={cn("font-mono font-bold", s.color, sz === 'xl' ? "text-lg" : sz === 'fs' ? "text-sm" : "text-xs")}>{s.count}</div>
              <div className={cn("text-muted-foreground/30 uppercase", sz === 'xl' ? "text-[9px]" : sz === 'fs' ? "text-[8px]" : "text-[8px]")}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ── Render: PANIC bar ──
  const renderPanic = () => (
    <div className="border-t-2 border-border/20 shrink-0" style={{ background: 'hsl(220 12% 6%)' }}>
      <div className={cn(sz === 'xl' ? "px-5 py-3" : sz === 'fs' ? "px-4 py-2" : "px-2 py-1.5")}>
        <button onClick={handlePanic}
          className={cn(
            "w-full rounded-lg font-black uppercase transition-all",
            "bg-gradient-to-b from-red-700 to-red-900 text-white/90",
            "hover:from-red-600 hover:to-red-800 active:scale-[0.97]",
            "border-2 border-red-600/50",
            "flex items-center justify-center gap-2",
            sz === 'xl' ? "h-16 text-lg tracking-[0.3em] rounded-xl" : sz === 'fs' ? "h-14 text-base tracking-[0.25em]" : "h-10 text-[11px] tracking-[0.25em]"
          )} style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1)' }}>
          <AlertTriangle className={cn(sz === 'xl' ? "w-7 h-7" : sz === 'fs' ? "w-5 h-5" : "w-4 h-4")} />
          PANIC — ALL STOP
        </button>
      </div>
    </div>
  );

  // ── Render: Module Monitor (replaces deadman) ──
  const renderModuleMonitor = () => {
    const onlineCount = modules.filter(m => m.connected).length;
    const totalBatteryOk = modules.filter(m => m.connected && m.batteryVoltage > 11).length;
    const avgSignal = modules.filter(m => m.connected).reduce((s, m) => s + m.signalStrength, 0) / Math.max(onlineCount, 1);
    
    return (
      <div className={cn("border-t border-primary/15 shrink-0",
        sz === 'xl' ? "px-5 py-2" : "px-3 py-1.5"
      )} style={{ background: 'hsl(220 12% 4%)' }}>
        {/* Summary bar */}
        <div className={cn("flex items-center gap-3 font-mono",
          sz === 'xl' ? "text-[10px] mb-2" : "text-[8px] mb-1"
        )}>
          <span className="text-primary/60 font-bold tracking-wider">MODULE TELEMETRY</span>
          <span className="text-green-400/70">ONLINE: {onlineCount}/{modules.length}</span>
          <span className={cn(armedModCount > 0 ? "text-red-400" : "text-muted-foreground/30")}>ARMED: {armedModCount}</span>
          <span className={cn(totalBatteryOk === onlineCount ? "text-green-400/60" : "text-amber-400/70")}>BATT: {totalBatteryOk === onlineCount ? 'OK' : `${totalBatteryOk}/${onlineCount}`}</span>
          <span className={cn(avgSignal > 70 ? "text-green-400/60" : "text-amber-400/70")}>SIG: {avgSignal > 70 ? 'STRONG' : 'WEAK'}</span>
          <button onClick={handleModuleScan} disabled={scanning}
            className={cn("ml-auto rounded border font-bold uppercase transition-all flex items-center gap-1",
              sz === 'xl' ? "px-3 py-1 text-[9px]" : "px-2 py-0.5 text-[8px]",
              scanning
                ? "bg-primary/10 border-primary/30 text-primary pyro-scan-sweep"
                : "border-primary/20 text-primary/60 hover:text-primary hover:border-primary/40"
            )}>
            <Search className={cn(sz === 'xl' ? "w-3 h-3" : "w-2.5 h-2.5")} />
            {scanning ? 'SCANNING...' : 'SCAN'}
          </button>
        </div>
        {/* Scan progress */}
        {scanning && (
          <div className="w-full h-0.5 rounded-full overflow-hidden mb-1" style={{ background: 'hsl(220 10% 10%)' }}>
            <div className="h-full rounded-full transition-all" style={{
              width: `${scanProgress}%`,
              background: 'linear-gradient(90deg, hsl(var(--primary)), hsl(var(--electric-glow)))',
              boxShadow: '0 0 8px hsl(var(--primary) / 0.4)',
            }} />
          </div>
        )}
        {/* Module cards grid */}
        <div className={cn("grid gap-1", sz === 'xl' ? "grid-cols-6" : "grid-cols-3")}>
          {modules.map(m => (
            <div key={m.address} className={cn(
              "rounded border p-1.5 font-mono transition-all",
              m.armed ? "border-red-500/30 bg-red-500/5 armed-pulse" :
              m.connected ? (m.batteryVoltage > 11 && m.signalStrength > 60 ? "border-green-500/20 bg-green-500/5" : "border-amber-400/20 bg-amber-400/5") :
              "border-border/5 bg-transparent opacity-30"
            )}>
              <div className="flex items-center justify-between">
                <span className={cn("font-bold", sz === 'xl' ? "text-[10px]" : "text-[8px]",
                  m.armed ? "text-red-400" : m.connected ? "text-foreground/60" : "text-muted-foreground/20"
                )}>FM-{String(m.address).padStart(2, '0')}</span>
                {/* Signal bars */}
                <div className="flex items-end gap-px">
                  {[1, 2, 3, 4, 5].map(bar => (
                    <div key={bar} className={cn(
                      "w-[2px] rounded-t",
                      bar * 20 <= m.signalStrength ? "bg-green-400/70" : "bg-muted-foreground/10"
                    )} style={{ height: `${bar * 2 + 2}px` }} />
                  ))}
                </div>
              </div>
              {m.connected && (
                <div className={cn("flex items-center gap-1.5 mt-0.5", sz === 'xl' ? "text-[8px]" : "text-[7px]")}>
                  {/* Battery SVG arc */}
                  <svg width="16" height="10" viewBox="0 0 16 10">
                    <rect x="0.5" y="1" width="13" height="8" rx="1" fill="none" stroke="hsl(var(--muted-foreground) / 0.2)" strokeWidth="0.7" />
                    <rect x="13.5" y="3" width="2" height="4" rx="0.5" fill="hsl(var(--muted-foreground) / 0.15)" />
                    <rect x="1.5" y="2" width={`${Math.min(11, (m.batteryVoltage / 12.8) * 11)}`} height="6" rx="0.5"
                      fill={m.batteryVoltage > 11.5 ? 'hsl(120 70% 40%)' : m.batteryVoltage > 11 ? 'hsl(45 100% 50%)' : 'hsl(0 80% 50%)'} />
                  </svg>
                  <span className="text-muted-foreground/40">{m.batteryVoltage.toFixed(1)}V</span>
                  <span className="text-muted-foreground/30">{Math.round(m.temperature)}°</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ── Mode content router ──
  const renderModeContent = () => {
    switch (pyroMode) {
      case 'manual': return renderIgniterGrid();
      case 'step': return renderStepMode();
      case 'timecode': return renderTimecodeMode();
      case 'test': return renderTestMode();
      default: return renderIgniterGrid();
    }
  };

  // ═══════════════════════════════════════════════════════════
  // DEDICATED XL4 FULLSCREEN — Portal to body
  // Replicates the real 10.1" XL4+ LCD with optimized touch
  // ═══════════════════════════════════════════════════════════
  if (pyroFullscreen) {
    const fullscreenContent = (
      <div
        className="fixed inset-0 z-[99999] flex flex-col select-none overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, hsl(0 12% 5%) 0%, hsl(220 15% 3%) 100%)',
          paddingTop: mob ? 'env(safe-area-inset-top)' : undefined,
          paddingBottom: mob ? 'max(env(safe-area-inset-bottom), 8px)' : undefined,
        }}
      >
        {renderFileInput()}
        {renderHeader()}
        {renderConnectionBar()}
        {renderMasterArm()}
        {renderStatusStrip()}

        {/* XL4 split layout: on wide screens show module list + content side by side */}
        {!mob ? (
          <div className="flex-1 flex min-h-0">
            {/* Left: Module selector + info (sidebar) */}
            <div className="w-52 shrink-0 border-r border-border/10 flex flex-col" style={{ background: 'hsl(220 12% 5%)' }}>
              <div className="px-3 py-2 border-b border-border/10">
                <span className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-wider">Field Modules</span>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-2 space-y-1">
                  {modules.map(m => {
                    const ModeIcon = connectionModeIcon(m.connectionMode);
                    const badge = connectionModeBadge(m.connectionMode);
                    return (
                    <button key={m.address} onClick={() => setSelectedModule(m.address)}
                      className={cn(
                        "w-full flex items-center gap-2 rounded-lg border px-3 py-2.5 transition-all text-left",
                        selectedModule === m.address
                          ? m.armed ? "bg-red-600/15 border-red-500/30" : "bg-primary/10 border-primary/30"
                          : m.armed ? "bg-red-600/5 border-red-800/15 hover:bg-red-600/10"
                          : m.connected ? "bg-[hsl(220_10%_8%)] border-border/10 hover:bg-[hsl(220_10%_12%)]"
                          : "bg-[hsl(220_10%_5%)] border-border/5 opacity-40"
                      )}>
                      <div className="flex flex-col items-center gap-0.5">
                        <div className={cn("w-2 h-2 rounded-full shrink-0",
                          m.armed ? "bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.5)]" :
                          m.connected ? "bg-green-500 shadow-[0_0_4px_rgba(34,197,94,0.4)]" : "bg-muted-foreground/15"
                        )} />
                        <ModeIcon className={cn("w-2.5 h-2.5",
                          m.connectionMode === 'wireless' ? rssiColor(m.rssiDbm) :
                          m.connectionMode === 'fallback' ? "text-amber-400 animate-pulse" : "text-green-400/30"
                        )} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={cn("font-mono font-bold text-xs",
                          selectedModule === m.address ? "text-foreground/80" : "text-foreground/50"
                        )}>FM-{String(m.address).padStart(2, '0')}</div>
                        <div className="flex items-center gap-2 text-[8px] text-muted-foreground/30 font-mono">
                          <span>{m.batteryVoltage.toFixed(1)}V</span>
                          <span>{Math.round(m.temperature)}°C</span>
                          {m.rssiDbm !== undefined && (
                            <span className={rssiColor(m.rssiDbm)}>{m.rssiDbm}dB</span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-0.5">
                        {m.armed && <span className="text-[8px] font-bold text-red-400 uppercase">ARM</span>}
                        <span className={cn("text-[8px] font-bold rounded px-1 border", badge.cls)}>{badge.text}</span>
                      </div>
                    </button>
                    );
                  })}
                </div>
                <div className="px-2 pb-2">
                  <button onClick={importPyroCues}
                    className="w-full rounded-lg border font-bold text-[10px] py-2 bg-amber-600/10 border-amber-500/20 text-amber-400/70 hover:bg-amber-600/15 transition-all">
                    <Download className="w-3.5 h-3.5 inline mr-1.5" />Import Cues
                  </button>
                </div>
              </ScrollArea>
            </div>

            {/* Right: Mode tabs + content */}
            <div className="flex-1 flex flex-col min-w-0">
              {renderModuleInfo()}
              {renderModeTabs()}
              <ScrollArea className="flex-1">{renderModeContent()}</ScrollArea>
            </div>
          </div>
        ) : (
          /* Mobile: stacked layout */
          <>
            {renderModeTabs()}
            {renderModuleSelector()}
            {renderModuleInfo()}
            <ScrollArea className="flex-1">{renderModeContent()}</ScrollArea>
          </>
        )}

        {renderModuleMonitor()}
        {renderPanic()}
      </div>
    );

    return createPortal(fullscreenContent, document.body);
  }

  // ═══════════════════════════════════════════════════════════
  // PANEL MODE (inside FX Commander)
  // ═══════════════════════════════════════════════════════════
  return (
    <div className="flex flex-col h-full relative overflow-hidden" style={{ background: 'hsl(0 5% 7%)' }}>
      {/* Scanline overlay — CRT effect */}
      <div className="absolute inset-0 pointer-events-none z-10" style={{
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(0,0,0,0.04) 1px, rgba(0,0,0,0.04) 2px)',
        backgroundSize: '100% 2px',
      }} />
      {/* Industrial panel housing corners */}
      <div className="absolute inset-0 pointer-events-none z-10" style={{
        background: 'radial-gradient(ellipse at center, transparent 55%, hsl(0 0% 3% / 0.5) 100%)',
      }} />
      {renderFileInput()}
      {renderHeader()}
      {renderConnectionBar()}
      {renderMasterArm()}
      {renderStatusStrip()}
      {renderModeTabs()}
      {renderModuleSelector()}
      {renderModuleInfo()}
      <ScrollArea className="flex-1">{renderModeContent()}</ScrollArea>
    </div>
  );
}
