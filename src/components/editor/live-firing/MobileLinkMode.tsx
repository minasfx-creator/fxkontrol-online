/**
 * MobileLinkMode — FireOne XL4+ Style Remote Firing Console
 * 
 * Inspired by the FireOne XL4+ hardware:
 * - Master Key Switch (ARM/SAFE)
 * - 4 independent outputs with redundancy
 * - Manual Mode: 3168 cues across 99 field modules
 * - Semi-Auto Mode: step-through sequencer
 * - Auto Mode: timecode-driven firing
 * - Continuity Check: field module & igniter status
 * - Hybrid Wired/Wireless control
 * - Deadman safety interlock
 * - GPS/Timecode sync
 * - Real-time broadcast bridge (mobile → desktop)
 */
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Cable, Flame, Wind, Sparkles, Zap, Plus, Trash2, Send, MonitorPlay,
  Shield, ShieldAlert, Lock, Unlock, Key, Radio, Signal, Timer,
  Play, Square, SkipForward, Hand, AlertTriangle, Check, X,
  Wifi, WifiOff, ChevronLeft, ChevronRight, Activity, Eye, Usb,
  RefreshCw, Search, CircuitBoard
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useLiveSfxStore } from '@/store/useLiveSfxStore';
import { useIsMobile } from '@/hooks/use-mobile';
import type { SFXChannel } from './types';
import {
  FireOneController, getFireOneController,
  createSimulatedModuleStatus,
  type FireOneModuleStatus, type FireOneEvent,
} from '@/lib/fireoneProtocol';

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════

interface VirtualFixture {
  id: string;
  name: string;
  type: 'co2' | 'flame' | 'spark' | 'cryo' | 'confetti' | 'haze' | 'streamer' | 'custom';
  color: string;
  intensity: number;
  dmxUniverse: number;
  dmxAddress: number;
  duration: number;
  moduleId: number;
  cueNumber: number;
}

interface LinkEvent {
  id: string;
  timestamp: number;
  source: 'local' | 'remote';
  fixtureName: string;
  type: string;
  color: string;
  intensity: number;
}

interface FieldModule {
  id: number;
  name: string;
  connected: boolean;
  wireless: boolean;
  batteryVoltage: number;
  signalStrength: number;
  igniters: { position: number; connected: boolean; fired: boolean; resistance: number }[];
  armed: boolean;
}

interface AutoCue {
  id: string;
  cueNumber: number;
  moduleId: number;
  igniterPos: number;
  timecodeMs: number;
  name: string;
  state: 'queued' | 'ready' | 'fired' | 'skip';
}

type XL4Mode = 'manual' | 'semiauto' | 'auto' | 'continuity' | 'status' | 'hardware';

const FIXTURE_TYPES = [
  { key: 'co2' as const, label: 'CO2', color: '#00d4ff', icon: Wind },
  { key: 'flame' as const, label: 'Flame', color: '#ff6600', icon: Flame },
  { key: 'spark' as const, label: 'Spark', color: '#ffcc00', icon: Sparkles },
  { key: 'cryo' as const, label: 'Cryo', color: '#88ddff', icon: Zap },
  { key: 'confetti' as const, label: 'Confetti', color: '#ff44cc', icon: Sparkles },
  { key: 'haze' as const, label: 'Haze', color: '#aaaaaa', icon: Wind },
];

const STORAGE_KEY = 'fxc-xl4-fixtures';
const MODULES_KEY = 'fxc-xl4-modules';

// ═══════════════════════════════════════════════════════════
// HELPER: format timecode
// ═══════════════════════════════════════════════════════════
function fmtTC(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const f = Math.floor((ms % 1000) / (1000 / 30));
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}:${String(f).padStart(2, '0')}`;
}

// ═══════════════════════════════════════════════════════════
// DEFAULT FIELD MODULES (simulated)
// ═══════════════════════════════════════════════════════════
function createDefaultModules(): FieldModule[] {
  return Array.from({ length: 6 }, (_, i) => ({
    id: i + 1,
    name: `FM-${String(i + 1).padStart(2, '0')}`,
    connected: i < 4,
    wireless: i >= 2,
    batteryVoltage: 11.5 + Math.random() * 1.5,
    signalStrength: 60 + Math.floor(Math.random() * 40),
    igniters: Array.from({ length: 32 }, (_, j) => ({
      position: j + 1,
      connected: Math.random() > 0.15,
      fired: false,
      resistance: 1.5 + Math.random() * 3,
    })),
    armed: false,
  }));
}

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════

interface MobileLinkModeProps {
  fs: boolean;
  fireChannel: (id: string) => void;
  channels: SFXChannel[];
  artNetConnected: boolean;
  relayConnected: boolean;
}

export default function MobileLinkMode({ fs, fireChannel, channels, artNetConnected, relayConnected }: MobileLinkModeProps) {
  const isMobile = useIsMobile();
  const mob = fs && isMobile;

  // ─── XL4 State ───
  const [masterArmed, setMasterArmed] = useState(false);
  const [deadmanHeld, setDeadmanHeld] = useState(false);
  const [xl4Mode, setXl4Mode] = useState<XL4Mode>('manual');
  const [keyInserted, setKeyInserted] = useState(false);
  const [selectedModule, setSelectedModule] = useState(1);
  const [selectedOutput, setSelectedOutput] = useState(0); // 0-3 for 4 outputs
  const [modules, setModules] = useState<FieldModule[]>(() => {
    try {
      const saved = localStorage.getItem(MODULES_KEY);
      return saved ? JSON.parse(saved) : createDefaultModules();
    } catch { return createDefaultModules(); }
  });

  // ─── Semi-Auto state ───
  const [semiAutoStep, setSemiAutoStep] = useState(0);
  const [semiAutoRunning, setSemiAutoRunning] = useState(false);

  // ─── Auto/Timecode state ───
  const [autoCues, setAutoCues] = useState<AutoCue[]>([]);
  const [autoRunning, setAutoRunning] = useState(false);
  const [timecodeMs, setTimecodeMs] = useState(0);
  const timecodeRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Link state ───
  const [fixtures, setFixtures] = useState<VirtualFixture[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
  });
  const [events, setEvents] = useState<LinkEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<VirtualFixture['type']>('co2');
  const [newColor, setNewColor] = useState('#00d4ff');
  const [newAddr, setNewAddr] = useState(1);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // ─── Hardware Serial (FireOne) state ───
  const fireoneRef = useRef<FireOneController>(getFireOneController());
  const [hwConnected, setHwConnected] = useState(false);
  const [hwModules, setHwModules] = useState<FireOneModuleStatus[]>([]);
  const [hwEvents, setHwEvents] = useState<FireOneEvent[]>([]);
  const [hwScanning, setHwScanning] = useState(false);
  const [hwSimulated, setHwSimulated] = useState(false);

  // Persist
  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(fixtures)); }, [fixtures]);
  useEffect(() => { localStorage.setItem(MODULES_KEY, JSON.stringify(modules)); }, [modules]);



  useEffect(() => {
    const ch = supabase.channel('fxc-mobile-link', { config: { broadcast: { self: false } } });

    ch.on('broadcast', { event: 'fxc-fire' }, (msg) => {
      const p = msg.payload as any;
      setEvents(prev => [{
        id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 4)}`,
        timestamp: Date.now(), source: 'remote' as const,
        fixtureName: p.name || p.type, type: p.type,
        color: p.color || '#fff', intensity: p.intensity || 200,
      }, ...prev].slice(0, 80));

      if (p.channelId) {
        const match = channels.find(c => c.id === p.channelId);
        if (match) { fireChannel(match.id); return; }
      }

      useLiveSfxStore.getState().fireEffect({
        id: `link-${Date.now()}`, type: p.type || 'co2',
        position: p.position || [0, 2, 0], color: p.color || '#00d4ff',
        intensity: p.intensity || 200, startedAt: performance.now(),
        duration: p.duration || 2000,
      });
      haptics.select();
    });

    // Master ARM broadcast
    ch.on('broadcast', { event: 'xl4-master' }, (msg) => {
      const p = msg.payload as any;
      if (p.action === 'arm') {
        toast.warning('⚠️ REMOTE MASTER ARM', { duration: 3000 });
      } else if (p.action === 'disarm') {
        toast.info('Master disarmed remotely');
      } else if (p.action === 'panic') {
        handlePanic();
      }
    });

    ch.subscribe((status) => { setConnected(status === 'SUBSCRIBED'); });
    channelRef.current = ch;
    return () => { supabase.removeChannel(ch); };
  }, [channels, fireChannel]);

  // ─── Timecode runner ───
  useEffect(() => {
    if (autoRunning) {
      timecodeRef.current = setInterval(() => {
        setTimecodeMs(prev => prev + 33); // ~30fps
      }, 33);
    } else {
      if (timecodeRef.current) clearInterval(timecodeRef.current);
    }
    return () => { if (timecodeRef.current) clearInterval(timecodeRef.current); };
  }, [autoRunning]);

  // Auto-fire cues when timecode passes
  useEffect(() => {
    if (!autoRunning || !masterArmed) return;
    autoCues.forEach(cue => {
      if (cue.state === 'ready' && timecodeMs >= cue.timecodeMs) {
        broadcastModuleFire(cue.moduleId, cue.igniterPos, cue.name);
        setAutoCues(prev => prev.map(c => c.id === cue.id ? { ...c, state: 'fired' as const } : c));
      }
    });
  }, [timecodeMs, autoRunning, masterArmed, autoCues]);

  // ─── Master ARM ───
  const handleMasterArm = useCallback((armed: boolean) => {
    if (armed && !keyInserted) {
      toast.error('🔑 Insira a chave antes de armar');
      return;
    }
    setMasterArmed(armed);
    setModules(prev => prev.map(m => ({ ...m, armed })));
    if (navigator.vibrate) navigator.vibrate(armed ? [50, 30, 50, 30, 100] : [30]);

    channelRef.current?.send({
      type: 'broadcast', event: 'xl4-master',
      payload: { action: armed ? 'arm' : 'disarm' },
    });

    toast[armed ? 'warning' : 'info'](armed ? '⚠️ MASTER ARMED — LIVE SYSTEM' : '🔒 Master Disarmed', { duration: 3000 });
  }, [keyInserted]);

  // ─── PANIC ───
  const handlePanic = useCallback(() => {
    if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 200]);
    setMasterArmed(false);
    setDeadmanHeld(false);
    setAutoRunning(false);
    setSemiAutoRunning(false);
    setKeyInserted(false);
    setModules(prev => prev.map(m => ({ ...m, armed: false })));

    channelRef.current?.send({
      type: 'broadcast', event: 'xl4-master',
      payload: { action: 'panic' },
    });

    toast.error('🚨 EMERGENCY STOP — ALL SYSTEMS DISARMED', { duration: 5000 });
  }, []);

  // ─── Fire module igniter ───
  const broadcastModuleFire = useCallback((moduleId: number, igniterPos: number, name?: string) => {
    if (!masterArmed) return;
    if (navigator.vibrate) navigator.vibrate(30);

    const label = name || `M${moduleId}-I${igniterPos}`;

    // Mark igniter as fired
    setModules(prev => prev.map(m =>
      m.id === moduleId
        ? { ...m, igniters: m.igniters.map(ig => ig.position === igniterPos ? { ...ig, fired: true } : ig) }
        : m
    ));

    setEvents(prev => [{
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 4)}`,
      timestamp: Date.now(), source: 'local' as const,
      fixtureName: label, type: 'fire', color: '#ff4400', intensity: 255,
    }, ...prev].slice(0, 80));

    // Try matching FXC channel
    const matchIdx = (moduleId - 1) * 32 + (igniterPos - 1);
    if (matchIdx < channels.length) {
      fireChannel(channels[matchIdx].id);
    }

    // Fire 3D effect
    useLiveSfxStore.getState().fireEffect({
      id: `xl4-${Date.now()}`, type: 'flame',
      position: [(igniterPos - 16) * 2, 0, (moduleId - 3) * 5],
      color: '#ff4400', intensity: 255,
      startedAt: performance.now(), duration: 2000,
    });

    channelRef.current?.send({
      type: 'broadcast', event: 'fxc-fire',
      payload: { name: label, type: 'flame', color: '#ff4400', intensity: 255, duration: 2000, moduleId, igniterPos },
    });
  }, [masterArmed, channels, fireChannel]);

  // ─── Hardware FireOne listener ───
  useEffect(() => {
    const ctrl = fireoneRef.current;
    const unsub = ctrl.on((evt: FireOneEvent) => {
      setHwEvents(prev => [evt, ...prev].slice(0, 100));
      if (evt.type === 'status-update' || evt.type === 'module-discovered' || evt.type === 'continuity-result') {
        setHwModules([...ctrl.discoveredModules]);
      }
      if (evt.type === 'fire-confirm') {
        const matchIdx = (evt.moduleAddress - 1) * 32 + ((evt.data?.igniterPos ?? 1) - 1);
        if (matchIdx < channels.length) {
          fireChannel(channels[matchIdx].id);
        }
      }
      if (evt.type === 'emergency-stop') {
        handlePanic();
      }
    });
    return unsub;
  }, [channels, fireChannel, handlePanic]);

  const handleHwConnect = useCallback(async () => {
    const ctrl = fireoneRef.current;
    try {
      await ctrl.connect();
      setHwConnected(true);
      toast.success('🔌 Hardware FireOne conectado');
      setHwScanning(true);
      await ctrl.discoverModules(20);
      setHwModules([...ctrl.discoveredModules]);
      setHwScanning(false);
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`);
      setHwConnected(false);
    }
  }, []);

  const handleHwDisconnect = useCallback(async () => {
    await fireoneRef.current.disconnect();
    setHwConnected(false);
    setHwModules([]);
    toast.info('Hardware desconectado');
  }, []);

  const handleHwScan = useCallback(async () => {
    setHwScanning(true);
    if (hwSimulated) {
      const sims = Array.from({ length: 6 }, (_, i) => createSimulatedModuleStatus(i + 1, i >= 3));
      setHwModules(sims);
      toast.success(`${sims.length} módulos simulados carregados`);
    } else {
      try {
        await fireoneRef.current.discoverModules(20);
        setHwModules([...fireoneRef.current.discoveredModules]);
        toast.success(`${fireoneRef.current.discoveredModules.length} módulos encontrados`);
      } catch (err: any) {
        toast.error(`Scan falhou: ${err.message}`);
      }
    }
    setHwScanning(false);
  }, [hwSimulated]);

  const handleHwFire = useCallback(async (modAddr: number, igniterPos: number) => {
    if (!masterArmed || !deadmanHeld) return;
    if (hwSimulated) {
      setHwModules(prev => prev.map(m =>
        m.moduleAddress === modAddr
          ? { ...m, igniters: m.igniters.map(ig => ig.position === igniterPos ? { ...ig, fired: true } : ig) }
          : m
      ));
      broadcastModuleFire(modAddr, igniterPos, `HW-M${modAddr}-I${igniterPos}`);
      toast.success(`🔥 HW Fire M${modAddr} I${igniterPos}`);
    } else {
      try {
        await fireoneRef.current.fireIgniter(modAddr, igniterPos, 500);
      } catch (err: any) {
        toast.error(`Fire falhou: ${err.message}`);
      }
    }
  }, [masterArmed, deadmanHeld, hwSimulated, broadcastModuleFire]);

  const handleHwArmModule = useCallback(async (modAddr: number, arm: boolean) => {
    if (hwSimulated) {
      setHwModules(prev => prev.map(m => m.moduleAddress === modAddr ? { ...m, armed: arm } : m));
    } else {
      try {
        if (arm) await fireoneRef.current.armModule(modAddr);
        else await fireoneRef.current.disarmModule(modAddr);
      } catch (err: any) { toast.error(err.message); }
    }
  }, [hwSimulated]);

  const handleHwEmergencyStop = useCallback(async () => {
    if (hwSimulated) {
      setHwModules(prev => prev.map(m => ({ ...m, armed: false })));
    } else {
      try { await fireoneRef.current.emergencyStop(); } catch { /* ignore */ }
    }
    handlePanic();
  }, [hwSimulated, handlePanic]);

  const handleHwContinuity = useCallback(async (modAddr: number) => {
    if (hwSimulated) {
      setHwModules(prev => prev.map(m =>
        m.moduleAddress === modAddr
          ? { ...m, igniters: m.igniters.map(ig => ({ ...ig, continuityOk: ig.connected && ig.resistance > 0.5 && ig.resistance < 10 })) }
          : m
      ));
      toast.success(`Continuity check M${modAddr} completo`);
    } else {
      try { await fireoneRef.current.requestContinuity(modAddr); } catch (err: any) { toast.error(err.message); }
    }
  }, [hwSimulated]);


  const broadcastFire = useCallback((fixture: VirtualFixture) => {
    if (!masterArmed) { toast.error('Sistema não armado'); return; }
    if (navigator.vibrate) navigator.vibrate(30);

    setEvents(prev => [{
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 4)}`,
      timestamp: Date.now(), source: 'local' as const,
      fixtureName: fixture.name, type: fixture.type,
      color: fixture.color, intensity: fixture.intensity,
    }, ...prev].slice(0, 80));

    useLiveSfxStore.getState().fireEffect({
      id: `link-${Date.now()}`, type: fixture.type as any,
      position: [0, 2, 0], color: fixture.color,
      intensity: fixture.intensity, startedAt: performance.now(),
      duration: fixture.duration,
    });

    channelRef.current?.send({
      type: 'broadcast', event: 'fxc-fire',
      payload: { name: fixture.name, type: fixture.type, color: fixture.color, intensity: fixture.intensity, duration: fixture.duration },
    });
  }, [masterArmed]);

  // ─── Broadcast FXC channel ───
  const broadcastChannelFire = useCallback((ch: SFXChannel) => {
    if (!masterArmed) { toast.error('Sistema não armado'); return; }
    if (navigator.vibrate) navigator.vibrate(30);
    fireChannel(ch.id);
    channelRef.current?.send({
      type: 'broadcast', event: 'fxc-fire',
      payload: { channelId: ch.id, name: ch.name, type: ch.type, color: ch.color, intensity: ch.intensity, duration: ch.duration },
    });
    setEvents(prev => [{
      id: `evt-${Date.now()}`, timestamp: Date.now(), source: 'local' as const,
      fixtureName: ch.name, type: ch.type, color: ch.color, intensity: ch.intensity,
    }, ...prev].slice(0, 80));
  }, [masterArmed, fireChannel]);

  // ─── Semi-Auto step fire ───
  const semiAutoFire = useCallback(() => {
    if (!masterArmed) return;
    const mod = modules.find(m => m.id === selectedModule);
    if (!mod) return;
    const activeIgniters = mod.igniters.filter(ig => ig.connected && !ig.fired);
    if (semiAutoStep >= activeIgniters.length) {
      toast.info('Sequência completa');
      setSemiAutoRunning(false);
      return;
    }
    const ig = activeIgniters[semiAutoStep];
    broadcastModuleFire(selectedModule, ig.position);
    setSemiAutoStep(prev => prev + 1);
  }, [masterArmed, selectedModule, modules, semiAutoStep, broadcastModuleFire]);

  const addFixture = useCallback(() => {
    if (!newName.trim()) return;
    setFixtures(prev => [...prev, {
      id: `vf-${Date.now()}`, name: newName.trim(), type: newType, color: newColor,
      intensity: 200, dmxUniverse: 1, dmxAddress: newAddr, duration: 2000,
      moduleId: selectedModule, cueNumber: prev.length + 1,
    }]);
    setShowAddForm(false);
    setNewName('');
    toast.success('Fixture adicionada');
  }, [newName, newType, newColor, newAddr, selectedModule]);

  const currentModule = modules.find(m => m.id === selectedModule);
  const connectedModules = modules.filter(m => m.connected);
  const totalIgniters = connectedModules.reduce((sum, m) => sum + m.igniters.filter(ig => ig.connected).length, 0);
  const firedIgniters = connectedModules.reduce((sum, m) => sum + m.igniters.filter(ig => ig.fired).length, 0);

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════

  const ts = mob ? 'text-[9px]' : fs ? 'text-[8px]' : 'text-[7px]';
  const tsL = mob ? 'text-[11px]' : fs ? 'text-[10px]' : 'text-[9px]';
  const tsS = mob ? 'text-[8px]' : fs ? 'text-[7px]' : 'text-[6px]';

  return (
    <div className={cn("flex flex-col h-full", mob ? "p-2 gap-2" : fs ? "p-3 gap-2" : "p-2 gap-1.5")}>

      {/* ═══ HEADER — FireOne XL4+ Branding ═══ */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn("rounded bg-gradient-to-b from-red-600 to-red-800 flex items-center justify-center", mob ? "w-7 h-7" : "w-6 h-6")}>
            <Zap className={cn(mob ? "w-4 h-4" : "w-3.5 h-3.5", "text-white")} />
          </div>
          <div>
            <div className={cn("font-black text-foreground tracking-[0.15em] uppercase", mob ? "text-[11px]" : fs ? "text-[10px]" : "text-[9px]")}>
              XL4+ Remote
            </div>
            <div className={cn("font-mono tracking-wider", tsS, connected ? "text-green-500/60" : "text-muted-foreground/30")}>
              {connected ? '● LINKED' : '○ OFFLINE'} · {isMobile ? 'REMOTE' : 'CONSOLE'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {/* Connection LEDs */}
          {[
            { label: 'ArtN', on: artNetConnected, color: 'green' },
            { label: 'UDP', on: relayConnected, color: 'cyan' },
            { label: 'RT', on: connected, color: 'green' },
          ].map(led => (
            <div key={led.label} className="flex items-center gap-0.5" title={led.label}>
              <div className={cn("rounded-full w-1.5 h-1.5", led.on ? `bg-${led.color}-500` : "bg-muted-foreground/20")}
                style={led.on ? { boxShadow: `0 0 4px ${led.color === 'cyan' ? 'rgba(0,220,255,0.5)' : 'rgba(34,197,94,0.5)'}` } : undefined} />
              <span className={cn("font-mono", tsS, led.on ? `text-${led.color}-500/60` : "text-muted-foreground/20")}>{led.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ MASTER KEY SWITCH + ARM ═══ */}
      <div className={cn("rounded-lg border-2 transition-all", masterArmed ? "border-red-500/40 bg-red-900/10" : "border-border/20 bg-[hsl(220_10%_7%)]")}>
        <div className={cn("flex items-center gap-2", mob ? "p-2.5" : "p-2")}>
          {/* Key Switch */}
          <button onClick={() => { setKeyInserted(!keyInserted); if (navigator.vibrate) navigator.vibrate(20); }}
            className={cn(
              "flex flex-col items-center justify-center rounded-lg border-2 transition-all shrink-0",
              mob ? "w-14 h-14" : "w-12 h-12",
              keyInserted
                ? "border-amber-500/50 bg-amber-500/10"
                : "border-border/20 bg-[hsl(220_10%_10%)] hover:border-border/40"
            )}>
            <Key className={cn(mob ? "w-5 h-5" : "w-4 h-4", keyInserted ? "text-amber-400 rotate-90" : "text-muted-foreground/30")}
              style={{ transition: 'transform 0.3s ease' }} />
            <span className={cn("font-mono font-bold uppercase mt-0.5", tsS, keyInserted ? "text-amber-400" : "text-muted-foreground/20")}>
              {keyInserted ? 'ON' : 'KEY'}
            </span>
          </button>

          {/* Master ARM */}
          <button onClick={() => handleMasterArm(!masterArmed)}
            disabled={!keyInserted}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 rounded-lg border-2 font-black uppercase transition-all",
              mob ? "h-14 text-sm tracking-[0.2em]" : "h-12 text-xs tracking-[0.15em]",
              masterArmed
                ? "bg-red-600/25 border-red-500/60 text-red-400"
                : keyInserted
                  ? "bg-[hsl(220_10%_10%)] border-amber-500/30 text-amber-400/70 hover:border-amber-500/50"
                  : "bg-[hsl(220_10%_8%)] border-border/10 text-muted-foreground/20"
            )}
            style={masterArmed ? { boxShadow: 'inset 0 0 20px rgba(255,50,30,0.15), 0 0 12px rgba(255,50,30,0.1)' } : undefined}>
            {masterArmed ? <ShieldAlert className={cn(mob ? "w-5 h-5" : "w-4 h-4")} /> : <Shield className={cn(mob ? "w-5 h-5" : "w-4 h-4")} />}
            {masterArmed ? 'ARMED' : 'MASTER ARM'}
          </button>

          {/* Deadman */}
          <button
            onMouseDown={() => setDeadmanHeld(true)}
            onMouseUp={() => setDeadmanHeld(false)}
            onMouseLeave={() => setDeadmanHeld(false)}
            onTouchStart={e => { e.preventDefault(); setDeadmanHeld(true); }}
            onTouchEnd={e => { e.preventDefault(); setDeadmanHeld(false); }}
            className={cn(
              "flex flex-col items-center justify-center rounded-lg border-2 transition-all shrink-0",
              mob ? "w-14 h-14" : "w-12 h-12",
              deadmanHeld
                ? "bg-green-600/20 border-green-500/50 text-green-400"
                : "bg-[hsl(220_10%_10%)] border-border/20 text-muted-foreground/20"
            )}>
            <Hand className={cn(mob ? "w-5 h-5" : "w-4 h-4")} />
            <span className={cn("font-mono font-bold uppercase mt-0.5", tsS)}>HOLD</span>
          </button>
        </div>

        {/* Status bar */}
        <div className={cn("flex items-center justify-between border-t px-2 py-1",
          masterArmed ? "border-red-800/30" : "border-border/10")}>
          <div className="flex items-center gap-2">
            <span className={cn("font-mono", tsS, masterArmed ? "text-red-400 animate-pulse font-bold" : "text-muted-foreground/30")}>
              {masterArmed ? '⚠ LIVE' : 'SAFE'}
            </span>
            <span className={cn("font-mono text-muted-foreground/20", tsS)}>
              {connectedModules.length} MOD · {totalIgniters} IGN · {firedIgniters} FIRED
            </span>
          </div>
          {/* 4 Output LEDs */}
          <div className="flex items-center gap-1">
            <span className={cn("font-mono text-muted-foreground/20 mr-1", tsS)}>OUT:</span>
            {[0, 1, 2, 3].map(i => (
              <button key={i} onClick={() => setSelectedOutput(i)}
                className={cn(
                  "rounded-full transition-all",
                  mob ? "w-3 h-3" : "w-2.5 h-2.5",
                  selectedOutput === i
                    ? masterArmed ? "bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.5)]" : "bg-green-500 shadow-[0_0_4px_rgba(34,197,94,0.4)]"
                    : "bg-muted-foreground/15 hover:bg-muted-foreground/30"
                )} title={`Output ${i + 1}`} />
            ))}
          </div>
        </div>
      </div>

      {masterArmed && (
        <div className={cn("text-center font-black uppercase animate-pulse tracking-[0.3em]",
          mob ? "text-[10px] py-1" : "text-[8px] py-0.5",
          "text-red-400"
        )} style={{ background: 'hsl(0 50% 8%)' }}>
          ⚠ MASTER ARMED — LIVE SYSTEM ⚠
        </div>
      )}

      {/* ═══ MODE TABS ═══ */}
      <div className="flex gap-0.5 overflow-x-auto">
        {([
          { key: 'manual' as XL4Mode, label: 'Manual', icon: Hand },
          { key: 'semiauto' as XL4Mode, label: 'Semi-Auto', icon: SkipForward },
          { key: 'auto' as XL4Mode, label: 'Auto/TC', icon: Timer },
          { key: 'continuity' as XL4Mode, label: 'Continuity', icon: Activity },
          { key: 'hardware' as XL4Mode, label: 'HW Serial', icon: Usb },
          { key: 'status' as XL4Mode, label: 'Status', icon: Signal },
        ]).map(m => (
          <button key={m.key} onClick={() => setXl4Mode(m.key)}
            className={cn(
              "flex items-center gap-1 rounded font-bold uppercase tracking-wider transition-all whitespace-nowrap shrink-0 border",
              mob ? "px-2.5 py-2 text-[9px]" : fs ? "px-2 py-1.5 text-[8px]" : "px-1.5 py-1 text-[7px]",
              xl4Mode === m.key
                ? "bg-primary/10 border-primary/30 text-primary"
                : "bg-[hsl(220_10%_8%)] border-border/10 text-muted-foreground/30 hover:text-muted-foreground/50"
            )}>
            <m.icon className={cn(mob ? "w-3.5 h-3.5" : "w-3 h-3")} />
            {m.label}
          </button>
        ))}
      </div>

      {/* ═══ MODE CONTENT ═══ */}
      <ScrollArea className="flex-1">
        {/* ─── MANUAL MODE ─── */}
        {xl4Mode === 'manual' && (
          <div className="space-y-2">
            {/* Module selector */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={cn("font-bold text-muted-foreground/40 uppercase tracking-wider", tsS)}>Module:</span>
              {modules.filter(m => m.connected).map(m => (
                <button key={m.id} onClick={() => setSelectedModule(m.id)}
                  className={cn(
                    "rounded border font-bold transition-all",
                    mob ? "px-2.5 py-1.5 text-[9px]" : "px-2 py-1 text-[8px]",
                    selectedModule === m.id
                      ? "border-primary/40 bg-primary/15 text-primary"
                      : m.armed ? "border-red-500/30 bg-red-500/5 text-red-400/60" : "border-border/15 text-muted-foreground/30"
                  )}>
                  {m.wireless ? '📡' : '🔌'} {m.name}
                </button>
              ))}
            </div>

            {/* Igniter grid — 32 positions like XL4 */}
            {currentModule && (
              <div className={cn("grid gap-1", mob ? "grid-cols-8" : fs ? "grid-cols-8" : "grid-cols-8")}>
                {currentModule.igniters.map(ig => (
                  <button key={ig.position}
                    onClick={() => { if (masterArmed && deadmanHeld && ig.connected && !ig.fired) broadcastModuleFire(selectedModule, ig.position); }}
                    disabled={!masterArmed || !deadmanHeld || !ig.connected || ig.fired}
                    className={cn(
                      "flex flex-col items-center justify-center rounded border transition-all select-none",
                      mob ? "min-h-[48px] rounded-lg" : "min-h-[36px]",
                      ig.fired
                        ? "bg-red-900/30 border-red-500/20 text-red-400/40"
                        : ig.connected && masterArmed && deadmanHeld
                          ? "bg-[hsl(120_30%_12%)] border-green-500/30 text-green-400 hover:bg-green-600/20 active:scale-[0.9] active:bg-red-600/40 cursor-pointer"
                          : ig.connected
                            ? "bg-[hsl(220_10%_10%)] border-border/15 text-muted-foreground/40"
                            : "bg-[hsl(220_10%_6%)] border-border/5 text-muted-foreground/10"
                    )}
                    style={ig.fired ? { boxShadow: 'inset 0 0 8px rgba(255,50,30,0.1)' } : undefined}>
                    <span className={cn("font-mono font-bold", mob ? "text-[10px]" : "text-[8px]")}>{ig.position}</span>
                    <span className={cn("font-mono", tsS)}>
                      {ig.fired ? '✕' : ig.connected ? `${ig.resistance.toFixed(1)}Ω` : '—'}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Console channels remote fire */}
            {channels.length > 0 && (
              <div>
                <span className={cn("font-bold text-muted-foreground/40 uppercase tracking-wider block mb-1", tsS)}>
                  Console Channels ({channels.length})
                </span>
                <div className={cn("grid gap-1", mob ? "grid-cols-2 gap-1.5" : "grid-cols-3 gap-1")}>
                  {channels.slice(0, 12).map(ch => (
                    <button key={ch.id} onClick={() => broadcastChannelFire(ch)}
                      disabled={!masterArmed}
                      className={cn(
                        "rounded border transition-all flex items-center gap-1.5 active:scale-[0.93]",
                        mob ? "px-2.5 py-2" : "px-2 py-1.5",
                        masterArmed
                          ? "border-border/20 bg-[hsl(220_10%_10%)] hover:bg-[hsl(220_10%_14%)] active:bg-red-700/40"
                          : "border-border/10 bg-[hsl(220_10%_7%)] opacity-40"
                      )}>
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: ch.color }} />
                      <div className="flex-1 min-w-0">
                        <div className={cn("font-bold uppercase truncate text-foreground/70", tsS)}>{ch.name}</div>
                      </div>
                      <Send className={cn("text-primary/30 shrink-0", mob ? "w-3 h-3" : "w-2.5 h-2.5")} />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── SEMI-AUTO MODE ─── */}
        {xl4Mode === 'semiauto' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className={cn("font-bold text-muted-foreground/40 uppercase tracking-wider", tsS)}>
                Step Sequencer — Module {selectedModule}
              </span>
              <span className={cn("font-mono text-primary/60", tsS)}>Step {semiAutoStep + 1}</span>
            </div>

            {/* Module selector */}
            <div className="flex gap-1">
              {modules.filter(m => m.connected).map(m => (
                <button key={m.id} onClick={() => { setSelectedModule(m.id); setSemiAutoStep(0); }}
                  className={cn("rounded border font-bold transition-all", mob ? "px-2.5 py-1.5 text-[9px]" : "px-2 py-1 text-[8px]",
                    selectedModule === m.id ? "border-primary/40 bg-primary/15 text-primary" : "border-border/15 text-muted-foreground/30")}>
                  {m.name}
                </button>
              ))}
            </div>

            {/* Step fire button */}
            <button onClick={semiAutoFire}
              disabled={!masterArmed || !deadmanHeld}
              className={cn(
                "w-full rounded-xl font-black uppercase transition-all border-2 flex items-center justify-center gap-2",
                mob ? "h-16 text-base tracking-[0.25em]" : "h-12 text-sm tracking-[0.2em]",
                masterArmed && deadmanHeld
                  ? "bg-gradient-to-b from-amber-600 to-amber-800 text-white border-amber-500/40 hover:from-amber-500 active:scale-[0.96]"
                  : "bg-[hsl(220_10%_8%)] text-muted-foreground/20 border-border/10"
              )} style={masterArmed && deadmanHeld ? { boxShadow: '0 0 16px rgba(245,158,11,0.2)' } : undefined}>
              <SkipForward className={cn(mob ? "w-6 h-6" : "w-5 h-5")} />
              NEXT FIRE
            </button>

            {/* Progress */}
            {currentModule && (() => {
              const active = currentModule.igniters.filter(ig => ig.connected && !ig.fired);
              return (
                <div className={cn("space-y-0.5 rounded border border-border/10 p-2", "bg-[hsl(220_10%_6%)]")}>
                  <div className="flex justify-between">
                    <span className={cn("font-mono text-muted-foreground/40", tsS)}>Queue: {active.length} remaining</span>
                    <button onClick={() => setSemiAutoStep(0)} className={cn("text-primary/50 font-bold uppercase", tsS)}>Reset</button>
                  </div>
                  <div className="flex gap-0.5 flex-wrap">
                    {currentModule.igniters.filter(ig => ig.connected).map((ig, i) => (
                      <div key={ig.position} className={cn("rounded-sm font-mono", mob ? "w-5 h-5 text-[7px]" : "w-4 h-4 text-[6px]",
                        "flex items-center justify-center",
                        ig.fired ? "bg-red-900/40 text-red-400/40" : i === semiAutoStep ? "bg-amber-500/20 text-amber-400 border border-amber-500/40" : "bg-[hsl(220_10%_12%)] text-muted-foreground/30")}>
                        {ig.position}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {!masterArmed && (
              <div className={cn("text-center font-bold uppercase text-muted-foreground/30", tsS)}>
                Arme o sistema para disparar
              </div>
            )}
          </div>
        )}

        {/* ─── AUTO/TIMECODE MODE ─── */}
        {xl4Mode === 'auto' && (
          <div className="space-y-2">
            {/* Timecode display */}
            <div className={cn("rounded-lg border text-center font-mono font-black tracking-[0.3em]",
              mob ? "py-3 text-xl" : "py-2 text-lg",
              autoRunning ? "border-green-500/30 bg-green-500/5 text-green-400" : "border-border/20 bg-[hsl(220_10%_6%)] text-foreground/60"
            )}>
              {fmtTC(timecodeMs)}
            </div>

            {/* Transport */}
            <div className="flex gap-1.5">
              <button onClick={() => { setTimecodeMs(0); setAutoCues(prev => prev.map(c => ({ ...c, state: 'ready' as const }))); }}
                className={cn("flex-1 rounded border border-border/15 bg-[hsl(220_10%_10%)] font-bold uppercase flex items-center justify-center gap-1",
                  mob ? "py-2.5 text-[10px]" : "py-2 text-[9px]", "text-muted-foreground/50 hover:text-foreground/70")}>
                <Square className="w-3 h-3" /> Reset
              </button>
              <button onClick={() => setAutoRunning(!autoRunning)}
                disabled={!masterArmed}
                className={cn("flex-1 rounded border font-bold uppercase flex items-center justify-center gap-1",
                  mob ? "py-2.5 text-[10px]" : "py-2 text-[9px]",
                  autoRunning
                    ? "border-red-500/30 bg-red-500/10 text-red-400"
                    : masterArmed ? "border-green-500/30 bg-green-500/10 text-green-400" : "border-border/15 bg-[hsl(220_10%_10%)] text-muted-foreground/20")}>
                {autoRunning ? <Square className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                {autoRunning ? 'Stop' : 'Run'}
              </button>
            </div>

            {/* Timecode source */}
            <div className="flex items-center gap-2">
              <span className={cn("font-mono text-muted-foreground/30", tsS)}>Source:</span>
              {['Internal', 'LTC', 'MTC', 'GPS'].map(src => (
                <span key={src} className={cn("font-mono rounded px-1.5 py-0.5 border", tsS,
                  src === 'Internal' ? "border-primary/30 bg-primary/10 text-primary/70" : "border-border/10 text-muted-foreground/20")}>
                  {src}
                </span>
              ))}
            </div>

            {/* Cue list */}
            <div className={cn("rounded border border-border/10 bg-[hsl(220_10%_5%)]", mob ? "p-2" : "p-1.5")}>
              <div className="flex items-center justify-between mb-1">
                <span className={cn("font-bold text-muted-foreground/40 uppercase tracking-wider", tsS)}>Cue List ({autoCues.length})</span>
                <button onClick={() => {
                  const newCue: AutoCue = {
                    id: `ac-${Date.now()}`, cueNumber: autoCues.length + 1,
                    moduleId: selectedModule, igniterPos: 1,
                    timecodeMs: timecodeMs + 1000, name: `Cue ${autoCues.length + 1}`,
                    state: 'ready',
                  };
                  setAutoCues(prev => [...prev, newCue]);
                }} className={cn("text-primary/50 font-bold", tsS)}>+ Add Cue</button>
              </div>
              {autoCues.length === 0 ? (
                <div className={cn("text-center text-muted-foreground/20 py-2 font-mono", tsS)}>Sem cues programadas</div>
              ) : (
                <div className="space-y-0.5">
                  {autoCues.map(cue => (
                    <div key={cue.id} className={cn("flex items-center gap-1.5 rounded px-1.5 py-1 font-mono", tsS,
                      cue.state === 'fired' ? "bg-red-900/20 text-red-400/50" : "bg-[hsl(220_10%_8%)] text-foreground/60")}>
                      <span className="text-muted-foreground/30 w-6">#{cue.cueNumber}</span>
                      <span className="text-muted-foreground/40 w-20">{fmtTC(cue.timecodeMs)}</span>
                      <span className="flex-1 truncate">{cue.name}</span>
                      <span className={cn("uppercase font-bold px-1 rounded text-[6px]",
                        cue.state === 'fired' ? "bg-red-500/15 text-red-400" : cue.state === 'ready' ? "bg-green-500/15 text-green-400" : "bg-muted text-muted-foreground/30")}>
                        {cue.state}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── CONTINUITY CHECK ─── */}
        {xl4Mode === 'continuity' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className={cn("font-bold text-muted-foreground/40 uppercase tracking-wider", tsS)}>Continuity Check</span>
              <button onClick={() => setModules(createDefaultModules())}
                className={cn("text-primary/50 font-bold uppercase", tsS)}>Refresh</button>
            </div>
            {modules.filter(m => m.connected).map(mod => {
              const ok = mod.igniters.filter(ig => ig.connected).length;
              const fail = mod.igniters.filter(ig => !ig.connected).length;
              return (
                <div key={mod.id} className={cn("rounded border border-border/15 bg-[hsl(220_10%_7%)]", mob ? "p-2" : "p-1.5")}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className={cn(mod.wireless ? "text-cyan-400" : "text-amber-400", mob ? "text-sm" : "text-xs")}>
                        {mod.wireless ? '📡' : '🔌'}
                      </span>
                      <span className={cn("font-bold text-foreground/70", tsL)}>{mod.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn("font-mono text-green-400/60", tsS)}>{ok}✓</span>
                      {fail > 0 && <span className={cn("font-mono text-red-400/60", tsS)}>{fail}✕</span>}
                      <span className={cn("font-mono text-muted-foreground/30", tsS)}>{mod.batteryVoltage.toFixed(1)}V</span>
                      {mod.wireless && <span className={cn("font-mono text-muted-foreground/30", tsS)}>{mod.signalStrength}%</span>}
                    </div>
                  </div>
                  {/* Mini igniter grid */}
                  <div className="flex gap-[2px] flex-wrap">
                    {mod.igniters.map(ig => (
                      <div key={ig.position}
                        className={cn("rounded-sm flex items-center justify-center font-mono",
                          mob ? "w-5 h-4 text-[6px]" : "w-4 h-3 text-[5px]",
                          ig.fired ? "bg-red-500/20 text-red-400/50"
                            : ig.connected ? "bg-green-500/15 text-green-400/60"
                              : "bg-red-500/10 text-red-400/30"
                        )}>
                        {ig.position}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ─── HARDWARE SERIAL MODE ─── */}
        {xl4Mode === 'hardware' && (
          <div className="space-y-2">
            {/* Connection */}
            <div className={cn("rounded-lg border bg-[hsl(220_10%_7%)]", hwConnected || hwSimulated ? "border-green-500/30" : "border-border/15")}>
              <div className={cn("flex items-center gap-2 p-2")}>
                <CircuitBoard className={cn("shrink-0", mob ? "w-5 h-5" : "w-4 h-4", hwConnected || hwSimulated ? "text-green-400" : "text-muted-foreground/30")} />
                <div className="flex-1 min-w-0">
                  <div className={cn("font-bold uppercase tracking-wider text-foreground/70", tsL)}>
                    FireOne RS-485 {hwSimulated ? '(Simulado)' : ''}
                  </div>
                  <div className={cn("font-mono text-muted-foreground/40", tsS)}>
                    {hwConnected ? '● Conectado · 9600 8N1' : hwSimulated ? '● Modo simulação ativo' : '○ Desconectado'}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setHwSimulated(!hwSimulated)}
                    className={cn("rounded border font-bold transition-all", mob ? "px-2 py-1 text-[9px]" : "px-1.5 py-0.5 text-[7px]",
                      hwSimulated ? "border-amber-500/30 bg-amber-500/10 text-amber-400" : "border-border/15 text-muted-foreground/30")}>
                    SIM
                  </button>
                  {!hwSimulated ? (
                    hwConnected ? (
                      <Button size="sm" variant="outline" onClick={handleHwDisconnect}
                        className={cn(mob ? "h-8 text-[10px]" : "h-6 text-[8px]", "border-red-500/30 text-red-400")}>
                        Desconectar
                      </Button>
                    ) : (
                      <Button size="sm" onClick={handleHwConnect}
                        className={cn(mob ? "h-8 text-[10px]" : "h-6 text-[8px]")}>
                        <Usb className="w-3 h-3 mr-1" /> Conectar
                      </Button>
                    )
                  ) : null}
                </div>
              </div>
            </div>

            {/* Scan & Module list */}
            <div className="flex items-center justify-between">
              <span className={cn("font-bold text-muted-foreground/40 uppercase tracking-wider", tsS)}>
                Módulos de Campo ({hwModules.length})
              </span>
              <button onClick={handleHwScan} disabled={hwScanning}
                className={cn("flex items-center gap-1 text-primary/60 font-bold uppercase", tsS,
                  hwScanning && "animate-spin")}>
                <RefreshCw className="w-3 h-3" /> {hwScanning ? 'Scanning...' : 'Scan'}
              </button>
            </div>

            {hwModules.length === 0 ? (
              <div className={cn("text-center text-muted-foreground/20 py-4 font-mono rounded border border-dashed border-border/10", tsS)}>
                {hwSimulated || hwConnected ? 'Clique em Scan para descobrir módulos' : 'Conecte o hardware ou ative o modo SIM'}
              </div>
            ) : (
              <div className="space-y-1.5">
                {hwModules.map(mod => {
                  const okCount = mod.igniters.filter(ig => ig.connected).length;
                  const firedCount = mod.igniters.filter(ig => ig.fired).length;
                  const contOk = mod.igniters.filter(ig => ig.continuityOk).length;
                  return (
                    <div key={mod.moduleAddress} className={cn("rounded-lg border bg-[hsl(220_10%_7%)]",
                      mod.armed ? "border-red-500/30" : "border-border/15")}>
                      {/* Module header */}
                      <div className={cn("flex items-center gap-2 p-2")}>
                        <span className={cn(mod.wireless ? "text-cyan-400" : "text-amber-400", mob ? "text-sm" : "text-xs")}>
                          {mod.wireless ? '📡' : '🔌'}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className={cn("font-bold text-foreground/70", tsL)}>
                            FM-{String(mod.moduleAddress).padStart(2, '0')}
                            <span className={cn("ml-1.5 font-mono text-muted-foreground/30", tsS)}>v{mod.firmwareVersion}</span>
                          </div>
                          <div className={cn("font-mono flex items-center gap-2", tsS)}>
                            <span className="text-green-400/60">{okCount}✓</span>
                            {firedCount > 0 && <span className="text-red-400/60">{firedCount}🔥</span>}
                            <span className="text-muted-foreground/30">{mod.batteryVoltage.toFixed(1)}V</span>
                            <span className="text-muted-foreground/30">{mod.temperature}°C</span>
                            {mod.wireless && <span className="text-muted-foreground/30">{mod.signalStrength}%</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleHwContinuity(mod.moduleAddress)}
                            className={cn("rounded border font-bold transition-all", mob ? "px-2 py-1 text-[9px]" : "px-1.5 py-0.5 text-[7px]",
                              "border-cyan-500/20 text-cyan-400/60 hover:bg-cyan-500/10")}>
                            <Activity className="w-3 h-3 inline mr-0.5" />CHK
                          </button>
                          <button onClick={() => handleHwArmModule(mod.moduleAddress, !mod.armed)}
                            disabled={!masterArmed}
                            className={cn("rounded border font-bold transition-all", mob ? "px-2 py-1 text-[9px]" : "px-1.5 py-0.5 text-[7px]",
                              mod.armed
                                ? "border-red-500/40 bg-red-500/15 text-red-400"
                                : masterArmed ? "border-amber-500/20 text-amber-400/60 hover:bg-amber-500/10" : "border-border/10 text-muted-foreground/15")}>
                            {mod.armed ? 'DISARM' : 'ARM'}
                          </button>
                        </div>
                      </div>

                      {/* Errors */}
                      {mod.errors.length > 0 && (
                        <div className={cn("px-2 pb-1 flex gap-1 flex-wrap")}>
                          {mod.errors.map(err => (
                            <span key={err} className={cn("rounded bg-red-500/10 text-red-400 font-mono px-1", tsS)}>{err}</span>
                          ))}
                        </div>
                      )}

                      {/* Igniter grid — 32 positions */}
                      <div className={cn("px-2 pb-2")}>
                        <div className={cn("grid gap-[3px]", mob ? "grid-cols-8" : "grid-cols-8")}>
                          {mod.igniters.map(ig => (
                            <button key={ig.position}
                              onClick={() => handleHwFire(mod.moduleAddress, ig.position)}
                              disabled={!masterArmed || !deadmanHeld || !ig.connected || ig.fired}
                              className={cn(
                                "flex flex-col items-center justify-center rounded border transition-all select-none",
                                mob ? "min-h-[44px] rounded-lg" : "min-h-[32px]",
                                ig.fired
                                  ? "bg-red-900/30 border-red-500/20 text-red-400/40"
                                  : ig.connected && masterArmed && deadmanHeld
                                    ? "bg-[hsl(120_30%_12%)] border-green-500/30 text-green-400 hover:bg-green-600/20 active:scale-[0.9] active:bg-red-600/40 cursor-pointer"
                                    : ig.connected
                                      ? "bg-[hsl(220_10%_10%)] border-border/15 text-muted-foreground/40"
                                      : "bg-[hsl(220_10%_6%)] border-border/5 text-muted-foreground/10"
                              )}>
                              <span className={cn("font-mono font-bold", mob ? "text-[9px]" : "text-[7px]")}>{ig.position}</span>
                              <span className={cn("font-mono", tsS)}>
                                {ig.fired ? '✕' : ig.connected ? `${ig.resistance.toFixed(1)}Ω` : '—'}
                              </span>
                              {ig.continuityOk && !ig.fired && (
                                <span className={cn("text-green-400", "text-[5px]")}>●</span>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* HW Event Log */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className={cn("font-bold text-muted-foreground/40 uppercase tracking-wider", tsS)}>Hardware Log</span>
                {hwEvents.length > 0 && (
                  <button onClick={() => setHwEvents([])} className={cn("text-muted-foreground/30 hover:text-foreground/50", tsS)}>Clear</button>
                )}
              </div>
              <ScrollArea className={cn("rounded border border-border/10 bg-[hsl(220_10%_5%)]", mob ? "h-24" : "h-16")}>
                <div className="p-1.5 space-y-0.5">
                  {hwEvents.length === 0 ? (
                    <div className={cn("text-center text-muted-foreground/20 py-2 font-mono", tsS)}>Sem eventos de hardware</div>
                  ) : hwEvents.slice(0, 30).map((evt, i) => (
                    <div key={i} className={cn("flex items-center gap-1.5 font-mono", tsS)}>
                      <span className="text-muted-foreground/30">
                        {new Date(evt.timestamp).toLocaleTimeString('pt-BR', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                      <span className={cn("font-bold px-1 rounded text-[6px] uppercase",
                        evt.type === 'fire-confirm' ? "bg-red-500/15 text-red-400"
                          : evt.type === 'error' ? "bg-red-500/15 text-red-300"
                          : evt.type === 'emergency-stop' ? "bg-red-500/20 text-red-400"
                          : "bg-primary/10 text-primary/60")}>
                        {evt.type.replace('-', ' ')}
                      </span>
                      <span className="text-muted-foreground/40">M{evt.moduleAddress}</span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>
        )}


        {xl4Mode === 'status' && (
          <div className="space-y-2">
            {/* Virtual Fixtures */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className={cn("font-bold text-muted-foreground/40 uppercase tracking-wider", tsS)}>Virtual Fixtures ({fixtures.length})</span>
                <button onClick={() => setShowAddForm(!showAddForm)} className={cn("rounded bg-primary/10 text-primary/70", mob ? "px-2 py-1 text-[9px]" : "px-1.5 py-0.5 text-[7px]")}>
                  <Plus className="w-3 h-3 inline mr-0.5" /> Add
                </button>
              </div>

              {showAddForm && (
                <div className={cn("rounded border border-primary/20 bg-primary/5 mb-2 space-y-1.5", mob ? "p-2.5" : "p-1.5")}>
                  <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nome..."
                    className={cn("bg-background/60 border-border/20", mob ? "h-9 text-sm" : "h-6 text-[9px]")} />
                  <div className="flex gap-1 flex-wrap">
                    {FIXTURE_TYPES.map(t => (
                      <button key={t.key} onClick={() => { setNewType(t.key); setNewColor(t.color); }}
                        className={cn("rounded border font-bold transition-all", mob ? "px-2 py-1 text-[9px]" : "px-1.5 py-0.5 text-[7px]",
                          newType === t.key ? "border-primary/40 bg-primary/15 text-primary" : "border-border/15 text-muted-foreground/30")}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-1.5 items-center">
                    <input type="color" value={newColor} onChange={e => setNewColor(e.target.value)} className="w-6 h-6 rounded border-0 cursor-pointer" />
                    <Input type="number" value={newAddr} onChange={e => setNewAddr(Number(e.target.value))} min={1} max={512}
                      className={cn("flex-1 bg-background/60 border-border/20 font-mono", mob ? "h-8 text-xs" : "h-6 text-[9px]")} />
                    <Button size="sm" onClick={addFixture} disabled={!newName.trim()} className={cn(mob ? "h-8" : "h-6 text-[9px]")}>OK</Button>
                  </div>
                </div>
              )}

              <div className={cn("grid gap-1", mob ? "grid-cols-2 gap-1.5" : "grid-cols-2 gap-1")}>
                {fixtures.map(fix => {
                  const ft = FIXTURE_TYPES.find(t => t.key === fix.type);
                  const Icon = ft?.icon || Zap;
                  return (
                    <div key={fix.id} className={cn("rounded border border-border/20 bg-[hsl(220_10%_8%)] flex flex-col", mob ? "p-2" : "p-1.5")}>
                      <div className="flex items-center gap-1.5 mb-1">
                        <Icon className={cn(mob ? "w-4 h-4" : "w-3 h-3")} style={{ color: fix.color }} />
                        <span className={cn("font-bold uppercase truncate flex-1 text-foreground/70", tsS)}>{fix.name}</span>
                        <button onClick={() => setFixtures(prev => prev.filter(f => f.id !== fix.id))} className="text-muted-foreground/20 hover:text-red-400">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                      <Slider value={[fix.intensity]} min={0} max={255} step={1}
                        onValueChange={([v]) => setFixtures(prev => prev.map(f => f.id === fix.id ? { ...f, intensity: v } : f))}
                        className="mb-1.5" />
                      <button onClick={() => broadcastFire(fix)}
                        disabled={!masterArmed}
                        className={cn(
                          "w-full rounded font-black uppercase transition-all border",
                          mob ? "py-2.5 text-sm tracking-[0.15em]" : "py-1.5 text-[9px] tracking-[0.1em]",
                          masterArmed
                            ? "bg-gradient-to-b from-red-700 to-red-900 text-white/90 border-red-600/40 hover:from-red-600 active:scale-[0.93]"
                            : "bg-[hsl(220_10%_8%)] text-muted-foreground/20 border-border/10"
                        )} style={masterArmed ? { boxShadow: '0 0 8px rgba(239,68,68,0.2)' } : undefined}>
                        🔥 FIRE
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Event Log */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <MonitorPlay className={cn("text-muted-foreground/40", mob ? "w-3.5 h-3.5" : "w-3 h-3")} />
                  <span className={cn("font-bold text-muted-foreground/40 uppercase tracking-wider", tsS)}>Event Log</span>
                </div>
                {events.length > 0 && (
                  <button onClick={() => setEvents([])} className={cn("text-muted-foreground/30 hover:text-foreground/50", tsS)}>Clear</button>
                )}
              </div>
              <ScrollArea className={cn("rounded border border-border/10 bg-[hsl(220_10%_5%)]", mob ? "h-28" : "h-20")}>
                <div className="p-1.5 space-y-0.5">
                  {events.length === 0 ? (
                    <div className={cn("text-center text-muted-foreground/20 py-2 font-mono", tsS)}>Aguardando eventos...</div>
                  ) : events.map(evt => (
                    <div key={evt.id} className={cn("flex items-center gap-1.5 font-mono", tsS)}>
                      <span className="text-muted-foreground/30">
                        {new Date(evt.timestamp).toLocaleTimeString('pt-BR', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                      <span className={cn("font-bold px-1 rounded text-[6px] uppercase",
                        evt.source === 'remote' ? "bg-cyan-500/15 text-cyan-400" : "bg-amber-500/15 text-amber-400")}>
                        {evt.source === 'remote' ? 'RX' : 'TX'}
                      </span>
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: evt.color }} />
                      <span className="text-foreground/60 truncate">{evt.fixtureName}</span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>
        )}
      </ScrollArea>

      {/* ═══ EMERGENCY PANIC ═══ */}
      <button onClick={handlePanic}
        className={cn(
          "w-full rounded-lg font-black uppercase transition-all shrink-0",
          "bg-gradient-to-b from-red-700 to-red-900 text-white/90",
          "hover:from-red-600 hover:to-red-800 active:scale-[0.97]",
          "border-2 border-red-600/50 flex items-center justify-center gap-2",
          mob ? "h-12 text-sm tracking-[0.25em]" : fs ? "h-10 text-xs tracking-[0.2em]" : "h-8 text-[10px] tracking-[0.15em]"
        )} style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1)' }}>
        <AlertTriangle className={cn(mob ? "w-5 h-5" : "w-4 h-4")} />
        EMERGENCY STOP
      </button>
    </div>
  );
}
