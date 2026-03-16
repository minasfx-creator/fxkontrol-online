/**
 * FXcommander™ Digital Console — Faithful recreation of the Showven FXcommander hardware.
 * 
 * Hardware reference:
 * - 10.1" capacitive touch screen
 * - 8 physical CUE keys (KEY1-KEY8) with LED status
 * - PYRO ARM + DMX ARM physical switches
 * - DEADMAN button + PANIC emergency stop
 * - 4 Scenes (SCENE0-3), Super DMX cue list
 * - Device library with firing rules (→, ←, ↑↑↑, ←→, →←)
 * - RDMX device status monitoring (temp, pressure)
 * - MIDI IN, LTC IN, DMX OUT interfaces
 */
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  Flame, Wind, Sparkles, Zap, Play, Square, Plus, Trash2,
  AlertTriangle, Check, Radio, Lightbulb, ChevronDown, ChevronRight,
  RotateCcw, Save, Upload, Lock, Unlock, Timer, Power,
  Shield, ShieldAlert, Gauge, Settings, FolderOpen, Wifi,
  Signal, Thermometer, Activity, Volume2, ArrowRight, ArrowLeft,
  ChevronsUp, ArrowLeftRight, Eye, EyeOff, Keyboard, Maximize2, Minimize2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useProjectStore } from '@/store/useProjectStore';
import { useLiveSfxStore } from '@/store/useLiveSfxStore';

// ─── Types ───
interface SFXChannel {
  id: string;
  name: string;
  type: 'co2' | 'flame' | 'confetti' | 'streamer' | 'cryo' | 'haze' | 'spark' | 'custom';
  dmxUniverse: number;
  dmxAddress: number;
  dmxChannels: number;
  armed: boolean;
  firing: boolean;
  duration: number;
  intensity: number;
  color: string;
  locked: boolean;
  enabled: boolean;
  temperature?: number;
  pressure?: number;
  positionId?: string;
}

interface CueEntry {
  id: string;
  deviceIds: string[];
  effect: string;
  firingRule: 'sync' | 'ltr' | 'rtl' | 'sides' | 'middle';
  duration: number;
  triggerDelay: number;
  repeatPeriod: number;
  repeatCount: number;
  keyIndex: number; // KEY1-KEY8 (0-7)
  keyLabel: string;
  keyColor: string;
}

type FXCMode = 'super_dmx' | 'simple_dmx' | 'manual_fire' | 'auto_fire' | 'check_slave' | 'settings';

const FIRING_RULES = [
  { key: 'sync' as const, label: '↑↑↑', desc: 'Sync' },
  { key: 'ltr' as const, label: '→', desc: 'L→R' },
  { key: 'rtl' as const, label: '←', desc: 'R→L' },
  { key: 'sides' as const, label: '→←', desc: 'Sides→Mid' },
  { key: 'middle' as const, label: '←→', desc: 'Mid→Sides' },
];

const SFX_TYPES: { key: SFXChannel['type']; label: string; icon: typeof Flame; color: string }[] = [
  { key: 'co2', label: 'CO₂ JET', icon: Wind, color: '#4DCFFF' },
  { key: 'flame', label: 'FLAMER', icon: Flame, color: '#FF6622' },
  { key: 'confetti', label: 'CONFETTI', icon: Sparkles, color: '#FFD700' },
  { key: 'streamer', label: 'STREAMER', icon: Sparkles, color: '#C77DFF' },
  { key: 'cryo', label: 'CRYO JET', icon: Wind, color: '#66DDFF' },
  { key: 'haze', label: 'HAZE', icon: Wind, color: '#888888' },
  { key: 'spark', label: 'SPARKULAR', icon: Zap, color: '#FFAA00' },
  { key: 'custom', label: 'DMX', icon: Lightbulb, color: '#00DDFF' },
];

const DEFAULT_CHANNELS: SFXChannel[] = [
  { id: 'sfx-1', name: 'SPARKULAR L1', type: 'spark', dmxUniverse: 1, dmxAddress: 1, dmxChannels: 2, armed: false, firing: false, duration: 2500, intensity: 200, color: '#FFAA00', locked: false, enabled: true, temperature: 575 },
  { id: 'sfx-2', name: 'SPARKULAR L2', type: 'spark', dmxUniverse: 1, dmxAddress: 3, dmxChannels: 2, armed: false, firing: false, duration: 2500, intensity: 200, color: '#FFAA00', locked: false, enabled: true, temperature: 580 },
  { id: 'sfx-3', name: 'SPARKULAR R1', type: 'spark', dmxUniverse: 1, dmxAddress: 5, dmxChannels: 2, armed: false, firing: false, duration: 2500, intensity: 200, color: '#FFAA00', locked: false, enabled: true, temperature: 572 },
  { id: 'sfx-4', name: 'SPARKULAR R2', type: 'spark', dmxUniverse: 1, dmxAddress: 7, dmxChannels: 2, armed: false, firing: false, duration: 2500, intensity: 200, color: '#FFAA00', locked: false, enabled: true, temperature: 568 },
  { id: 'sfx-5', name: 'FLAMER C1', type: 'flame', dmxUniverse: 1, dmxAddress: 9, dmxChannels: 6, armed: false, firing: false, duration: 800, intensity: 200, color: '#FF6622', locked: false, enabled: true },
  { id: 'sfx-6', name: 'FLAMER C2', type: 'flame', dmxUniverse: 1, dmxAddress: 15, dmxChannels: 6, armed: false, firing: false, duration: 800, intensity: 200, color: '#FF6622', locked: false, enabled: true },
  { id: 'sfx-7', name: 'CO₂ JET L', type: 'co2', dmxUniverse: 1, dmxAddress: 21, dmxChannels: 2, armed: false, firing: false, duration: 500, intensity: 255, color: '#4DCFFF', locked: false, enabled: true, pressure: 55 },
  { id: 'sfx-8', name: 'CO₂ JET R', type: 'co2', dmxUniverse: 1, dmxAddress: 23, dmxChannels: 2, armed: false, firing: false, duration: 500, intensity: 255, color: '#4DCFFF', locked: false, enabled: true, pressure: 52 },
];

// ═══════════════════════════════════════════════════════════
// CUE KEY — hardware key replica (KEY1-KEY8)
// ═══════════════════════════════════════════════════════════
function CueKey({
  index, cue, firing, onPress, onRelease, pyroArmed, dmxArmed,
}: {
  index: number;
  cue?: CueEntry;
  firing: boolean;
  onPress: () => void;
  onRelease: () => void;
  pyroArmed: boolean;
  dmxArmed: boolean;
}) {
  const isArmed = pyroArmed || dmxArmed;
  const hasAssignment = !!cue;

  return (
    <button
      onMouseDown={onPress}
      onMouseUp={onRelease}
      onMouseLeave={() => firing && onRelease()}
      onTouchStart={(e) => { e.preventDefault(); onPress(); }}
      onTouchEnd={(e) => { e.preventDefault(); onRelease(); }}
      disabled={!isArmed || !hasAssignment}
      className={cn(
        "relative flex flex-col items-center justify-center rounded-md transition-all select-none",
        "min-h-[52px] border-2",
        firing
          ? "bg-red-600 border-red-400 shadow-[0_0_16px_rgba(255,60,30,0.6)] scale-[0.96]"
          : isArmed && hasAssignment
            ? "bg-surface-3/90 border-border/50 hover:bg-surface-4 active:scale-[0.96] active:bg-red-700/80 cursor-pointer"
            : hasAssignment
              ? "bg-surface-2/60 border-border/20"
              : "bg-surface-1/30 border-border/10"
      )}
    >
      {/* Key number indicator LED */}
      <div className={cn(
        "absolute top-0.5 left-0.5 w-1.5 h-1.5 rounded-full",
        firing ? "bg-red-400 shadow-[0_0_4px_#ff4444]" :
        isArmed && hasAssignment ? "bg-green-500 shadow-[0_0_3px_#22cc44]" :
        "bg-muted-foreground/20"
      )} />

      <span className={cn(
        "text-[7px] font-mono font-bold",
        firing ? "text-white" : "text-muted-foreground/50"
      )}>
        KEY{index + 1}
      </span>

      {cue ? (
        <>
          <span className={cn(
            "text-[8px] font-black uppercase tracking-wide leading-tight text-center px-0.5 truncate w-full",
            firing ? "text-white" : "text-foreground/80"
          )} style={{ color: firing ? undefined : cue.keyColor }}>
            {cue.keyLabel || cue.effect}
          </span>
          <span className={cn(
            "text-[6px] font-mono",
            firing ? "text-red-200" : "text-muted-foreground/40"
          )}>
            {cue.deviceIds.length}dev · {FIRING_RULES.find(r => r.key === cue.firingRule)?.label}
          </span>
        </>
      ) : (
        <span className="text-[7px] text-muted-foreground/20">—</span>
      )}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════
// DEVICE TABLE ROW — like the real FXcommander device list
// ═══════════════════════════════════════════════════════════
function DeviceRow({
  channel, index, selected, onSelect, dmxArmed,
}: {
  channel: SFXChannel; index: number; selected: boolean;
  onSelect: () => void; dmxArmed: boolean;
}) {
  const sfxType = SFX_TYPES.find(t => t.key === channel.type);
  
  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full flex items-center gap-1 px-1.5 py-1 border-b border-border/10 transition-all text-left",
        selected ? "bg-primary/15 border-primary/20" :
        dmxArmed && channel.enabled ? "bg-[#0a2844]/60 hover:bg-[#0a2844]/90" :
        "hover:bg-surface-2/40",
        !channel.enabled && "opacity-40"
      )}
    >
      {/* Index */}
      <span className="text-[7px] font-mono text-muted-foreground/40 w-3 text-right shrink-0">{index + 1}</span>
      
      {/* Type color indicator */}
      <div className="w-1.5 h-6 rounded-sm shrink-0" style={{ backgroundColor: sfxType?.color || '#888' }} />
      
      {/* Device info */}
      <div className="flex-1 min-w-0">
        <div className={cn(
          "text-[8px] font-bold uppercase truncate leading-tight",
          selected ? "text-primary" : "text-foreground/80"
        )}>
          {channel.name}
        </div>
        <div className="text-[6px] font-mono text-muted-foreground/40 leading-tight">
          {sfxType?.label} · U{channel.dmxUniverse}.{String(channel.dmxAddress).padStart(3, '0')}
        </div>
      </div>

      {/* Status indicators */}
      <div className="flex flex-col items-end gap-0.5 shrink-0">
        {channel.temperature !== undefined && (
          <span className={cn(
            "text-[6px] font-mono",
            channel.temperature > 600 ? "text-red-400" : "text-green-400/70"
          )}>
            {channel.temperature}°
          </span>
        )}
        {channel.pressure !== undefined && (
          <span className="text-[6px] font-mono text-cyan-400/70">{channel.pressure}bar</span>
        )}
      </div>

      {/* Firing status */}
      {channel.firing && (
        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
      )}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════
// MAIN PANEL
// ═══════════════════════════════════════════════════════════
export default function LiveFiringPanel({ onClose }: { onClose: () => void }) {
  const { isPlaying, currentTime, setPlaying, positions } = useProjectStore();
  const [channels, setChannels] = useState<SFXChannel[]>(DEFAULT_CHANNELS);
  const [cues, setCues] = useState<CueEntry[]>([]);
  const [activeScene, setActiveScene] = useState(0);
  const [pyroArm, setPyroArm] = useState(false);
  const [dmxArm, setDmxArm] = useState(false);
  const [deadmanHeld, setDeadmanHeld] = useState(false);
  const [selectedDevices, setSelectedDevices] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<FXCMode>('super_dmx');
  const [artNetConnected, setArtNetConnected] = useState(false);
  const [artNetIp, setArtNetIp] = useState('255.255.255.255');
  const [artNetPort, setArtNetPort] = useState(6454);
  const [firingKeys, setFiringKeys] = useState<Set<number>>(new Set());
  const [editingCue, setEditingCue] = useState<number | null>(null);
  const [cueEffect, setCueEffect] = useState('Height 10');
  const [cueFiringRule, setCueFiringRule] = useState<CueEntry['firingRule']>('sync');
  const [cueDuration, setCueDuration] = useState(25);
  const [cueTriggerDelay, setCueTriggerDelay] = useState(0);
  const [cueRepeatCount, setCueRepeatCount] = useState(1);
  const [cueKeyLabel, setCueKeyLabel] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const sequenceRef = useRef(0);
  const fireTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const sceneCues = useMemo(() => cues.filter(() => true), [cues]); // All cues for current scene

  // ─── Art-Net Bridge ───
  const sendArtNetPacket = useCallback(async (currentChannels: SFXChannel[]) => {
    const universeMap = new Map<number, number[]>();
    for (const ch of currentChannels) {
      if (!universeMap.has(ch.dmxUniverse)) universeMap.set(ch.dmxUniverse, new Array(512).fill(0));
      const buf = universeMap.get(ch.dmxUniverse)!;
      const baseAddr = ch.dmxAddress - 1;
      const val = ch.firing ? ch.intensity : 0;
      for (let i = 0; i < ch.dmxChannels; i++) { if (baseAddr + i < 512) buf[baseAddr + i] = val; }
    }
    const universes = Array.from(universeMap.entries()).map(([uniId, buf]) => ({
      universe: uniId % 16, subnet: Math.floor(uniId / 16) % 16, net: Math.floor(uniId / 256),
      channels: buf, sequence: (sequenceRef.current++) & 0xFF,
    }));
    try {
      const { data, error } = await supabase.functions.invoke('artnet-bridge', {
        body: { action: 'send', universes, targetIp: artNetIp, targetPort: artNetPort },
      });
      if (error) throw error;
      setArtNetConnected(true);
      return data;
    } catch { setArtNetConnected(false); }
  }, [artNetIp, artNetPort]);

  // ─── ARM controls ───
  const handlePyroArm = useCallback((armed: boolean) => {
    setPyroArm(armed);
    if (armed) toast.warning('⚠️ PYRO ARMED', { duration: 3000 });
    else toast.info('Pyro disarmed');
  }, []);

  const handleDmxArm = useCallback((armed: boolean) => {
    setDmxArm(armed);
    setChannels(prev => prev.map(ch => ({ ...ch, armed: ch.locked ? false : armed })));
    if (armed) toast.warning('DMX ARMED', { duration: 2000 });
    else toast.info('DMX disarmed');
  }, []);

  const handlePanic = useCallback(() => {
    // PANIC — immediate stop all
    setChannels(prev => {
      const updated = prev.map(ch => ({ ...ch, firing: false }));
      sendArtNetPacket(updated);
      return updated;
    });
    fireTimers.current.forEach(t => clearTimeout(t));
    fireTimers.current.clear();
    setFiringKeys(new Set());
    setPyroArm(false);
    setDmxArm(false);
    setDeadmanHeld(false);
    toast.error('🚨 PANIC — ALL STOP', { duration: 5000 });
  }, [sendArtNetPacket]);

  // ─── Fire logic ───
  const fireChannel = useCallback((id: string) => {
    setChannels(prev => {
      const updated = prev.map(ch => ch.id === id ? { ...ch, firing: true } : ch);
      sendArtNetPacket(updated);
      return updated;
    });
    const ch = channels.find(c => c.id === id);
    if (ch) {
      let pos3d: [number, number, number];
      if (ch.positionId) {
        const linkedPos = positions.find(p => p.id === ch.positionId);
        pos3d = linkedPos ? [linkedPos.x, linkedPos.y, linkedPos.z] : [(channels.indexOf(ch) - (channels.length - 1) / 2) * 8, 0, 0];
      } else {
        pos3d = [(channels.indexOf(ch) - (channels.length - 1) / 2) * 8, 0, 0];
      }
      useLiveSfxStore.getState().fireEffect({ id: ch.id, type: ch.type, position: pos3d, color: ch.color, intensity: ch.intensity, startedAt: performance.now(), duration: ch.duration });
      const timer = setTimeout(() => {
        setChannels(prev => { const updated = prev.map(c => c.id === id ? { ...c, firing: false } : c); sendArtNetPacket(updated); return updated; });
        fireTimers.current.delete(id);
      }, ch.duration);
      fireTimers.current.set(id, timer);
    }
  }, [channels, sendArtNetPacket, positions]);

  const stopChannel = useCallback((id: string) => {
    const timer = fireTimers.current.get(id);
    if (timer) { clearTimeout(timer); fireTimers.current.delete(id); }
    setChannels(prev => { const updated = prev.map(ch => ch.id === id ? { ...ch, firing: false } : ch); sendArtNetPacket(updated); return updated; });
  }, [sendArtNetPacket]);

  // ─── CUE Key firing ───
  const fireCueKey = useCallback((keyIndex: number) => {
    const cue = sceneCues.find(c => c.keyIndex === keyIndex);
    if (!cue) return;
    if (!dmxArm && !pyroArm) return;
    
    setFiringKeys(prev => new Set(prev).add(keyIndex));
    
    // Execute firing rule
    const deviceChans = channels.filter(ch => cue.deviceIds.includes(ch.id) && ch.enabled);
    const sortedDevices = [...deviceChans];
    
    if (cue.firingRule === 'rtl') sortedDevices.reverse();
    if (cue.firingRule === 'sides') {
      const mid = Math.floor(sortedDevices.length / 2);
      const left = sortedDevices.slice(0, mid);
      const right = sortedDevices.slice(mid).reverse();
      sortedDevices.length = 0;
      for (let i = 0; i < Math.max(left.length, right.length); i++) {
        if (i < left.length) sortedDevices.push(left[i]);
        if (i < right.length) sortedDevices.push(right[i]);
      }
    }
    if (cue.firingRule === 'middle') {
      const mid = Math.floor(sortedDevices.length / 2);
      const reordered: SFXChannel[] = [];
      for (let i = 0; i < Math.ceil(sortedDevices.length / 2); i++) {
        if (mid + i < sortedDevices.length) reordered.push(sortedDevices[mid + i]);
        if (mid - 1 - i >= 0) reordered.push(sortedDevices[mid - 1 - i]);
      }
      sortedDevices.length = 0;
      sortedDevices.push(...reordered);
    }

    sortedDevices.forEach((ch, i) => {
      const delay = cue.firingRule === 'sync' ? 0 : i * cue.triggerDelay * 1000;
      setTimeout(() => fireChannel(ch.id), delay);
    });
  }, [sceneCues, channels, dmxArm, pyroArm, fireChannel]);

  const stopCueKey = useCallback((keyIndex: number) => {
    const cue = sceneCues.find(c => c.keyIndex === keyIndex);
    if (cue) cue.deviceIds.forEach(id => stopChannel(id));
    setFiringKeys(prev => { const n = new Set(prev); n.delete(keyIndex); return n; });
  }, [sceneCues, stopChannel]);

  // ─── Add CUE ───
  const addCue = useCallback(() => {
    if (selectedDevices.size === 0 || editingCue === null) return;
    const newCue: CueEntry = {
      id: `cue-${Date.now()}`,
      deviceIds: [...selectedDevices],
      effect: cueEffect,
      firingRule: cueFiringRule,
      duration: cueDuration,
      triggerDelay: cueTriggerDelay,
      repeatPeriod: 0,
      repeatCount: cueRepeatCount,
      keyIndex: editingCue,
      keyLabel: cueKeyLabel || cueEffect,
      keyColor: channels.find(ch => selectedDevices.has(ch.id))
        ? SFX_TYPES.find(t => t.key === channels.find(ch => selectedDevices.has(ch.id))?.type)?.color || '#fff'
        : '#fff',
    };
    setCues(prev => [...prev.filter(c => c.keyIndex !== editingCue), newCue]);
    setEditingCue(null);
    setSelectedDevices(new Set());
    toast.success(`CUE KEY${editingCue + 1} programmed`);
  }, [selectedDevices, editingCue, cueEffect, cueFiringRule, cueDuration, cueTriggerDelay, cueRepeatCount, cueKeyLabel, channels]);

  // ─── Add device ───
  const addChannel = useCallback((type: SFXChannel['type']) => {
    const sfxType = SFX_TYPES.find(t => t.key === type);
    const maxAddr = Math.max(0, ...channels.map(c => c.dmxAddress + c.dmxChannels));
    setChannels(prev => [...prev, {
      id: `sfx-${Date.now()}`, name: `${sfxType?.label || 'CH'} ${prev.length + 1}`, type,
      dmxUniverse: 1, dmxAddress: maxAddr || 1, dmxChannels: type === 'flame' ? 6 : type === 'co2' || type === 'cryo' ? 2 : 2,
      armed: dmxArm, firing: false, duration: type === 'flame' ? 800 : type === 'confetti' ? 2000 : type === 'spark' ? 2500 : 500,
      intensity: 200, color: sfxType?.color || '#fff', locked: false, enabled: true,
    }]);
  }, [channels, dmxArm]);

  useEffect(() => { return () => { fireTimers.current.forEach(timer => clearTimeout(timer)); }; }, []);

  const armedCount = channels.filter(c => c.armed).length;
  const firingCount = channels.filter(c => c.firing).length;
  const enabledCount = channels.filter(c => c.enabled).length;

  // ─── Fullscreen toggle with ESC support ───
  useEffect(() => {
    if (!isFullscreen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFullscreen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isFullscreen]);

  // ═══════════════════════════════════════════════════════════
  // SHARED SUBCOMPONENTS
  // ═══════════════════════════════════════════════════════════

  const renderStatusBar = (fs: boolean) => (
    <div className={cn(
      "flex items-center justify-between border-b-2",
      fs ? "px-6 py-3" : "px-2 py-1.5"
    )} style={{ borderColor: 'hsl(220 10% 15%)' }}>
      <div className="flex items-center gap-2">
        <div className={cn(
          "rounded bg-gradient-to-b from-amber-500 to-amber-700 flex items-center justify-center",
          fs ? "w-8 h-8" : "w-5 h-5"
        )}>
          <Zap className={cn(fs ? "w-5 h-5" : "w-3 h-3", "text-black")} />
        </div>
        <div>
          <div className={cn("font-black text-foreground tracking-[0.12em]", fs ? "text-base" : "text-[10px]")}>FXcommander™</div>
          <div className={cn("font-mono text-muted-foreground/40 tracking-wider", fs ? "text-[9px]" : "text-[6px]")}>SHOWVEN® · V2.0</div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          <div className={cn("rounded-full", artNetConnected ? "bg-green-500" : "bg-muted-foreground/20", fs ? "w-2.5 h-2.5" : "w-1.5 h-1.5")} />
          <span className={cn("font-mono text-muted-foreground/40", fs ? "text-[9px]" : "text-[6px]")}>DMX</span>
        </div>
        <div className="flex items-center gap-1">
          <Signal className={cn(pyroArm ? "text-red-500" : "text-muted-foreground/20", fs ? "w-4 h-4" : "w-2.5 h-2.5")} />
          <span className={cn("font-mono text-muted-foreground/40", fs ? "text-[9px]" : "text-[6px]")}>RF</span>
        </div>
        {/* Fullscreen toggle */}
        <button 
          onClick={() => setIsFullscreen(!isFullscreen)}
          className={cn(
            "text-muted-foreground/40 hover:text-foreground transition-colors rounded",
            fs ? "p-1.5" : "p-0.5"
          )}
          title={isFullscreen ? 'Exit Fullscreen (ESC)' : 'Fullscreen Mode'}
        >
          {isFullscreen ? <Minimize2 className={cn(fs ? "w-4 h-4" : "w-3 h-3")} /> : <Maximize2 className={cn(fs ? "w-4 h-4" : "w-3 h-3")} />}
        </button>
        {!isFullscreen && (
          <button onClick={onClose} className="text-muted-foreground/30 hover:text-foreground p-0.5 rounded transition-colors text-xs ml-1">✕</button>
        )}
      </div>
    </div>
  );

  const renderArmBar = (fs: boolean) => (
    <>
      <div className={cn(
        "flex items-center gap-3 border-b transition-colors",
        fs ? "px-6 py-2.5" : "px-2 py-1",
        (pyroArm || dmxArm) ? "bg-red-900/20 border-red-800/30" : "bg-surface-1/20 border-border/15"
      )}>
        <button
          onClick={() => handlePyroArm(!pyroArm)}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 rounded border-2 font-black uppercase transition-all",
            fs ? "py-3 text-sm tracking-[0.2em]" : "py-1.5 text-[9px] tracking-[0.15em]",
            pyroArm
              ? "bg-red-600/20 border-red-500/60 text-red-400 shadow-[inset_0_0_12px_rgba(255,50,30,0.1)]"
              : "bg-surface-2/40 border-border/20 text-muted-foreground/40 hover:border-border/40"
          )}
        >
          <Shield className={cn(fs ? "w-5 h-5" : "w-3 h-3")} />
          PYRO {pyroArm ? 'ARMED' : 'SAFE'}
        </button>
        <button
          onClick={() => handleDmxArm(!dmxArm)}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 rounded border-2 font-black uppercase transition-all",
            fs ? "py-3 text-sm tracking-[0.2em]" : "py-1.5 text-[9px] tracking-[0.15em]",
            dmxArm
              ? "bg-amber-600/20 border-amber-500/60 text-amber-400 shadow-[inset_0_0_12px_rgba(255,180,30,0.1)]"
              : "bg-surface-2/40 border-border/20 text-muted-foreground/40 hover:border-border/40"
          )}
        >
          <Radio className={cn(fs ? "w-5 h-5" : "w-3 h-3")} />
          DMX {dmxArm ? 'ARMED' : 'SAFE'}
        </button>
      </div>
      {(pyroArm || dmxArm) && (
        <div className={cn(
          "text-center font-black uppercase animate-pulse",
          fs ? "px-4 py-1.5 text-xs tracking-[0.3em]" : "px-2 py-0.5 text-[8px] tracking-[0.25em]",
          pyroArm ? "bg-red-600/15 text-red-400" : "bg-amber-600/10 text-amber-400"
        )}>
          {pyroArm ? '⚠ PYRO ARMED ⚠' : 'DMX ARMED'}
        </div>
      )}
    </>
  );

  const renderCueKeys = (fs: boolean) => (
    <div className={cn(
      "border-b border-border/15",
      fs ? "px-6 py-4" : "px-1.5 py-1.5"
    )} style={{ background: 'hsl(220 12% 6%)' }}>
      <div className={cn("grid grid-cols-8", fs ? "gap-2" : "gap-0.5")}>
        {Array.from({ length: 8 }).map((_, i) => {
          const cue = sceneCues.find(c => c.keyIndex === i);
          const isFiring = firingKeys.has(i);
          const isArmed = pyroArm || dmxArm;
          const hasAssignment = !!cue;

          return fs ? (
            // ═══ FULLSCREEN CUE KEY — large touch-friendly hardware button ═══
            <button
              key={i}
              onMouseDown={() => fireCueKey(i)}
              onMouseUp={() => stopCueKey(i)}
              onMouseLeave={() => isFiring && stopCueKey(i)}
              onTouchStart={(e) => { e.preventDefault(); fireCueKey(i); }}
              onTouchEnd={(e) => { e.preventDefault(); stopCueKey(i); }}
              disabled={!isArmed || !hasAssignment}
              className={cn(
                "relative flex flex-col items-center justify-center rounded-lg transition-all select-none",
                "min-h-[100px] border-2",
                isFiring
                  ? "bg-red-600 border-red-400 shadow-[0_0_30px_rgba(255,60,30,0.5)] scale-[0.97]"
                  : isArmed && hasAssignment
                    ? "bg-surface-3/90 border-border/50 hover:bg-surface-4 active:scale-[0.97] active:bg-red-700/80 cursor-pointer"
                    : hasAssignment
                      ? "bg-surface-2/60 border-border/20"
                      : "bg-surface-1/30 border-border/10"
              )}
            >
              <div className={cn(
                "absolute top-1.5 left-1.5 w-3 h-3 rounded-full",
                isFiring ? "bg-red-400 shadow-[0_0_8px_#ff4444]" :
                isArmed && hasAssignment ? "bg-green-500 shadow-[0_0_6px_#22cc44]" :
                "bg-muted-foreground/20"
              )} />
              <span className={cn(
                "text-xs font-mono font-bold mb-1",
                isFiring ? "text-white" : "text-muted-foreground/50"
              )}>KEY{i + 1}</span>
              {cue ? (
                <>
                  <span className={cn(
                    "text-sm font-black uppercase tracking-wide leading-tight text-center px-1 truncate w-full",
                    isFiring ? "text-white" : "text-foreground/80"
                  )} style={{ color: isFiring ? undefined : cue.keyColor }}>
                    {cue.keyLabel || cue.effect}
                  </span>
                  <span className={cn(
                    "text-[10px] font-mono mt-0.5",
                    isFiring ? "text-red-200" : "text-muted-foreground/40"
                  )}>
                    {cue.deviceIds.length}dev · {FIRING_RULES.find(r => r.key === cue.firingRule)?.label}
                  </span>
                </>
              ) : (
                <span className="text-sm text-muted-foreground/20">—</span>
              )}
            </button>
          ) : (
            <CueKey
              key={i}
              index={i}
              cue={cue}
              firing={isFiring}
              onPress={() => fireCueKey(i)}
              onRelease={() => stopCueKey(i)}
              pyroArmed={pyroArm}
              dmxArmed={dmxArm}
            />
          );
        })}
      </div>
    </div>
  );

  const renderSceneModeBar = (fs: boolean) => (
    <div className="flex items-center border-b border-border/15" style={{ background: 'hsl(220 10% 7%)' }}>
      <div className="flex">
        {[0, 1, 2, 3].map(s => (
          <button
            key={s}
            onClick={() => setActiveScene(s)}
            className={cn(
              "font-bold uppercase tracking-wider transition-all border-b-2",
              fs ? "px-5 py-2.5 text-xs" : "px-2.5 py-1.5 text-[7px]",
              activeScene === s
                ? "text-primary border-primary bg-primary/5"
                : "text-muted-foreground/30 border-transparent hover:text-muted-foreground/60"
            )}
          >
            SCENE{s}
          </button>
        ))}
      </div>
      <div className="flex-1" />
      <div className={cn("flex", fs ? "pr-3" : "pr-1")}>
        {[
          { key: 'super_dmx' as FXCMode, label: 'Super' },
          { key: 'simple_dmx' as FXCMode, label: 'Simple' },
          { key: 'manual_fire' as FXCMode, label: 'Manual' },
        ].map(m => (
          <button
            key={m.key}
            onClick={() => setMode(m.key)}
            className={cn(
              "font-bold uppercase tracking-wider transition-all",
              fs ? "px-4 py-2.5 text-[10px]" : "px-2 py-1.5 text-[6px]",
              mode === m.key ? "text-foreground/80" : "text-muted-foreground/25 hover:text-muted-foreground/50"
            )}
          >
            {m.label}
          </button>
        ))}
      </div>
    </div>
  );

  const renderPanic = (fs: boolean) => (
    <div className="border-t-2 border-border/20" style={{ background: 'hsl(220 12% 6%)' }}>
      <div className={cn(fs ? "px-6 py-3" : "px-2 py-1.5")}>
        <button
          onClick={handlePanic}
          className={cn(
            "w-full rounded-lg font-black uppercase transition-all",
            "bg-gradient-to-b from-red-700 to-red-900 text-white/90",
            "hover:from-red-600 hover:to-red-800 active:scale-[0.97]",
            "border-2 border-red-600/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]",
            "flex items-center justify-center gap-2",
            fs ? "h-16 text-lg tracking-[0.3em]" : "h-10 text-[11px] tracking-[0.25em]"
          )}
        >
          <AlertTriangle className={cn(fs ? "w-6 h-6" : "w-4 h-4")} />
          PANIC
        </button>
      </div>
      <div className={cn(
        "flex items-center justify-between border-t border-border/10",
        fs ? "px-6 py-2" : "px-2 py-1"
      )}>
        <div className="flex items-center gap-2">
          <span className={cn("font-mono text-muted-foreground/30", fs ? "text-[9px]" : "text-[6px]")}>{channels.length}CH · {armedCount}RDY</span>
          <span className={cn("font-mono", fs ? "text-[9px]" : "text-[6px]", artNetConnected ? "text-green-500/60" : "text-muted-foreground/20")}>
            {artNetConnected ? '● Art-Net' : '○ Art-Net'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Input value={artNetIp} onChange={e => setArtNetIp(e.target.value)} className={cn("font-mono bg-transparent border-border/10 px-1", fs ? "h-6 text-[9px] w-28" : "h-4 text-[6px] w-20")} />
          <span className={cn("font-mono text-muted-foreground/20", fs ? "text-[9px]" : "text-[6px]")}>:{artNetPort}</span>
        </div>
      </div>
    </div>
  );

  // Shared device list renderer
  const renderDeviceList = (fs: boolean) => (
    <div className="border-b border-border/15">
      <div className={cn("flex items-center justify-between", fs ? "px-4 py-2" : "px-2 py-1")} style={{ background: 'hsl(220 10% 9%)' }}>
        <span className={cn("font-bold text-muted-foreground/50 uppercase tracking-wider", fs ? "text-[10px]" : "text-[7px]")}>Device List</span>
        <div className="flex items-center gap-2">
          <span className={cn("font-mono text-muted-foreground/30", fs ? "text-[9px]" : "text-[7px]")}>{enabledCount}/{channels.length} enabled</span>
          {firingCount > 0 && (
            <span className={cn("font-mono text-red-400 font-bold animate-pulse", fs ? "text-[9px]" : "text-[7px]")}>🔥 {firingCount}</span>
          )}
        </div>
      </div>
      <div className={cn("overflow-y-auto", fs ? "max-h-[300px]" : "max-h-[140px]")}>
        {channels.map((ch, i) => (
          <DeviceRow key={ch.id} channel={ch} index={i} selected={selectedDevices.has(ch.id)}
            onSelect={() => {
              setSelectedDevices(prev => {
                const next = new Set(prev);
                if (next.has(ch.id)) next.delete(ch.id); else next.add(ch.id);
                return next;
              });
            }} dmxArmed={dmxArm} />
        ))}
      </div>
      <div className={cn("flex gap-1 border-t border-border/10", fs ? "px-3 py-1.5" : "px-1.5 py-1")} style={{ background: 'hsl(220 12% 7%)' }}>
        {[
          { label: 'Select All', fn: () => setSelectedDevices(new Set(channels.map(c => c.id))) },
          { label: 'Even', fn: () => setSelectedDevices(new Set(channels.filter((_, i) => i % 2 === 1).map(c => c.id))) },
          { label: 'Odd', fn: () => setSelectedDevices(new Set(channels.filter((_, i) => i % 2 === 0).map(c => c.id))) },
          { label: 'Same', fn: () => { const first = channels[0]?.type; if (first) setSelectedDevices(new Set(channels.filter(c => c.type === first).map(c => c.id))); } },
          { label: 'Clear', fn: () => setSelectedDevices(new Set()) },
        ].map(b => (
          <button key={b.label} onClick={b.fn} className={cn(
            "rounded bg-surface-2/40 text-muted-foreground/50 hover:text-foreground/70",
            fs ? "text-[8px] px-2.5 py-1" : "text-[6px] px-1.5 py-0.5"
          )}>{b.label}</button>
        ))}
      </div>
    </div>
  );

  // Shared CUE setting renderer
  const renderCueSetting = (fs: boolean) => (
    <div className={cn("space-y-2", fs ? "p-4" : "p-2")}>
      <div className="flex items-center justify-between">
        <span className={cn("font-bold text-muted-foreground/50 uppercase tracking-wider", fs ? "text-[10px]" : "text-[8px]")}>CUE Setting</span>
        <span className={cn("font-mono text-primary/50", fs ? "text-[9px]" : "text-[7px]")}>{selectedDevices.size} selected</span>
      </div>
      <div className={cn("grid grid-cols-8", fs ? "gap-1.5" : "gap-0.5")}>
        {Array.from({ length: 8 }).map((_, i) => (
          <button key={i} onClick={() => setEditingCue(editingCue === i ? null : i)}
            className={cn(
              "rounded font-bold transition-all border",
              fs ? "py-2 text-xs" : "py-1 text-[7px]",
              editingCue === i ? "bg-primary/15 border-primary/40 text-primary"
                : sceneCues.find(c => c.keyIndex === i) ? "bg-surface-3/60 border-border/20 text-foreground/50"
                : "bg-surface-1/30 border-border/10 text-muted-foreground/30"
            )}>K{i + 1}</button>
        ))}
      </div>
      {editingCue !== null && (
        <div className={cn("space-y-2 rounded-md border border-primary/20 bg-primary/5", fs ? "p-4" : "p-2")}>
          <div className="flex gap-1.5">
            <Input value={cueEffect} onChange={e => setCueEffect(e.target.value)} placeholder="Effect name..."
              className={cn("flex-1 bg-surface-0/60 border-border/20", fs ? "h-8 text-xs" : "h-5 text-[8px]")} />
            <Input value={cueKeyLabel} onChange={e => setCueKeyLabel(e.target.value)} placeholder="Key label"
              className={cn("bg-surface-0/60 border-border/20", fs ? "h-8 text-xs w-24" : "h-5 text-[8px] w-16")} />
          </div>
          <div className="flex gap-1">
            {FIRING_RULES.map(rule => (
              <button key={rule.key} onClick={() => setCueFiringRule(rule.key)}
                className={cn(
                  "flex-1 rounded font-bold transition-all border",
                  fs ? "py-2 text-sm" : "py-1 text-[8px]",
                  cueFiringRule === rule.key ? "bg-primary/15 border-primary/40 text-primary"
                    : "bg-surface-2/40 border-border/10 text-muted-foreground/40 hover:text-muted-foreground/70"
                )}>{rule.label}</button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { label: 'Duration', value: cueDuration, set: setCueDuration },
              { label: 'Delay (s)', value: cueTriggerDelay, set: setCueTriggerDelay },
              { label: 'Repeat', value: cueRepeatCount, set: setCueRepeatCount },
            ].map(p => (
              <div key={p.label}>
                <label className={cn("text-muted-foreground/40 uppercase", fs ? "text-[8px]" : "text-[6px]")}>{p.label}</label>
                <Input type="number" value={p.value} onChange={e => p.set(Number(e.target.value))}
                  className={cn("bg-surface-0/60 border-border/20 font-mono", fs ? "h-8 text-xs" : "h-5 text-[8px]")} />
              </div>
            ))}
          </div>
          <Button size={fs ? "default" : "sm"} onClick={addCue} disabled={selectedDevices.size === 0}
            className={cn("w-full font-bold uppercase tracking-wider", fs ? "h-10 text-sm" : "h-6 text-[8px]")}>
            <Check className={cn(fs ? "w-4 h-4" : "w-3 h-3", "mr-1")} /> OK — Assign to KEY{editingCue + 1}
          </Button>
        </div>
      )}
      {/* Add device */}
      <div className="pt-1 border-t border-border/10">
        <span className={cn("font-bold text-muted-foreground/30 uppercase tracking-wider mb-1 block", fs ? "text-[9px]" : "text-[7px]")}>Add Device</span>
        <div className={cn("grid grid-cols-4", fs ? "gap-1.5" : "gap-0.5")}>
          {SFX_TYPES.map(t => (
            <button key={t.key} onClick={() => addChannel(t.key)}
              className={cn(
                "flex flex-col items-center rounded bg-surface-1/20 hover:bg-surface-2/50 active:scale-95 transition-all border border-border/5",
                fs ? "gap-1 py-3" : "gap-0.5 py-1.5"
              )}>
              <t.icon className={cn(fs ? "w-5 h-5" : "w-3 h-3")} style={{ color: t.color }} />
              <span className={cn("font-bold uppercase text-muted-foreground/40", fs ? "text-[7px]" : "text-[5px]")}>{t.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  // Shared simple DMX renderer
  const renderSimpleDmx = (fs: boolean) => (
    <div className={cn("space-y-1", fs ? "p-4" : "p-2")}>
      <span className={cn("font-bold text-muted-foreground/40 uppercase tracking-wider block px-1", fs ? "text-[9px]" : "text-[7px]")}>
        DMX Output — {channels.length} channels
      </span>
      {channels.map((ch, i) => {
        const sfxType = SFX_TYPES.find(t => t.key === ch.type);
        return (
          <div key={ch.id} className={cn("flex items-center gap-1.5 rounded bg-surface-1/15 border border-border/5", fs ? "px-3 py-2" : "px-1.5 py-1")}>
            <span className={cn("font-mono text-muted-foreground/30 text-right", fs ? "text-[9px] w-5" : "text-[7px] w-4")}>{String(i + 1).padStart(2, '0')}</span>
            <div className={cn("rounded-full shrink-0", fs ? "w-2.5 h-2.5" : "w-1.5 h-1.5")} style={{ backgroundColor: sfxType?.color }} />
            <span className={cn("font-bold flex-1 truncate text-foreground/70", fs ? "text-xs" : "text-[8px]")}>{ch.name}</span>
            <Slider value={[ch.intensity]} min={0} max={255} step={1} onValueChange={([v]) => setChannels(prev => prev.map(c => c.id === ch.id ? { ...c, intensity: v } : c))} className={cn(fs ? "w-28" : "w-16")} />
            <span className={cn("font-mono text-muted-foreground/50 text-right", fs ? "text-[9px] w-8" : "text-[7px] w-6")}>{ch.intensity}</span>
            <button onClick={() => setChannels(prev => prev.map(c => c.id === ch.id ? { ...c, enabled: !c.enabled } : c))} className="p-0.5">
              {ch.enabled ? <Eye className={cn(fs ? "w-4 h-4" : "w-2.5 h-2.5", "text-green-500/60")} /> : <EyeOff className={cn(fs ? "w-4 h-4" : "w-2.5 h-2.5", "text-muted-foreground/20")} />}
            </button>
          </div>
        );
      })}
    </div>
  );

  // Shared manual fire renderer
  const renderManualFire = (fs: boolean) => (
    <div className={cn("space-y-2", fs ? "p-4" : "p-2")}>
      <span className={cn("font-bold text-muted-foreground/40 uppercase tracking-wider block px-1", fs ? "text-[9px]" : "text-[7px]")}>
        Manual Fire — Press & Hold
      </span>
      {(dmxArm || pyroArm) && (
        <button
          onMouseDown={() => channels.filter(ch => ch.enabled).forEach(ch => fireChannel(ch.id))}
          onMouseUp={() => channels.forEach(ch => stopChannel(ch.id))}
          className={cn(
            "w-full rounded bg-gradient-to-b from-red-600 via-red-700 to-red-800 text-white font-black uppercase hover:shadow-[0_0_24px_rgba(239,68,68,0.3)] active:scale-[0.97] transition-all border border-red-500/40",
            fs ? "py-5 text-base tracking-[0.3em]" : "py-3 text-[12px] tracking-[0.3em]"
          )}>
          ⚡ FIRE ALL ({enabledCount})
        </button>
      )}
      <div className={cn("grid gap-1.5", fs ? "grid-cols-4" : "grid-cols-2")}>
        {channels.map((ch, i) => {
          const sfxType = SFX_TYPES.find(t => t.key === ch.type);
          return (
            <button key={ch.id}
              onMouseDown={() => (dmxArm || pyroArm) && ch.enabled && fireChannel(ch.id)}
              onMouseUp={() => stopChannel(ch.id)}
              onMouseLeave={() => ch.firing && stopChannel(ch.id)}
              disabled={(!dmxArm && !pyroArm) || !ch.enabled}
              className={cn(
                "relative flex flex-col items-center justify-center rounded border-2 transition-all",
                fs ? "py-5" : "py-3",
                ch.firing ? "bg-red-600/30 border-red-400 shadow-[0_0_12px_rgba(255,60,30,0.3)] scale-[0.97]"
                  : (dmxArm || pyroArm) && ch.enabled ? "bg-surface-2/60 border-border/30 hover:bg-surface-3/80 active:scale-[0.97] active:bg-red-700/40"
                  : "bg-surface-1/20 border-border/10 opacity-40"
              )}>
              <span className={cn("absolute top-0.5 left-1 font-mono text-muted-foreground/30", fs ? "text-[8px]" : "text-[6px]")}>{String(i + 1).padStart(2, '0')}</span>
              {sfxType && <sfxType.icon className={cn(fs ? "w-6 h-6" : "w-4 h-4", "mb-0.5")} style={{ color: ch.firing ? '#ff4444' : sfxType.color }} />}
              <span className={cn("font-bold uppercase truncate w-full text-center", fs ? "text-xs" : "text-[8px]", ch.firing ? "text-red-300" : "text-foreground/70")}>
                {ch.name}
              </span>
              <span className={cn("font-mono text-muted-foreground/30", fs ? "text-[8px]" : "text-[6px]")}>{ch.duration}ms</span>
            </button>
          );
        })}
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════
  // FULLSCREEN LAYOUT — hardware 10.1" touch screen replica
  // ═══════════════════════════════════════════════════════════
  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-[9999] flex flex-col select-none" style={{
        background: 'linear-gradient(180deg, hsl(220 15% 8%) 0%, hsl(220 12% 4%) 100%)',
      }}>
        {renderStatusBar(true)}
        {renderArmBar(true)}
        {renderCueKeys(true)}
        {renderSceneModeBar(true)}

        <ScrollArea className="flex-1">
          {mode === 'super_dmx' && (
            <div className="flex h-full">
              {/* Left column — Device list */}
              <div className="w-1/2 border-r border-border/15 flex flex-col">
                {renderDeviceList(true)}
              </div>
              {/* Right column — CUE setting */}
              <div className="w-1/2 flex flex-col overflow-y-auto">
                {renderCueSetting(true)}
              </div>
            </div>
          )}
          {mode === 'simple_dmx' && renderSimpleDmx(true)}
          {mode === 'manual_fire' && renderManualFire(true)}
        </ScrollArea>

        {renderPanic(true)}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // PANEL LAYOUT — embedded side panel
  // ═══════════════════════════════════════════════════════════
  return (
    <div className="h-full flex flex-col overflow-hidden select-none" style={{
      minWidth: 300, maxWidth: 360,
      background: 'linear-gradient(180deg, hsl(220 15% 8%) 0%, hsl(220 12% 5%) 100%)',
    }}>
      {renderStatusBar(false)}
      {renderArmBar(false)}
      {renderCueKeys(false)}
      {renderSceneModeBar(false)}

      <ScrollArea className="flex-1">
        {mode === 'super_dmx' && (
          <div className="flex flex-col">
            {renderDeviceList(false)}
            {renderCueSetting(false)}
          </div>
        )}
        {mode === 'simple_dmx' && renderSimpleDmx(false)}
        {mode === 'manual_fire' && renderManualFire(false)}
      </ScrollArea>

      {renderPanic(false)}
    </div>
  );
}
