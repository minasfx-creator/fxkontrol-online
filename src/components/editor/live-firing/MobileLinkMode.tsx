/**
 * MobileLinkMode — FX Commander integrated Mobile Link (Master/Slave)
 * Broadcasts fire events via Supabase Realtime and receives them on desktop.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { Cable, Wifi, WifiOff, Flame, Wind, Sparkles, Zap, Plus, Trash2, Send, MonitorPlay } from 'lucide-react';
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

interface VirtualFixture {
  id: string;
  name: string;
  type: 'co2' | 'flame' | 'spark' | 'cryo' | 'confetti' | 'haze' | 'streamer' | 'custom';
  color: string;
  intensity: number;
  dmxUniverse: number;
  dmxAddress: number;
  duration: number;
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

const FIXTURE_TYPES = [
  { key: 'co2' as const, label: 'CO2', color: '#00d4ff', icon: Wind },
  { key: 'flame' as const, label: 'Flame', color: '#ff6600', icon: Flame },
  { key: 'spark' as const, label: 'Spark', color: '#ffcc00', icon: Sparkles },
  { key: 'cryo' as const, label: 'Cryo', color: '#88ddff', icon: Zap },
  { key: 'confetti' as const, label: 'Confetti', color: '#ff44cc', icon: Sparkles },
  { key: 'haze' as const, label: 'Haze', color: '#aaaaaa', icon: Wind },
];

const STORAGE_KEY = 'fxc-mobile-link-fixtures';

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

  // Persist fixtures
  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(fixtures)); }, [fixtures]);

  // Subscribe to Realtime broadcast
  useEffect(() => {
    const ch = supabase.channel('fxc-mobile-link', { config: { broadcast: { self: false } } });

    ch.on('broadcast', { event: 'fxc-fire' }, (msg) => {
      const p = msg.payload as any;
      // Log event
      setEvents(prev => [{
        id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 4)}`,
        timestamp: Date.now(),
        source: 'remote' as const,
        fixtureName: p.name || p.type,
        type: p.type,
        color: p.color || '#fff',
        intensity: p.intensity || 200,
      }, ...prev].slice(0, 50));

      // Try to match FXC channel by ID or DMX address
      if (p.channelId) {
        const match = channels.find(c => c.id === p.channelId);
        if (match) {
          fireChannel(match.id);
          return;
        }
      }

      // Fire as virtual SFX in 3D viewport
      useLiveSfxStore.getState().fireEffect({
        id: `link-${Date.now()}`,
        type: p.type || 'co2',
        position: p.position || [0, 2, 0],
        color: p.color || '#00d4ff',
        intensity: p.intensity || 200,
        startedAt: performance.now(),
        duration: p.duration || 2000,
      });

      if (navigator.vibrate) navigator.vibrate(15);
    });

    ch.subscribe((status) => {
      setConnected(status === 'SUBSCRIBED');
    });

    channelRef.current = ch;
    return () => { supabase.removeChannel(ch); };
  }, [channels, fireChannel]);

  // Broadcast fire
  const broadcastFire = useCallback((fixture: VirtualFixture) => {
    if (navigator.vibrate) navigator.vibrate(30);

    // Log locally
    setEvents(prev => [{
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 4)}`,
      timestamp: Date.now(),
      source: 'local',
      fixtureName: fixture.name,
      type: fixture.type,
      color: fixture.color,
      intensity: fixture.intensity,
    }, ...prev].slice(0, 50));

    // Fire locally in 3D
    useLiveSfxStore.getState().fireEffect({
      id: `link-${Date.now()}`,
      type: fixture.type as any,
      position: [0, 2, 0],
      color: fixture.color,
      intensity: fixture.intensity,
      startedAt: performance.now(),
      duration: fixture.duration,
    });

    // Broadcast to other devices
    channelRef.current?.send({
      type: 'broadcast',
      event: 'fxc-fire',
      payload: {
        name: fixture.name,
        type: fixture.type,
        color: fixture.color,
        intensity: fixture.intensity,
        duration: fixture.duration,
        dmxUniverse: fixture.dmxUniverse,
        dmxAddress: fixture.dmxAddress,
      },
    });
  }, []);

  // Broadcast existing FXC channel fire
  const broadcastChannelFire = useCallback((ch: SFXChannel) => {
    if (navigator.vibrate) navigator.vibrate(30);
    fireChannel(ch.id);

    channelRef.current?.send({
      type: 'broadcast',
      event: 'fxc-fire',
      payload: {
        channelId: ch.id,
        name: ch.name,
        type: ch.type,
        color: ch.color,
        intensity: ch.intensity,
        duration: ch.duration,
      },
    });

    setEvents(prev => [{
      id: `evt-${Date.now()}`,
      timestamp: Date.now(),
      source: 'local',
      fixtureName: ch.name,
      type: ch.type,
      color: ch.color,
      intensity: ch.intensity,
    }, ...prev].slice(0, 50));
  }, [fireChannel]);

  const addFixture = useCallback(() => {
    if (!newName.trim()) return;
    const fixture: VirtualFixture = {
      id: `vf-${Date.now()}`,
      name: newName.trim(),
      type: newType,
      color: newColor,
      intensity: 200,
      dmxUniverse: 1,
      dmxAddress: newAddr,
      duration: 2000,
    };
    setFixtures(prev => [...prev, fixture]);
    setShowAddForm(false);
    setNewName('');
    toast.success(`Fixture "${fixture.name}" adicionada`);
  }, [newName, newType, newColor, newAddr]);

  const removeFixture = useCallback((id: string) => {
    setFixtures(prev => prev.filter(f => f.id !== id));
  }, []);

  return (
    <div className={cn("flex flex-col h-full", mob ? "p-2" : fs ? "p-4" : "p-2")}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Cable className={cn("text-primary", mob ? "w-4 h-4" : fs ? "w-5 h-5" : "w-3.5 h-3.5")} />
          <span className={cn("font-black uppercase tracking-wider text-foreground/80", mob ? "text-[11px]" : fs ? "text-xs" : "text-[9px]")}>
            Mobile Link
          </span>
          <span className={cn(
            "font-mono uppercase px-1.5 py-0.5 rounded text-[7px] font-bold",
            isMobile
              ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
              : "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30"
          )}>
            {isMobile ? 'SLAVE' : 'MASTER'}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className={cn("rounded-full", connected ? "bg-green-500" : "bg-red-500/50", "w-2 h-2")}
            style={connected ? { boxShadow: '0 0 6px rgba(34,197,94,0.6)' } : undefined} />
          <span className={cn("font-mono text-muted-foreground/50", mob ? "text-[8px]" : fs ? "text-[9px]" : "text-[7px]")}>
            {connected ? 'LINKED' : 'OFFLINE'}
          </span>
        </div>
      </div>

      {/* Connection status */}
      <div className={cn("flex gap-2 mb-2", mob ? "gap-1.5" : "")}>
        <div className={cn("flex-1 rounded border flex items-center gap-1.5 px-2 py-1", artNetConnected ? "border-green-500/30 bg-green-500/5" : "border-border/15 bg-[hsl(220_10%_8%)]")}>
          <div className={cn("rounded-full w-1.5 h-1.5", artNetConnected ? "bg-green-500" : "bg-muted-foreground/20")} />
          <span className={cn("font-mono", artNetConnected ? "text-green-500/70" : "text-muted-foreground/30", mob ? "text-[8px]" : fs ? "text-[9px]" : "text-[7px]")}>Art-Net</span>
        </div>
        <div className={cn("flex-1 rounded border flex items-center gap-1.5 px-2 py-1", relayConnected ? "border-cyan-400/30 bg-cyan-400/5" : "border-border/15 bg-[hsl(220_10%_8%)]")}>
          <div className={cn("rounded-full w-1.5 h-1.5", relayConnected ? "bg-cyan-400" : "bg-muted-foreground/20")} />
          <span className={cn("font-mono", relayConnected ? "text-cyan-400/70" : "text-muted-foreground/30", mob ? "text-[8px]" : fs ? "text-[9px]" : "text-[7px]")}>Relay</span>
        </div>
        <div className={cn("flex-1 rounded border flex items-center gap-1.5 px-2 py-1", connected ? "border-green-500/30 bg-green-500/5" : "border-border/15 bg-[hsl(220_10%_8%)]")}>
          <div className={cn("rounded-full w-1.5 h-1.5", connected ? "bg-green-500" : "bg-muted-foreground/20")} />
          <span className={cn("font-mono", connected ? "text-green-500/70" : "text-muted-foreground/30", mob ? "text-[8px]" : fs ? "text-[9px]" : "text-[7px]")}>Realtime</span>
        </div>
      </div>

      {/* FXC Channels — remote fire */}
      {channels.length > 0 && (
        <div className="mb-2">
          <span className={cn("font-bold text-muted-foreground/40 uppercase tracking-wider block mb-1", mob ? "text-[9px]" : fs ? "text-[9px]" : "text-[7px]")}>
            Console Channels ({channels.length})
          </span>
          <div className={cn("grid gap-1", mob ? "grid-cols-2 gap-1.5" : fs ? "grid-cols-3 gap-1" : "grid-cols-2 gap-0.5")}>
            {channels.slice(0, 12).map(ch => (
              <button key={ch.id} onClick={() => broadcastChannelFire(ch)}
                className={cn(
                  "rounded border border-border/20 bg-[hsl(220_10%_10%)] hover:bg-[hsl(220_10%_14%)] active:scale-[0.93] active:bg-red-700/40 transition-all flex items-center gap-1.5",
                  mob ? "px-2.5 py-2.5" : fs ? "px-2 py-2" : "px-1.5 py-1.5"
                )}>
                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: ch.color }} />
                <div className="flex-1 min-w-0">
                  <div className={cn("font-bold uppercase truncate text-foreground/70", mob ? "text-[9px]" : fs ? "text-[8px]" : "text-[7px]")}>{ch.name}</div>
                  <div className={cn("font-mono text-muted-foreground/30", mob ? "text-[7px]" : "text-[6px]")}>U{ch.dmxUniverse}.{ch.dmxAddress}</div>
                </div>
                <Send className={cn("text-primary/40 shrink-0", mob ? "w-3.5 h-3.5" : "w-3 h-3")} />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Virtual Fixtures */}
      <div className="mb-2">
        <div className="flex items-center justify-between mb-1">
          <span className={cn("font-bold text-muted-foreground/40 uppercase tracking-wider", mob ? "text-[9px]" : fs ? "text-[9px]" : "text-[7px]")}>
            Virtual Fixtures ({fixtures.length})
          </span>
          <button onClick={() => setShowAddForm(!showAddForm)} className={cn("rounded bg-primary/10 text-primary/70 hover:bg-primary/20 transition-colors", mob ? "px-2 py-1 text-[9px]" : fs ? "px-2 py-0.5 text-[8px]" : "px-1.5 py-0.5 text-[7px]")}>
            <Plus className="w-3 h-3 inline mr-0.5" /> Add
          </button>
        </div>

        {showAddForm && (
          <div className={cn("rounded border border-primary/20 bg-primary/5 mb-2 space-y-1.5", mob ? "p-2.5" : fs ? "p-2" : "p-1.5")}>
            <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nome..."
              className={cn("bg-background/60 border-border/20", mob ? "h-9 text-sm" : fs ? "h-7 text-xs" : "h-5 text-[8px]")} />
            <div className="flex gap-1 flex-wrap">
              {FIXTURE_TYPES.map(t => (
                <button key={t.key} onClick={() => { setNewType(t.key); setNewColor(t.color); }}
                  className={cn(
                    "rounded border font-bold transition-all",
                    mob ? "px-2.5 py-1.5 text-[9px]" : fs ? "px-2 py-1 text-[8px]" : "px-1.5 py-0.5 text-[7px]",
                    newType === t.key ? "border-primary/40 bg-primary/15 text-primary" : "border-border/15 bg-[hsl(220_10%_10%)] text-muted-foreground/40"
                  )}>{t.label}</button>
              ))}
            </div>
            <div className="flex gap-1.5 items-center">
              <input type="color" value={newColor} onChange={e => setNewColor(e.target.value)} className="w-6 h-6 rounded border-0 cursor-pointer" />
              <Input type="number" value={newAddr} onChange={e => setNewAddr(Number(e.target.value))} min={1} max={512} placeholder="DMX Addr"
                className={cn("flex-1 bg-background/60 border-border/20 font-mono", mob ? "h-8 text-xs" : fs ? "h-7 text-xs" : "h-5 text-[8px]")} />
              <Button size="sm" onClick={addFixture} disabled={!newName.trim()} className={cn(mob ? "h-8 text-xs" : fs ? "h-7 text-[10px]" : "h-5 text-[8px]")}>OK</Button>
            </div>
          </div>
        )}

        <div className={cn("grid gap-1", mob ? "grid-cols-2 gap-1.5" : fs ? "grid-cols-2 gap-1" : "grid-cols-2 gap-0.5")}>
          {fixtures.map(fix => {
            const ft = FIXTURE_TYPES.find(t => t.key === fix.type);
            const Icon = ft?.icon || Zap;
            return (
              <div key={fix.id} className={cn("rounded border border-border/20 bg-[hsl(220_10%_8%)] flex flex-col", mob ? "p-2" : fs ? "p-1.5" : "p-1")}>
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon className={cn(mob ? "w-4 h-4" : "w-3 h-3")} style={{ color: fix.color }} />
                  <span className={cn("font-bold uppercase truncate flex-1 text-foreground/70", mob ? "text-[10px]" : fs ? "text-[9px]" : "text-[7px]")}>{fix.name}</span>
                  <button onClick={() => removeFixture(fix.id)} className="text-muted-foreground/20 hover:text-red-400 transition-colors">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
                <Slider value={[fix.intensity]} min={0} max={255} step={1}
                  onValueChange={([v]) => setFixtures(prev => prev.map(f => f.id === fix.id ? { ...f, intensity: v } : f))}
                  className="mb-1.5" />
                <button onClick={() => broadcastFire(fix)}
                  className={cn(
                    "w-full rounded font-black uppercase transition-all",
                    "bg-gradient-to-b from-red-700 to-red-900 text-white/90 border border-red-600/40",
                    "hover:from-red-600 hover:to-red-800 active:scale-[0.93]",
                    mob ? "py-3 text-sm tracking-[0.2em]" : fs ? "py-2 text-xs tracking-[0.15em]" : "py-1.5 text-[9px] tracking-[0.1em]"
                  )} style={{ boxShadow: '0 0 8px rgba(239,68,68,0.2)' }}>
                  🔥 FIRE
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Event Log */}
      <div className="flex-1 min-h-0">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5">
            <MonitorPlay className={cn("text-muted-foreground/40", mob ? "w-3.5 h-3.5" : "w-3 h-3")} />
            <span className={cn("font-bold text-muted-foreground/40 uppercase tracking-wider", mob ? "text-[9px]" : fs ? "text-[9px]" : "text-[7px]")}>
              Event Log
            </span>
          </div>
          {events.length > 0 && (
            <button onClick={() => setEvents([])} className={cn("text-muted-foreground/30 hover:text-foreground/50", mob ? "text-[8px]" : "text-[7px]")}>Clear</button>
          )}
        </div>
        <ScrollArea className={cn("rounded border border-border/10 bg-[hsl(220_10%_5%)]", mob ? "h-32" : fs ? "h-28" : "h-20")}>
          <div className="p-1.5 space-y-0.5">
            {events.length === 0 ? (
              <div className={cn("text-center text-muted-foreground/20 py-3 font-mono", mob ? "text-[9px]" : "text-[8px]")}>
                Aguardando eventos...
              </div>
            ) : (
              events.map(evt => (
                <div key={evt.id} className={cn("flex items-center gap-1.5 font-mono", mob ? "text-[9px]" : fs ? "text-[8px]" : "text-[7px]")}>
                  <span className="text-muted-foreground/30">
                    {new Date(evt.timestamp).toLocaleTimeString('pt-BR', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                  <span className={cn(
                    "font-bold px-1 rounded text-[6px] uppercase",
                    evt.source === 'remote' ? "bg-cyan-500/15 text-cyan-400" : "bg-amber-500/15 text-amber-400"
                  )}>
                    {evt.source === 'remote' ? 'RX' : 'TX'}
                  </span>
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: evt.color }} />
                  <span className="text-foreground/60 truncate">{evt.fixtureName}</span>
                  <span className="text-muted-foreground/30 ml-auto">{evt.intensity}</span>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
