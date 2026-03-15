/**
 * Live SFX Firing Console — FX Commander (Showven) Style
 * Professional hardware-inspired layout with large fire buttons,
 * real-time intensity bars, DMX programmer and cue stack.
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Flame, Wind, Sparkles, Zap, Play, Square, Plus, Trash2,
  AlertTriangle, Check, Radio, Lightbulb, ChevronDown, ChevronRight,
  RotateCcw, Save, Upload, Lock, Unlock, Timer, MapPinned, Power,
  Shield, ShieldAlert, Gauge
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
  dmxChannels: number;
  armed: boolean;
  firing: boolean;
  duration: number;
  intensity: number;
  color: string;
  locked: boolean;
  positionId?: string;
}

interface DMXScene {
  id: string;
  name: string;
  channels: { channelId: string; intensity: number }[];
}

interface DMXCue {
  id: string;
  sceneId: string;
  time: number;
  fadeIn: number;
  hold: number;
  fadeOut: number;
}

const SFX_TYPES: { key: SFXChannel['type']; label: string; icon: typeof Flame; color: string }[] = [
  { key: 'co2', label: 'CO₂ Jet', icon: Wind, color: 'hsl(200, 80%, 60%)' },
  { key: 'flame', label: 'Fire', icon: Flame, color: 'hsl(15, 95%, 55%)' },
  { key: 'confetti', label: 'Confetti', icon: Sparkles, color: 'hsl(45, 90%, 55%)' },
  { key: 'streamer', label: 'Streamer', icon: Sparkles, color: 'hsl(280, 70%, 60%)' },
  { key: 'cryo', label: 'Cryo', icon: Wind, color: 'hsl(190, 90%, 70%)' },
  { key: 'haze', label: 'Haze', icon: Wind, color: 'hsl(0, 0%, 65%)' },
  { key: 'spark', label: 'Spark', icon: Zap, color: 'hsl(40, 95%, 55%)' },
  { key: 'custom', label: 'DMX', icon: Lightbulb, color: 'hsl(var(--primary))' },
];

const DEFAULT_CHANNELS: SFXChannel[] = [
  { id: 'sfx-1', name: 'CO₂ L', type: 'co2', dmxUniverse: 1, dmxAddress: 1, dmxChannels: 2, armed: false, firing: false, duration: 500, intensity: 255, color: '#4DCFFF', locked: false },
  { id: 'sfx-2', name: 'CO₂ R', type: 'co2', dmxUniverse: 1, dmxAddress: 3, dmxChannels: 2, armed: false, firing: false, duration: 500, intensity: 255, color: '#4DCFFF', locked: false },
  { id: 'sfx-3', name: 'FLAME C', type: 'flame', dmxUniverse: 1, dmxAddress: 5, dmxChannels: 3, armed: false, firing: false, duration: 800, intensity: 200, color: '#FF6622', locked: false },
  { id: 'sfx-4', name: 'CONFETTI L', type: 'confetti', dmxUniverse: 1, dmxAddress: 8, dmxChannels: 1, armed: false, firing: false, duration: 2000, intensity: 255, color: '#FFD700', locked: false },
  { id: 'sfx-5', name: 'CONFETTI R', type: 'confetti', dmxUniverse: 1, dmxAddress: 9, dmxChannels: 1, armed: false, firing: false, duration: 2000, intensity: 255, color: '#FFD700', locked: false },
  { id: 'sfx-6', name: 'SPARK', type: 'spark', dmxUniverse: 1, dmxAddress: 10, dmxChannels: 1, armed: false, firing: false, duration: 1500, intensity: 255, color: '#FFAA00', locked: false },
  { id: 'sfx-7', name: 'CRYO L', type: 'cryo', dmxUniverse: 1, dmxAddress: 11, dmxChannels: 2, armed: false, firing: false, duration: 600, intensity: 255, color: '#66DDFF', locked: false },
  { id: 'sfx-8', name: 'CRYO R', type: 'cryo', dmxUniverse: 1, dmxAddress: 13, dmxChannels: 2, armed: false, firing: false, duration: 600, intensity: 255, color: '#66DDFF', locked: false },
];

// ─── FX Commander Fire Button ───
function FXCommanderButton({ 
  channel, onFire, onStop, index 
}: { 
  channel: SFXChannel; onFire: (id: string) => void; onStop: (id: string) => void; index: number;
}) {
  const sfxType = SFX_TYPES.find(t => t.key === channel.type);
  const Icon = sfxType?.icon || Zap;
  const intensityPct = Math.round((channel.intensity / 255) * 100);

  return (
    <div className={cn(
      "relative flex flex-col rounded-lg overflow-hidden transition-all duration-150 select-none",
      "border-2",
      channel.firing 
        ? "border-destructive shadow-[0_0_20px_rgba(239,68,68,0.4)] scale-[0.97]" 
        : channel.armed 
          ? "border-destructive/50 hover:border-destructive/70" 
          : "border-border/30 hover:border-border/50",
      channel.locked && "opacity-30 pointer-events-none"
    )}>
      {/* Channel number badge */}
      <div className="absolute top-1 left-1 z-10">
        <span className={cn(
          "text-[8px] font-mono font-bold px-1 py-0.5 rounded",
          channel.armed ? "bg-destructive/20 text-destructive" : "bg-surface-2 text-muted-foreground/60"
        )}>
          {String(index + 1).padStart(2, '0')}
        </span>
      </div>

      {/* Lock indicator */}
      {channel.locked && (
        <div className="absolute top-1 right-1 z-10">
          <Lock className="w-2.5 h-2.5 text-muted-foreground" />
        </div>
      )}

      {/* Top section — icon + name */}
      <div className={cn(
        "px-2 pt-4 pb-1.5 text-center",
        channel.firing ? "bg-destructive/15" : channel.armed ? "bg-destructive/5" : "bg-surface-1/80"
      )}>
        <Icon 
          className={cn(
            "w-5 h-5 mx-auto mb-1 transition-all",
            channel.firing && "animate-pulse"
          )} 
          style={{ color: channel.armed ? sfxType?.color : 'hsl(var(--muted-foreground))' }} 
        />
        <div className="text-[9px] font-bold uppercase tracking-wider truncate" 
          style={{ color: channel.armed ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))' }}>
          {channel.name}
        </div>
        <div className="text-[7px] font-mono text-muted-foreground/50 mt-0.5">
          U{channel.dmxUniverse}.{String(channel.dmxAddress).padStart(3, '0')}
        </div>
      </div>

      {/* Intensity meter — vertical bar */}
      <div className="h-1.5 w-full bg-black/40 relative">
        <div
          className={cn("h-full transition-all duration-75", channel.firing && "animate-pulse")}
          style={{
            width: `${intensityPct}%`,
            background: channel.firing 
              ? `linear-gradient(90deg, ${sfxType?.color}, white)` 
              : channel.armed 
                ? sfxType?.color 
                : 'hsl(var(--muted-foreground) / 0.3)',
          }}
        />
      </div>

      {/* Fire button — large touch target */}
      <button
        onMouseDown={() => channel.armed && onFire(channel.id)}
        onMouseUp={() => onStop(channel.id)}
        onMouseLeave={() => channel.firing && onStop(channel.id)}
        onTouchStart={(e) => { e.preventDefault(); channel.armed && onFire(channel.id); }}
        onTouchEnd={(e) => { e.preventDefault(); onStop(channel.id); }}
        disabled={!channel.armed || channel.locked}
        className={cn(
          "py-3 font-black text-[11px] uppercase tracking-[0.2em] transition-all",
          channel.armed
            ? channel.firing
              ? "bg-destructive text-white"
              : "bg-gradient-to-b from-red-600 to-red-700 text-white hover:from-red-500 hover:to-red-600 active:from-red-700 active:to-red-800"
            : "bg-surface-2/80 text-muted-foreground/40 cursor-not-allowed"
        )}
      >
        {channel.firing ? '● FIRING' : channel.armed ? 'FIRE' : 'SAFE'}
      </button>

      {/* Duration indicator */}
      <div className={cn(
        "text-center py-0.5 text-[7px] font-mono",
        channel.armed ? "bg-black/30 text-muted-foreground/70" : "bg-surface-1/50 text-muted-foreground/30"
      )}>
        {channel.duration}ms · {intensityPct}%
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
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [newSceneName, setNewSceneName] = useState('');
  const [section, setSection] = useState<'triggers' | 'programmer' | 'cues'>('triggers');
  const [artNetConnected, setArtNetConnected] = useState(false);
  const [artNetIp, setArtNetIp] = useState('255.255.255.255');
  const [artNetPort, setArtNetPort] = useState(6454);
  const [syncEnabled, setSyncEnabled] = useState(true);
  const [activeCueId, setActiveCueId] = useState<string | null>(null);
  const sequenceRef = useRef(0);
  const fireTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const firedCuesRef = useRef<Set<string>>(new Set());

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

  const handleMasterArm = useCallback((armed: boolean) => {
    setMasterArm(armed);
    setChannels(prev => prev.map(ch => ({ ...ch, armed: ch.locked ? false : armed })));
    if (armed) toast.warning('⚠️ SYSTEM ARMED', { duration: 3000 });
    else toast.info('System disarmed');
  }, []);

  const handleFire = useCallback((id: string) => {
    setChannels(prev => {
      const updated = prev.map(ch => ch.id === id ? { ...ch, firing: true } : ch);
      sendArtNetPacket(updated);
      return updated;
    });
    const ch = channels.find(c => c.id === id);
    if (ch) {
      toast(`🔥 ${ch.name}`, { description: `DMX U${ch.dmxUniverse}.${ch.dmxAddress}` });
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

  const handleStop = useCallback((id: string) => {
    const timer = fireTimers.current.get(id);
    if (timer) { clearTimeout(timer); fireTimers.current.delete(id); }
    setChannels(prev => { const updated = prev.map(ch => ch.id === id ? { ...ch, firing: false } : ch); sendArtNetPacket(updated); return updated; });
  }, [sendArtNetPacket]);

  const addChannel = useCallback((type: SFXChannel['type']) => {
    const sfxType = SFX_TYPES.find(t => t.key === type);
    const maxAddr = Math.max(0, ...channels.map(c => c.dmxAddress + c.dmxChannels));
    setChannels(prev => [...prev, {
      id: `sfx-${Date.now()}`, name: `${sfxType?.label || 'CH'} ${prev.length + 1}`, type,
      dmxUniverse: 1, dmxAddress: maxAddr || 1, dmxChannels: type === 'flame' ? 3 : type === 'co2' || type === 'cryo' ? 2 : 1,
      armed: masterArm, firing: false, duration: type === 'flame' ? 800 : type === 'confetti' ? 2000 : 500,
      intensity: 255, color: sfxType?.color || '#fff', locked: false,
    }]);
  }, [channels, masterArm]);

  const updateChannel = useCallback((id: string, updates: Partial<SFXChannel>) => {
    setChannels(prev => prev.map(ch => ch.id === id ? { ...ch, ...updates } : ch));
  }, []);

  const saveScene = useCallback(() => {
    if (!newSceneName.trim()) return;
    setScenes(prev => [...prev, { id: `scene-${Date.now()}`, name: newSceneName, channels: channels.map(ch => ({ channelId: ch.id, intensity: ch.intensity })) }]);
    setNewSceneName('');
    toast.success('Scene saved');
  }, [newSceneName, channels]);

  const recallScene = useCallback((sceneId: string) => {
    const scene = scenes.find(s => s.id === sceneId);
    if (!scene) return;
    setChannels(prev => prev.map(ch => { const saved = scene.channels.find(sc => sc.channelId === ch.id); return saved ? { ...ch, intensity: saved.intensity } : ch; }));
  }, [scenes]);

  const fireAll = useCallback(() => {
    channels.filter(ch => ch.armed && !ch.locked).forEach(ch => handleFire(ch.id));
  }, [channels, handleFire]);

  useEffect(() => { return () => { fireTimers.current.forEach(timer => clearTimeout(timer)); }; }, []);
  useEffect(() => { if (!isPlaying) { firedCuesRef.current.clear(); setActiveCueId(null); } }, [isPlaying]);

  // Timeline sync
  useEffect(() => {
    if (!syncEnabled || !isPlaying || !masterArm || cues.length === 0) return;
    for (const cue of cues) {
      if (firedCuesRef.current.has(cue.id)) continue;
      const scene = scenes.find(s => s.id === cue.sceneId);
      if (!scene) continue;
      const cueTotalDuration = (cue.fadeIn + cue.hold + cue.fadeOut) / 1000;
      if (currentTime >= cue.time && currentTime < cue.time + cueTotalDuration) {
        firedCuesRef.current.add(cue.id);
        setActiveCueId(cue.id);
        setChannels(prev => {
          const updated = prev.map(ch => {
            const sceneCh = scene.channels.find(sc => sc.channelId === ch.id);
            if (!sceneCh || ch.locked) return ch;
            const elapsed = (currentTime - cue.time) * 1000;
            let envelope = 1;
            if (elapsed < cue.fadeIn) envelope = elapsed / cue.fadeIn;
            else if (elapsed > cue.fadeIn + cue.hold) envelope = Math.max(0, 1 - (elapsed - cue.fadeIn - cue.hold) / cue.fadeOut);
            return { ...ch, intensity: Math.round(sceneCh.intensity * envelope), firing: true };
          });
          sendArtNetPacket(updated);
          return updated;
        });
        const remaining = (cue.time + cueTotalDuration - currentTime) * 1000;
        setTimeout(() => {
          setChannels(prev => { const updated = prev.map(ch => ({ ...ch, firing: false })); sendArtNetPacket(updated); return updated; });
          setActiveCueId(null);
        }, Math.max(50, remaining));
      }
    }
  }, [currentTime, isPlaying, syncEnabled, masterArm, cues, scenes, sendArtNetPacket]);

  const armedCount = channels.filter(c => c.armed).length;
  const firingCount = channels.filter(c => c.firing).length;

  return (
    <div className="h-full flex flex-col bg-black/95 backdrop-blur-xl overflow-hidden" style={{ minWidth: 280, maxWidth: 340 }}>
      {/* ═══ HEADER — FX Commander style ═══ */}
      <div className="px-3 py-2 border-b border-border/20 bg-gradient-to-b from-surface-1/40 to-transparent">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-7 h-7 rounded-lg flex items-center justify-center border transition-all",
              masterArm 
                ? "bg-destructive/20 border-destructive/50 shadow-[0_0_12px_rgba(239,68,68,0.3)]" 
                : "bg-surface-2/80 border-border/30"
            )}>
              <ShieldAlert className={cn("w-4 h-4", masterArm ? "text-destructive" : "text-muted-foreground/50")} />
            </div>
            <div>
              <h2 className="text-[11px] font-black uppercase tracking-[0.15em] text-foreground">FX Commander</h2>
              <p className="text-[7px] uppercase tracking-[0.2em] text-muted-foreground/50 font-mono">SFX · DMX · Art-Net</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <div className={cn("w-2 h-2 rounded-full", artNetConnected ? "bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.5)]" : "bg-muted-foreground/30")} />
            <button onClick={onClose} className="text-muted-foreground/40 hover:text-foreground p-1 rounded-md hover:bg-surface-3/50 transition-colors text-xs">✕</button>
          </div>
        </div>

        {/* Master ARM button — FX Commander prominent toggle */}
        <button
          onClick={() => handleMasterArm(!masterArm)}
          className={cn(
            "w-full flex items-center justify-center gap-2.5 py-2 rounded-lg border-2 font-black text-[12px] uppercase tracking-[0.25em] transition-all",
            masterArm
              ? "border-destructive bg-destructive/10 text-destructive shadow-[0_0_24px_rgba(239,68,68,0.2)]"
              : "border-border/40 bg-surface-1/50 text-muted-foreground/60 hover:border-yellow-500/40 hover:text-yellow-500/80"
          )}
        >
          <Power className="w-4 h-4" />
          {masterArm ? '⚠ ARMED' : 'ARM SYSTEM'}
        </button>

        {/* Status strip */}
        <div className="flex items-center justify-between mt-2 px-1">
          <div className="flex items-center gap-3">
            <span className="text-[8px] font-mono text-muted-foreground/50">{channels.length} CH</span>
            <span className={cn("text-[8px] font-mono font-bold", armedCount > 0 ? "text-yellow-500" : "text-muted-foreground/30")}>{armedCount} RDY</span>
            {firingCount > 0 && <span className="text-[8px] font-mono text-destructive font-bold animate-pulse">🔥 {firingCount}</span>}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[7px] font-mono text-muted-foreground/40">SYNC</span>
            <Switch checked={syncEnabled} onCheckedChange={setSyncEnabled} className="scale-75" />
          </div>
        </div>
      </div>

      {/* ═══ SECTION TABS ═══ */}
      <div className="flex border-b border-border/15">
        {(['triggers', 'programmer', 'cues'] as const).map(s => (
          <button
            key={s}
            onClick={() => setSection(s)}
            className={cn(
              "flex-1 py-2 text-[8px] font-black uppercase tracking-[0.15em] transition-all border-b-2",
              section === s 
                ? "text-foreground border-primary bg-surface-1/20" 
                : "text-muted-foreground/30 border-transparent hover:text-muted-foreground/60"
            )}
          >
            {s === 'triggers' ? '⚡ Triggers' : s === 'programmer' ? '🎛 DMX' : '📋 Cues'}
          </button>
        ))}
      </div>

      {/* ═══ CONTENT ═══ */}
      <div className="flex-1 overflow-y-auto">
        {/* ── TRIGGERS GRID ── */}
        {section === 'triggers' && (
          <div className="p-2 space-y-2">
            {/* Fire All */}
            {masterArm && (
              <button
                onClick={fireAll}
                className="w-full py-3 rounded-lg bg-gradient-to-b from-red-600 via-red-700 to-red-800 text-white font-black text-[13px] uppercase tracking-[0.3em] hover:shadow-[0_0_30px_rgba(239,68,68,0.4)] active:scale-[0.97] transition-all border border-red-500/50"
              >
                ⚡ FIRE ALL ({armedCount})
              </button>
            )}

            {/* Channel grid — 2 columns, hardware style */}
            <div className="grid grid-cols-2 gap-1.5">
              {channels.map((ch, i) => (
                <FXCommanderButton key={ch.id} channel={ch} onFire={handleFire} onStop={handleStop} index={i} />
              ))}
            </div>

            {/* Add devices row */}
            <div className="pt-2 border-t border-border/15">
              <p className="text-[7px] font-bold text-muted-foreground/40 uppercase tracking-[0.15em] mb-1.5 px-1">+ Add Device</p>
              <div className="grid grid-cols-4 gap-1">
                {SFX_TYPES.map(t => (
                  <button
                    key={t.key}
                    onClick={() => addChannel(t.key)}
                    className="flex flex-col items-center gap-0.5 py-1.5 px-1 rounded-md bg-surface-1/30 hover:bg-surface-1/60 active:scale-95 transition-all border border-border/10"
                  >
                    <t.icon className="w-3 h-3" style={{ color: t.color }} />
                    <span className="text-[6px] font-bold uppercase text-muted-foreground/50">{t.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── DMX PROGRAMMER ── */}
        {section === 'programmer' && (
          <div className="p-2 space-y-1.5">
            <p className="text-[8px] text-muted-foreground/40 px-1">Adjust intensity per channel</p>

            {channels.map((ch, i) => {
              const sfxType = SFX_TYPES.find(t => t.key === ch.type);
              return (
                <div key={ch.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-surface-1/20 border border-border/10">
                  <span className="text-[7px] font-mono text-muted-foreground/40 w-4">{String(i + 1).padStart(2, '0')}</span>
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: sfxType?.color }} />
                  <span className="text-[9px] font-bold flex-1 truncate text-foreground/80">{ch.name}</span>
                  <Slider value={[ch.intensity]} min={0} max={255} step={1} onValueChange={([v]) => updateChannel(ch.id, { intensity: v })} className="w-20" />
                  <span className="text-[8px] font-mono text-muted-foreground/60 w-7 text-right">{ch.intensity}</span>
                  <button onClick={() => updateChannel(ch.id, { locked: !ch.locked })} className="p-0.5">
                    {ch.locked ? <Lock className="w-2.5 h-2.5 text-destructive/60" /> : <Unlock className="w-2.5 h-2.5 text-muted-foreground/30" />}
                  </button>
                </div>
              );
            })}

            {/* Save scene */}
            <div className="pt-2 border-t border-border/15 space-y-1.5">
              <div className="flex gap-1.5">
                <Input placeholder="Scene name..." value={newSceneName} onChange={e => setNewSceneName(e.target.value)} className="h-6 text-[9px] flex-1 bg-surface-1/30 border-border/20" />
                <Button size="sm" variant="outline" className="h-6 text-[8px] px-2 border-border/20" onClick={saveScene} disabled={!newSceneName.trim()}>
                  <Save className="w-2.5 h-2.5 mr-1" /> Save
                </Button>
              </div>
              {scenes.map(scene => (
                <button key={scene.id} onClick={() => recallScene(scene.id)} className="w-full flex items-center gap-2 p-1.5 rounded-md bg-surface-1/20 hover:bg-surface-1/40 transition-all text-left border border-border/10">
                  <Play className="w-3 h-3 text-primary/60" />
                  <span className="text-[9px] font-medium text-foreground/70">{scene.name}</span>
                  <span className="text-[7px] text-muted-foreground/40 ml-auto">{scene.channels.length} ch</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── CUE STACK ── */}
        {section === 'cues' && (
          <div className="p-2 space-y-2">
            {scenes.length === 0 ? (
              <div className="text-center py-8">
                <Lightbulb className="w-8 h-8 text-muted-foreground/15 mx-auto mb-2" />
                <p className="text-[9px] text-muted-foreground/40">Save scenes in DMX tab first</p>
              </div>
            ) : (
              <>
                <Select onValueChange={(sceneId) => {
                  setCues(prev => [...prev, { id: `cue-${Date.now()}`, sceneId, time: prev.length * 5, fadeIn: 500, hold: 2000, fadeOut: 1000 }].sort((a, b) => a.time - b.time));
                }}>
                  <SelectTrigger className="h-7 text-[9px] bg-surface-1/30 border-border/20">
                    <SelectValue placeholder="+ Add cue from scene..." />
                  </SelectTrigger>
                  <SelectContent>
                    {scenes.map(s => (<SelectItem key={s.id} value={s.id} className="text-[9px]">{s.name}</SelectItem>))}
                  </SelectContent>
                </Select>

                {cues.map((cue, i) => {
                  const scene = scenes.find(s => s.id === cue.sceneId);
                  return (
                    <div key={cue.id} className={cn(
                      "flex items-center gap-2 p-1.5 rounded-md border border-border/10",
                      activeCueId === cue.id ? "bg-primary/10 border-primary/30" : "bg-surface-1/20"
                    )}>
                      <span className="text-[8px] font-mono text-primary/60 w-4">{String(i + 1).padStart(2, '0')}</span>
                      <Input type="number" value={cue.time} onChange={e => setCues(prev => prev.map(c => c.id === cue.id ? { ...c, time: parseFloat(e.target.value) || 0 } : c).sort((a, b) => a.time - b.time))} className="h-5 w-12 text-[8px] font-mono bg-transparent border-border/20" step={0.1} />
                      <span className="text-[9px] flex-1 truncate text-foreground/60">{scene?.name || '?'}</span>
                      <span className="text-[7px] text-muted-foreground/30 font-mono">{cue.fadeIn}/{cue.hold}/{cue.fadeOut}</span>
                      <button onClick={() => setCues(prev => prev.filter(c => c.id !== cue.id))} className="text-muted-foreground/30 hover:text-destructive"><Trash2 className="w-2.5 h-2.5" /></button>
                    </div>
                  );
                })}

                {cues.length > 0 && (
                  <Button size="sm" className="w-full h-8 text-[9px] font-bold uppercase tracking-wider" variant={isPlaying ? "destructive" : "outline"}
                    onClick={() => { if (isPlaying) { setPlaying(false); } else { if (!masterArm) handleMasterArm(true); setSyncEnabled(true); firedCuesRef.current.clear(); setPlaying(true); } }}>
                    {isPlaying ? <><Square className="w-3 h-3 mr-1.5" /> Stop</> : <><Play className="w-3 h-3 mr-1.5" /> Run ({cues.length} cues)</>}
                  </Button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* ═══ FOOTER — Art-Net Status ═══ */}
      <div className="px-3 py-1.5 border-t border-border/15 bg-surface-1/10">
        <div className="flex items-center gap-1.5">
          <Input value={artNetIp} onChange={e => setArtNetIp(e.target.value)} className="h-5 text-[7px] font-mono bg-transparent border-border/15 flex-1" />
          <Input type="number" value={artNetPort} onChange={e => setArtNetPort(Number(e.target.value))} className="h-5 text-[7px] font-mono bg-transparent border-border/15 w-12" />
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-[7px] font-mono text-muted-foreground/30">Art-Net → Edge Function</span>
          <span className={cn("text-[7px] font-mono font-bold", artNetConnected ? "text-green-500" : masterArm ? "text-destructive" : "text-muted-foreground/30")}>
            {artNetConnected ? '● ONLINE' : masterArm ? '● LIVE' : '○ SAFE'}
          </span>
        </div>
      </div>
    </div>
  );
}
