/**
 * Live SFX Firing Module
 * Manual trigger console for CO2 jets, fire machines, confetti/streamers,
 * and DMX-controlled fixtures with scene programmer.
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Flame, Wind, Sparkles, Zap, Play, Square, Plus, Trash2,
  AlertTriangle, Check, Radio, Lightbulb, ChevronDown, ChevronRight,
  RotateCcw, Save, Upload, Lock, Unlock, Timer
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

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

// ─── Fire Button Component ───
function FireButton({ channel, onFire, onStop }: { channel: SFXChannel; onFire: (id: string) => void; onStop: (id: string) => void }) {
  const sfxType = SFX_TYPES.find(t => t.key === channel.type);
  const Icon = sfxType?.icon || Zap;

  return (
    <div className={cn(
      "relative rounded-lg border p-2 transition-all",
      channel.armed ? "border-destructive/50 bg-destructive/5" : "border-border/50 bg-card/50",
      channel.firing && "ring-2 ring-destructive animate-pulse",
      channel.locked && "opacity-50 pointer-events-none"
    )}>
      {/* Channel name + type */}
      <div className="flex items-center gap-1.5 mb-1.5">
        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: sfxType?.color }} />
        <span className="text-[10px] font-bold truncate flex-1">{channel.name}</span>
        <span className="text-[8px] font-mono text-muted-foreground">U{channel.dmxUniverse}.{channel.dmxAddress}</span>
      </div>

      {/* Fire button */}
      <button
        onMouseDown={() => channel.armed && onFire(channel.id)}
        onMouseUp={() => onStop(channel.id)}
        onMouseLeave={() => channel.firing && onStop(channel.id)}
        onTouchStart={() => channel.armed && onFire(channel.id)}
        onTouchEnd={() => onStop(channel.id)}
        disabled={!channel.armed || channel.locked}
        className={cn(
          "w-full h-10 rounded-md flex items-center justify-center gap-1.5 font-bold text-[11px] uppercase tracking-wider transition-all select-none",
          channel.armed
            ? channel.firing
              ? "bg-destructive text-destructive-foreground shadow-[0_0_20px_hsl(0,80%,50%,0.4)] scale-95"
              : "bg-destructive/80 text-destructive-foreground hover:bg-destructive active:scale-95"
            : "bg-muted text-muted-foreground cursor-not-allowed"
        )}
      >
        <Icon className="w-4 h-4" />
        {channel.firing ? 'FIRING!' : channel.armed ? 'FIRE' : 'DISARMED'}
      </button>

      {/* Intensity bar */}
      <div className="mt-1.5 h-1 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${(channel.intensity / 255) * 100}%`,
            backgroundColor: sfxType?.color,
            opacity: channel.firing ? 1 : 0.5,
          }}
        />
      </div>

      {/* Duration label */}
      <div className="flex items-center justify-between mt-1">
        <span className="text-[8px] text-muted-foreground font-mono">{channel.duration}ms</span>
        <span className="text-[8px] text-muted-foreground font-mono">{Math.round(channel.intensity / 2.55)}%</span>
      </div>
    </div>
  );
}

// ─── Main Panel ───
export default function LiveFiringPanel({ onClose }: { onClose: () => void }) {
  const [channels, setChannels] = useState<SFXChannel[]>(DEFAULT_CHANNELS);
  const [scenes, setScenes] = useState<DMXScene[]>([]);
  const [cues, setCues] = useState<DMXCue[]>([]);
  const [masterArm, setMasterArm] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [newSceneName, setNewSceneName] = useState('');
  const [section, setSection] = useState<'triggers' | 'programmer' | 'cues'>('triggers');
  const fireTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());

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

  // Fire a channel
  const handleFire = useCallback((id: string) => {
    setChannels(prev => prev.map(ch => ch.id === id ? { ...ch, firing: true } : ch));

    // Log the fire event
    const ch = channels.find(c => c.id === id);
    if (ch) {
      toast(`🔥 FIRED: ${ch.name}`, { description: `DMX U${ch.dmxUniverse}.${ch.dmxAddress} @ ${ch.intensity}/255 for ${ch.duration}ms` });
    }

    // Auto-stop after duration
    const channel = channels.find(c => c.id === id);
    if (channel) {
      const timer = setTimeout(() => {
        setChannels(prev => prev.map(ch => ch.id === id ? { ...ch, firing: false } : ch));
        fireTimers.current.delete(id);
      }, channel.duration);
      fireTimers.current.set(id, timer);
    }
  }, [channels]);

  // Stop firing
  const handleStop = useCallback((id: string) => {
    const timer = fireTimers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      fireTimers.current.delete(id);
    }
    setChannels(prev => prev.map(ch => ch.id === id ? { ...ch, firing: false } : ch));
  }, []);

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

  const armedCount = channels.filter(c => c.armed).length;
  const firingCount = channels.filter(c => c.firing).length;
  const selected = selectedChannel ? channels.find(c => c.id === selectedChannel) : null;

  return (
    <div className="h-full flex flex-col bg-card border-r border-border overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-destructive" />
            <h2 className="text-[10px] font-bold uppercase tracking-[0.15em]">Live SFX Console</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xs">✕</button>
        </div>

        {/* Master arm */}
        <div className={cn(
          "flex items-center justify-between p-2 rounded-lg border transition-all",
          masterArm ? "border-destructive/50 bg-destructive/10" : "border-border/50 bg-muted/30"
        )}>
          <div className="flex items-center gap-2">
            <AlertTriangle className={cn("w-4 h-4", masterArm ? "text-destructive" : "text-muted-foreground")} />
            <span className={cn("text-[11px] font-bold uppercase tracking-wider", masterArm ? "text-destructive" : "text-muted-foreground")}>
              {masterArm ? 'SYSTEM ARMED' : 'SYSTEM SAFE'}
            </span>
          </div>
          <Switch checked={masterArm} onCheckedChange={handleMasterArm} />
        </div>

        {/* Status */}
        <div className="flex items-center gap-3 mt-1.5">
          <span className="text-[9px] font-mono text-muted-foreground">{channels.length} devices</span>
          <span className="text-[9px] font-mono text-accent">{armedCount} armed</span>
          {firingCount > 0 && (
            <span className="text-[9px] font-mono text-destructive animate-pulse">🔥 {firingCount} firing</span>
          )}
        </div>

        {/* Section tabs */}
        <div className="flex gap-1 mt-2">
          {(['triggers', 'programmer', 'cues'] as const).map(s => (
            <button
              key={s}
              onClick={() => setSection(s)}
              className={cn(
                "flex-1 py-1 text-[9px] font-bold uppercase tracking-wider rounded transition-all",
                section === s ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {s === 'triggers' ? '🎯 Triggers' : s === 'programmer' ? '🎛️ DMX Prog' : '📋 Cues'}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {/* ── TRIGGERS ── */}
        {section === 'triggers' && (
          <>
            {/* Fire All button */}
            {masterArm && (
              <button
                onClick={fireAll}
                className="w-full py-2.5 rounded-lg bg-destructive text-destructive-foreground font-bold text-xs uppercase tracking-widest hover:shadow-[0_0_30px_hsl(0,80%,50%,0.4)] active:scale-95 transition-all"
              >
                ⚡ FIRE ALL ARMED ({armedCount})
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
                <div key={ch.id} className="flex items-center gap-2 p-1.5 rounded-md bg-muted/20 border border-border/30">
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
                  <Button size="sm" className="w-full h-8 text-[10px] mt-2" variant="outline">
                    <Play className="w-3 h-3 mr-1.5" />
                    Run Cue Sequence ({cues.length} cues)
                  </Button>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-1.5 border-t border-border/50 flex items-center justify-between">
        <span className="text-[8px] text-muted-foreground font-mono">DMX OUT via Art-Net</span>
        <div className="flex items-center gap-1">
          <div className={cn("w-1.5 h-1.5 rounded-full", masterArm ? "bg-destructive animate-pulse" : "bg-muted-foreground")} />
          <span className="text-[8px] font-mono text-muted-foreground">{masterArm ? 'LIVE' : 'SAFE'}</span>
        </div>
      </div>
    </div>
  );
}
