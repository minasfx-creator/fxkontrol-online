/**
 * PyroFireOnePanel — FireOne XL4+ style pyrotechnic firing panel
 * Full XL4 replica: 99 modules × 32 igniters, continuity, safety interlocks,
 * Manual / Step / Timecode / Test modes, AutoFire bridge
 * Includes DEDICATED FULLSCREEN mode replicating the real XL4 10.1" display
 */
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Shield, ShieldAlert, Hand, AlertTriangle, Zap, Radio,
  ChevronLeft, ChevronRight, RotateCcw, Play, Square, SkipForward,
  CheckCircle2, XCircle, Clock, Activity, Battery, Signal,
  Lock, Unlock, Search, Download, Upload, Maximize2, Minimize2, X,
  Wifi, WifiOff, Usb, ScanLine, Info
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
import { parseFireOneCSV, parseFireOneFIR, exportFireOneCSV, downloadFile } from '@/lib/fireoneScriptParser';

interface PyroFireOnePanelProps {
  fs: boolean;
  fireChannel: (id: string) => void;
  channels: SFXChannel[];
  pyroArm: boolean;
  dmxArm: boolean;
  deadmanHeld: boolean;
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
}

interface IgniterState {
  position: number;
  connected: boolean;
  fired: boolean;
  resistance: number;
  misfire: boolean;
}

function createSimModule(addr: number, connected: boolean): FieldModule {
  return {
    address: addr,
    connected,
    armed: false,
    batteryVoltage: connected ? 11.2 + Math.random() * 1.6 : 0,
    signalStrength: connected ? 60 + Math.random() * 40 : 0,
    temperature: connected ? 18 + Math.random() * 12 : 0,
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
  fs, fireChannel, channels, pyroArm, dmxArm, deadmanHeld, handlePanic, artNetConnected, relayConnected,
}: PyroFireOnePanelProps) {
  const isMobile = useIsMobile();
  const hardware = useFireOneHardware();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pyroMode, setPyroMode] = useState<PyroMode>('manual');
  const [modules, setModules] = useState<FieldModule[]>(() => {
    const mods: FieldModule[] = [];
    for (let i = 1; i <= 6; i++) mods.push(createSimModule(i, true));
    return mods;
  });
  const [selectedModule, setSelectedModule] = useState(1);
  const [masterKeyOn, setMasterKeyOn] = useState(false);
  const [simMode, setSimMode] = useState(true);
  const [pyroFullscreen, setPyroFullscreen] = useState(false);

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

  const canFire = masterKeyOn && (pyroArm || dmxArm) && deadmanHeld;

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
      let cues: AutoFireCue[] = [];
      if (file.name.endsWith('.fir') || file.name.endsWith('.sem')) {
        cues = parseFireOneFIR(text);
      } else {
        cues = parseFireOneCSV(text);
      }
      if (cues.length === 0) {
        toast.error('No valid cues found in file');
        return;
      }
      setTcCues(cues);
      setStepCues(cues);
      setStepIndex(0);
      toast.success(`Imported ${cues.length} cues from ${file.name}`);
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

    if (navigator.vibrate) navigator.vibrate(40);

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

  const connectedCount = modules.filter(m => m.connected).length;
  const armedModCount = modules.filter(m => m.armed).length;
  const totalIgniters = modules.reduce((sum, m) => sum + m.igniters.filter(i => i.connected && !i.fired).length, 0);
  const firedCount = modules.reduce((sum, m) => sum + m.igniters.filter(i => i.fired).length, 0);
  const misfireCount = modules.reduce((sum, m) => sum + m.igniters.filter(i => i.misfire).length, 0);

  // ── Determine sizing: xl = dedicated fullscreen, fs = parent fullscreen, default = panel
  const xl = pyroFullscreen;
  const mob = isMobile;
  const sz = xl ? 'xl' : fs ? 'fs' : 'sm';

  // ── Render: Header ──
  const renderHeader = () => (
    <div className={cn(
      "border-b border-border/15 flex items-center justify-between",
      sz === 'xl' ? "px-6 py-3" : sz === 'fs' ? "px-4 py-2" : "px-2 py-1"
    )} style={{ background: 'hsl(0 20% 7%)' }}>
      <div className="flex items-center gap-3">
        <span className={cn("font-black tracking-wider",
          sz === 'xl' ? "text-sm text-red-400" : sz === 'fs' ? "text-xs text-red-400/80" : "text-[8px] text-red-400/80"
        )}>🔥 FIREONE XL4+</span>
        <span className={cn("font-mono text-muted-foreground/30",
          sz === 'xl' ? "text-xs" : sz === 'fs' ? "text-[9px]" : "text-[7px]"
        )}>{connectedCount} MOD · {totalIgniters} IG · {firedCount} FIRED</span>
      </div>
      <div className="flex items-center gap-3">
        {/* Art-Net status */}
        <div className="flex items-center gap-1">
          <div className={cn("rounded-full", artNetConnected ? "bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.5)]" : "bg-muted-foreground/20",
            sz === 'xl' ? "w-2.5 h-2.5" : "w-1.5 h-1.5"
          )} />
          <span className={cn("font-mono", artNetConnected ? "text-green-500/70" : "text-muted-foreground/30",
            sz === 'xl' ? "text-[10px]" : sz === 'fs' ? "text-[8px]" : "text-[6px]"
          )}>DMX</span>
        </div>
        <div className="flex items-center gap-1">
          <div className={cn("rounded-full", relayConnected ? "bg-cyan-400 shadow-[0_0_6px_rgba(0,220,255,0.5)]" : "bg-muted-foreground/20",
            sz === 'xl' ? "w-2.5 h-2.5" : "w-1.5 h-1.5"
          )} />
          <span className={cn("font-mono", relayConnected ? "text-cyan-400/70" : "text-muted-foreground/30",
            sz === 'xl' ? "text-[10px]" : sz === 'fs' ? "text-[8px]" : "text-[6px]"
          )}>UDP</span>
        </div>
        {/* SIM/LIVE */}
        <div className="flex items-center gap-1.5">
          <span className={cn("font-mono font-bold",
            sz === 'xl' ? "text-[10px]" : sz === 'fs' ? "text-[8px]" : "text-[6px]",
            simMode ? "text-amber-400/70" : "text-green-400/70"
          )}>{simMode ? 'SIM' : 'LIVE'}</span>
          <Switch checked={!simMode} onCheckedChange={(v) => setSimMode(!v)} className="scale-75" />
        </div>
        {/* Fullscreen toggle */}
        <button onClick={() => setPyroFullscreen(!pyroFullscreen)}
          className="text-muted-foreground/40 hover:text-foreground transition-colors rounded p-1">
          {pyroFullscreen
            ? <Minimize2 className={cn(sz === 'xl' ? "w-5 h-5" : "w-3 h-3")} />
            : <Maximize2 className={cn(sz === 'xl' ? "w-5 h-5" : sz === 'fs' ? "w-4 h-4" : "w-3 h-3")} />
          }
        </button>
      </div>
    </div>
  );

  // ── Render: Master Key + ARM controls ──
  const renderMasterArm = () => (
    <div className={cn(
      "border-b flex items-center gap-3",
      sz === 'xl' ? (mob ? "px-4 py-2.5 flex-wrap" : "px-6 py-3") : sz === 'fs' ? "px-4 py-2" : "px-2 py-1",
      masterKeyOn ? "border-red-800/30" : "border-border/15"
    )} style={{ background: masterKeyOn ? 'hsl(0 30% 8%)' : 'hsl(220 12% 7%)' }}>
      <button onClick={() => { setMasterKeyOn(!masterKeyOn); if (navigator.vibrate) navigator.vibrate(masterKeyOn ? 20 : [30, 20, 30]); }}
        className={cn(
          "flex items-center gap-2 rounded border-2 font-black uppercase transition-all",
          sz === 'xl' ? (mob ? "px-5 py-3 text-xs flex-1" : "px-6 py-3 text-sm") : sz === 'fs' ? "px-4 py-2 text-[10px]" : "px-3 py-1.5 text-[8px]",
          masterKeyOn
            ? "bg-red-600/20 border-red-500/50 text-red-400"
            : "bg-[hsl(220_10%_10%)] border-border/20 text-muted-foreground/40"
        )}>
        {masterKeyOn ? <Unlock className={cn(sz === 'xl' ? "w-5 h-5" : "w-3 h-3")} /> : <Lock className={cn(sz === 'xl' ? "w-5 h-5" : "w-3 h-3")} />}
        MASTER KEY {masterKeyOn ? 'ON' : 'OFF'}
      </button>
      <div className="flex items-center gap-1.5">
        <button onClick={() => armAll(true)} disabled={!masterKeyOn}
          className={cn("rounded border font-bold uppercase transition-all",
            sz === 'xl' ? "px-4 py-2.5 text-[11px]" : sz === 'fs' ? "px-3 py-1.5 text-[9px]" : "px-2 py-1 text-[7px]",
            masterKeyOn ? "bg-red-600/15 border-red-500/30 text-red-400/80" : "border-border/10 text-muted-foreground/20"
          )}>ARM ALL</button>
        <button onClick={() => armAll(false)} disabled={!masterKeyOn}
          className={cn("rounded border font-bold uppercase transition-all",
            sz === 'xl' ? "px-4 py-2.5 text-[11px]" : sz === 'fs' ? "px-3 py-1.5 text-[9px]" : "px-2 py-1 text-[7px]",
            masterKeyOn ? "bg-green-600/10 border-green-500/30 text-green-400/80" : "border-border/10 text-muted-foreground/20"
          )}>DISARM ALL</button>
      </div>
      <span className={cn("font-mono ml-auto",
        sz === 'xl' ? "text-xs" : sz === 'fs' ? "text-[9px]" : "text-[7px]",
        armedModCount > 0 ? "text-red-400 font-bold" : "text-muted-foreground/30"
      )}>{armedModCount}/{connectedCount} ARMED</span>
    </div>
  );

  // ── Render: Status strip ──
  const renderStatusStrip = () => (
    (firedCount > 0 || misfireCount > 0) ? (
      <div className={cn("flex items-center gap-3 border-b border-border/10",
        sz === 'xl' ? "px-6 py-1.5" : sz === 'fs' ? "px-4 py-1" : "px-2 py-0.5"
      )} style={{ background: 'hsl(220 10% 6%)' }}>
        <span className={cn("font-mono text-green-400/70", sz === 'xl' ? "text-xs" : sz === 'fs' ? "text-[9px]" : "text-[7px]")}>✓ {firedCount} fired</span>
        {misfireCount > 0 && <span className={cn("font-mono text-red-400 font-bold animate-pulse", sz === 'xl' ? "text-xs" : sz === 'fs' ? "text-[9px]" : "text-[7px]")}>⚠ {misfireCount} misfire</span>}
      </div>
    ) : null
  );

  // ── Render: Mode tabs ──
  const renderModeTabs = () => (
    <div className={cn("flex border-b border-border/15")} style={{ background: 'hsl(220 10% 7%)' }}>
      {([
        { key: 'manual' as PyroMode, label: 'Manual' },
        { key: 'step' as PyroMode, label: 'Step' },
        { key: 'timecode' as PyroMode, label: 'Timecode' },
        { key: 'test' as PyroMode, label: 'Test' },
      ]).map(m => (
        <button key={m.key} onClick={() => setPyroMode(m.key)}
          className={cn(
            "flex-1 font-bold uppercase tracking-wider transition-all border-b-2",
            sz === 'xl' ? "py-3 text-sm" : sz === 'fs' ? "py-2 text-[10px]" : "py-1.5 text-[7px]",
            pyroMode === m.key ? "text-red-400/80 border-red-500/60" : "text-muted-foreground/30 border-transparent"
          )}>{m.label}</button>
      ))}
    </div>
  );

  // ── Render: Module selector ──
  const renderModuleSelector = () => (
    <div className={cn("flex items-center gap-1.5 border-b border-border/10 overflow-x-auto scrollbar-thin",
      sz === 'xl' ? "px-5 py-2" : sz === 'fs' ? "px-3 py-1.5" : "px-2 py-1"
    )} style={{ background: 'hsl(220 12% 6%)' }}>
      {modules.map(m => (
        <button key={m.address} onClick={() => setSelectedModule(m.address)}
          className={cn(
            "rounded border font-mono font-bold shrink-0 transition-all",
            sz === 'xl' ? "px-3.5 py-2 text-xs" : sz === 'fs' ? "px-2.5 py-1.5 text-[9px]" : "px-2 py-1 text-[7px]",
            selectedModule === m.address
              ? m.armed ? "bg-red-600/20 border-red-500/40 text-red-400" : "bg-primary/15 border-primary/40 text-primary"
              : m.armed ? "bg-red-600/10 border-red-800/20 text-red-400/50"
              : m.connected ? "bg-[hsl(220_10%_10%)] border-border/15 text-foreground/50" : "bg-[hsl(220_10%_7%)] border-border/5 text-muted-foreground/15"
          )}>
          FM-{String(m.address).padStart(2, '0')}
          {m.armed && <span className="ml-1 text-red-400">●</span>}
        </button>
      ))}
      <button onClick={importPyroCues}
        className={cn("rounded border shrink-0 transition-all font-bold",
          sz === 'xl' ? "px-3.5 py-2 text-[10px]" : sz === 'fs' ? "px-2.5 py-1.5 text-[8px]" : "px-2 py-1 text-[6px]",
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
        <div className="flex items-center gap-1">
          <Battery className={cn(sz === 'xl' ? "w-4 h-4" : "w-3 h-3", currentModule.batteryVoltage > 11 ? "text-green-400/70" : "text-amber-400")} />
          <span className={cn("font-mono text-muted-foreground/50", sz === 'xl' ? "text-[10px]" : sz === 'fs' ? "text-[8px]" : "text-[6px]")}>{currentModule.batteryVoltage.toFixed(1)}V</span>
        </div>
        <div className="flex items-center gap-1">
          <Signal className={cn(sz === 'xl' ? "w-4 h-4" : "w-3 h-3", "text-cyan-400/60")} />
          <span className={cn("font-mono text-muted-foreground/50", sz === 'xl' ? "text-[10px]" : sz === 'fs' ? "text-[8px]" : "text-[6px]")}>{Math.round(currentModule.signalStrength)}%</span>
        </div>
        <div className="flex items-center gap-1">
          <Activity className={cn(sz === 'xl' ? "w-4 h-4" : "w-3 h-3", "text-muted-foreground/40")} />
          <span className={cn("font-mono text-muted-foreground/50", sz === 'xl' ? "text-[10px]" : sz === 'fs' ? "text-[8px]" : "text-[6px]")}>{Math.round(currentModule.temperature)}°C</span>
        </div>
        <button onClick={() => armModule(currentModule.address, !currentModule.armed)} disabled={!masterKeyOn}
          className={cn("ml-auto rounded border font-bold uppercase transition-all",
            sz === 'xl' ? "px-4 py-2 text-xs" : sz === 'fs' ? "px-2.5 py-1 text-[8px]" : "px-2 py-0.5 text-[6px]",
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
            sz === 'xl' ? "text-sm py-2" : sz === 'fs' ? "text-[10px]" : "text-[7px]"
          )}>
            {!masterKeyOn ? 'Turn Master Key ON' : !deadmanHeld ? 'Hold DEADMAN to fire' : 'ARM system to fire'}
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
                  sz === 'xl' ? (mob ? "text-base" : "text-sm") : sz === 'fs' ? "text-[10px]" : "text-[7px]",
                  ig.fired ? "text-muted-foreground/20" : ig.misfire ? "text-red-400" : ok ? "text-foreground/60" : "text-muted-foreground/15"
                )}>{String(ig.position).padStart(2, '0')}</span>
                <span className={cn("font-mono",
                  sz === 'xl' ? "text-[10px]" : sz === 'fs' ? "text-[7px]" : "text-[5px]",
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
                sz === 'xl' ? "text-xs px-3 py-1.5" : sz === 'fs' ? "text-[9px] px-2 py-1" : "text-[7px] px-1.5 py-0.5"
              )}>
              <RotateCcw className={cn(sz === 'xl' ? "w-4 h-4 inline mr-1" : "w-3 h-3 inline mr-0.5")} />Reset
            </button>
          </div>
          {stepCues[stepIndex] && (
            <div className={cn("rounded border mb-3",
              sz === 'xl' ? "p-4 border-red-500/25" : sz === 'fs' ? "p-3 border-red-500/20" : "p-2 border-border/15"
            )} style={{ background: 'hsl(0 20% 8%)' }}>
              <div className={cn("font-bold text-red-400/80", sz === 'xl' ? "text-base" : sz === 'fs' ? "text-sm" : "text-[9px]")}>{stepCues[stepIndex].name}</div>
              <div className={cn("font-mono text-muted-foreground/40", sz === 'xl' ? "text-xs mt-1" : sz === 'fs' ? "text-[9px]" : "text-[7px]")}>
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
                sz === 'xl' ? "px-4 py-2 text-xs" : sz === 'fs' ? "px-3 py-1.5 text-[9px]" : "px-2 py-1 text-[7px]",
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
            <button onClick={() => { if (!canFire && !tcRunning) { toast.error('ARM + DEADMAN required'); return; } setTcRunning(!tcRunning); }}
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
                  sz === 'xl' ? "px-4 py-2 text-xs" : sz === 'fs' ? "px-3 py-1 text-[9px]" : "px-2 py-0.5 text-[7px]",
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
              sz === 'xl' ? "px-4 py-2 text-xs" : sz === 'fs' ? "px-3 py-1.5 text-[9px]" : "px-2 py-1 text-[7px]",
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
                sz === 'xl' ? "text-sm" : sz === 'fs' ? "text-[9px]" : "text-[6px]",
                ig.connected ? "text-foreground/50" : "text-muted-foreground/15"
              )}>{String(ig.position).padStart(2, '0')}</span>
              <span className={cn("font-mono",
                sz === 'xl' ? "text-[10px]" : sz === 'fs' ? "text-[8px]" : "text-[5px]",
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
              <div className={cn("text-muted-foreground/30 uppercase", sz === 'xl' ? "text-[9px]" : sz === 'fs' ? "text-[7px]" : "text-[5px]")}>{s.label}</div>
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

  // ── Render: Deadman (for XL fullscreen) ──
  const renderDeadman = () => (
    <div className={cn("border-t border-border/15 shrink-0",
      sz === 'xl' ? "px-5 py-2" : "px-3 py-1.5"
    )} style={{ background: deadmanHeld ? 'hsl(140 30% 8%)' : 'hsl(220 12% 6%)' }}>
      <button
        onMouseDown={() => {/* deadman comes from parent */}}
        onTouchStart={(e) => { e.preventDefault(); }}
        className={cn(
          "w-full rounded-lg font-black uppercase transition-all border-2 flex items-center justify-center gap-2",
          sz === 'xl' ? "py-4 text-sm rounded-xl" : "py-3 text-[10px]",
          deadmanHeld
            ? "bg-green-600/25 border-green-500/50 text-green-400"
            : "bg-[hsl(220_10%_10%)] border-border/20 text-muted-foreground/30"
        )}>
        <Hand className={cn(sz === 'xl' ? "w-6 h-6" : "w-4 h-4")} />
        DEADMAN {deadmanHeld ? '● HELD' : '— INACTIVE'}
      </button>
      <p className={cn("text-center text-muted-foreground/20 mt-1", sz === 'xl' ? "text-[9px]" : "text-[7px]")}>
        Deadman is controlled from FX Commander ARM bar
      </p>
    </div>
  );

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
        {renderHeader()}
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
                  {modules.map(m => (
                    <button key={m.address} onClick={() => setSelectedModule(m.address)}
                      className={cn(
                        "w-full flex items-center gap-2 rounded-lg border px-3 py-2.5 transition-all text-left",
                        selectedModule === m.address
                          ? m.armed ? "bg-red-600/15 border-red-500/30" : "bg-primary/10 border-primary/30"
                          : m.armed ? "bg-red-600/5 border-red-800/15 hover:bg-red-600/10"
                          : m.connected ? "bg-[hsl(220_10%_8%)] border-border/10 hover:bg-[hsl(220_10%_12%)]"
                          : "bg-[hsl(220_10%_5%)] border-border/5 opacity-40"
                      )}>
                      <div className={cn("w-2 h-2 rounded-full shrink-0",
                        m.armed ? "bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.5)]" :
                        m.connected ? "bg-green-500 shadow-[0_0_4px_rgba(34,197,94,0.4)]" : "bg-muted-foreground/15"
                      )} />
                      <div className="flex-1 min-w-0">
                        <div className={cn("font-mono font-bold text-xs",
                          selectedModule === m.address ? "text-foreground/80" : "text-foreground/50"
                        )}>FM-{String(m.address).padStart(2, '0')}</div>
                        <div className="flex items-center gap-2 text-[8px] text-muted-foreground/30 font-mono">
                          <span>{m.batteryVoltage.toFixed(1)}V</span>
                          <span>{Math.round(m.signalStrength)}%</span>
                          <span>{Math.round(m.temperature)}°C</span>
                        </div>
                      </div>
                      {m.armed && <span className="text-[8px] font-bold text-red-400 uppercase">ARM</span>}
                    </button>
                  ))}
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

        {renderDeadman()}
        {renderPanic()}
      </div>
    );

    return createPortal(fullscreenContent, document.body);
  }

  // ═══════════════════════════════════════════════════════════
  // PANEL MODE (inside FX Commander)
  // ═══════════════════════════════════════════════════════════
  return (
    <div className="flex flex-col h-full">
      {renderHeader()}
      {renderMasterArm()}
      {renderStatusStrip()}
      {renderModeTabs()}
      {renderModuleSelector()}
      {renderModuleInfo()}
      <ScrollArea className="flex-1">{renderModeContent()}</ScrollArea>
    </div>
  );
}
