/**
 * FXcommander™ Digital Console — Complete recreation + enhancements
 * 
 * Modes: Super DMX · Simple DMX · Manual Fire · Auto Fire · Check Slave · Settings
 * Features: 4 Scenes, 128 CUEs/scene, Lock/Tap keys, Deadman, PANIC, Device Library,
 *           RDMX monitoring, Safety channels, Art-Net bridge, CUE grouping
 */
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { haptics } from '@/lib/haptics';
import { createPortal } from 'react-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Flame, Wind, Sparkles, Zap, Play, Square, Plus, Trash2,
  AlertTriangle, Check, Radio, Lightbulb, ChevronDown,
  RotateCcw, Save, Upload, Lock, Unlock, Timer, Power,
  Shield, ShieldAlert, Gauge, Settings, FolderOpen, Wifi,
  Signal, Thermometer, Activity, Volume2, Eye, EyeOff,
  Maximize2, Minimize2, Battery, Hand, ChevronLeft, ChevronRight,
  Cable
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
import { useSfxChannelStore } from '@/store/useSfxChannelStore';
import { useFireOneHardware } from '@/hooks/useFireOneHardware';
import { usePBusHardware } from '@/hooks/usePBusHardware';

import type { SFXChannel, CueEntry, FXCMode, FXCSettings, DeviceLibEntry } from './live-firing/types';
import { FIRING_RULES, SFX_TYPES, DEFAULT_CHANNELS, DEFAULT_SETTINGS, CUES_PER_PAGE, formatTimecode, SHOWVEN_LIBRARY } from './live-firing/constants';
import AutoFirePanel from './live-firing/AutoFirePanel';
import CheckSlavePanel from './live-firing/CheckSlavePanel';
import SettingsPanel from './live-firing/SettingsPanel';
import DeviceLibraryPanel from './live-firing/DeviceLibraryPanel';
import MobileLinkMode from './live-firing/MobileLinkMode';
import PyroFireOnePanel from './live-firing/PyroFireOnePanel';
import VirtualControllerHub from './VirtualControllerHub';
import VirtualZK6200 from './VirtualZK6200';
import VirtualFXButton from './VirtualFXButton';
import FieldMap2D from './FieldMap2D';
import ConnectionManagerPanel from './ConnectionManagerPanel';
import PBusMonitorPanel from './live-firing/PBusMonitorPanel';
import RadioControlPanel from './RadioControlPanel';
import MA3ControlPanel from './MA3ControlPanel';
import VirtualIFMx32QPanel from './live-firing/VirtualIFMx32QPanel';
import { RISK_GROUP_LABELS, RISK_GROUP_COLORS, type RiskGroup } from '@/lib/pyroPhysics';

// ═══════════════════════════════════════════════════════════
// LOCKOUT PANEL — Finale 3D Risk Group Lockout System
// ═══════════════════════════════════════════════════════════
function LockoutPanel({ fs, mob }: { fs: boolean; mob: boolean }) {
  const { activeLockouts, toggleLockout } = useProjectStore();
  const groups: RiskGroup[] = ['A', 'B', 'C', 'D', 'E'];

  return (
    <div className={cn("border-t border-border/15", fs && mob ? "px-3 py-1.5" : fs ? "px-4 py-2" : "px-2 py-1")} style={{ background: 'hsl(220 12% 7%)' }}>
      <div className={cn("flex items-center gap-2 mb-1", fs ? "text-[9px]" : "text-[7px]")}>
        <Shield className={cn(fs ? "w-3.5 h-3.5" : "w-2.5 h-2.5", "text-amber-400/60")} />
        <span className="font-bold text-muted-foreground/50 uppercase tracking-wider">Lockout Groups</span>
      </div>
      <div className={cn("flex gap-1", fs && mob ? "flex-wrap" : "")}>
        {groups.map(g => {
          const locked = activeLockouts.includes(g);
          return (
            <button
              key={g}
              onClick={() => toggleLockout(g)}
              className={cn(
                "flex-1 rounded border-2 font-bold uppercase transition-all flex flex-col items-center",
                fs && mob ? "py-2 text-[9px] min-w-[60px]" : fs ? "py-1.5 text-[8px]" : "py-1 text-[6px]",
                locked
                  ? "border-red-500/60 bg-red-500/15 text-red-400"
                  : "border-border/20 bg-[hsl(220_10%_10%)] text-muted-foreground/40 hover:border-border/40"
              )}
            >
              <span className="font-black" style={{ color: locked ? undefined : RISK_GROUP_COLORS[g] }}>{g}</span>
              <span className={cn("font-normal", fs ? "text-[6px]" : "text-[5px]")}>
                {locked ? '🔒' : RISK_GROUP_LABELS[g].split(' ')[0]}
              </span>
            </button>
          );
        })}
      </div>
      {activeLockouts.length > 0 && (
        <div className={cn("text-center font-bold text-red-400/70 uppercase mt-1", fs ? "text-[8px]" : "text-[6px]")}>
          ⛔ {activeLockouts.length} group{activeLockouts.length > 1 ? 's' : ''} locked out
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// CUE KEY — hardware key replica with Lock/Tap mode
// ═══════════════════════════════════════════════════════════
function CueKey({
  index, cue, firing, onPress, onRelease, onLongPress, pyroArmed, dmxArmed, fs, mobile,
}: {
  index: number; cue?: CueEntry; firing: boolean;
  onPress: () => void; onRelease: () => void; onLongPress: () => void;
  pyroArmed: boolean; dmxArmed: boolean; fs: boolean; mobile?: boolean;
}) {
  const isArmed = pyroArmed || dmxArmed;
  const hasAssignment = !!cue;
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLocked = cue?.keyMode === 'lock';
  const isBig = fs && mobile;

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
        isBig ? "min-h-[72px] rounded-xl" : fs ? "min-h-[100px] rounded-lg" : "min-h-[52px]",
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
      <div className={cn(
        "absolute rounded-full",
        isBig ? "w-2.5 h-2.5 top-1.5 left-1.5" : fs ? "w-3 h-3 top-1.5 left-1.5" : "w-1.5 h-1.5 top-0.5 left-0.5",
        firing ? "bg-red-400" : isArmed && hasAssignment ? "bg-green-500" : "bg-muted-foreground/20"
      )} style={firing ? { boxShadow: '0 0 6px #ff4444' } : isArmed && hasAssignment ? { boxShadow: '0 0 4px #22cc44' } : undefined} />

      {isLocked && (
        <Lock className={cn(
          "absolute text-amber-400/50",
          isBig ? "w-3 h-3 top-1.5 right-1.5" : fs ? "w-3 h-3 top-1.5 right-1.5" : "w-2 h-2 top-0.5 right-0.5"
        )} />
      )}

      <span className={cn(
        "font-mono font-bold",
        isBig ? "text-[9px] mb-0.5" : fs ? "text-xs mb-1" : "text-[7px]",
        firing ? "text-white" : "text-muted-foreground/50"
      )}>KEY{index + 1}</span>

      {cue ? (
        <>
          <span className={cn(
            "font-black uppercase tracking-wide leading-tight text-center px-0.5 truncate w-full",
            isBig ? "text-[10px]" : fs ? "text-sm" : "text-[8px]",
            firing ? "text-white" : "text-foreground/80"
          )} style={{ color: firing ? undefined : cue.keyColor }}>
            {cue.keyLabel || cue.effect}
          </span>
          <span className={cn(
            "font-mono",
            isBig ? "text-[7px] mt-0.5" : fs ? "text-[10px] mt-0.5" : "text-[6px]",
            firing ? "text-red-200" : "text-muted-foreground/40"
          )}>
            {cue.deviceIds.length}dev · {FIRING_RULES.find(r => r.key === cue.firingRule)?.label}
          </span>
        </>
      ) : (
        <span className={cn(isBig ? "text-xs" : fs ? "text-sm" : "text-[7px]", "text-muted-foreground/20")}>—</span>
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
  const isMobile = useIsMobile();
  const { isPlaying, currentTime, setPlaying, positions } = useProjectStore();
  const { channels, setChannels: setStoreChannels, updateChannels } = useSfxChannelStore();
  const fireone = useFireOneHardware();
  const pbus = usePBusHardware();
  const setChannels = useCallback((updaterOrValue: SFXChannel[] | ((prev: SFXChannel[]) => SFXChannel[])) => {
    if (typeof updaterOrValue === 'function') {
      updateChannels(updaterOrValue);
    } else {
      setStoreChannels(updaterOrValue);
    }
  }, [updateChannels, setStoreChannels]);
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
  const [isFullscreen, setIsFullscreen] = useState(isMobile);
  const [cuePage, setCuePage] = useState(0);
  const [showDeviceLib, setShowDeviceLib] = useState(false);
  const [settings, setSettings] = useState<FXCSettings>(DEFAULT_SETTINGS);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [firingStartTime, setFiringStartTime] = useState<number | null>(null);
  const [batteryVoltage] = useState(11.82);
  const [relayConnected, setRelayConnected] = useState(false);
  const [relayUrl, setRelayUrl] = useState('ws://localhost:9001');
  const [showMode, setShowMode] = useState(false);
  const showModeTapRef = useRef<number>(0);
  const sequenceRef = useRef(0);
  const fireTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const relayWs = useRef<WebSocket | null>(null);

  // ─── WebSocket Relay connection ───
  const connectRelay = useCallback(() => {
    if (relayWs.current?.readyState === WebSocket.OPEN) return;
    try {
      const ws = new WebSocket(relayUrl);
      ws.onopen = () => { setRelayConnected(true); toast.success('🔌 Relay UDP conectado'); };
      ws.onclose = () => { setRelayConnected(false); relayWs.current = null; };
      ws.onerror = () => { setRelayConnected(false); toast.error('Falha ao conectar relay'); };
      ws.onmessage = (e) => {
        try { const msg = JSON.parse(e.data); if (msg.error) console.warn('[Relay]', msg.error); } catch {}
      };
      relayWs.current = ws;
    } catch { toast.error('URL do relay inválida'); }
  }, [relayUrl]);

  const disconnectRelay = useCallback(() => {
    relayWs.current?.close();
    relayWs.current = null;
    setRelayConnected(false);
  }, []);

  // Cleanup relay on unmount
  useEffect(() => { return () => { relayWs.current?.close(); }; }, []);

  // ─── Remote LiveFX relay listener ───
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail) return;
      const { type, scene, cueIndex, channelId, field, value, armed } = detail;
      if (type === 'fire-cue' && typeof cueIndex === 'number') {
        if (typeof scene === 'number') setActiveScene(scene);
        const cue = cues[cueIndex];
        if (cue) {
          const ch = channels.find(c => c.type === cue.effect);
          if (ch) {
            useLiveSfxStore.getState().fireEffect({
              id: `remote-${Date.now()}`,
              type: ch.type as any,
              position: [0, 0, 0],
              color: ch.color,
              intensity: ch.intensity,
              startedAt: performance.now(),
              duration: ch.duration,
            });
          }
        }
      } else if (type === 'scene-change' && typeof scene === 'number') {
        setActiveScene(scene);
      } else if (type === 'arm' && typeof armed === 'boolean') {
        setPyroArm(armed);
      } else if (type === 'channel-adjust' && channelId && field) {
        setChannels((prev: SFXChannel[]) =>
          prev.map((c: SFXChannel) => c.id === channelId ? { ...c, [field]: value } : c)
        );
      }
    };
    window.addEventListener('remote-livefx', handler);
    return () => window.removeEventListener('remote-livefx', handler);
  }, [cues, channels, setChannels]);

  // ─── Swipe gesture for mobile mode switching / close ───
  const SWIPE_MODES: FXCMode[] = ['super_dmx', 'simple_dmx', 'manual_fire', 'pyro_fire', 'auto_fire', 'check_slave', 'controllers', 'pbus', 'field_map', 'connections', 'radio', 'ma3', 'module', 'mobile_link', 'settings'];
  const touchRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const swipeHandled = useRef(false);

  const handleSwipeStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchRef.current = { x: touch.clientX, y: touch.clientY, t: Date.now() };
    swipeHandled.current = false;
  }, []);

  const handleSwipeEnd = useCallback((e: React.TouchEvent) => {
    if (!touchRef.current || swipeHandled.current) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchRef.current.x;
    const dy = touch.clientY - touchRef.current.y;
    const dt = Date.now() - touchRef.current.t;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    // Swipe down to close — threshold 80px, mostly vertical
    if (dy > 80 && absDy > absDx * 1.5 && dt < 500) {
      swipeHandled.current = true;
      onClose();
      return;
    }

    // Swipe left/right to change mode — threshold 60px, mostly horizontal
    if (absDx > 60 && absDx > absDy * 1.5 && dt < 400) {
      swipeHandled.current = true;
      const currentIdx = SWIPE_MODES.indexOf(mode);
      if (dx < 0 && currentIdx < SWIPE_MODES.length - 1) {
        setMode(SWIPE_MODES[currentIdx + 1]);
        setShowDeviceLib(false);
      } else if (dx > 0 && currentIdx > 0) {
        setMode(SWIPE_MODES[currentIdx - 1]);
        setShowDeviceLib(false);
      }
    }
    touchRef.current = null;
  }, [mode, onClose]);

  const swipeProps = isMobile ? {
    onTouchStart: handleSwipeStart,
    onTouchEnd: handleSwipeEnd,
  } : {};

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

    // Send via WebSocket relay (real UDP Art-Net) if connected
    if (relayWs.current?.readyState === WebSocket.OPEN) {
      try {
        relayWs.current.send(JSON.stringify({ action: 'dmx-batch', universes }));
      } catch (e) { console.warn('[Relay] WS send error', e); }
    }

    // Also send via edge function (for logging/diagnostics)
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
    if (armed) {
      toast.warning('⚠️ PYRO ARMED — LIVE SYSTEM', { duration: 3000 });
      if (fireone.isConnected) fireone.armAll().catch(() => {});
      if (pbus.isConnected) pbus.armAll().catch(() => {});
    } else {
      toast.info('Pyro disarmed');
      setLockedKeys(new Set());
      if (fireone.isConnected) fireone.disarmAll().catch(() => {});
      if (pbus.isConnected) pbus.disarmAll().catch(() => {});
    }
  }, [fireone, pbus]);

  const handleDmxArm = useCallback((armed: boolean) => {
    setDmxArm(armed);
    setChannels(prev => prev.map(ch => ({ ...ch, armed: ch.locked ? false : armed })));
    if (armed) toast.warning('DMX ARMED', { duration: 2000 });
    else { toast.info('DMX disarmed'); setLockedKeys(new Set()); }
  }, []);

  const handlePanic = useCallback(() => {
    // Strong haptic burst for PANIC
    haptics.panic();
    setChannels(prev => { const updated = prev.map(ch => ({ ...ch, firing: false })); sendArtNetPacket(updated); return updated; });
    fireTimers.current.forEach(t => clearTimeout(t));
    fireTimers.current.clear();
    setFiringKeys(new Set());
    setLockedKeys(new Set());
    setPyroArm(false);
    setDmxArm(false);
    setDeadmanHeld(false);
    setFiringStartTime(null);
    // E-STOP all connected hardware
    if (fireone.isConnected) fireone.emergencyStop().catch(() => {});
    if (pbus.isConnected) pbus.emergencyStop().catch(() => {});
    toast.error('🚨 PANIC — ALL STOP', { duration: 5000 });
  }, [sendArtNetPacket, fireone, pbus]);

  // ─── Fire logic ───
  const fireChannel = useCallback((id: string) => {
    // Haptic feedback on mobile
    haptics.fire();
    setChannels(prev => { const updated = prev.map(ch => ch.id === id ? { ...ch, firing: true } : ch); sendArtNetPacket(updated); return updated; });
    const ch = channels.find(c => c.id === id);
    if (ch) {
      // Route to bound hardware
      if (ch.hardwareBinding) {
        const { system, address, pin } = ch.hardwareBinding;
        if (system === 'fireone' && fireone.isConnected) {
          fireone.fireIgniter(address, pin).catch(() => {});
        } else if ((system === 'pbus' || system === 'radio') && pbus.isConnected) {
          pbus.fireCue(address, pin, ch.duration).catch(() => {});
        }
      }

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
  }, [channels, sendArtNetPacket, positions, firingStartTime, fireone, pbus]);

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
    // Haptic feedback for CUE fire
    haptics.tap();

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

  // Auto-fullscreen on mobile
  useEffect(() => {
    if (isMobile) {
      setIsFullscreen(true);
    }
  }, [isMobile]);

  // Sync browser Fullscreen API with isFullscreen state
  useEffect(() => {
    if (isFullscreen) {
      const timer = setTimeout(() => {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen?.().catch(() => {});
        }
      }, 100);
      return () => clearTimeout(timer);
    }

    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    }
  }, [isFullscreen]);

  // Lock body scroll while mobile commander is fullscreen (prevents cropped controls)
  useEffect(() => {
    if (!(isMobile && isFullscreen)) return;

    const prevOverflow = document.body.style.overflow;
    const prevOverscroll = document.body.style.overscrollBehavior;
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';

    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.overscrollBehavior = prevOverscroll;
    };
  }, [isMobile, isFullscreen]);

  // Listen for native fullscreen exit (e.g. system gesture) to sync state
  useEffect(() => {
    const onFsChange = () => {
      if (!document.fullscreenElement && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, [isFullscreen]);

  const armedCount = channels.filter(c => c.armed).length;
  const firingCount = channels.filter(c => c.firing).length;
  const enabledCount = channels.filter(c => c.enabled).length;

  // ═══════════════════════════════════════════════════════════
  // RENDER FUNCTIONS
  // ═══════════════════════════════════════════════════════════

  const mob = isMobile; // shorthand

  const renderStatusBar = (fs: boolean) => (
    <div className={cn("flex items-center justify-between border-b-2", fs && mob ? "px-3 py-2" : fs ? "px-6 py-3" : "px-2 py-1.5")} style={{ borderColor: 'hsl(220 10% 15%)', background: 'hsl(220 15% 8%)' }}>
      <div className="flex items-center gap-2">
        <div className={cn("rounded bg-gradient-to-b from-amber-500 to-amber-700 flex items-center justify-center cursor-pointer", fs && mob ? "w-6 h-6" : fs ? "w-8 h-8" : "w-5 h-5")}
          onClick={() => {
            const now = Date.now();
            if (now - showModeTapRef.current < 400) {
              setShowMode(prev => !prev);
              haptics.showMode(!showMode);
              toast.info(showMode ? '🔓 Show Mode OFF' : '🔒 SHOW MODE — Live Operation', { duration: 2000 });
              showModeTapRef.current = 0;
            } else {
              showModeTapRef.current = now;
            }
          }}>
          <Zap className={cn(fs && mob ? "w-3.5 h-3.5" : fs ? "w-5 h-5" : "w-3 h-3", "text-black")} />
        </div>
        <div>
          <div className={cn("font-black text-foreground tracking-[0.12em]", fs && mob ? "text-xs" : fs ? "text-base" : "text-[10px]")}>FXcommander™</div>
          <div className={cn("font-mono tracking-wider", fs && mob ? "text-[7px]" : fs ? "text-[9px]" : "text-[6px]", showMode ? "text-red-400/60" : "text-muted-foreground/40")}>
            {showMode ? '● SHOW MODE' : 'SHOWVEN® · V2.0'}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {/* Elapsed timer */}
        <span className={cn("font-mono text-foreground/40", fs && mob ? "text-[10px]" : fs ? "text-sm" : "text-[8px]")}>
          {formatTimecode(elapsedMs)}
        </span>
        {/* Battery — hide on mobile fs for space */}
        {!(fs && mob) && (
          <div className="flex items-center gap-1">
            <Battery className={cn(batteryVoltage > 11 ? "text-green-400/60" : "text-amber-400", fs ? "w-4 h-4" : "w-2.5 h-2.5")} />
            <span className={cn("font-mono text-muted-foreground/40", fs ? "text-[9px]" : "text-[6px]")}>{batteryVoltage.toFixed(2)}V</span>
          </div>
        )}
        {/* DMX Signal LED Indicator */}
        <div className="flex items-center gap-1" title={artNetConnected ? `DMX Signal: Active · ${settings.artNetIp}:${settings.artNetPort}` : 'DMX Signal: No Signal'}>
          {/* LED + signal bars */}
          <div className="flex items-end gap-[1px]">
            {/* Main LED */}
            <div
              className={cn(
                "rounded-full transition-colors",
                artNetConnected
                  ? "bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]"
                  : "bg-muted-foreground/20",
                fs ? "w-2.5 h-2.5" : "w-1.5 h-1.5"
              )}
              style={artNetConnected ? { animation: 'pulse 2s ease-in-out infinite' } : undefined}
            />
            {/* Signal strength bars */}
            {[0.3, 0.55, 0.8, 1].map((h, i) => (
              <div
                key={i}
                className={cn(
                  "rounded-[1px] transition-all",
                  artNetConnected
                    ? i < 3 ? "bg-green-500" : relayConnected ? "bg-green-500" : "bg-green-500/30"
                    : "bg-muted-foreground/15",
                  fs ? "w-[3px]" : "w-[2px]"
                )}
                style={{ height: fs ? `${Math.round(h * 12)}px` : `${Math.round(h * 8)}px` }}
              />
            ))}
          </div>
          <span className={cn(
            "font-mono",
            artNetConnected ? "text-green-500/70" : "text-muted-foreground/40",
            fs && mob ? "text-[7px]" : fs ? "text-[9px]" : "text-[6px]"
          )}>DMX</span>
        </div>
        <button onClick={() => relayConnected ? disconnectRelay() : connectRelay()} className="flex items-center gap-1" title={relayConnected ? 'Relay UDP conectado — clique para desconectar' : 'Clique para conectar relay UDP local'}>
          <div className={cn("rounded-full", relayConnected ? "bg-cyan-400" : "bg-muted-foreground/20", fs ? "w-2.5 h-2.5" : "w-1.5 h-1.5")} style={relayConnected ? { boxShadow: '0 0 6px rgba(0,220,255,0.5)' } : undefined} />
          <span className={cn("font-mono", relayConnected ? "text-cyan-400/70" : "text-muted-foreground/40", fs && mob ? "text-[7px]" : fs ? "text-[9px]" : "text-[6px]")}>UDP</span>
        </button>
        <div className="flex items-center gap-1">
          <Signal className={cn(pyroArm ? "text-red-500" : "text-muted-foreground/20", fs && mob ? "w-3.5 h-3.5" : fs ? "w-4 h-4" : "w-2.5 h-2.5")} />
        </div>
        <button onClick={() => setIsFullscreen(!isFullscreen)} className="text-muted-foreground/40 hover:text-foreground transition-colors rounded p-1">
          {isFullscreen ? <Minimize2 className={cn(fs && mob ? "w-5 h-5" : fs ? "w-4 h-4" : "w-3 h-3")} /> : <Maximize2 className={cn(fs ? "w-4 h-4" : "w-3 h-3")} />}
        </button>
        {!isFullscreen && <button onClick={onClose} className="text-muted-foreground/30 hover:text-foreground p-0.5 rounded transition-colors text-xs ml-1">✕</button>}
      </div>
    </div>
  );

  const renderArmBar = (fs: boolean) => (
    <>
      <div className={cn(
        "border-b transition-colors",
        fs && mob ? "px-3 py-2 flex flex-col gap-2" : "flex items-center gap-3",
        !fs || !mob ? (fs ? "px-6 py-2.5" : "px-2 py-1") : "",
        (pyroArm || dmxArm) ? "border-red-800/30" : "border-border/15"
      )} style={{ background: (pyroArm || dmxArm) ? 'hsl(0 40% 8%)' : 'hsl(220 12% 7%)' }}>
        {/* On mobile fullscreen, stack PYRO + DMX horizontally but bigger, DEADMAN below */}
        <div className={cn(fs && mob ? "flex gap-2" : "contents")}>
          <button onClick={() => handlePyroArm(!pyroArm)}
            className={cn(
              "flex items-center justify-center gap-2 rounded border-2 font-black uppercase transition-all",
              fs && mob ? "flex-1 py-3.5 text-[11px] tracking-[0.15em]" : fs ? "flex-1 py-3 text-sm tracking-[0.2em]" : "flex-1 py-1.5 text-[9px] tracking-[0.15em]",
              pyroArm ? "bg-red-600/20 border-red-500/60 text-red-400" : "bg-[hsl(220_10%_10%)] border-border/20 text-muted-foreground/40 hover:border-border/40"
            )} style={pyroArm ? { boxShadow: 'inset 0 0 12px rgba(255,50,30,0.1)' } : undefined}>
            <Shield className={cn(fs && mob ? "w-4 h-4" : fs ? "w-5 h-5" : "w-3 h-3")} />
            {pyroArm ? 'PYRO ●' : 'PYRO'}
          </button>
          <button onClick={() => handleDmxArm(!dmxArm)}
            className={cn(
              "flex items-center justify-center gap-2 rounded border-2 font-black uppercase transition-all",
              fs && mob ? "flex-1 py-3.5 text-[11px] tracking-[0.15em]" : fs ? "flex-1 py-3 text-sm tracking-[0.2em]" : "flex-1 py-1.5 text-[9px] tracking-[0.15em]",
              dmxArm ? "bg-amber-600/20 border-amber-500/60 text-amber-400" : "bg-[hsl(220_10%_10%)] border-border/20 text-muted-foreground/40 hover:border-border/40"
            )} style={dmxArm ? { boxShadow: 'inset 0 0 12px rgba(255,180,30,0.1)' } : undefined}>
            <Radio className={cn(fs && mob ? "w-4 h-4" : fs ? "w-5 h-5" : "w-3 h-3")} />
            {dmxArm ? 'DMX ●' : 'DMX'}
          </button>
        </div>
        {/* DEADMAN — full width on mobile */}
        <button
          onMouseDown={() => setDeadmanHeld(true)}
          onMouseUp={() => setDeadmanHeld(false)}
          onMouseLeave={() => setDeadmanHeld(false)}
          onTouchStart={(e) => { e.preventDefault(); setDeadmanHeld(true); }}
          onTouchEnd={(e) => { e.preventDefault(); setDeadmanHeld(false); }}
          className={cn(
            "flex items-center justify-center rounded border-2 font-black uppercase transition-all gap-2",
            fs && mob ? "w-full py-3 text-[10px]" : fs ? "w-16 py-3 text-[10px] shrink-0" : "w-10 py-1.5 text-[7px] shrink-0",
            deadmanHeld ? "bg-green-600/30 border-green-500/60 text-green-400" : "bg-[hsl(220_10%_10%)] border-border/20 text-muted-foreground/30"
          )}>
          <Hand className={cn(fs && mob ? "w-5 h-5" : fs ? "w-4 h-4" : "w-3 h-3")} />
          {fs && mob && <span>DEADMAN</span>}
        </button>
      </div>
      {(pyroArm || dmxArm) && (
        <div className={cn(
          "text-center font-black uppercase animate-pulse",
          fs && mob ? "px-3 py-1 text-[10px] tracking-[0.25em]" : fs ? "px-4 py-1.5 text-xs tracking-[0.3em]" : "px-2 py-0.5 text-[8px] tracking-[0.25em]",
          pyroArm && dmxArm ? "text-red-400" : pyroArm ? "text-red-400" : "text-amber-400"
        )} style={{ background: pyroArm ? 'hsl(0 50% 8%)' : 'hsl(40 40% 8%)' }}>
          {pyroArm && dmxArm ? '⚠ DMX + PYRO ARMED ⚠' : pyroArm ? '⚠ PYRO ARMED ⚠' : 'DMX ARMED'}
        </div>
      )}
      {/* ── Lockout Risk Groups (Finale 3D) ── */}
      {(pyroArm) && (
        <LockoutPanel fs={fs} mob={mob} />
      )}
    </>
  );

  const renderCueKeys = (fs: boolean) => (
    <div className={cn("border-b border-border/15", fs && mob ? "px-2 py-2" : fs ? "px-6 py-4" : "px-1.5 py-1.5")} style={{ background: 'hsl(220 12% 6%)' }}>
      {/* Pagination */}
      <div className={cn("flex items-center justify-between", fs && mob ? "mb-1.5" : fs ? "mb-2" : "mb-0.5")}>
        <div className="flex items-center gap-1">
          <button onClick={() => setCuePage(Math.max(0, cuePage - 1))} disabled={cuePage === 0}
            className={cn("rounded text-muted-foreground/30 hover:text-foreground/60 disabled:opacity-20 transition-colors", fs && mob ? "p-1.5" : fs ? "p-1" : "p-0.5")}>
            <ChevronLeft className={cn(fs ? "w-4 h-4" : "w-3 h-3")} />
          </button>
          <span className={cn("font-mono text-muted-foreground/40", fs && mob ? "text-[8px]" : fs ? "text-[9px]" : "text-[6px]")}>
            {cuePage * CUES_PER_PAGE + 1}-{Math.min((cuePage + 1) * CUES_PER_PAGE, 128)}
          </span>
          <button onClick={() => setCuePage(Math.min(15, cuePage + 1))}
            className={cn("rounded text-muted-foreground/30 hover:text-foreground/60 transition-colors", fs && mob ? "p-1.5" : fs ? "p-1" : "p-0.5")}>
            <ChevronRight className={cn(fs ? "w-4 h-4" : "w-3 h-3")} />
          </button>
        </div>
        <span className={cn("font-mono text-muted-foreground/20", fs && mob ? "text-[7px]" : fs ? "text-[8px]" : "text-[5px]")}>
          Page {cuePage + 1}/16
        </span>
      </div>
      {/* 4 cols on mobile fullscreen, 8 cols on desktop */}
      <div className={cn("grid", fs && mob ? "grid-cols-4 gap-1.5" : fs ? "grid-cols-8 gap-2" : "grid-cols-8 gap-0.5")}>
        {Array.from({ length: CUES_PER_PAGE }).map((_, i) => {
          const globalIndex = i + pageStart;
          const cue = pageCues.find(c => c.keyIndex === globalIndex);
          return (
            <CueKey key={i} index={i} cue={cue} firing={firingKeys.has(i)}
              onPress={() => fireCueKey(i)} onRelease={() => stopCueKey(i)}
              onLongPress={() => toggleKeyMode(i)}
              pyroArmed={pyroArm} dmxArmed={dmxArm} fs={fs} mobile={mob} />
          );
        })}
      </div>
    </div>
  );

  const renderSceneModeBar = (fs: boolean) => (
    <div className={cn("flex items-center border-b border-border/15", fs && mob ? "flex-col" : "")} style={{ background: 'hsl(220 10% 7%)' }}>
      {/* Scenes */}
      <div className={cn("flex", fs && mob ? "w-full border-b border-border/10" : "")}>
        {[0, 1, 2, 3].map(s => (
          <button key={s} onClick={() => setActiveScene(s)} disabled={pyroArm}
            className={cn(
              "font-bold uppercase tracking-wider transition-all border-b-2",
              fs && mob ? "flex-1 px-3 py-2.5 text-[10px]" : fs ? "px-5 py-2.5 text-xs" : "px-2.5 py-1.5 text-[7px]",
              activeScene === s ? "text-primary border-primary bg-primary/5" : "text-muted-foreground/30 border-transparent hover:text-muted-foreground/60"
            )}>S{s}</button>
        ))}
      </div>
      {!mob && <div className="flex-1" />}
      {/* Mode tabs — horizontally scrollable on mobile */}
      <div className={cn("flex overflow-x-auto scrollbar-thin scrollbar-thumb-border/30 scrollbar-track-transparent", fs && mob ? "w-full pb-1" : fs ? "pr-3 gap-0.5" : "pr-1")}>
        {([
          // DMX modes
          { key: 'super_dmx' as FXCMode, label: 'Super' },
          { key: 'simple_dmx' as FXCMode, label: 'Simple' },
          { key: 'manual_fire' as FXCMode, label: 'Manual' },
          // Fire modes
          { key: 'pyro_fire' as FXCMode, label: '🔥 Pyro' },
          { key: 'auto_fire' as FXCMode, label: 'Auto' },
          { key: 'check_slave' as FXCMode, label: 'Check' },
          // Hardware
          { key: 'controllers' as FXCMode, label: '🎛 HW' },
          { key: 'pbus' as FXCMode, label: '📡 PBUS' },
          { key: 'ma3' as FXCMode, label: '🎛 MA3' },
          { key: 'field_map' as FXCMode, label: '🗺 Map' },
          { key: 'connections' as FXCMode, label: '🔌 Conn' },
          { key: 'mobile_link' as FXCMode, label: '📡 Link' },
          { key: 'settings' as FXCMode, label: '⚙' },
        ]).map(m => (
          <button key={m.key} onClick={() => { setMode(m.key); setShowDeviceLib(false); }}
            className={cn(
              "font-bold uppercase tracking-wider transition-all whitespace-nowrap shrink-0",
              fs && mob ? "px-3 py-2.5 text-[10px]" : fs ? "px-3 py-2.5 text-[9px]" : "px-1.5 py-1.5 text-[6px]",
              mode === m.key ? "text-foreground/80" : "text-muted-foreground/25 hover:text-muted-foreground/50"
            )}>{m.label}</button>
        ))}
      </div>
    </div>
  );

  const renderPanic = (fs: boolean) => (
    <div className="border-t-2 border-border/20" style={{ background: 'hsl(220 12% 6%)' }}>
      <div className={cn(fs && mob ? "px-3 py-2" : fs ? "px-6 py-3" : "px-2 py-1.5")}>
        <button onClick={handlePanic}
          className={cn(
            "w-full rounded-lg font-black uppercase transition-all",
            "bg-gradient-to-b from-red-700 to-red-900 text-white/90",
            "hover:from-red-600 hover:to-red-800 active:scale-[0.97]",
            "border-2 border-red-600/50",
            "flex items-center justify-center gap-2",
            fs && mob ? "h-14 text-base tracking-[0.25em]" : fs ? "h-16 text-lg tracking-[0.3em]" : "h-10 text-[11px] tracking-[0.25em]"
          )} style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1)' }}>
          <AlertTriangle className={cn(fs && mob ? "w-5 h-5" : fs ? "w-6 h-6" : "w-4 h-4")} />
          PANIC
        </button>
      </div>
      <div className={cn("flex items-center justify-between border-t border-border/10", fs && mob ? "px-3 py-1.5" : fs ? "px-6 py-2" : "px-2 py-1")}>
        <div className="flex items-center gap-2">
          <span className={cn("font-mono text-muted-foreground/30", fs && mob ? "text-[8px]" : fs ? "text-[9px]" : "text-[6px]")}>{channels.length}CH · {armedCount}RDY</span>
          {firingCount > 0 && <span className={cn("font-mono text-red-400 font-bold animate-pulse", fs ? "text-[9px]" : "text-[6px]")}>🔥 {firingCount}</span>}
        </div>
        <div className="flex items-center gap-1.5">
          {fireone.isConnected && <span className={cn("font-mono text-[6px]", fs ? "text-[8px]" : "")}>
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 mr-0.5" />F1
          </span>}
          {pbus.isConnected && <span className={cn("font-mono text-[6px]", fs ? "text-[8px]" : "")}>
            <span className={cn("inline-block w-1.5 h-1.5 rounded-full mr-0.5", pbus.connectionPath === 'radio' ? "bg-amber-400" : "bg-green-500")} />PB
          </span>}
          <span className={cn("font-mono", fs && mob ? "text-[7px]" : fs ? "text-[9px]" : "text-[6px]", artNetConnected ? "text-green-500/60" : "text-muted-foreground/20")}>
            {artNetConnected ? '● Art-Net' : '○ Off'}
          </span>
        </div>
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

  const renderManualFire = (fs: boolean) => {
    const isMobileFire = fs && mob;
    return (
      <div className={cn("space-y-2", isMobileFire ? "p-3" : fs ? "p-4" : "p-2")}>
        <div className="flex items-center justify-between px-1">
          <span className={cn("font-bold text-muted-foreground/40 uppercase tracking-wider", isMobileFire ? "text-[10px]" : fs ? "text-[9px]" : "text-[7px]")}>
            Pyro Manual Fire
          </span>
          <span className={cn("font-mono text-foreground/40", isMobileFire ? "text-sm" : fs ? "text-xs" : "text-[8px]")}>{formatTimecode(elapsedMs)}</span>
        </div>
        {(dmxArm || pyroArm) && (
          <button
            onMouseDown={() => { if (deadmanHeld || !settings.pyroArmRequired) channels.filter(ch => ch.enabled).forEach(ch => fireChannel(ch.id)); }}
            onMouseUp={() => channels.forEach(ch => stopChannel(ch.id))}
            onTouchStart={(e) => { e.preventDefault(); if (deadmanHeld || !settings.pyroArmRequired) channels.filter(ch => ch.enabled).forEach(ch => fireChannel(ch.id)); }}
            onTouchEnd={(e) => { e.preventDefault(); channels.forEach(ch => stopChannel(ch.id)); }}
            disabled={settings.pyroArmRequired && !deadmanHeld}
            className={cn(
              "w-full rounded-xl font-black uppercase transition-all border-2",
              isMobileFire ? "py-5 text-lg tracking-[0.3em]" : fs ? "py-5 text-base tracking-[0.3em]" : "py-3 text-[12px] tracking-[0.3em]",
              deadmanHeld || !settings.pyroArmRequired
                ? "bg-gradient-to-b from-red-600 via-red-700 to-red-800 text-white border-red-500/40 hover:from-red-500"
                : "bg-[hsl(220_10%_10%)] text-muted-foreground/20 border-border/10"
            )} style={deadmanHeld ? { boxShadow: '0 0 24px rgba(239,68,68,0.3)' } : undefined}>
            ⚡ FIRE ALL ({enabledCount})
          </button>
        )}
        {settings.pyroArmRequired && !deadmanHeld && (pyroArm || dmxArm) && (
          <div className={cn("text-center text-amber-400/50 font-bold uppercase", isMobileFire ? "text-xs" : fs ? "text-[10px]" : "text-[7px]")}>
            Hold DEADMAN to enable firing
          </div>
        )}
        {/* 2 cols on mobile, 4 on desktop — bigger touch targets on mobile */}
        <div className={cn("grid gap-2", isMobileFire ? "grid-cols-2 gap-3" : fs ? "grid-cols-4 gap-1.5" : "grid-cols-2 gap-1.5")}>
          {channels.map((ch, i) => {
            const sfxType = SFX_TYPES.find(t => t.key === ch.type);
            const canFire = (dmxArm || pyroArm) && ch.enabled && (deadmanHeld || !settings.pyroArmRequired);
            return (
              <button key={ch.id}
                onMouseDown={() => canFire && fireChannel(ch.id)}
                onMouseUp={() => stopChannel(ch.id)}
                onMouseLeave={() => ch.firing && stopChannel(ch.id)}
                onTouchStart={(e) => { e.preventDefault(); if (canFire) fireChannel(ch.id); }}
                onTouchEnd={(e) => { e.preventDefault(); stopChannel(ch.id); }}
                disabled={!canFire && !ch.firing}
                className={cn(
                  "relative flex flex-col items-center justify-center rounded-xl border-2 transition-all select-none",
                  isMobileFire ? "min-h-[96px] py-4 rounded-2xl" : fs ? "py-5" : "py-3",
                  ch.firing
                    ? "bg-red-600/30 border-red-400 scale-[0.95] manual-fire-haptic"
                    : canFire
                      ? "bg-[hsl(220_10%_12%)] border-border/30 hover:bg-[hsl(220_10%_16%)] active:scale-[0.93] active:bg-red-700/40"
                      : "bg-[hsl(220_10%_8%)] border-border/10 opacity-40"
                )}
                style={ch.firing ? {
                  boxShadow: '0 0 20px rgba(255,60,30,0.4), inset 0 0 16px rgba(255,60,30,0.15)',
                } : undefined}
              >
                {/* Haptic ripple overlay when firing */}
                {ch.firing && (
                  <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none">
                    <div className="absolute inset-0 animate-manual-fire-pulse bg-gradient-radial from-red-500/20 to-transparent" />
                    <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-red-400 to-transparent animate-pulse" />
                  </div>
                )}
                <span className={cn(
                  "absolute font-mono text-muted-foreground/30",
                  isMobileFire ? "text-[10px] top-1.5 left-2.5" : fs ? "text-[8px] top-0.5 left-1" : "text-[6px] top-0.5 left-1"
                )}>{String(i + 1).padStart(2, '0')}</span>
                {sfxType && <sfxType.icon className={cn(
                  isMobileFire ? "w-8 h-8 mb-1" : fs ? "w-6 h-6 mb-0.5" : "w-4 h-4 mb-0.5",
                  ch.firing && "animate-pulse"
                )} style={{ color: ch.firing ? '#ff4444' : sfxType.color }} />}
                <span className={cn(
                  "font-bold uppercase truncate w-full text-center px-1",
                  isMobileFire ? "text-sm" : fs ? "text-xs" : "text-[8px]",
                  ch.firing ? "text-red-300" : "text-foreground/70"
                )}>
                  {ch.name}
                </span>
                <span className={cn(
                  "font-mono text-muted-foreground/30",
                  isMobileFire ? "text-[10px] mt-0.5" : fs ? "text-[8px]" : "text-[6px]"
                )}>{ch.duration}ms</span>
                {/* Firing indicator bar */}
                {ch.firing && (
                  <div className={cn(
                    "absolute bottom-0 left-0 right-0 bg-gradient-to-r from-red-600 via-orange-500 to-red-600 animate-pulse",
                    isMobileFire ? "h-1 rounded-b-2xl" : "h-0.5 rounded-b-xl"
                  )} />
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

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
      case 'pyro_fire': return <PyroFireOnePanel fs={fs} fireChannel={fireChannel} channels={channels} pyroArm={pyroArm} dmxArm={dmxArm} deadmanHeld={deadmanHeld} handlePanic={handlePanic} artNetConnected={artNetConnected} relayConnected={relayConnected} />;
      case 'check_slave': return <CheckSlavePanel fs={fs} pyroArm={pyroArm} />;
      case 'mobile_link': return <MobileLinkMode fs={fs} fireChannel={fireChannel} channels={channels} artNetConnected={artNetConnected} relayConnected={relayConnected} />;
      case 'controllers': return <VirtualControllerHub fs={fs} onSelectMode={(m) => setMode(m as FXCMode)} />;
      case 'zk6200': return <VirtualZK6200 fs={fs} />;
      case 'fxbutton': return <VirtualFXButton fs={fs} />;
      case 'field_map': return <FieldMap2D fs={fs} />;
      case 'pbus': return <PBusMonitorPanel />;
      case 'connections': return <ConnectionManagerPanel fs={fs} />;
      case 'radio': return <RadioControlPanel fs={fs} />;
      case 'ma3': return <MA3ControlPanel fs={fs} />;
      case 'module': return <VirtualIFMx32QPanel fs={fs} />;
      case 'settings': return <SettingsPanel fs={fs} settings={settings} onSettingsChange={setSettings} relayConnected={relayConnected} relayUrl={relayUrl} onRelayUrlChange={setRelayUrl} onConnectRelay={connectRelay} onDisconnectRelay={disconnectRelay} />;
      default: return renderSimpleDmx(fs);
    }
  };

  // ═══════════════════════════════════════════════════════════
  // FULLSCREEN LAYOUT
  // ═══════════════════════════════════════════════════════════
  if (isFullscreen) {
    const fullscreenContent = (
      <div
        {...swipeProps}
        className="fixed inset-x-0 top-0 z-[9999] flex h-[100dvh] w-screen flex-col select-none"
        style={{
          background: 'linear-gradient(180deg, hsl(220 15% 8%) 0%, hsl(220 12% 4%) 100%)',
          paddingBottom: mob ? 'max(env(safe-area-inset-bottom), 8px)' : undefined,
        }}
      >
        {renderStatusBar(true)}
        {!showMode && renderArmBar(true)}
        {renderCueKeys(true)}
        {!showMode && renderSceneModeBar(true)}
        {showMode ? (
          <ScrollArea className="flex-1">
            <MobileLinkMode fs={true} fireChannel={fireChannel} channels={channels} artNetConnected={artNetConnected} relayConnected={relayConnected} />
          </ScrollArea>
        ) : (
          <ScrollArea className="flex-1">{renderModeContent(true)}</ScrollArea>
        )}
        {renderPanic(true)}
      </div>
    );

    return mob ? createPortal(fullscreenContent, document.body) : fullscreenContent;
  }

  // ═══════════════════════════════════════════════════════════
  // PANEL LAYOUT — auto-fullscreen on mobile
  // ═══════════════════════════════════════════════════════════
  if (mob) {
    return (
      <div {...swipeProps} className="fixed inset-0 z-[9999] flex flex-col select-none pb-[env(safe-area-inset-bottom)]"
        style={{ background: 'linear-gradient(180deg, hsl(220 15% 8%) 0%, hsl(220 12% 4%) 100%)' }}>
        {renderStatusBar(true)}
        {!showMode && renderArmBar(true)}
        {renderCueKeys(true)}
        {!showMode && renderSceneModeBar(true)}
        {showMode ? (
          <ScrollArea className="flex-1">
            <MobileLinkMode fs={true} fireChannel={fireChannel} channels={channels} artNetConnected={artNetConnected} relayConnected={relayConnected} />
          </ScrollArea>
        ) : (
          <ScrollArea className="flex-1">{renderModeContent(true)}</ScrollArea>
        )}
        {renderPanic(true)}
      </div>
    );
  }

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
