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

  return (
    <div className="h-full flex flex-col overflow-hidden select-none" style={{ 
      minWidth: 300, maxWidth: 360,
      background: 'linear-gradient(180deg, hsl(220 15% 8%) 0%, hsl(220 12% 5%) 100%)',
    }}>
      
      {/* ═══ TOP STATUS BAR — FXcommander header ═══ */}
      <div className="px-2 py-1.5 flex items-center justify-between border-b-2" 
        style={{ borderColor: 'hsl(220 10% 15%)' }}>
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded bg-gradient-to-b from-amber-500 to-amber-700 flex items-center justify-center">
            <Zap className="w-3 h-3 text-black" />
          </div>
          <div>
            <div className="text-[10px] font-black text-foreground tracking-[0.12em]">FXcommander™</div>
            <div className="text-[6px] font-mono text-muted-foreground/40 tracking-wider">SHOWVEN® · V2.0</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Connection indicators */}
          <div className="flex items-center gap-1">
            <div className={cn("w-1.5 h-1.5 rounded-full", artNetConnected ? "bg-green-500" : "bg-muted-foreground/20")} />
            <span className="text-[6px] font-mono text-muted-foreground/40">DMX</span>
          </div>
          <div className="flex items-center gap-1">
            <Signal className={cn("w-2.5 h-2.5", pyroArm ? "text-red-500" : "text-muted-foreground/20")} />
            <span className="text-[6px] font-mono text-muted-foreground/40">RF</span>
          </div>
          <button onClick={onClose} className="text-muted-foreground/30 hover:text-foreground p-0.5 rounded transition-colors text-xs ml-1">✕</button>
        </div>
      </div>

      {/* ═══ ARM STATUS BAR — PYRO ARM / DMX ARM ═══ */}
      <div className={cn(
        "px-2 py-1 flex items-center gap-2 border-b transition-colors",
        (pyroArm || dmxArm) ? "bg-red-900/20 border-red-800/30" : "bg-surface-1/20 border-border/15"
      )}>
        {/* PYRO ARM */}
        <button
          onClick={() => handlePyroArm(!pyroArm)}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded border-2 font-black text-[9px] uppercase tracking-[0.15em] transition-all",
            pyroArm
              ? "bg-red-600/20 border-red-500/60 text-red-400 shadow-[inset_0_0_12px_rgba(255,50,30,0.1)]"
              : "bg-surface-2/40 border-border/20 text-muted-foreground/40 hover:border-border/40"
          )}
        >
          <Shield className="w-3 h-3" />
          PYRO {pyroArm ? 'ARMED' : 'SAFE'}
        </button>

        {/* DMX ARM */}
        <button
          onClick={() => handleDmxArm(!dmxArm)}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded border-2 font-black text-[9px] uppercase tracking-[0.15em] transition-all",
            dmxArm
              ? "bg-amber-600/20 border-amber-500/60 text-amber-400 shadow-[inset_0_0_12px_rgba(255,180,30,0.1)]"
              : "bg-surface-2/40 border-border/20 text-muted-foreground/40 hover:border-border/40"
          )}
        >
          <Radio className="w-3 h-3" />
          DMX {dmxArm ? 'ARMED' : 'SAFE'}
        </button>
      </div>

      {/* Armed status text */}
      {(pyroArm || dmxArm) && (
        <div className={cn(
          "px-2 py-0.5 text-center text-[8px] font-black uppercase tracking-[0.25em] animate-pulse",
          pyroArm ? "bg-red-600/15 text-red-400" : "bg-amber-600/10 text-amber-400"
        )}>
          {pyroArm ? '⚠ PYRO ARMED ⚠' : 'DMX ARMED'}
        </div>
      )}

      {/* ═══ KEY1-KEY8 — Hardware keys row ═══ */}
      <div className="px-1.5 py-1.5 border-b border-border/15" style={{ background: 'hsl(220 12% 6%)' }}>
        <div className="grid grid-cols-8 gap-0.5">
          {Array.from({ length: 8 }).map((_, i) => (
            <CueKey
              key={i}
              index={i}
              cue={sceneCues.find(c => c.keyIndex === i)}
              firing={firingKeys.has(i)}
              onPress={() => fireCueKey(i)}
              onRelease={() => stopCueKey(i)}
              pyroArmed={pyroArm}
              dmxArmed={dmxArm}
            />
          ))}
        </div>
      </div>

      {/* ═══ SCENE TABS + MODE SELECTOR ═══ */}
      <div className="flex items-center border-b border-border/15" style={{ background: 'hsl(220 10% 7%)' }}>
        {/* Scene tabs */}
        <div className="flex">
          {[0, 1, 2, 3].map(s => (
            <button
              key={s}
              onClick={() => setActiveScene(s)}
              className={cn(
                "px-2.5 py-1.5 text-[7px] font-bold uppercase tracking-wider transition-all border-b-2",
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
        {/* Mode tabs */}
        <div className="flex pr-1">
          {[
            { key: 'super_dmx' as FXCMode, label: 'Super' },
            { key: 'simple_dmx' as FXCMode, label: 'Simple' },
            { key: 'manual_fire' as FXCMode, label: 'Manual' },
          ].map(m => (
            <button
              key={m.key}
              onClick={() => setMode(m.key)}
              className={cn(
                "px-2 py-1.5 text-[6px] font-bold uppercase tracking-wider transition-all",
                mode === m.key ? "text-foreground/80" : "text-muted-foreground/25 hover:text-muted-foreground/50"
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* ═══ MAIN CONTENT ═══ */}
      <ScrollArea className="flex-1">
        {mode === 'super_dmx' && (
          <div className="flex flex-col">
            {/* ── Device List (left table in real FXcommander) ── */}
            <div className="border-b border-border/15">
              <div className="px-2 py-1 flex items-center justify-between" style={{ background: 'hsl(220 10% 9%)' }}>
                <span className="text-[7px] font-bold text-muted-foreground/50 uppercase tracking-wider">Device List</span>
                <div className="flex items-center gap-2">
                  <span className="text-[7px] font-mono text-muted-foreground/30">{enabledCount}/{channels.length} enabled</span>
                  {firingCount > 0 && (
                    <span className="text-[7px] font-mono text-red-400 font-bold animate-pulse">🔥 {firingCount}</span>
                  )}
                </div>
              </div>
              
              <div className="max-h-[140px] overflow-y-auto">
                {channels.map((ch, i) => (
                  <DeviceRow
                    key={ch.id}
                    channel={ch}
                    index={i}
                    selected={selectedDevices.has(ch.id)}
                    onSelect={() => {
                      setSelectedDevices(prev => {
                        const next = new Set(prev);
                        if (next.has(ch.id)) next.delete(ch.id);
                        else next.add(ch.id);
                        return next;
                      });
                    }}
                    dmxArmed={dmxArm}
                  />
                ))}
              </div>

              {/* Quick selection */}
              <div className="px-1.5 py-1 flex gap-1 border-t border-border/10" style={{ background: 'hsl(220 12% 7%)' }}>
                <button onClick={() => setSelectedDevices(new Set(channels.map(c => c.id)))} className="text-[6px] px-1.5 py-0.5 rounded bg-surface-2/40 text-muted-foreground/50 hover:text-foreground/70">Select All</button>
                <button onClick={() => {
                  const evens = channels.filter((_, i) => i % 2 === 1).map(c => c.id);
                  setSelectedDevices(new Set(evens));
                }} className="text-[6px] px-1.5 py-0.5 rounded bg-surface-2/40 text-muted-foreground/50 hover:text-foreground/70">Even</button>
                <button onClick={() => {
                  const odds = channels.filter((_, i) => i % 2 === 0).map(c => c.id);
                  setSelectedDevices(new Set(odds));
                }} className="text-[6px] px-1.5 py-0.5 rounded bg-surface-2/40 text-muted-foreground/50 hover:text-foreground/70">Odd</button>
                <button onClick={() => {
                  const first = channels.length > 0 ? channels[0].type : null;
                  if (first) setSelectedDevices(new Set(channels.filter(c => c.type === first).map(c => c.id)));
                }} className="text-[6px] px-1.5 py-0.5 rounded bg-surface-2/40 text-muted-foreground/50 hover:text-foreground/70">Same</button>
                <button onClick={() => setSelectedDevices(new Set())} className="text-[6px] px-1.5 py-0.5 rounded bg-surface-2/40 text-muted-foreground/50 hover:text-foreground/70">Clear</button>
              </div>
            </div>

            {/* ── CUE Setting (right panel in real FXcommander) ── */}
            <div className="p-2 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[8px] font-bold text-muted-foreground/50 uppercase tracking-wider">CUE Setting</span>
                <span className="text-[7px] font-mono text-primary/50">{selectedDevices.size} selected</span>
              </div>

              {/* Assign to KEY */}
              <div className="grid grid-cols-8 gap-0.5">
                {Array.from({ length: 8 }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setEditingCue(editingCue === i ? null : i)}
                    className={cn(
                      "py-1 rounded text-[7px] font-bold transition-all border",
                      editingCue === i
                        ? "bg-primary/15 border-primary/40 text-primary"
                        : sceneCues.find(c => c.keyIndex === i)
                          ? "bg-surface-3/60 border-border/20 text-foreground/50"
                          : "bg-surface-1/30 border-border/10 text-muted-foreground/30"
                    )}
                  >
                    K{i + 1}
                  </button>
                ))}
              </div>

              {editingCue !== null && (
                <div className="space-y-1.5 p-2 rounded-md border border-primary/20 bg-primary/5">
                  {/* Effect name */}
                  <div className="flex gap-1">
                    <Input
                      value={cueEffect}
                      onChange={e => setCueEffect(e.target.value)}
                      placeholder="Effect name..."
                      className="h-5 text-[8px] flex-1 bg-surface-0/60 border-border/20"
                    />
                    <Input
                      value={cueKeyLabel}
                      onChange={e => setCueKeyLabel(e.target.value)}
                      placeholder="Key label"
                      className="h-5 text-[8px] w-16 bg-surface-0/60 border-border/20"
                    />
                  </div>

                  {/* Firing rules — authentic layout */}
                  <div className="flex gap-0.5">
                    {FIRING_RULES.map(rule => (
                      <button
                        key={rule.key}
                        onClick={() => setCueFiringRule(rule.key)}
                        className={cn(
                          "flex-1 py-1 rounded text-[8px] font-bold transition-all border",
                          cueFiringRule === rule.key
                            ? "bg-primary/15 border-primary/40 text-primary"
                            : "bg-surface-2/40 border-border/10 text-muted-foreground/40 hover:text-muted-foreground/70"
                        )}
                      >
                        {rule.label}
                      </button>
                    ))}
                  </div>

                  {/* Parameters grid */}
                  <div className="grid grid-cols-3 gap-1">
                    <div>
                      <label className="text-[6px] text-muted-foreground/40 uppercase">Duration</label>
                      <Input type="number" value={cueDuration} onChange={e => setCueDuration(Number(e.target.value))} className="h-5 text-[8px] bg-surface-0/60 border-border/20 font-mono" />
                    </div>
                    <div>
                      <label className="text-[6px] text-muted-foreground/40 uppercase">Delay (s)</label>
                      <Input type="number" value={cueTriggerDelay} onChange={e => setCueTriggerDelay(Number(e.target.value))} step={0.1} className="h-5 text-[8px] bg-surface-0/60 border-border/20 font-mono" />
                    </div>
                    <div>
                      <label className="text-[6px] text-muted-foreground/40 uppercase">Repeat</label>
                      <Input type="number" value={cueRepeatCount} onChange={e => setCueRepeatCount(Number(e.target.value))} min={1} className="h-5 text-[8px] bg-surface-0/60 border-border/20 font-mono" />
                    </div>
                  </div>

                  <Button
                    size="sm"
                    onClick={addCue}
                    disabled={selectedDevices.size === 0}
                    className="w-full h-6 text-[8px] font-bold uppercase tracking-wider"
                  >
                    <Check className="w-3 h-3 mr-1" /> OK — Assign to KEY{editingCue + 1}
                  </Button>
                </div>
              )}

              {/* Add device */}
              <div className="pt-1 border-t border-border/10">
                <span className="text-[7px] font-bold text-muted-foreground/30 uppercase tracking-wider mb-1 block">Add Device</span>
                <div className="grid grid-cols-4 gap-0.5">
                  {SFX_TYPES.map(t => (
                    <button
                      key={t.key}
                      onClick={() => addChannel(t.key)}
                      className="flex flex-col items-center gap-0.5 py-1.5 rounded bg-surface-1/20 hover:bg-surface-2/50 active:scale-95 transition-all border border-border/5"
                    >
                      <t.icon className="w-3 h-3" style={{ color: t.color }} />
                      <span className="text-[5px] font-bold uppercase text-muted-foreground/40">{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── SIMPLE DMX — 128ch fader view ── */}
        {mode === 'simple_dmx' && (
          <div className="p-2 space-y-1">
            <span className="text-[7px] font-bold text-muted-foreground/40 uppercase tracking-wider block px-1">DMX Output — {channels.length} channels</span>
            {channels.map((ch, i) => {
              const sfxType = SFX_TYPES.find(t => t.key === ch.type);
              return (
                <div key={ch.id} className="flex items-center gap-1.5 px-1.5 py-1 rounded bg-surface-1/15 border border-border/5">
                  <span className="text-[7px] font-mono text-muted-foreground/30 w-4 text-right">{String(i + 1).padStart(2, '0')}</span>
                  <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: sfxType?.color }} />
                  <span className="text-[8px] font-bold flex-1 truncate text-foreground/70">{ch.name}</span>
                  <Slider value={[ch.intensity]} min={0} max={255} step={1} onValueChange={([v]) => setChannels(prev => prev.map(c => c.id === ch.id ? { ...c, intensity: v } : c))} className="w-16" />
                  <span className="text-[7px] font-mono text-muted-foreground/50 w-6 text-right">{ch.intensity}</span>
                  <button onClick={() => setChannels(prev => prev.map(c => c.id === ch.id ? { ...c, enabled: !c.enabled } : c))} className="p-0.5">
                    {ch.enabled ? <Eye className="w-2.5 h-2.5 text-green-500/60" /> : <EyeOff className="w-2.5 h-2.5 text-muted-foreground/20" />}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* ── MANUAL FIRE — direct trigger ── */}
        {mode === 'manual_fire' && (
          <div className="p-2 space-y-1.5">
            <span className="text-[7px] font-bold text-muted-foreground/40 uppercase tracking-wider block px-1">Manual Fire — Press & Hold</span>
            
            {(dmxArm || pyroArm) && (
              <button
                onMouseDown={() => channels.filter(ch => ch.enabled).forEach(ch => fireChannel(ch.id))}
                onMouseUp={() => channels.forEach(ch => stopChannel(ch.id))}
                className="w-full py-3 rounded bg-gradient-to-b from-red-600 via-red-700 to-red-800 text-white font-black text-[12px] uppercase tracking-[0.3em] hover:shadow-[0_0_24px_rgba(239,68,68,0.3)] active:scale-[0.97] transition-all border border-red-500/40"
              >
                ⚡ FIRE ALL ({enabledCount})
              </button>
            )}

            <div className="grid grid-cols-2 gap-1">
              {channels.map((ch, i) => {
                const sfxType = SFX_TYPES.find(t => t.key === ch.type);
                return (
                  <button
                    key={ch.id}
                    onMouseDown={() => (dmxArm || pyroArm) && ch.enabled && fireChannel(ch.id)}
                    onMouseUp={() => stopChannel(ch.id)}
                    onMouseLeave={() => ch.firing && stopChannel(ch.id)}
                    disabled={(!dmxArm && !pyroArm) || !ch.enabled}
                    className={cn(
                      "relative flex flex-col items-center justify-center py-3 rounded border-2 transition-all",
                      ch.firing
                        ? "bg-red-600/30 border-red-400 shadow-[0_0_12px_rgba(255,60,30,0.3)] scale-[0.97]"
                        : (dmxArm || pyroArm) && ch.enabled
                          ? "bg-surface-2/60 border-border/30 hover:bg-surface-3/80 active:scale-[0.97] active:bg-red-700/40"
                          : "bg-surface-1/20 border-border/10 opacity-40"
                    )}
                  >
                    <span className="absolute top-0.5 left-1 text-[6px] font-mono text-muted-foreground/30">{String(i + 1).padStart(2, '0')}</span>
                    {sfxType && <sfxType.icon className="w-4 h-4 mb-0.5" style={{ color: ch.firing ? '#ff4444' : sfxType.color }} />}
                    <span className={cn("text-[8px] font-bold uppercase truncate w-full text-center", ch.firing ? "text-red-300" : "text-foreground/70")}>
                      {ch.name}
                    </span>
                    <span className="text-[6px] font-mono text-muted-foreground/30">{ch.duration}ms</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </ScrollArea>

      {/* ═══ PANIC + DEADMAN — bottom hardware zone ═══ */}
      <div className="border-t-2 border-border/20" style={{ background: 'hsl(220 12% 6%)' }}>
        {/* PANIC button */}
        <div className="px-2 py-1.5">
          <button
            onClick={handlePanic}
            className={cn(
              "w-full h-10 rounded-lg font-black text-[11px] tracking-[0.25em] uppercase transition-all",
              "bg-gradient-to-b from-red-700 to-red-900 text-white/90",
              "hover:from-red-600 hover:to-red-800 active:scale-[0.97]",
              "border-2 border-red-600/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]",
              "flex items-center justify-center gap-2"
            )}
          >
            <AlertTriangle className="w-4 h-4" />
            PANIC
          </button>
        </div>

        {/* Status footer */}
        <div className="px-2 py-1 flex items-center justify-between border-t border-border/10">
          <div className="flex items-center gap-2">
            <span className="text-[6px] font-mono text-muted-foreground/30">{channels.length}CH · {armedCount}RDY</span>
            <span className={cn("text-[6px] font-mono", artNetConnected ? "text-green-500/60" : "text-muted-foreground/20")}>
              {artNetConnected ? '● Art-Net' : '○ Art-Net'}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Input value={artNetIp} onChange={e => setArtNetIp(e.target.value)} className="h-4 text-[6px] font-mono bg-transparent border-border/10 w-20 px-1" />
            <span className="text-[6px] font-mono text-muted-foreground/20">:{artNetPort}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
