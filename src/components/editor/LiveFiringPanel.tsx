/**
 * FXcommander™ Digital Console — Complete recreation + enhancements
 * 
 * Modes: Super DMX · Simple DMX · Manual Fire · Auto Fire · Check Slave · Settings
 * Features: 4 Scenes, 128 CUEs/scene, Lock/Tap keys, Deadman, PANIC, Device Library,
 *           RDMX monitoring, Safety channels, Art-Net bridge, CUE grouping
 */
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  Flame, Wind, Sparkles, Zap, Play, Square, Plus, Trash2,
  AlertTriangle, Check, Radio, Lightbulb, ChevronDown,
  RotateCcw, Save, Upload, Lock, Unlock, Timer, Power,
  Shield, ShieldAlert, Gauge, Settings, FolderOpen, Wifi,
  Signal, Thermometer, Activity, Volume2, Eye, EyeOff,
  Maximize2, Minimize2, Battery, Hand, ChevronLeft, ChevronRight
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

import type { SFXChannel, CueEntry, FXCMode, FXCSettings, DeviceLibEntry } from './live-firing/types';
import { FIRING_RULES, SFX_TYPES, DEFAULT_CHANNELS, DEFAULT_SETTINGS, CUES_PER_PAGE, formatTimecode, SHOWVEN_LIBRARY } from './live-firing/constants';
import AutoFirePanel from './live-firing/AutoFirePanel';
import CheckSlavePanel from './live-firing/CheckSlavePanel';
import SettingsPanel from './live-firing/SettingsPanel';
import DeviceLibraryPanel from './live-firing/DeviceLibraryPanel';

// ═══════════════════════════════════════════════════════════
// CUE KEY — hardware key replica with Lock/Tap mode
// ═══════════════════════════════════════════════════════════
function CueKey({
  index, cue, firing, onPress, onRelease, onLongPress, pyroArmed, dmxArmed, fs,
}: {
  index: number; cue?: CueEntry; firing: boolean;
  onPress: () => void; onRelease: () => void; onLongPress: () => void;
  pyroArmed: boolean; dmxArmed: boolean; fs: boolean;
}) {
  const isArmed = pyroArmed || dmxArmed;
  const hasAssignment = !!cue;
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLocked = cue?.keyMode === 'lock';

  const handleDown = () => {
    onPress();
    longPressTimer.current = setTimeout(() => { onLongPress(); }, 800);
  };
  const handleUp = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    onRelease();
  };

  return (
    <button
      onMouseDown={handleDown}
      onMouseUp={handleUp}
      onMouseLeave={() => { if (longPressTimer.current) clearTimeout(longPressTimer.current); if (firing && !isLocked) onRelease(); }}
      onTouchStart={(e) => { e.preventDefault(); handleDown(); }}
      onTouchEnd={(e) => { e.preventDefault(); handleUp(); }}
      disabled={!isArmed || !hasAssignment}
      className={cn(
        "relative flex flex-col items-center justify-center rounded-md transition-all select-none border-2",
        fs ? "min-h-[100px] rounded-lg" : "min-h-[52px]",
        firing
          ? "bg-red-600 border-red-400 scale-[0.96]"
          : isArmed && hasAssignment
            ? "bg-[hsl(220_12%_12%)] border-border/50 hover:bg-[hsl(220_12%_16%)] active:scale-[0.96] active:bg-red-700/80 cursor-pointer"
            : hasAssignment
              ? "bg-[hsl(220_10%_10%)] border-border/20"
              : "bg-[hsl(220_10%_7%)] border-border/10"
      )}
      style={firing ? { boxShadow: '0 0 20px rgba(255,60,30,0.5)' } : undefined}
    >
      {/* LED + Lock icon */}
      <div className={cn(
        "absolute top-0.5 left-0.5 rounded-full",
        fs ? "w-3 h-3 top-1.5 left-1.5" : "w-1.5 h-1.5",
        firing ? "bg-red-400" : isArmed && hasAssignment ? "bg-green-500" : "bg-muted-foreground/20"
      )} style={firing ? { boxShadow: '0 0 6px #ff4444' } : isArmed && hasAssignment ? { boxShadow: '0 0 4px #22cc44' } : undefined} />

      {isLocked && (
        <Lock className={cn(
          "absolute top-0.5 right-0.5 text-amber-400/50",
          fs ? "w-3 h-3 top-1.5 right-1.5" : "w-2 h-2"
        )} />
      )}

      <span className={cn(
        "font-mono font-bold",
        fs ? "text-xs mb-1" : "text-[7px]",
        firing ? "text-white" : "text-muted-foreground/50"
      )}>KEY{index + 1}</span>

      {cue ? (
        <>
          <span className={cn(
            "font-black uppercase tracking-wide leading-tight text-center px-0.5 truncate w-full",
            fs ? "text-sm" : "text-[8px]",
            firing ? "text-white" : "text-foreground/80"
          )} style={{ color: firing ? undefined : cue.keyColor }}>
            {cue.keyLabel || cue.effect}
          </span>
          <span className={cn(
            "font-mono",
            fs ? "text-[10px] mt-0.5" : "text-[6px]",
            firing ? "text-red-200" : "text-muted-foreground/40"
          )}>
            {cue.deviceIds.length}dev · {FIRING_RULES.find(r => r.key === cue.firingRule)?.label}
          </span>
        </>
      ) : (
        <span className={cn(fs ? "text-sm" : "text-[7px]", "text-muted-foreground/20")}>—</span>
      )}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════
// DEVICE TABLE ROW
// ═══════════════════════════════════════════════════════════
function DeviceRow({
  channel, index, selected, onSelect, dmxArmed, fs,
}: {
  channel: SFXChannel; index: number; selected: boolean;
  onSelect: () => void; dmxArmed: boolean; fs: boolean;
}) {
  const sfxType = SFX_TYPES.find(t => t.key === channel.type);
  const hasSafety = channel.safetyChannel !== undefined;

  return (
    <button onClick={onSelect}
      className={cn(
        "w-full flex items-center gap-1 border-b border-border/10 transition-all text-left",
        fs ? "px-2.5 py-1.5 gap-2" : "px-1.5 py-1 gap-1",
        selected ? "bg-primary/15 border-primary/20" :
        dmxArmed && channel.enabled && hasSafety && channel.firing ? "bg-red-600/15" :
        dmxArmed && channel.enabled && hasSafety ? "bg-[hsl(210_80%_25%_/_0.2)]" :
        dmxArmed && channel.enabled ? "bg-[hsl(220_10%_12%)] hover:bg-[hsl(220_10%_15%)]" :
        "hover:bg-[hsl(220_10%_10%)]",
        !channel.enabled && "opacity-40"
      )}>
      <span className={cn("font-mono text-muted-foreground/40 text-right shrink-0", fs ? "text-[8px] w-4" : "text-[7px] w-3")}>{index + 1}</span>
      <div className={cn("rounded-sm shrink-0", fs ? "w-2 h-7" : "w-1.5 h-6")} style={{ backgroundColor: sfxType?.color || '#888' }} />
      <div className="flex-1 min-w-0">
        <div className={cn("font-bold uppercase truncate leading-tight", fs ? "text-[10px]" : "text-[8px]", selected ? "text-primary" : "text-foreground/80")}>
          {channel.name}
        </div>
        <div className={cn("font-mono text-muted-foreground/40 leading-tight", fs ? "text-[8px]" : "text-[6px]")}>
          {sfxType?.label} · U{channel.dmxUniverse}.{String(channel.dmxAddress).padStart(3, '0')}
        </div>
      </div>
      <div className="flex flex-col items-end gap-0.5 shrink-0">
        {channel.temperature !== undefined && (
          <span className={cn("font-mono", fs ? "text-[8px]" : "text-[6px]", channel.temperature > 600 ? "text-red-400" : "text-green-400/70")}>
            {channel.temperature}°
          </span>
        )}
        {channel.pressure !== undefined && (
          <span className={cn("font-mono text-cyan-400/70", fs ? "text-[8px]" : "text-[6px]")}>{channel.pressure}bar</span>
        )}
      </div>
      {channel.firing && <div className={cn("rounded-full bg-red-500 animate-pulse shrink-0", fs ? "w-2.5 h-2.5" : "w-2 h-2")} />}
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
  const [firingKeys, setFiringKeys] = useState<Set<number>>(new Set());
  const [lockedKeys, setLockedKeys] = useState<Set<number>>(new Set());
  const [editingCue, setEditingCue] = useState<number | null>(null);
  const [cueEffect, setCueEffect] = useState('Height 10');
  const [cueFiringRule, setCueFiringRule] = useState<CueEntry['firingRule']>('sync');
  const [cueDuration, setCueDuration] = useState(2.0);
  const [cueTriggerDelay, setCueTriggerDelay] = useState(0);
  const [cueRepeatPeriod, setCueRepeatPeriod] = useState(1.0);
  const [cueRepeatCount, setCueRepeatCount] = useState(1);
  const [cueGroupRepeat, setCueGroupRepeat] = useState(1);
  const [cueKeyLabel, setCueKeyLabel] = useState('');
  const [cueKeyMode, setCueKeyMode] = useState<'tap' | 'lock'>('tap');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [cuePage, setCuePage] = useState(0);
  const [showDeviceLib, setShowDeviceLib] = useState(false);
  const [settings, setSettings] = useState<FXCSettings>(DEFAULT_SETTINGS);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [firingStartTime, setFiringStartTime] = useState<number | null>(null);
  const [batteryVoltage] = useState(11.82);
  const sequenceRef = useRef(0);
  const fireTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const sceneCues = useMemo(() => cues.filter(() => true), [cues]);
  const pageStart = cuePage * CUES_PER_PAGE;
  const pageEnd = pageStart + CUES_PER_PAGE;
  const pageCues = sceneCues.slice(0, 128); // Max 128

  // Timer for elapsed display
  useEffect(() => {
    if (!firingStartTime) return;
    const iv = setInterval(() => setElapsedMs(Date.now() - firingStartTime), 100);
    return () => clearInterval(iv);
  }, [firingStartTime]);

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
        body: { action: 'send', universes, targetIp: settings.artNetIp, targetPort: settings.artNetPort },
      });
      if (error) throw error;
      setArtNetConnected(true);
      return data;
    } catch { setArtNetConnected(false); }
  }, [settings.artNetIp, settings.artNetPort]);

  // ─── ARM controls ───
  const handlePyroArm = useCallback((armed: boolean) => {
    setPyroArm(armed);
    if (armed) toast.warning('⚠️ PYRO ARMED — LIVE SYSTEM', { duration: 3000 });
    else { toast.info('Pyro disarmed'); setLockedKeys(new Set()); }
  }, []);

  const handleDmxArm = useCallback((armed: boolean) => {
    setDmxArm(armed);
    setChannels(prev => prev.map(ch => ({ ...ch, armed: ch.locked ? false : armed })));
    if (armed) toast.warning('DMX ARMED', { duration: 2000 });
    else { toast.info('DMX disarmed'); setLockedKeys(new Set()); }
  }, []);

  const handlePanic = useCallback(() => {
    setChannels(prev => { const updated = prev.map(ch => ({ ...ch, firing: false })); sendArtNetPacket(updated); return updated; });
    fireTimers.current.forEach(t => clearTimeout(t));
    fireTimers.current.clear();
    setFiringKeys(new Set());
    setLockedKeys(new Set());
    setPyroArm(false);
    setDmxArm(false);
    setDeadmanHeld(false);
    setFiringStartTime(null);
    toast.error('🚨 PANIC — ALL STOP', { duration: 5000 });
  }, [sendArtNetPacket]);

  // ─── Fire logic ───
  const fireChannel = useCallback((id: string) => {
    setChannels(prev => { const updated = prev.map(ch => ch.id === id ? { ...ch, firing: true } : ch); sendArtNetPacket(updated); return updated; });
    const ch = channels.find(c => c.id === id);
    if (ch) {
      let pos3d: [number, number, number];
      if (ch.positionId) {
        const linkedPos = positions.find(p => p.id === ch.positionId);
        pos3d = linkedPos ? [linkedPos.x, linkedPos.y, linkedPos.z] : [(channels.indexOf(ch) - (channels.length - 1) / 2) * 8, 0, 0];
      } else {
        pos3d = [(channels.indexOf(ch) - (channels.length - 1) / 2) * 8, 0, 0];
      }
      useLiveSfxStore.getState().fireEffect({ id: ch.id, type: ch.type as any, position: pos3d, color: ch.color, intensity: ch.intensity, startedAt: performance.now(), duration: ch.duration });
      if (!firingStartTime) setFiringStartTime(Date.now());
      const timer = setTimeout(() => {
        setChannels(prev => { const updated = prev.map(c => c.id === id ? { ...c, firing: false } : c); sendArtNetPacket(updated); return updated; });
        fireTimers.current.delete(id);
      }, ch.duration);
      fireTimers.current.set(id, timer);
    }
  }, [channels, sendArtNetPacket, positions, firingStartTime]);

  const stopChannel = useCallback((id: string) => {
    const timer = fireTimers.current.get(id);
    if (timer) { clearTimeout(timer); fireTimers.current.delete(id); }
    setChannels(prev => { const updated = prev.map(ch => ch.id === id ? { ...ch, firing: false } : ch); sendArtNetPacket(updated); return updated; });
  }, [sendArtNetPacket]);

  // ─── CUE Key firing with Lock/Tap + firing rules ───
  const fireCueKey = useCallback((keyIndex: number) => {
    const cue = pageCues.find(c => c.keyIndex === keyIndex + pageStart);
    if (!cue) return;
    if (!dmxArm && !pyroArm) return;

    // Lock mode toggle
    if (cue.keyMode === 'lock') {
      if (lockedKeys.has(keyIndex)) {
        setLockedKeys(prev => { const n = new Set(prev); n.delete(keyIndex); return n; });
        cue.deviceIds.forEach(id => stopChannel(id));
        setFiringKeys(prev => { const n = new Set(prev); n.delete(keyIndex); return n; });
        return;
      }
      setLockedKeys(prev => new Set(prev).add(keyIndex));
    }

    setFiringKeys(prev => new Set(prev).add(keyIndex));
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

    // Handle repeat
    for (let rep = 0; rep < cue.repeatCount; rep++) {
      sortedDevices.forEach((ch, i) => {
        const delay = (cue.firingRule === 'sync' ? 0 : i * cue.triggerDelay * 1000) + rep * cue.repeatPeriod * 1000;
        setTimeout(() => fireChannel(ch.id), delay);
      });
    }
  }, [pageCues, pageStart, channels, dmxArm, pyroArm, lockedKeys, fireChannel, stopChannel]);

  const stopCueKey = useCallback((keyIndex: number) => {
    const cue = pageCues.find(c => c.keyIndex === keyIndex + pageStart);
    if (!cue) return;
    if (cue.keyMode === 'lock') return; // Lock mode handles on next press
    cue.deviceIds.forEach(id => stopChannel(id));
    setFiringKeys(prev => { const n = new Set(prev); n.delete(keyIndex); return n; });
  }, [pageCues, pageStart, stopChannel]);

  const toggleKeyMode = useCallback((keyIndex: number) => {
    setCues(prev => prev.map(c =>
      c.keyIndex === keyIndex + pageStart
        ? { ...c, keyMode: c.keyMode === 'tap' ? 'lock' : 'tap' }
        : c
    ));
    const currentCue = pageCues.find(c => c.keyIndex === keyIndex + pageStart);
    toast.info(`KEY${keyIndex + 1}: ${currentCue?.keyMode === 'tap' ? 'Lock' : 'Tap'} Mode`);
  }, [pageCues, pageStart]);

  // ─── Add CUE ───
  const addCue = useCallback(() => {
    if (selectedDevices.size === 0 || editingCue === null) return;
    const newCue: CueEntry = {
      id: `cue-${Date.now()}`, deviceIds: [...selectedDevices], effect: cueEffect,
      firingRule: cueFiringRule, duration: cueDuration, triggerDelay: cueTriggerDelay,
      repeatPeriod: cueRepeatPeriod, repeatCount: cueRepeatCount, cueGroupRepeat: cueGroupRepeat,
      keyIndex: editingCue + pageStart, keyLabel: cueKeyLabel || cueEffect,
      keyColor: channels.find(ch => selectedDevices.has(ch.id))
        ? SFX_TYPES.find(t => t.key === channels.find(ch => selectedDevices.has(ch.id))?.type)?.color || '#fff' : '#fff',
      keyMode: cueKeyMode,
    };
    setCues(prev => [...prev.filter(c => c.keyIndex !== editingCue + pageStart), newCue]);
    setEditingCue(null);
    setSelectedDevices(new Set());
    toast.success(`CUE KEY${editingCue + 1} programmed`);
  }, [selectedDevices, editingCue, cueEffect, cueFiringRule, cueDuration, cueTriggerDelay, cueRepeatPeriod, cueRepeatCount, cueGroupRepeat, cueKeyLabel, cueKeyMode, channels, pageStart]);

  // ─── Add device from library ───
  const addDeviceFromLib = useCallback((entry: DeviceLibEntry, startAddress: number, count: number) => {
    const sfxType = SFX_TYPES.find(t => t.label.toUpperCase().includes(entry.name.split(' ')[0].toUpperCase()));
    setChannels(prev => {
      const newDevices: SFXChannel[] = Array.from({ length: count }, (_, i) => ({
        id: `sfx-${Date.now()}-${i}`, name: `${entry.name} ${prev.length + i + 1}`,
        type: sfxType?.key || 'custom', dmxUniverse: 1,
        dmxAddress: startAddress + i * entry.dmxChannels, dmxChannels: entry.dmxChannels,
        armed: dmxArm, firing: false, duration: (entry.effects[0]?.duration || 1) * 1000,
        intensity: 200, color: sfxType?.color || '#fff', locked: false, enabled: true,
        manufacturer: entry.manufacturer,
        safetyChannel: entry.safetyChannel, safetyValue: entry.safetyValue,
      }));
      return [...prev, ...newDevices];
    });
    setShowDeviceLib(false);
  }, [dmxArm]);

  // ─── Add channel quick ───
  const addChannel = useCallback((type: SFXChannel['type']) => {
    const sfxType = SFX_TYPES.find(t => t.key === type);
    const maxAddr = Math.max(0, ...channels.map(c => c.dmxAddress + c.dmxChannels));
    setChannels(prev => [...prev, {
      id: `sfx-${Date.now()}`, name: `${sfxType?.label || 'CH'} ${prev.length + 1}`, type,
      dmxUniverse: 1, dmxAddress: maxAddr || 1, dmxChannels: sfxType?.defaultChannels || 2,
      armed: dmxArm, firing: false, duration: sfxType?.defaultDuration || 1000,
      intensity: 200, color: sfxType?.color || '#fff', locked: false, enabled: true,
    }]);
  }, [channels, dmxArm]);

  useEffect(() => { return () => { fireTimers.current.forEach(timer => clearTimeout(timer)); }; }, []);
  useEffect(() => {
    if (!isFullscreen) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsFullscreen(false); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [isFullscreen]);

  const armedCount = channels.filter(c => c.armed).length;
  const firingCount = channels.filter(c => c.firing).length;
  const enabledCount = channels.filter(c => c.enabled).length;

  // ═══════════════════════════════════════════════════════════
  // RENDER FUNCTIONS
  // ═══════════════════════════════════════════════════════════

  const renderStatusBar = (fs: boolean) => (
    <div className={cn("flex items-center justify-between border-b-2", fs ? "px-6 py-3" : "px-2 py-1.5")} style={{ borderColor: 'hsl(220 10% 15%)', background: 'hsl(220 15% 8%)' }}>
      <div className="flex items-center gap-2">
        <div className={cn("rounded bg-gradient-to-b from-amber-500 to-amber-700 flex items-center justify-center", fs ? "w-8 h-8" : "w-5 h-5")}>
          <Zap className={cn(fs ? "w-5 h-5" : "w-3 h-3", "text-black")} />
        </div>
        <div>
          <div className={cn("font-black text-foreground tracking-[0.12em]", fs ? "text-base" : "text-[10px]")}>FXcommander™</div>
          <div className={cn("font-mono text-muted-foreground/40 tracking-wider", fs ? "text-[9px]" : "text-[6px]")}>SHOWVEN® · V2.0</div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {/* Elapsed timer */}
        <span className={cn("font-mono text-foreground/40", fs ? "text-sm" : "text-[8px]")}>
          {formatTimecode(elapsedMs)}
        </span>
        {/* Battery */}
        <div className="flex items-center gap-1">
          <Battery className={cn(batteryVoltage > 11 ? "text-green-400/60" : "text-amber-400", fs ? "w-4 h-4" : "w-2.5 h-2.5")} />
          <span className={cn("font-mono text-muted-foreground/40", fs ? "text-[9px]" : "text-[6px]")}>{batteryVoltage.toFixed(2)}V</span>
        </div>
        {/* Connection indicators */}
        <div className="flex items-center gap-1">
          <div className={cn("rounded-full", artNetConnected ? "bg-green-500" : "bg-muted-foreground/20", fs ? "w-2.5 h-2.5" : "w-1.5 h-1.5")} />
          <span className={cn("font-mono text-muted-foreground/40", fs ? "text-[9px]" : "text-[6px]")}>DMX</span>
        </div>
        <div className="flex items-center gap-1">
          <Signal className={cn(pyroArm ? "text-red-500" : "text-muted-foreground/20", fs ? "w-4 h-4" : "w-2.5 h-2.5")} />
          <span className={cn("font-mono text-muted-foreground/40", fs ? "text-[9px]" : "text-[6px]")}>RF</span>
        </div>
        <button onClick={() => setIsFullscreen(!isFullscreen)} className="text-muted-foreground/40 hover:text-foreground transition-colors rounded p-0.5">
          {isFullscreen ? <Minimize2 className={cn(fs ? "w-4 h-4" : "w-3 h-3")} /> : <Maximize2 className={cn(fs ? "w-4 h-4" : "w-3 h-3")} />}
        </button>
        {!isFullscreen && <button onClick={onClose} className="text-muted-foreground/30 hover:text-foreground p-0.5 rounded transition-colors text-xs ml-1">✕</button>}
      </div>
    </div>
  );

  const renderArmBar = (fs: boolean) => (
    <>
      <div className={cn(
        "flex items-center gap-3 border-b transition-colors",
        fs ? "px-6 py-2.5" : "px-2 py-1",
        (pyroArm || dmxArm) ? "border-red-800/30" : "border-border/15"
      )} style={{ background: (pyroArm || dmxArm) ? 'hsl(0 40% 8%)' : 'hsl(220 12% 7%)' }}>
        <button onClick={() => handlePyroArm(!pyroArm)}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 rounded border-2 font-black uppercase transition-all",
            fs ? "py-3 text-sm tracking-[0.2em]" : "py-1.5 text-[9px] tracking-[0.15em]",
            pyroArm ? "bg-red-600/20 border-red-500/60 text-red-400" : "bg-[hsl(220_10%_10%)] border-border/20 text-muted-foreground/40 hover:border-border/40"
          )} style={pyroArm ? { boxShadow: 'inset 0 0 12px rgba(255,50,30,0.1)' } : undefined}>
          <Shield className={cn(fs ? "w-5 h-5" : "w-3 h-3")} />
          PYRO {pyroArm ? 'ARMED' : 'SAFE'}
        </button>
        <button onClick={() => handleDmxArm(!dmxArm)}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 rounded border-2 font-black uppercase transition-all",
            fs ? "py-3 text-sm tracking-[0.2em]" : "py-1.5 text-[9px] tracking-[0.15em]",
            dmxArm ? "bg-amber-600/20 border-amber-500/60 text-amber-400" : "bg-[hsl(220_10%_10%)] border-border/20 text-muted-foreground/40 hover:border-border/40"
          )} style={dmxArm ? { boxShadow: 'inset 0 0 12px rgba(255,180,30,0.1)' } : undefined}>
          <Radio className={cn(fs ? "w-5 h-5" : "w-3 h-3")} />
          DMX {dmxArm ? 'ARMED' : 'SAFE'}
        </button>
        {/* DEADMAN */}
        <button
          onMouseDown={() => setDeadmanHeld(true)}
          onMouseUp={() => setDeadmanHeld(false)}
          onMouseLeave={() => setDeadmanHeld(false)}
          onTouchStart={(e) => { e.preventDefault(); setDeadmanHeld(true); }}
          onTouchEnd={(e) => { e.preventDefault(); setDeadmanHeld(false); }}
          className={cn(
            "flex items-center justify-center rounded border-2 font-black uppercase transition-all shrink-0",
            fs ? "w-16 py-3 text-[10px]" : "w-10 py-1.5 text-[7px]",
            deadmanHeld ? "bg-green-600/30 border-green-500/60 text-green-400" : "bg-[hsl(220_10%_10%)] border-border/20 text-muted-foreground/30"
          )}>
          <Hand className={cn(fs ? "w-4 h-4" : "w-3 h-3")} />
        </button>
      </div>
      {(pyroArm || dmxArm) && (
        <div className={cn(
          "text-center font-black uppercase animate-pulse",
          fs ? "px-4 py-1.5 text-xs tracking-[0.3em]" : "px-2 py-0.5 text-[8px] tracking-[0.25em]",
          pyroArm && dmxArm ? "text-red-400" : pyroArm ? "text-red-400" : "text-amber-400"
        )} style={{ background: pyroArm ? 'hsl(0 50% 8%)' : 'hsl(40 40% 8%)' }}>
          {pyroArm && dmxArm ? '⚠ DMX + PYRO ARMED ⚠' : pyroArm ? '⚠ PYRO ARMED ⚠' : 'DMX ARMED'}
        </div>
      )}
    </>
  );

  const renderCueKeys = (fs: boolean) => (
    <div className={cn("border-b border-border/15", fs ? "px-6 py-4" : "px-1.5 py-1.5")} style={{ background: 'hsl(220 12% 6%)' }}>
      {/* Pagination */}
      <div className={cn("flex items-center justify-between mb-1", fs ? "mb-2" : "mb-0.5")}>
        <div className="flex items-center gap-1">
          <button onClick={() => setCuePage(Math.max(0, cuePage - 1))} disabled={cuePage === 0}
            className={cn("rounded text-muted-foreground/30 hover:text-foreground/60 disabled:opacity-20 transition-colors", fs ? "p-1" : "p-0.5")}>
            <ChevronLeft className={cn(fs ? "w-4 h-4" : "w-3 h-3")} />
          </button>
          <span className={cn("font-mono text-muted-foreground/40", fs ? "text-[9px]" : "text-[6px]")}>
            {cuePage * CUES_PER_PAGE + 1}-{Math.min((cuePage + 1) * CUES_PER_PAGE, 128)}
          </span>
          <button onClick={() => setCuePage(Math.min(15, cuePage + 1))}
            className={cn("rounded text-muted-foreground/30 hover:text-foreground/60 transition-colors", fs ? "p-1" : "p-0.5")}>
            <ChevronRight className={cn(fs ? "w-4 h-4" : "w-3 h-3")} />
          </button>
        </div>
        <span className={cn("font-mono text-muted-foreground/20", fs ? "text-[8px]" : "text-[5px]")}>
          Page {cuePage + 1}/16
        </span>
      </div>
      <div className={cn("grid grid-cols-8", fs ? "gap-2" : "gap-0.5")}>
        {Array.from({ length: CUES_PER_PAGE }).map((_, i) => {
          const globalIndex = i + pageStart;
          const cue = pageCues.find(c => c.keyIndex === globalIndex);
          return (
            <CueKey key={i} index={i} cue={cue} firing={firingKeys.has(i)}
              onPress={() => fireCueKey(i)} onRelease={() => stopCueKey(i)}
              onLongPress={() => toggleKeyMode(i)}
              pyroArmed={pyroArm} dmxArmed={dmxArm} fs={fs} />
          );
        })}
      </div>
    </div>
  );

  const renderSceneModeBar = (fs: boolean) => (
    <div className="flex items-center border-b border-border/15" style={{ background: 'hsl(220 10% 7%)' }}>
      <div className="flex">
        {[0, 1, 2, 3].map(s => (
          <button key={s} onClick={() => setActiveScene(s)} disabled={pyroArm}
            className={cn(
              "font-bold uppercase tracking-wider transition-all border-b-2",
              fs ? "px-5 py-2.5 text-xs" : "px-2.5 py-1.5 text-[7px]",
              activeScene === s ? "text-primary border-primary bg-primary/5" : "text-muted-foreground/30 border-transparent hover:text-muted-foreground/60"
            )}>SCENE{s}</button>
        ))}
      </div>
      <div className="flex-1" />
      <div className={cn("flex flex-wrap", fs ? "pr-3 gap-0.5" : "pr-1")}>
        {([
          { key: 'super_dmx' as FXCMode, label: 'Super' },
          { key: 'simple_dmx' as FXCMode, label: 'Simple' },
          { key: 'manual_fire' as FXCMode, label: 'Manual' },
          { key: 'auto_fire' as FXCMode, label: 'Auto' },
          { key: 'check_slave' as FXCMode, label: 'Check' },
          { key: 'settings' as FXCMode, label: 'Settings' },
        ]).map(m => (
          <button key={m.key} onClick={() => { setMode(m.key); setShowDeviceLib(false); }}
            className={cn(
              "font-bold uppercase tracking-wider transition-all",
              fs ? "px-3 py-2.5 text-[9px]" : "px-1.5 py-1.5 text-[6px]",
              mode === m.key ? "text-foreground/80" : "text-muted-foreground/25 hover:text-muted-foreground/50"
            )}>{m.label}</button>
        ))}
      </div>
    </div>
  );

  const renderPanic = (fs: boolean) => (
    <div className="border-t-2 border-border/20" style={{ background: 'hsl(220 12% 6%)' }}>
      <div className={cn(fs ? "px-6 py-3" : "px-2 py-1.5")}>
        <button onClick={handlePanic}
          className={cn(
            "w-full rounded-lg font-black uppercase transition-all",
            "bg-gradient-to-b from-red-700 to-red-900 text-white/90",
            "hover:from-red-600 hover:to-red-800 active:scale-[0.97]",
            "border-2 border-red-600/50",
            "flex items-center justify-center gap-2",
            fs ? "h-16 text-lg tracking-[0.3em]" : "h-10 text-[11px] tracking-[0.25em]"
          )} style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1)' }}>
          <AlertTriangle className={cn(fs ? "w-6 h-6" : "w-4 h-4")} />
          PANIC
        </button>
      </div>
      <div className={cn("flex items-center justify-between border-t border-border/10", fs ? "px-6 py-2" : "px-2 py-1")}>
        <div className="flex items-center gap-2">
          <span className={cn("font-mono text-muted-foreground/30", fs ? "text-[9px]" : "text-[6px]")}>{channels.length}CH · {armedCount}RDY</span>
          {firingCount > 0 && <span className={cn("font-mono text-red-400 font-bold animate-pulse", fs ? "text-[9px]" : "text-[6px]")}>🔥 {firingCount}</span>}
          <span className={cn("font-mono", fs ? "text-[9px]" : "text-[6px]", artNetConnected ? "text-green-500/60" : "text-muted-foreground/20")}>
            {artNetConnected ? '● Art-Net' : '○ Art-Net'}
          </span>
        </div>
        <span className={cn("font-mono text-muted-foreground/20", fs ? "text-[9px]" : "text-[6px]")}>
          {settings.artNetIp}:{settings.artNetPort}
        </span>
      </div>
    </div>
  );

  const renderDeviceList = (fs: boolean) => (
    <div className="border-b border-border/15">
      <div className={cn("flex items-center justify-between", fs ? "px-4 py-2" : "px-2 py-1")} style={{ background: 'hsl(220 10% 9%)' }}>
        <span className={cn("font-bold text-muted-foreground/50 uppercase tracking-wider", fs ? "text-[10px]" : "text-[7px]")}>Device List</span>
        <div className="flex items-center gap-2">
          <span className={cn("font-mono text-muted-foreground/30", fs ? "text-[9px]" : "text-[7px]")}>{enabledCount}/{channels.length}</span>
          {firingCount > 0 && <span className={cn("font-mono text-red-400 font-bold animate-pulse", fs ? "text-[9px]" : "text-[7px]")}>🔥 {firingCount}</span>}
        </div>
      </div>
      <div className={cn("overflow-y-auto", fs ? "max-h-[300px]" : "max-h-[140px]")}>
        {channels.map((ch, i) => (
          <DeviceRow key={ch.id} channel={ch} index={i} selected={selectedDevices.has(ch.id)} fs={fs}
            onSelect={() => setSelectedDevices(prev => { const n = new Set(prev); if (n.has(ch.id)) n.delete(ch.id); else n.add(ch.id); return n; })} dmxArmed={dmxArm} />
        ))}
      </div>
      <div className={cn("flex gap-1 flex-wrap border-t border-border/10", fs ? "px-3 py-1.5" : "px-1.5 py-1")} style={{ background: 'hsl(220 12% 7%)' }}>
        {[
          { label: 'All', fn: () => setSelectedDevices(new Set(channels.map(c => c.id))) },
          { label: 'Even', fn: () => setSelectedDevices(new Set(channels.filter((_, i) => i % 2 === 1).map(c => c.id))) },
          { label: 'Odd', fn: () => setSelectedDevices(new Set(channels.filter((_, i) => i % 2 === 0).map(c => c.id))) },
          { label: 'Same', fn: () => { const sel = [...selectedDevices]; const first = channels.find(c => sel.includes(c.id)); if (first) setSelectedDevices(new Set(channels.filter(c => c.type === first.type).map(c => c.id))); } },
          { label: 'Clear', fn: () => setSelectedDevices(new Set()) },
          { label: 'Add Device', fn: () => setShowDeviceLib(true) },
          { label: 'Delete', fn: () => { setChannels(prev => prev.filter(c => !selectedDevices.has(c.id))); setSelectedDevices(new Set()); } },
          { label: 'Enable', fn: () => setChannels(prev => prev.map(c => selectedDevices.has(c.id) ? { ...c, enabled: !c.enabled } : c)) },
        ].map(b => (
          <button key={b.label} onClick={b.fn} className={cn(
            "rounded text-muted-foreground/50 hover:text-foreground/70 transition-colors",
            fs ? "text-[8px] px-2.5 py-1" : "text-[6px] px-1.5 py-0.5",
            b.label === 'Add Device' ? "bg-primary/10 text-primary/70" : "bg-[hsl(220_10%_12%)]"
          )}>{b.label}</button>
        ))}
      </div>
    </div>
  );

  const renderCueSetting = (fs: boolean) => (
    <div className={cn("space-y-2", fs ? "p-4" : "p-2")}>
      <div className="flex items-center justify-between">
        <span className={cn("font-bold text-muted-foreground/50 uppercase tracking-wider", fs ? "text-[10px]" : "text-[8px]")}>CUE Setting</span>
        <span className={cn("font-mono text-primary/50", fs ? "text-[9px]" : "text-[7px]")}>{selectedDevices.size} selected</span>
      </div>
      {/* Key selector */}
      <div className={cn("grid grid-cols-8", fs ? "gap-1.5" : "gap-0.5")}>
        {Array.from({ length: CUES_PER_PAGE }).map((_, i) => (
          <button key={i} onClick={() => setEditingCue(editingCue === i ? null : i)}
            className={cn(
              "rounded font-bold transition-all border",
              fs ? "py-2 text-xs" : "py-1 text-[7px]",
              editingCue === i ? "bg-primary/15 border-primary/40 text-primary"
                : pageCues.find(c => c.keyIndex === i + pageStart) ? "bg-[hsl(220_12%_14%)] border-border/20 text-foreground/50"
                : "bg-[hsl(220_10%_8%)] border-border/10 text-muted-foreground/30"
            )}>K{i + 1}</button>
        ))}
      </div>
      {editingCue !== null && (
        <div className={cn("space-y-2 rounded-md border border-primary/20 bg-primary/5", fs ? "p-4" : "p-2")}>
          <div className="flex gap-1.5">
            <Input value={cueEffect} onChange={e => setCueEffect(e.target.value)} placeholder="Effect name..."
              className={cn("flex-1 bg-background/60 border-border/20", fs ? "h-8 text-xs" : "h-5 text-[8px]")} />
            <Input value={cueKeyLabel} onChange={e => setCueKeyLabel(e.target.value)} placeholder="Key label"
              className={cn("bg-background/60 border-border/20", fs ? "h-8 text-xs w-24" : "h-5 text-[8px] w-16")} />
          </div>
          {/* Firing rules */}
          <div className="flex gap-1">
            {FIRING_RULES.map(rule => (
              <button key={rule.key} onClick={() => setCueFiringRule(rule.key)}
                className={cn(
                  "flex-1 rounded font-bold transition-all border",
                  fs ? "py-2 text-sm" : "py-1 text-[8px]",
                  cueFiringRule === rule.key ? "bg-primary/15 border-primary/40 text-primary"
                    : "bg-[hsl(220_10%_10%)] border-border/10 text-muted-foreground/40 hover:text-muted-foreground/70"
                )}>{rule.label}</button>
            ))}
          </div>
          {/* Parameters — matches real FXcommander layout */}
          <div className="grid grid-cols-2 gap-1.5">
            {[
              { label: 'Duration(s)', value: cueDuration, set: setCueDuration },
              { label: 'Trigger Delay(s)', value: cueTriggerDelay, set: setCueTriggerDelay },
              { label: 'Repeat Period(s)', value: cueRepeatPeriod, set: setCueRepeatPeriod },
              { label: 'Repeat Counts', value: cueRepeatCount, set: setCueRepeatCount },
            ].map(p => (
              <div key={p.label}>
                <label className={cn("text-muted-foreground/40 uppercase block", fs ? "text-[8px]" : "text-[6px]")}>{p.label}</label>
                <Input type="number" value={p.value} onChange={e => p.set(Number(e.target.value))} step={p.label.includes('Count') ? 1 : 0.1}
                  className={cn("bg-background/60 border-border/20 font-mono", fs ? "h-8 text-xs" : "h-5 text-[8px]")} />
              </div>
            ))}
          </div>
          {/* CUE Group Repeat */}
          <div className="flex items-center gap-2">
            <label className={cn("text-muted-foreground/40 uppercase", fs ? "text-[8px]" : "text-[6px]")}>CUE Group Repeat:</label>
            <Input type="number" value={cueGroupRepeat} onChange={e => setCueGroupRepeat(Number(e.target.value))} min={1}
              className={cn("bg-background/60 border-border/20 font-mono w-16", fs ? "h-7 text-xs" : "h-5 text-[8px]")} />
          </div>
          {/* Key mode */}
          <div className="flex items-center gap-2">
            <label className={cn("text-muted-foreground/40 uppercase", fs ? "text-[8px]" : "text-[6px]")}>Key Mode:</label>
            <button onClick={() => setCueKeyMode(cueKeyMode === 'tap' ? 'lock' : 'tap')}
              className={cn(
                "rounded border font-bold flex items-center gap-1 transition-all",
                fs ? "px-3 py-1 text-[10px]" : "px-2 py-0.5 text-[7px]",
                cueKeyMode === 'lock' ? "bg-amber-500/15 border-amber-500/40 text-amber-400" : "bg-[hsl(220_10%_12%)] border-border/15 text-muted-foreground/50"
              )}>
              {cueKeyMode === 'lock' ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
              {cueKeyMode === 'lock' ? 'LOCK' : 'TAP'}
            </button>
          </div>
          <Button size={fs ? "default" : "sm"} onClick={addCue} disabled={selectedDevices.size === 0}
            className={cn("w-full font-bold uppercase tracking-wider", fs ? "h-10 text-sm" : "h-6 text-[8px]")}>
            <Check className={cn(fs ? "w-4 h-4" : "w-3 h-3", "mr-1")} /> OK — Assign to KEY{editingCue + 1}
          </Button>
        </div>
      )}
      {/* Quick add device */}
      <div className="pt-1 border-t border-border/10">
        <span className={cn("font-bold text-muted-foreground/30 uppercase tracking-wider mb-1 block", fs ? "text-[9px]" : "text-[7px]")}>Quick Add</span>
        <div className={cn("grid grid-cols-4", fs ? "gap-1.5" : "gap-0.5")}>
          {SFX_TYPES.slice(0, 8).map(t => (
            <button key={t.key} onClick={() => addChannel(t.key)}
              className={cn(
                "flex flex-col items-center rounded bg-[hsl(220_10%_8%)] hover:bg-[hsl(220_10%_12%)] active:scale-95 transition-all border border-border/5",
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

  const renderSimpleDmx = (fs: boolean) => (
    <div className={cn("space-y-1", fs ? "p-4" : "p-2")}>
      <div className="flex items-center justify-between px-1 mb-1">
        <span className={cn("font-bold text-muted-foreground/40 uppercase tracking-wider", fs ? "text-[9px]" : "text-[7px]")}>
          DMX Output — {channels.length} channels
        </span>
        <button onClick={() => setChannels(prev => prev.map(c => ({ ...c, intensity: 0 })))}
          className={cn("text-muted-foreground/30 hover:text-foreground/60 font-bold uppercase", fs ? "text-[8px]" : "text-[6px]")}>Clear All</button>
      </div>
      {channels.map((ch, i) => {
        const sfxType = SFX_TYPES.find(t => t.key === ch.type);
        return (
          <div key={ch.id} className={cn("flex items-center gap-1.5 rounded border border-border/5", fs ? "px-3 py-2" : "px-1.5 py-1")} style={{ background: 'hsl(220 10% 8%)' }}>
            <span className={cn("font-mono text-muted-foreground/30 text-right", fs ? "text-[9px] w-5" : "text-[7px] w-4")}>{String(i + 1).padStart(2, '0')}</span>
            <div className={cn("rounded-full shrink-0", fs ? "w-2.5 h-2.5" : "w-1.5 h-1.5")} style={{ backgroundColor: sfxType?.color }} />
            <span className={cn("font-bold flex-1 truncate text-foreground/70", fs ? "text-xs" : "text-[8px]")}>{ch.name}</span>
            <Slider value={[ch.intensity]} min={0} max={255} step={1} onValueChange={([v]) => setChannels(prev => prev.map(c => c.id === ch.id ? { ...c, intensity: v } : c))} className={cn(fs ? "w-28" : "w-16")} />
            <span className={cn("font-mono text-muted-foreground/50 text-right", fs ? "text-[9px] w-10" : "text-[7px] w-8")}>{ch.intensity}/{Math.round(ch.intensity / 255 * 100)}%</span>
            <button onClick={() => setChannels(prev => prev.map(c => c.id === ch.id ? { ...c, enabled: !c.enabled } : c))} className="p-0.5">
              {ch.enabled ? <Eye className={cn(fs ? "w-4 h-4" : "w-2.5 h-2.5", "text-green-500/60")} /> : <EyeOff className={cn(fs ? "w-4 h-4" : "w-2.5 h-2.5", "text-muted-foreground/20")} />}
            </button>
          </div>
        );
      })}
    </div>
  );

  const renderManualFire = (fs: boolean) => (
    <div className={cn("space-y-2", fs ? "p-4" : "p-2")}>
      <div className="flex items-center justify-between px-1">
        <span className={cn("font-bold text-muted-foreground/40 uppercase tracking-wider", fs ? "text-[9px]" : "text-[7px]")}>
          Pyro Manual Fire
        </span>
        <span className={cn("font-mono text-foreground/40", fs ? "text-xs" : "text-[8px]")}>{formatTimecode(elapsedMs)}</span>
      </div>
      {(dmxArm || pyroArm) && (
        <button
          onMouseDown={() => { if (deadmanHeld || !settings.pyroArmRequired) channels.filter(ch => ch.enabled).forEach(ch => fireChannel(ch.id)); }}
          onMouseUp={() => channels.forEach(ch => stopChannel(ch.id))}
          disabled={settings.pyroArmRequired && !deadmanHeld}
          className={cn(
            "w-full rounded font-black uppercase transition-all border",
            fs ? "py-5 text-base tracking-[0.3em]" : "py-3 text-[12px] tracking-[0.3em]",
            deadmanHeld || !settings.pyroArmRequired
              ? "bg-gradient-to-b from-red-600 via-red-700 to-red-800 text-white border-red-500/40 hover:from-red-500"
              : "bg-[hsl(220_10%_10%)] text-muted-foreground/20 border-border/10"
          )} style={deadmanHeld ? { boxShadow: '0 0 24px rgba(239,68,68,0.3)' } : undefined}>
          ⚡ FIRE ALL ({enabledCount})
        </button>
      )}
      {settings.pyroArmRequired && !deadmanHeld && (pyroArm || dmxArm) && (
        <div className={cn("text-center text-amber-400/50 font-bold uppercase", fs ? "text-[10px]" : "text-[7px]")}>
          Hold DEADMAN to enable firing
        </div>
      )}
      <div className={cn("grid gap-1.5", fs ? "grid-cols-4" : "grid-cols-2")}>
        {channels.map((ch, i) => {
          const sfxType = SFX_TYPES.find(t => t.key === ch.type);
          return (
            <button key={ch.id}
              onMouseDown={() => (dmxArm || pyroArm) && ch.enabled && (deadmanHeld || !settings.pyroArmRequired) && fireChannel(ch.id)}
              onMouseUp={() => stopChannel(ch.id)}
              onMouseLeave={() => ch.firing && stopChannel(ch.id)}
              disabled={(!dmxArm && !pyroArm) || !ch.enabled || (settings.pyroArmRequired && !deadmanHeld)}
              className={cn(
                "relative flex flex-col items-center justify-center rounded border-2 transition-all",
                fs ? "py-5" : "py-3",
                ch.firing ? "bg-red-600/30 border-red-400 scale-[0.97]"
                  : (dmxArm || pyroArm) && ch.enabled && (deadmanHeld || !settings.pyroArmRequired)
                    ? "bg-[hsl(220_10%_12%)] border-border/30 hover:bg-[hsl(220_10%_16%)] active:scale-[0.97] active:bg-red-700/40"
                    : "bg-[hsl(220_10%_8%)] border-border/10 opacity-40"
              )} style={ch.firing ? { boxShadow: '0 0 12px rgba(255,60,30,0.3)' } : undefined}>
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

  // ─── Mode content router ───
  const renderModeContent = (fs: boolean) => {
    if (showDeviceLib) {
      return <DeviceLibraryPanel fs={fs} channels={channels} onAddDevice={addDeviceFromLib} onBack={() => setShowDeviceLib(false)} />;
    }
    switch (mode) {
      case 'super_dmx':
        return fs ? (
          <div className="flex h-full">
            <div className="w-1/2 border-r border-border/15 flex flex-col">{renderDeviceList(true)}</div>
            <div className="w-1/2 flex flex-col overflow-y-auto">{renderCueSetting(true)}</div>
          </div>
        ) : (
          <div className="flex flex-col">{renderDeviceList(false)}{renderCueSetting(false)}</div>
        );
      case 'simple_dmx': return renderSimpleDmx(fs);
      case 'manual_fire': return renderManualFire(fs);
      case 'auto_fire': return <AutoFirePanel fs={fs} pyroArm={pyroArm} dmxArm={dmxArm} />;
      case 'check_slave': return <CheckSlavePanel fs={fs} pyroArm={pyroArm} />;
      case 'settings': return <SettingsPanel fs={fs} settings={settings} onSettingsChange={setSettings} />;
      default: return renderSimpleDmx(fs);
    }
  };

  // ═══════════════════════════════════════════════════════════
  // FULLSCREEN LAYOUT
  // ═══════════════════════════════════════════════════════════
  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-[9999] flex flex-col select-none" style={{ background: 'linear-gradient(180deg, hsl(220 15% 8%) 0%, hsl(220 12% 4%) 100%)' }}>
        {renderStatusBar(true)}
        {renderArmBar(true)}
        {renderCueKeys(true)}
        {renderSceneModeBar(true)}
        <ScrollArea className="flex-1">{renderModeContent(true)}</ScrollArea>
        {renderPanic(true)}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // PANEL LAYOUT
  // ═══════════════════════════════════════════════════════════
  return (
    <div className="h-full flex flex-col overflow-hidden select-none" style={{ minWidth: 300, maxWidth: 380, background: 'linear-gradient(180deg, hsl(220 15% 8%) 0%, hsl(220 12% 5%) 100%)' }}>
      {renderStatusBar(false)}
      {renderArmBar(false)}
      {renderCueKeys(false)}
      {renderSceneModeBar(false)}
      <ScrollArea className="flex-1">{renderModeContent(false)}</ScrollArea>
      {renderPanic(false)}
    </div>
  );
}
