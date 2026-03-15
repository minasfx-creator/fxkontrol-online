/**
 * Live SFX Firing Module
 * Manual trigger console for CO2 jets, fire machines, confetti/streamers,
 * and DMX-controlled fixtures with scene programmer.
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Flame, Wind, Sparkles, Zap, Play, Square, Plus, Trash2,
  AlertTriangle, Check, Radio, Lightbulb, ChevronDown, ChevronRight,
  RotateCcw, Save, Upload, Lock, Unlock, Timer, MapPinned
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  dmxChannels: number; // how many DMX channels this device uses
  armed: boolean;
  firing: boolean;
  duration: number; // burst duration in ms
  intensity: number; // 0-255
  color: string;
  locked: boolean;
  positionId?: string; // linked pyro position for 3D visualization
}

interface DMXScene {
  id: string;
  name: string;
  channels: { channelId: string; intensity: number }[];
}

interface DMXCue {
  id: string;
  sceneId: string;
  time: number; // seconds from show start
  fadeIn: number; // ms
  hold: number; // ms
  fadeOut: number; // ms
}

const SFX_TYPES: { key: SFXChannel['type']; label: string; icon: typeof Flame; color: string }[] = [
  { key: 'co2', label: 'CO₂ Jet', icon: Wind, color: 'hsl(200, 80%, 60%)' },
  { key: 'flame', label: 'Fire Machine', icon: Flame, color: 'hsl(15, 95%, 55%)' },
  { key: 'confetti', label: 'Confetti', icon: Sparkles, color: 'hsl(45, 90%, 55%)' },
  { key: 'streamer', label: 'Streamer', icon: Sparkles, color: 'hsl(280, 70%, 60%)' },
  { key: 'cryo', label: 'Cryo Jet', icon: Wind, color: 'hsl(190, 90%, 70%)' },
  { key: 'haze', label: 'Haze', icon: Wind, color: 'hsl(0, 0%, 65%)' },
  { key: 'spark', label: 'Spark Machine', icon: Zap, color: 'hsl(40, 95%, 55%)' },
  { key: 'custom', label: 'Custom DMX', icon: Lightbulb, color: 'hsl(var(--primary))' },
];

const DEFAULT_CHANNELS: SFXChannel[] = [
  { id: 'sfx-1', name: 'CO₂ Left', type: 'co2', dmxUniverse: 1, dmxAddress: 1, dmxChannels: 2, armed: false, firing: false, duration: 500, intensity: 255, color: '#4DCFFF', locked: false },
  { id: 'sfx-2', name: 'CO₂ Right', type: 'co2', dmxUniverse: 1, dmxAddress: 3, dmxChannels: 2, armed: false, firing: false, duration: 500, intensity: 255, color: '#4DCFFF', locked: false },
  { id: 'sfx-3', name: 'Flame Center', type: 'flame', dmxUniverse: 1, dmxAddress: 5, dmxChannels: 3, armed: false, firing: false, duration: 800, intensity: 200, color: '#FF6622', locked: false },
  { id: 'sfx-4', name: 'Confetti L', type: 'confetti', dmxUniverse: 1, dmxAddress: 8, dmxChannels: 1, armed: false, firing: false, duration: 2000, intensity: 255, color: '#FFD700', locked: false },
  { id: 'sfx-5', name: 'Confetti R', type: 'confetti', dmxUniverse: 1, dmxAddress: 9, dmxChannels: 1, armed: false, firing: false, duration: 2000, intensity: 255, color: '#FFD700', locked: false },
  { id: 'sfx-6', name: 'Streamer Blast', type: 'streamer', dmxUniverse: 1, dmxAddress: 10, dmxChannels: 1, armed: false, firing: false, duration: 1500, intensity: 255, color: '#AA55FF', locked: false },
];

// ─── Fire Button Component (Show Commander style) ───
function FireButton({ channel, onFire, onStop }: { channel: SFXChannel; onFire: (id: string) => void; onStop: (id: string) => void }) {
  const sfxType = SFX_TYPES.find(t => t.key === channel.type);
  const Icon = sfxType?.icon || Zap;

  return (
    <div className={cn(
      "relative rounded-lg border overflow-hidden transition-all",
      channel.armed ? "border-destructive/60 bg-destructive/8" : "border-border/40 bg-surface-1/60",
      channel.firing && "ring-2 ring-destructive shadow-[0_0_24px_hsl(0,80%,50%,0.3)]",
      channel.locked && "opacity-40 pointer-events-none"
    )}>
      {/* Top bar with color accent */}
      <div className="h-1 w-full" style={{ backgroundColor: channel.armed ? sfxType?.color : 'hsl(var(--muted))' }} />
      
      {/* Channel info */}
      <div className="px-2 pt-1.5 pb-1">
        <div className="flex items-center gap-1.5 mb-1">
          <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: sfxType?.color }} />
          <span className="text-[10px] font-bold truncate flex-1">{channel.name}</span>
        </div>
        <div className="flex items-center gap-2 text-[8px] font-mono-code text-muted-foreground/60">
          <span>U{channel.dmxUniverse}.{channel.dmxAddress}</span>
          <span>{channel.duration}ms</span>
          <span>{Math.round(channel.intensity / 2.55)}%</span>
        </div>
      </div>

      {/* Fire button — large touch target */}
      <div className="px-2 pb-2">
        <button
          onMouseDown={() => channel.armed && onFire(channel.id)}
          onMouseUp={() => onStop(channel.id)}
          onMouseLeave={() => channel.firing && onStop(channel.id)}
          onTouchStart={() => channel.armed && onFire(channel.id)}
          onTouchEnd={() => onStop(channel.id)}
          disabled={!channel.armed || channel.locked}
          className={cn(
            "w-full h-11 rounded-md flex items-center justify-center gap-2 font-bold text-[12px] uppercase tracking-[0.2em] transition-all select-none",
            channel.armed
              ? channel.firing
                ? "bg-destructive text-destructive-foreground shadow-[0_0_30px_hsl(0,80%,50%,0.5)] scale-[0.97]"
                : "bg-gradient-to-b from-destructive/90 to-destructive text-destructive-foreground hover:from-destructive hover:to-destructive active:scale-[0.97] shadow-lg"
              : "bg-surface-2 text-muted-foreground/50 cursor-not-allowed"
          )}
        >
          {channel.firing ? (
            <>
              <Flame className="w-4 h-4 animate-pulse" />
              FIRING
            </>
          ) : channel.armed ? (
            <>
              <Zap className="w-4 h-4" />
              FIRE
            </>
          ) : (
            'SAFE'
          )}
        </button>
      </div>

      {/* Intensity bar */}
      <div className="h-1 w-full bg-surface-0">
        <div
          className="h-full transition-all duration-100"
          style={{
            width: `${(channel.intensity / 255) * 100}%`,
            backgroundColor: channel.firing ? sfxType?.color : `${sfxType?.color}66`,
          }}
        />
      </div>
    </div>
  );
}

// ─── Main Panel ───
export default function LiveFiringPanel({ onClose }: { onClose: () => void }) {
  const { isPlaying, currentTime, setPlaying, positions } = useProjectStore();
  const [channels, setChannels] = useState<SFXChannel[]>(DEFAULT_CHANNELS);
  const [scenes, setScenes] = useState<DMXScene[]>([]);
  const [cues, setCues] = useState<DMXCue[]>([]);
  const [masterArm, setMasterArm] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [newSceneName, setNewSceneName] = useState('');
  const [section, setSection] = useState<'triggers' | 'programmer' | 'cues'>('triggers');
  const [artNetConnected, setArtNetConnected] = useState(false);
  const [artNetIp, setArtNetIp] = useState('255.255.255.255');
  const [artNetPort, setArtNetPort] = useState(6454);
  const [syncEnabled, setSyncEnabled] = useState(true);
  const [cueRunning, setCueRunning] = useState(false);
  const [activeCueId, setActiveCueId] = useState<string | null>(null);
  const sequenceRef = useRef(0);
  const fireTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const firedCuesRef = useRef<Set<string>>(new Set());

  // Build DMX universe buffer from channels and send via Art-Net edge function
  const sendArtNetPacket = useCallback(async (currentChannels: SFXChannel[]) => {
    // Group channels by universe
    const universeMap = new Map<number, number[]>();
    for (const ch of currentChannels) {
      if (!universeMap.has(ch.dmxUniverse)) {
        universeMap.set(ch.dmxUniverse, new Array(512).fill(0));
      }
      const buf = universeMap.get(ch.dmxUniverse)!;
      const baseAddr = ch.dmxAddress - 1; // 0-indexed
      // Set intensity on all DMX channels for this fixture
      const val = ch.firing ? ch.intensity : 0;
      for (let i = 0; i < ch.dmxChannels; i++) {
        if (baseAddr + i < 512) buf[baseAddr + i] = val;
      }
    }

    const universes = Array.from(universeMap.entries()).map(([uniId, buf]) => ({
      universe: uniId % 16,
      subnet: Math.floor(uniId / 16) % 16,
      net: Math.floor(uniId / 256),
      channels: buf,
      sequence: (sequenceRef.current++) & 0xFF,
    }));

    try {
      const { data, error } = await supabase.functions.invoke('artnet-bridge', {
        body: { action: 'send', universes, targetIp: artNetIp, targetPort: artNetPort },
      });
      if (error) throw error;
      setArtNetConnected(true);
      return data;
    } catch (e: any) {
      setArtNetConnected(false);
      console.error('Art-Net send failed:', e);
    }
  }, [artNetIp, artNetPort]);

  // Master arm toggles all channels
  const handleMasterArm = useCallback((armed: boolean) => {
    setMasterArm(armed);
    setChannels(prev => prev.map(ch => ({ ...ch, armed: ch.locked ? false : armed })));
    if (armed) {
      toast.warning('⚠️ SYSTEM ARMED — All channels ready to fire', { duration: 3000 });
    } else {
      toast.info('System disarmed');
    }
  }, []);

  // Fire a channel — send DMX packet with intensity ON + 3D visualization
  const handleFire = useCallback((id: string) => {
    setChannels(prev => {
      const updated = prev.map(ch => ch.id === id ? { ...ch, firing: true } : ch);
      // Send Art-Net packet with updated state
      sendArtNetPacket(updated);
      return updated;
    });

    const ch = channels.find(c => c.id === id);
    if (ch) {
      toast(`🔥 FIRED: ${ch.name}`, { description: `DMX U${ch.dmxUniverse}.${ch.dmxAddress} @ ${ch.intensity}/255 → Art-Net` });

      // Resolve 3D position from linked pyro position, or fallback to spread layout
      let pos3d: [number, number, number];
      if (ch.positionId) {
        const linkedPos = positions.find(p => p.id === ch.positionId);
        if (linkedPos) {
          pos3d = [linkedPos.x, linkedPos.y, linkedPos.z];
        } else {
          const idx = channels.indexOf(ch);
          pos3d = [(idx - (channels.length - 1) / 2) * 8, 0, 0];
        }
      } else {
        const idx = channels.indexOf(ch);
        pos3d = [(idx - (channels.length - 1) / 2) * 8, 0, 0];
      }

      useLiveSfxStore.getState().fireEffect({
        id: ch.id,
        type: ch.type,
        position: pos3d,
        color: ch.color,
        intensity: ch.intensity,
        startedAt: performance.now(),
        duration: ch.duration,
      });
    }

    // Auto-stop after duration
    const channel = channels.find(c => c.id === id);
    if (channel) {
      const timer = setTimeout(() => {
        setChannels(prev => {
          const updated = prev.map(ch => ch.id === id ? { ...ch, firing: false } : ch);
          sendArtNetPacket(updated);
          return updated;
        });
        fireTimers.current.delete(id);
      }, channel.duration);
      fireTimers.current.set(id, timer);
    }
  }, [channels, sendArtNetPacket]);

  // Stop firing — send DMX packet with intensity OFF
  const handleStop = useCallback((id: string) => {
    const timer = fireTimers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      fireTimers.current.delete(id);
    }
    setChannels(prev => {
      const updated = prev.map(ch => ch.id === id ? { ...ch, firing: false } : ch);
      sendArtNetPacket(updated);
      return updated;
    });
  }, [sendArtNetPacket]);

  // Add new channel
  const addChannel = useCallback((type: SFXChannel['type']) => {
    const sfxType = SFX_TYPES.find(t => t.key === type);
    const maxAddr = Math.max(0, ...channels.map(c => c.dmxAddress + c.dmxChannels));
    const newCh: SFXChannel = {
      id: `sfx-${Date.now()}`,
      name: `${sfxType?.label || 'Device'} ${channels.length + 1}`,
      type,
      dmxUniverse: 1,
      dmxAddress: maxAddr || 1,
      dmxChannels: type === 'flame' ? 3 : type === 'co2' ? 2 : 1,
      armed: masterArm,
      firing: false,
      duration: type === 'flame' ? 800 : type === 'confetti' ? 2000 : 500,
      intensity: 255,
      color: sfxType?.color || '#fff',
      locked: false,
    };
    setChannels(prev => [...prev, newCh]);
  }, [channels, masterArm]);

  // Update channel property
  const updateChannel = useCallback((id: string, updates: Partial<SFXChannel>) => {
    setChannels(prev => prev.map(ch => ch.id === id ? { ...ch, ...updates } : ch));
  }, []);

  // Delete channel
  const deleteChannel = useCallback((id: string) => {
    setChannels(prev => prev.filter(ch => ch.id !== id));
  }, []);

  // Save current intensities as a scene
  const saveScene = useCallback(() => {
    if (!newSceneName.trim()) return;
    const scene: DMXScene = {
      id: `scene-${Date.now()}`,
      name: newSceneName,
      channels: channels.map(ch => ({ channelId: ch.id, intensity: ch.intensity })),
    };
    setScenes(prev => [...prev, scene]);
    setNewSceneName('');
    toast.success(`Scene "${scene.name}" saved`);
  }, [newSceneName, channels]);

  // Recall a scene
  const recallScene = useCallback((sceneId: string) => {
    const scene = scenes.find(s => s.id === sceneId);
    if (!scene) return;
    setChannels(prev => prev.map(ch => {
      const saved = scene.channels.find(sc => sc.channelId === ch.id);
      return saved ? { ...ch, intensity: saved.intensity } : ch;
    }));
    toast.info(`Scene "${scene.name}" recalled`);
  }, [scenes]);

  // Fire all armed
  const fireAll = useCallback(() => {
    channels.filter(ch => ch.armed && !ch.locked).forEach(ch => handleFire(ch.id));
  }, [channels, handleFire]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      fireTimers.current.forEach(timer => clearTimeout(timer));
    };
  }, []);

  // Reset fired cues when playback restarts or time rewinds
  useEffect(() => {
    if (!isPlaying) {
      firedCuesRef.current.clear();
      setCueRunning(false);
      setActiveCueId(null);
    }
  }, [isPlaying]);

  // ── Timeline sync: fire cues automatically during playback ──
  useEffect(() => {
    if (!syncEnabled || !isPlaying || !masterArm || cues.length === 0) return;

    setCueRunning(true);

    for (const cue of cues) {
      if (firedCuesRef.current.has(cue.id)) continue;

      const scene = scenes.find(s => s.id === cue.sceneId);
      if (!scene) continue;

      // Check if current time has crossed the cue trigger point
      const cueTotalDuration = (cue.fadeIn + cue.hold + cue.fadeOut) / 1000;
      if (currentTime >= cue.time && currentTime < cue.time + cueTotalDuration) {
        firedCuesRef.current.add(cue.id);
        setActiveCueId(cue.id);

        // Apply scene intensities to channels and fire
        setChannels(prev => {
          const updated = prev.map(ch => {
            const sceneCh = scene.channels.find(sc => sc.channelId === ch.id);
            if (!sceneCh || ch.locked) return ch;

            // Calculate fade envelope
            const elapsed = (currentTime - cue.time) * 1000; // ms
            let envelope = 1;
            if (elapsed < cue.fadeIn) {
              envelope = elapsed / cue.fadeIn;
            } else if (elapsed > cue.fadeIn + cue.hold) {
              const fadeElapsed = elapsed - cue.fadeIn - cue.hold;
              envelope = Math.max(0, 1 - fadeElapsed / cue.fadeOut);
            }

            return {
              ...ch,
              intensity: Math.round(sceneCh.intensity * envelope),
              firing: true,
            };
          });
          sendArtNetPacket(updated);
          return updated;
        });

        // Schedule stop after full cue duration
        const remaining = (cue.time + cueTotalDuration - currentTime) * 1000;
        setTimeout(() => {
          setChannels(prev => {
            const updated = prev.map(ch => {
              const sceneCh = scene.channels.find(sc => sc.channelId === ch.id);
              if (!sceneCh) return ch;
              return { ...ch, firing: false };
            });
            sendArtNetPacket(updated);
            return updated;
          });
          setActiveCueId(null);
        }, Math.max(50, remaining));

        toast(`📋 CUE: ${scene.name}`, {
          description: `T=${cue.time.toFixed(1)}s · Fade ${cue.fadeIn}ms → Hold ${cue.hold}ms → Out ${cue.fadeOut}ms`,
        });
      }
    }
  }, [currentTime, isPlaying, syncEnabled, masterArm, cues, scenes, sendArtNetPacket]);

  const armedCount = channels.filter(c => c.armed).length;
  const firingCount = channels.filter(c => c.firing).length;
  const selected = selectedChannel ? channels.find(c => c.id === selectedChannel) : null;

  return (
    <div className="h-full flex flex-col bg-card/95 backdrop-blur-sm border-r border-border/60 overflow-hidden">
      {/* Header — Show Commander style */}
      <div className="px-3 pt-3 pb-2 border-b border-border/40">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-6 h-6 rounded-md flex items-center justify-center transition-all",
              masterArm ? "bg-destructive/20 shadow-[0_0_12px_hsl(0,80%,50%,0.3)]" : "bg-surface-2"
            )}>
              <Zap className={cn("w-3.5 h-3.5", masterArm ? "text-destructive" : "text-muted-foreground")} />
            </div>
            <div>
              <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] font-display">SFX Console</h2>
              <p className="text-[8px] text-muted-foreground font-mono-code">Show Commander</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-surface-3 transition-colors">✕</button>
        </div>

        {/* Master ARM — prominent toggle */}
        <button
          onClick={() => handleMasterArm(!masterArm)}
          className={cn(
            "w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border-2 font-bold text-[12px] uppercase tracking-[0.2em] transition-all",
            masterArm
              ? "border-destructive bg-destructive/15 text-destructive shadow-[0_0_20px_hsl(0,80%,50%,0.2)] animate-pulse"
              : "border-border/60 bg-surface-1 text-muted-foreground hover:border-destructive/40 hover:text-destructive/80"
          )}
        >
          <AlertTriangle className="w-4 h-4" />
          {masterArm ? '⚠ SYSTEM ARMED' : 'ARM SYSTEM'}
        </button>

        {/* Status bar */}
        <div className="flex items-center gap-2 mt-2 px-2 py-1.5 rounded-md bg-surface-1/60 border border-border/30">
          <div className="flex items-center gap-1.5 flex-1">
            <span className="text-[9px] font-mono-code text-muted-foreground">{channels.length} CH</span>
            <span className="text-[9px] font-mono-code text-accent font-bold">{armedCount} RDY</span>
            {firingCount > 0 && (
              <span className="text-[9px] font-mono-code text-destructive font-bold animate-pulse">🔥 {firingCount}</span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <Radio className={cn("w-3 h-3", syncEnabled ? "text-primary" : "text-muted-foreground/40")} />
            <Switch checked={syncEnabled} onCheckedChange={setSyncEnabled} />
          </div>
        </div>

        {/* Section tabs — cleaner */}
        <div className="flex gap-0.5 mt-2 bg-surface-1/60 rounded-md p-0.5">
          {(['triggers', 'programmer', 'cues'] as const).map(s => (
            <button
              key={s}
              onClick={() => setSection(s)}
              className={cn(
                "flex-1 py-1.5 text-[9px] font-bold uppercase tracking-[0.1em] rounded transition-all",
                section === s 
                  ? "bg-surface-3 text-foreground shadow-sm" 
                  : "text-muted-foreground/60 hover:text-foreground"
              )}
            >
              {s === 'triggers' ? 'Triggers' : s === 'programmer' ? 'DMX Prog' : 'Cue Stack'}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {/* ── TRIGGERS ── */}
        {section === 'triggers' && (
          <>
            {/* Fire All button — Show Commander style */}
            {masterArm && (
              <button
                onClick={fireAll}
                className="w-full py-3 rounded-lg bg-gradient-to-b from-destructive to-red-700 text-destructive-foreground font-bold text-[13px] uppercase tracking-[0.25em] hover:shadow-[0_0_40px_hsl(0,80%,50%,0.5)] active:scale-[0.97] transition-all border-2 border-destructive/60"
              >
                ⚡ FIRE ALL ({armedCount})
              </button>
            )}

            {/* Channel grid */}
            <div className="grid grid-cols-2 gap-1.5">
              {channels.map(ch => (
                <FireButton
                  key={ch.id}
                  channel={ch}
                  onFire={handleFire}
                  onStop={handleStop}
                />
              ))}
            </div>

            {/* Add device */}
            <div className="pt-2 border-t border-border/30">
              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Add Device</p>
              <div className="grid grid-cols-4 gap-1">
                {SFX_TYPES.map(t => (
                  <button
                    key={t.key}
                    onClick={() => addChannel(t.key)}
                    className="flex flex-col items-center gap-0.5 p-1.5 rounded-md bg-muted/30 hover:bg-muted/60 active:scale-95 transition-all"
                  >
                    <t.icon className="w-3.5 h-3.5" style={{ color: t.color }} />
                    <span className="text-[7px] font-bold uppercase truncate w-full text-center text-muted-foreground">{t.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── DMX PROGRAMMER ── */}
        {section === 'programmer' && (
          <>
            <p className="text-[9px] text-muted-foreground">Adjust intensity per channel and save as scene.</p>

            {channels.map(ch => {
              const sfxType = SFX_TYPES.find(t => t.key === ch.type);
              return (
                <div key={ch.id} className="space-y-1 p-1.5 rounded-md bg-muted/20 border border-border/30">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: sfxType?.color }} />
                    <span className="text-[10px] font-medium flex-1 truncate">{ch.name}</span>
                    <Slider
                      value={[ch.intensity]}
                      min={0}
                      max={255}
                      step={1}
                      onValueChange={([v]) => updateChannel(ch.id, { intensity: v })}
                      className="w-24"
                    />
                    <span className="text-[9px] font-mono text-muted-foreground w-8 text-right">{ch.intensity}</span>
                    <button
                      onClick={() => updateChannel(ch.id, { locked: !ch.locked })}
                      className="p-0.5 text-muted-foreground hover:text-foreground"
                    >
                      {ch.locked ? <Lock className="w-3 h-3 text-destructive" /> : <Unlock className="w-3 h-3" />}
                    </button>
                  </div>
                  {/* Position link */}
                  <div className="flex items-center gap-1.5 pl-4">
                    <MapPinned className="w-3 h-3 text-muted-foreground" />
                    <Select
                      value={ch.positionId || '__none__'}
                      onValueChange={(v) => updateChannel(ch.id, { positionId: v === '__none__' ? undefined : v })}
                    >
                      <SelectTrigger className="h-5 text-[9px] flex-1 border-border/30 bg-transparent">
                        <SelectValue placeholder="No position" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">
                          <span className="text-muted-foreground">Auto (spread)</span>
                        </SelectItem>
                        {positions.map(p => (
                          <SelectItem key={p.id} value={p.id}>
                            <span className="flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: p.color }} />
                              {p.name} <span className="text-muted-foreground ml-1">({p.x.toFixed(1)}, {p.z.toFixed(1)})</span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              );
            })}

            {/* Scene controls */}
            <div className="pt-2 border-t border-border/30 space-y-1.5">
              <div className="flex gap-1.5">
                <Input
                  placeholder="Scene name..."
                  value={newSceneName}
                  onChange={e => setNewSceneName(e.target.value)}
                  className="h-7 text-[10px] flex-1"
                />
                <Button size="sm" variant="outline" className="h-7 text-[9px]" onClick={saveScene} disabled={!newSceneName.trim()}>
                  <Save className="w-3 h-3 mr-1" /> Save
                </Button>
              </div>

              {scenes.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Saved Scenes</p>
                  {scenes.map(scene => (
                    <button
                      key={scene.id}
                      onClick={() => recallScene(scene.id)}
                      className="w-full flex items-center gap-2 p-1.5 rounded-md bg-muted/20 hover:bg-muted/40 transition-all text-left"
                    >
                      <Play className="w-3 h-3 text-primary" />
                      <span className="text-[10px] font-medium">{scene.name}</span>
                      <span className="text-[8px] text-muted-foreground ml-auto">{scene.channels.length} ch</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* ── CUES ── */}
        {section === 'cues' && (
          <>
            <p className="text-[9px] text-muted-foreground mb-2">Program timed DMX cue sequences for automated playback.</p>

            {scenes.length === 0 ? (
              <div className="text-center py-6">
                <Lightbulb className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-[10px] text-muted-foreground">Save scenes in the DMX Programmer first</p>
              </div>
            ) : (
              <>
                {/* Add cue */}
                <div className="flex gap-1.5 items-center">
                  <Select onValueChange={(sceneId) => {
                    const cue: DMXCue = {
                      id: `cue-${Date.now()}`,
                      sceneId,
                      time: cues.length * 5,
                      fadeIn: 500,
                      hold: 2000,
                      fadeOut: 1000,
                    };
                    setCues(prev => [...prev, cue].sort((a, b) => a.time - b.time));
                  }}>
                    <SelectTrigger className="h-7 text-[10px] flex-1">
                      <SelectValue placeholder="Add cue from scene..." />
                    </SelectTrigger>
                    <SelectContent>
                      {scenes.map(s => (
                        <SelectItem key={s.id} value={s.id} className="text-[10px]">{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Cue list */}
                <div className="space-y-1 mt-2">
                  {cues.map((cue, i) => {
                    const scene = scenes.find(s => s.id === cue.sceneId);
                    return (
                      <div key={cue.id} className="flex items-center gap-2 p-1.5 rounded-md bg-muted/20 border border-border/30">
                        <span className="text-[9px] font-mono text-primary w-5">{String(i + 1).padStart(2, '0')}</span>
                        <Timer className="w-3 h-3 text-muted-foreground" />
                        <Input
                          type="number"
                          value={cue.time}
                          onChange={e => {
                            const t = parseFloat(e.target.value) || 0;
                            setCues(prev => prev.map(c => c.id === cue.id ? { ...c, time: t } : c).sort((a, b) => a.time - b.time));
                          }}
                          className="h-6 w-14 text-[9px] font-mono"
                          step={0.1}
                        />
                        <span className="text-[10px] flex-1 truncate">{scene?.name || '?'}</span>
                        <span className="text-[8px] text-muted-foreground font-mono">
                          F{cue.fadeIn}ms H{cue.hold}ms O{cue.fadeOut}ms
                        </span>
                        <button onClick={() => setCues(prev => prev.filter(c => c.id !== cue.id))} className="text-muted-foreground hover:text-destructive">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>

                {cues.length > 0 && (
                  <div className="space-y-1 mt-2">
                    {activeCueId && (
                      <div className="flex items-center gap-1.5 p-1.5 rounded bg-primary/10 border border-primary/30 animate-pulse">
                        <Radio className="w-3 h-3 text-primary" />
                        <span className="text-[9px] font-bold text-primary">
                          ACTIVE: {scenes.find(s => s.id === cues.find(c => c.id === activeCueId)?.sceneId)?.name}
                        </span>
                      </div>
                    )}
                    <Button
                      size="sm"
                      className="w-full h-8 text-[10px]"
                      variant={isPlaying ? "destructive" : "outline"}
                      onClick={() => {
                        if (isPlaying) {
                          setPlaying(false);
                        } else {
                          if (!masterArm) handleMasterArm(true);
                          setSyncEnabled(true);
                          firedCuesRef.current.clear();
                          setPlaying(true);
                          toast.info('▶ Playback started — SFX cues synced to timeline');
                        }
                      }}
                    >
                      {isPlaying ? (
                        <><Square className="w-3 h-3 mr-1.5" /> Stop Sequence</>
                      ) : (
                        <><Play className="w-3 h-3 mr-1.5" /> Run Cue Sequence ({cues.length} cues)</>
                      )}
                    </Button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* Footer — Art-Net config */}
      <div className="px-3 py-1.5 border-t border-border/50 space-y-1">
        <div className="flex items-center gap-1.5">
          <Input
            value={artNetIp}
            onChange={e => setArtNetIp(e.target.value)}
            className="h-5 text-[8px] font-mono bg-muted/30 border-border/50 flex-1"
            placeholder="Art-Net IP"
          />
          <Input
            type="number"
            value={artNetPort}
            onChange={e => setArtNetPort(Number(e.target.value))}
            className="h-5 text-[8px] font-mono bg-muted/30 border-border/50 w-14"
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[8px] text-muted-foreground font-mono">DMX OUT → Art-Net Edge Function</span>
          <div className="flex items-center gap-1">
            <div className={cn("w-1.5 h-1.5 rounded-full", artNetConnected ? "bg-green-500" : masterArm ? "bg-destructive animate-pulse" : "bg-muted-foreground")} />
            <span className="text-[8px] font-mono text-muted-foreground">{artNetConnected ? 'CONNECTED' : masterArm ? 'LIVE' : 'SAFE'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
