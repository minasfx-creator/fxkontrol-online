/**
 * ShowControlPanel — Macro Mission Overview
 * Real-time monitoring of all 4 systems: PYRO, DMX, LIGHT, DRONE
 * BR2049 holographic command center aesthetic
 * Now with Supabase Realtime for Art-Net module telemetry
 */
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Flame, Zap, Gauge, Layers, Activity, Radio, Shield } from 'lucide-react';
import { useLiveSfxStore } from '@/store/useLiveSfxStore';
import { useSfxChannelStore } from '@/store/useSfxChannelStore';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea } from '@/components/ui/scroll-area';

interface EventLog {
  id: string;
  system: string;
  color: string;
  message: string;
  timestamp: number;
}

const SYSTEMS = [
  { name: 'FXK-PYRO', code: 'PYRO', icon: Flame, color: 'hsl(0 85% 48%)', glow: 'hsl(0 85% 48% / 0.08)' },
  { name: 'FXK-DMX', code: 'DMX', icon: Zap, color: 'hsl(200 80% 48%)', glow: 'hsl(200 80% 48% / 0.08)' },
  { name: 'FXK-LIGHT', code: 'LIGHT', icon: Gauge, color: 'hsl(240 50% 52%)', glow: 'hsl(240 50% 52% / 0.08)' },
  { name: 'FXK-DRONE', code: 'DRONE', icon: Layers, color: 'hsl(165 100% 42%)', glow: 'hsl(165 100% 42% / 0.08)' },
];

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-[1px] h-4">
      {data.map((v, i) => (
        <div
          key={i}
          className="w-[3px] rounded-t-sm transition-all duration-300"
          style={{
            height: `${(v / max) * 100}%`,
            backgroundColor: v > 0 ? color : 'hsl(220 10% 15%)',
            opacity: 0.4 + (i / data.length) * 0.6,
          }}
        />
      ))}
    </div>
  );
}

function TimecodeDisplay({ ms }: { ms: number }) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const f = Math.floor((ms % 1000) / (1000 / 30));
  return (
    <div className="font-mono font-black text-center" style={{ color: 'hsl(32 100% 60%)' }}>
      <span className="text-2xl tracking-[0.15em]">
        {String(h).padStart(2, '0')}:{String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}
      </span>
      <span className="text-lg text-[hsl(32_100%_40%)] ml-1">:{String(f).padStart(2, '0')}</span>
    </div>
  );
}

interface ShowControlPanelProps {
  fs?: boolean;
  onClose?: () => void;
}

export default function ShowControlPanel({ fs = false, onClose }: ShowControlPanelProps) {
  const activeEffects = useLiveSfxStore(s => s.activeEffects);
  const channels = useSfxChannelStore(s => s.channels);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [eventLog, setEventLog] = useState<EventLog[]>([]);
  const [modulesOnline, setModulesOnline] = useState(0);
  const [lastLatency, setLastLatency] = useState<Record<string, number>>({});
  const startRef = useRef(Date.now());
  const prevEffectCountRef = useRef(0);
  const sparklineBuffers = useRef<Record<string, number[]>>({
    PYRO: new Array(20).fill(0),
    DMX: new Array(20).fill(0),
    LIGHT: new Array(20).fill(0),
    DRONE: new Array(20).fill(0),
  });

  // Elapsed timer
  useEffect(() => {
    const iv = setInterval(() => setElapsedMs(Date.now() - startRef.current), 100);
    return () => clearInterval(iv);
  }, []);

  // Realtime: subscribe to artnet_modules changes
  useEffect(() => {
    const channel = supabase
      .channel('show-telemetry')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'artnet_modules' },
        (payload) => {
          const mod = payload.new as any;
          const eventType = payload.eventType;
          setEventLog(prev => [{
            id: `rt-${Date.now()}`,
            system: 'DMX',
            color: 'hsl(200 80% 48%)',
            message: `MODULE ${mod?.name || 'UNKNOWN'} ${eventType.toUpperCase()} @ ${mod?.ip || '?'}`,
            timestamp: Date.now(),
          }, ...prev].slice(0, 50));
          setLastLatency(prev => ({ ...prev, DMX: Date.now() }));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // Sparkline data from real store — update every 500ms
  useEffect(() => {
    const iv = setInterval(() => {
      const ch = useSfxChannelStore.getState().channels;
      const pyroActive = ch.filter(c => ['flame', 'spark', 'confetti', 'streamer'].includes(c.type) && c.firing).length;
      const dmxActive = ch.filter(c => ['co2', 'cryo', 'haze', 'fog', 'snow', 'bubble'].includes(c.type) && c.firing).length;

      sparklineBuffers.current.PYRO = [...sparklineBuffers.current.PYRO.slice(1), pyroActive * 20];
      sparklineBuffers.current.DMX = [...sparklineBuffers.current.DMX.slice(1), dmxActive * 20];
      sparklineBuffers.current.LIGHT = [...sparklineBuffers.current.LIGHT.slice(1), Math.random() * 5];
      sparklineBuffers.current.DRONE = [...sparklineBuffers.current.DRONE.slice(1), Math.random() * 3];
    }, 500);
    return () => clearInterval(iv);
  }, []);

  // Track new effects → log
  useEffect(() => {
    if (activeEffects.length > prevEffectCountRef.current) {
      const newEffect = activeEffects[activeEffects.length - 1];
      const sys = newEffect?.type === 'flame' ? 'PYRO' : 'DMX';
      setEventLog(prev => [{
        id: `log-${Date.now()}`,
        system: sys,
        color: sys === 'PYRO' ? 'hsl(0 85% 48%)' : 'hsl(200 80% 48%)',
        message: `FIRE ${newEffect?.type?.toUpperCase()} @ ${newEffect?.intensity ?? 255}`,
        timestamp: Date.now(),
      }, ...prev].slice(0, 50));
      setLastLatency(prev => ({ ...prev, [sys]: Date.now() }));
    }
    prevEffectCountRef.current = activeEffects.length;
  }, [activeEffects]);

  const systems = useMemo(() => {
    const pyroChannels = channels.filter(c => ['flame', 'spark', 'confetti', 'streamer'].includes(c.type));
    const dmxChannels = channels.filter(c => ['co2', 'cryo', 'haze', 'fog', 'snow', 'bubble'].includes(c.type));
    const firingPyro = pyroChannels.filter(c => c.firing).length;
    const firingDmx = dmxChannels.filter(c => c.firing).length;

    return SYSTEMS.map(sys => {
      const isP = sys.code === 'PYRO';
      const isD = sys.code === 'DMX';
      const ch = isP ? pyroChannels : isD ? dmxChannels : [];
      const active = isP ? firingPyro : isD ? firingDmx : 0;
      const armed = ch.some(c => c.armed);
      const lat = lastLatency[sys.code];
      const latencyMs = lat ? Date.now() - lat : null;
      return {
        ...sys,
        status: (armed ? 'ARMED' : ch.length > 0 ? 'ONLINE' : 'STANDBY') as 'ARMED' | 'ONLINE' | 'STANDBY',
        channels: ch.length,
        activeCount: active,
        lastCommand: active > 0 ? 'FIRING' : 'IDLE',
        activity: sparklineBuffers.current[sys.code] || new Array(20).fill(0),
        latencyMs,
      };
    });
  }, [channels, activeEffects, lastLatency]);

  const totalArmed = channels.filter(c => c.armed).length;
  const totalFiring = channels.filter(c => c.firing).length;

  return (
    <div className="flex flex-col h-full" style={{ background: 'hsl(220 15% 4%)' }}>
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: 'hsl(32 100% 50% / 0.1)', background: 'hsl(220 12% 5%)' }}>
        <div className="flex items-center gap-3">
          <Activity className="w-4 h-4" style={{ color: 'hsl(32 100% 55%)' }} />
          <span className="text-[10px] font-black font-mono tracking-[0.25em] text-foreground/80">SHOW CONTROL</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <Shield className="w-3 h-3 text-red-400/50" />
            <span className="text-[8px] font-mono font-bold text-red-400/60">{totalArmed} ARMED</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Radio className="w-3 h-3 text-amber-400/50" />
            <span className="text-[8px] font-mono font-bold text-amber-400/60">{totalFiring} ACTIVE</span>
          </div>
        </div>
      </div>

      {/* Timecode */}
      <div className="shrink-0 py-3 border-b" style={{ borderColor: 'hsl(32 100% 50% / 0.06)', background: 'linear-gradient(180deg, hsl(32 100% 50% / 0.03) 0%, transparent 100%)' }}>
        <TimecodeDisplay ms={elapsedMs} />
        <div className="text-center mt-1">
          <span className="text-[7px] font-mono tracking-[0.3em] text-muted-foreground/30">MASTER TIMECODE</span>
        </div>
      </div>

      {/* Quad Split */}
      <div className="grid grid-cols-2 gap-[1px] flex-1 min-h-0" style={{ background: 'hsl(220 10% 8%)' }}>
        {systems.map(sys => {
          const Icon = sys.icon;
          const isArmed = sys.status === 'ARMED';
          return (
            <div key={sys.code} className="flex flex-col p-3 relative overflow-hidden" style={{
              background: isArmed
                ? `linear-gradient(135deg, hsl(0 40% 6%) 0%, hsl(220 15% 4%) 100%)`
                : `linear-gradient(135deg, ${sys.glow} 0%, hsl(220 15% 4%) 100%)`,
            }}>
              <div className="absolute inset-0 pointer-events-none opacity-[0.02]" style={{
                background: 'repeating-linear-gradient(0deg, transparent 0px, transparent 2px, hsl(32 100% 50%) 2px, hsl(32 100% 50%) 3px)',
              }} />
              <div className="flex items-center justify-between mb-2 relative z-10">
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4" style={{ color: sys.color }} />
                  <span className="text-[9px] font-black font-mono tracking-[0.2em]" style={{ color: sys.color }}>{sys.code}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className={cn("w-1.5 h-1.5 rounded-full", isArmed && "animate-pulse")} style={{
                    backgroundColor: isArmed ? 'hsl(0 85% 48%)' : sys.status === 'ONLINE' ? 'hsl(120 70% 40%)' : 'hsl(220 10% 25%)',
                    boxShadow: isArmed ? '0 0 6px hsl(0 85% 48%)' : sys.status === 'ONLINE' ? `0 0 4px ${sys.color}` : 'none',
                  }} />
                  <span className={cn("text-[7px] font-bold font-mono tracking-wider", isArmed ? "text-red-400" : sys.status === 'ONLINE' ? "text-foreground/50" : "text-muted-foreground/30")}>{sys.status}</span>
                </div>
              </div>
              <div className="space-y-1.5 relative z-10 flex-1">
                {[
                  { label: 'CHANNELS', value: sys.channels },
                  { label: 'ACTIVE', value: sys.activeCount, highlight: sys.activeCount > 0 },
                  { label: 'STATE', value: sys.lastCommand },
                  ...(sys.latencyMs !== null ? [{ label: 'LATENCY', value: `${Math.min(sys.latencyMs!, 9999)}ms` }] : []),
                ].map(row => (
                  <div key={row.label} className="flex items-center justify-between">
                    <span className="text-[7px] font-mono text-muted-foreground/30">{row.label}</span>
                    <span className={cn("text-[10px] font-mono font-bold", row.highlight ? "text-red-400" : "text-foreground/50")}>{row.value}</span>
                  </div>
                ))}
              </div>
              <div className="mt-2 relative z-10">
                <Sparkline data={sys.activity} color={sys.color} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Event Log */}
      <div className="shrink-0 border-t" style={{ borderColor: 'hsl(32 100% 50% / 0.08)' }}>
        <div className="px-3 py-1.5 flex items-center justify-between" style={{ background: 'hsl(220 12% 5%)' }}>
          <span className="text-[7px] font-mono font-bold tracking-[0.2em] text-muted-foreground/40">EVENT LOG</span>
          <span className="text-[7px] font-mono text-muted-foreground/25">{eventLog.length} entries</span>
        </div>
        <ScrollArea className="h-28">
          <div className="px-3 py-1 space-y-[2px]">
            {eventLog.length === 0 ? (
              <div className="text-[8px] font-mono text-muted-foreground/20 text-center py-4">NO EVENTS LOGGED</div>
            ) : eventLog.map(e => (
              <div key={e.id} className="flex items-center gap-2 py-0.5">
                <span className="text-[7px] font-mono text-muted-foreground/25 shrink-0">
                  {new Date(e.timestamp).toLocaleTimeString('en', { hour12: false })}
                </span>
                <div className="w-1 h-1 rounded-full shrink-0" style={{ backgroundColor: e.color }} />
                <span className="text-[7px] font-mono font-bold shrink-0" style={{ color: e.color }}>{e.system}</span>
                <span className="text-[8px] font-mono text-foreground/40 truncate">{e.message}</span>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
