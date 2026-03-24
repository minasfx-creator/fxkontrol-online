/**
 * ShowControlPanel — Mission Control Macro Dashboard
 * Real-time monitoring of all 4 systems: PYRO, DMX, LIGHT, DRONE
 * Enhanced: circular gauges, threat level, mission clock, heartbeat, system health
 */
import { useState, useEffect, useRef, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Flame, Zap, Gauge, Layers, Activity, Radio, Shield, AlertTriangle, Clock, Wifi, Thermometer, Eye, Play, Square, Lock, Unlock } from 'lucide-react';
import { useLiveSfxStore } from '@/store/useLiveSfxStore';
import { useSfxChannelStore } from '@/store/useSfxChannelStore';
import { useProjectStore } from '@/store/useProjectStore';
import { useSMPTEStore } from '@/store/useSMPTEStore';
import { frameSyncEngine, type FrameSyncState } from '@/core/sync/frameSyncEngine';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea } from '@/components/ui/scroll-area';

interface EventLog {
  id: string;
  system: string;
  color: string;
  message: string;
  timestamp: number;
  severity: 'info' | 'warn' | 'critical';
}

const SYSTEMS = [
  { name: 'FXK-PYRO', code: 'PYRO', icon: Flame, color: 'hsl(0 85% 48%)', glow: 'hsl(0 85% 48% / 0.08)', desc: 'PYROTECHNIC FIRE' },
  { name: 'FXK-DMX', code: 'DMX', icon: Zap, color: 'hsl(200 80% 48%)', glow: 'hsl(200 80% 48% / 0.08)', desc: 'SPECIAL EFFECTS' },
  { name: 'FXK-LIGHT', code: 'LIGHT', icon: Gauge, color: 'hsl(240 50% 52%)', glow: 'hsl(240 50% 52% / 0.08)', desc: 'LIGHTING CTRL' },
  { name: 'FXK-DRONE', code: 'DRONE', icon: Layers, color: 'hsl(165 100% 42%)', glow: 'hsl(165 100% 42% / 0.08)', desc: 'SWARM OPS' },
];

/* Circular gauge for system health */
function CircularGauge({ value, max, color, label, size = 48 }: { value: number; max: number; color: string; label: string; size?: number }) {
  const pct = max > 0 ? Math.min(value / max, 1) : 0;
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct);
  return (
    <div className="flex flex-col items-center gap-0.5">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(220 10% 12%)" strokeWidth={3} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={3}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          className="transition-all duration-500"
          style={{ filter: pct > 0.7 ? `drop-shadow(0 0 3px ${color})` : 'none' }}
        />
      </svg>
      <span className="text-[6px] font-mono font-bold tracking-wider text-muted-foreground/40">{label}</span>
    </div>
  );
}

/* Animated sparkline */
function Sparkline({ data, color, height = 20 }: { data: number[]; color: string; height?: number }) {
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-[1px]" style={{ height }}>
      {data.map((v, i) => (
        <div
          key={i}
          className="w-[3px] rounded-t-sm transition-all duration-300"
          style={{
            height: `${(v / max) * 100}%`,
            backgroundColor: v > 0 ? color : 'hsl(220 10% 12%)',
            opacity: 0.3 + (i / data.length) * 0.7,
          }}
        />
      ))}
    </div>
  );
}

/* Heartbeat line */
function HeartbeatLine({ active, color }: { active: boolean; color: string }) {
  return (
    <div className="flex items-center gap-[1px] h-3 overflow-hidden">
      {Array.from({ length: 24 }, (_, i) => {
        const isSpike = active && (i === 8 || i === 10 || i === 16 || i === 18);
        const h = isSpike ? '100%' : active ? `${15 + Math.sin(i * 0.6) * 10}%` : '2px';
        return <div key={i} className="w-[2px] transition-all duration-200" style={{ height: h, backgroundColor: color, opacity: 0.3 + (i / 24) * 0.5 }} />;
      })}
    </div>
  );
}

function TimecodeDisplay({ seconds, fps }: { seconds: number; fps: number }) {
  const totalMs = seconds * 1000;
  const h = Math.floor(totalMs / 3600000);
  const m = Math.floor((totalMs % 3600000) / 60000);
  const s = Math.floor((totalMs % 60000) / 1000);
  const f = Math.floor((totalMs % 1000) / (1000 / fps));
  return (
    <div className="font-mono font-black text-center select-none">
      <div className="flex items-center justify-center gap-1">
        {[String(h).padStart(2, '0'), String(m).padStart(2, '0'), String(s).padStart(2, '0')].map((seg, i) => (
          <span key={i} className="flex items-center">
            {i > 0 && <span className="text-lg mx-0.5 animate-pulse" style={{ color: 'hsl(32 100% 40%)' }}>:</span>}
            <span className="text-2xl tracking-[0.12em] px-1 rounded" style={{ color: 'hsl(32 100% 60%)', textShadow: '0 0 12px hsl(32 100% 50% / 0.3)' }}>{seg}</span>
          </span>
        ))}
        <span className="text-sm ml-1" style={{ color: 'hsl(32 100% 35%)' }}>:{String(f).padStart(2, '0')}</span>
      </div>
    </div>
  );
}

/* Threat level indicator */
function ThreatLevel({ level }: { level: 0 | 1 | 2 | 3 }) {
  const labels = ['SAFE', 'CAUTION', 'ELEVATED', 'CRITICAL'];
  const colors = ['hsl(120 70% 40%)', 'hsl(45 100% 50%)', 'hsl(25 100% 50%)', 'hsl(0 85% 48%)'];
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-[2px]">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className={cn("w-2 h-3 rounded-sm transition-all", i <= level && "animate-pulse")}
            style={{ backgroundColor: i <= level ? colors[level] : 'hsl(220 10% 15%)', boxShadow: i <= level ? `0 0 4px ${colors[level]}` : 'none' }} />
        ))}
      </div>
      <span className="text-[7px] font-mono font-bold tracking-wider" style={{ color: colors[level] }}>{labels[level]}</span>
    </div>
  );
}

export default function ShowControlPanel({ fs = false }: { fs?: boolean; onClose?: () => void }) {
  const activeEffects = useLiveSfxStore(s => s.activeEffects);
  const channels = useSfxChannelStore(s => s.channels);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [eventLog, setEventLog] = useState<EventLog[]>([]);
  const [lastLatency, setLastLatency] = useState<Record<string, number>>({});
  const startRef = useRef(Date.now());
  const prevEffectCountRef = useRef(0);
  const sparklineBuffers = useRef<Record<string, number[]>>({
    PYRO: new Array(20).fill(0), DMX: new Array(20).fill(0),
    LIGHT: new Array(20).fill(0), DRONE: new Array(20).fill(0),
  });

  useEffect(() => {
    const iv = setInterval(() => setElapsedMs(Date.now() - startRef.current), 100);
    return () => clearInterval(iv);
  }, []);

  // Realtime
  useEffect(() => {
    const channel = supabase.channel('show-telemetry')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'artnet_modules' }, (payload) => {
        const mod = payload.new as any;
        setEventLog(prev => [{
          id: `rt-${Date.now()}`, system: 'DMX', color: 'hsl(200 80% 48%)',
          message: `MODULE ${mod?.name || '?'} ${payload.eventType.toUpperCase()} @ ${mod?.ip || '?'}`,
          timestamp: Date.now(), severity: 'info' as const,
        }, ...prev].slice(0, 50));
        setLastLatency(prev => ({ ...prev, DMX: Date.now() }));
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // Sparklines
  useEffect(() => {
    const iv = setInterval(() => {
      const ch = useSfxChannelStore.getState().channels;
      const pa = ch.filter(c => ['flame', 'spark', 'confetti', 'streamer'].includes(c.type) && c.firing).length;
      const da = ch.filter(c => ['co2', 'cryo', 'haze', 'fog', 'snow', 'bubble'].includes(c.type) && c.firing).length;
      sparklineBuffers.current.PYRO = [...sparklineBuffers.current.PYRO.slice(1), pa * 25];
      sparklineBuffers.current.DMX = [...sparklineBuffers.current.DMX.slice(1), da * 25];
      sparklineBuffers.current.LIGHT = [...sparklineBuffers.current.LIGHT.slice(1), Math.random() * 8];
      sparklineBuffers.current.DRONE = [...sparklineBuffers.current.DRONE.slice(1), Math.random() * 5];
    }, 500);
    return () => clearInterval(iv);
  }, []);

  // Effect log
  useEffect(() => {
    if (activeEffects.length > prevEffectCountRef.current) {
      const ne = activeEffects[activeEffects.length - 1];
      const sys = ne?.type === 'flame' ? 'PYRO' : 'DMX';
      setEventLog(prev => [{
        id: `log-${Date.now()}`, system: sys,
        color: sys === 'PYRO' ? 'hsl(0 85% 48%)' : 'hsl(200 80% 48%)',
        message: `FIRE ${ne?.type?.toUpperCase()} · INT ${ne?.intensity ?? 255} · DUR ${ne?.duration ?? 0}ms`,
        timestamp: Date.now(), severity: (sys === 'PYRO' ? 'warn' : 'info') as EventLog['severity'],
      }, ...prev].slice(0, 50));
      setLastLatency(prev => ({ ...prev, [sys]: Date.now() }));
    }
    prevEffectCountRef.current = activeEffects.length;
  }, [activeEffects]);

  const systems = useMemo(() => {
    const pyroChannels = channels.filter(c => ['flame', 'spark', 'confetti', 'streamer'].includes(c.type));
    const dmxChannels = channels.filter(c => ['co2', 'cryo', 'haze', 'fog', 'snow', 'bubble'].includes(c.type));
    return SYSTEMS.map(sys => {
      const ch = sys.code === 'PYRO' ? pyroChannels : sys.code === 'DMX' ? dmxChannels : [];
      const active = ch.filter(c => c.firing).length;
      const armed = ch.some(c => c.armed);
      const lat = lastLatency[sys.code];
      return {
        ...sys, status: (armed ? 'ARMED' : ch.length > 0 ? 'ONLINE' : 'STANDBY') as 'ARMED' | 'ONLINE' | 'STANDBY',
        channels: ch.length, activeCount: active,
        activity: sparklineBuffers.current[sys.code] || new Array(20).fill(0),
        latencyMs: lat ? Date.now() - lat : null,
        health: ch.length > 0 ? (armed ? 95 : 75) : 0,
      };
    });
  }, [channels, activeEffects, lastLatency]);

  const totalArmed = channels.filter(c => c.armed).length;
  const totalFiring = channels.filter(c => c.firing).length;
  const threatLevel = totalFiring > 3 ? 3 : totalArmed > 0 ? 2 : totalFiring > 0 ? 1 : 0;

  return (
    <div className="flex flex-col h-full select-none" style={{ background: 'hsl(220 15% 4%)' }}>
      {/* Scanlines */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.015] z-0" style={{
        background: 'repeating-linear-gradient(0deg, transparent 0px, transparent 2px, hsl(32 100% 50%) 2px, hsl(32 100% 50%) 3px)',
      }} />

      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b flex items-center justify-between relative z-10" style={{ borderColor: 'hsl(32 100% 50% / 0.1)', background: 'linear-gradient(90deg, hsl(32 100% 50% / 0.04) 0%, hsl(220 12% 5%) 100%)' }}>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Eye className="w-5 h-5" style={{ color: 'hsl(32 100% 55%)' }} />
            <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          </div>
          <div>
            <span className="text-[10px] font-black font-mono tracking-[0.25em] text-foreground/80 block">MISSION CONTROL</span>
            <span className="text-[6px] font-mono tracking-[0.2em] text-muted-foreground/30">SHOW OVERVIEW · 4 SYSTEMS</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <ThreatLevel level={threatLevel as 0 | 1 | 2 | 3} />
          <div className="flex items-center gap-1.5">
            <Shield className="w-3 h-3 text-red-400/50" />
            <span className="text-[8px] font-mono font-bold text-red-400/60">{totalArmed} ARM</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Radio className="w-3 h-3 text-amber-400/50" />
            <span className="text-[8px] font-mono font-bold text-amber-400/60">{totalFiring} HOT</span>
          </div>
        </div>
      </div>

      {/* Mission Clock + Global Gauges */}
      <div className="shrink-0 py-3 px-4 border-b flex items-center justify-between relative z-10" style={{ borderColor: 'hsl(32 100% 50% / 0.06)', background: 'linear-gradient(180deg, hsl(32 100% 50% / 0.02) 0%, transparent 100%)' }}>
        <div className="flex items-center gap-3">
          <CircularGauge value={totalArmed} max={channels.length || 1} color="hsl(0 85% 48%)" label="ARMED" />
          <CircularGauge value={totalFiring} max={Math.max(totalArmed, 1)} color="hsl(32 100% 55%)" label="FIRING" />
        </div>
        <TimecodeDisplay ms={elapsedMs} />
        <div className="flex items-center gap-3">
          <CircularGauge value={channels.filter(c => c.enabled).length} max={channels.length || 1} color="hsl(120 70% 45%)" label="ONLINE" />
          <CircularGauge value={4} max={4} color="hsl(200 80% 50%)" label="SYSTEMS" />
        </div>
      </div>

      {/* Quad Split */}
      <div className="grid grid-cols-2 gap-[1px] flex-1 min-h-0 relative z-10" style={{ background: 'hsl(220 10% 6%)' }}>
        {systems.map(sys => {
          const Icon = sys.icon;
          const isArmed = sys.status === 'ARMED';
          const isFiring = sys.activeCount > 0;
          return (
            <div key={sys.code} className="flex flex-col p-3 relative overflow-hidden" style={{
              background: isFiring
                ? `linear-gradient(135deg, hsl(0 40% 7%) 0%, hsl(220 15% 4%) 100%)`
                : isArmed
                  ? `linear-gradient(135deg, hsl(0 30% 6%) 0%, hsl(220 15% 4%) 100%)`
                  : `linear-gradient(135deg, ${sys.glow} 0%, hsl(220 15% 4%) 100%)`,
            }}>
              {/* Top border accent */}
              <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, ${sys.color}, transparent)`, opacity: isArmed ? 0.6 : 0.2 }} />

              <div className="flex items-center justify-between mb-2 relative z-10">
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded" style={{ background: `${sys.color}15` }}>
                    <Icon className="w-3.5 h-3.5" style={{ color: sys.color }} />
                  </div>
                  <div>
                    <span className="text-[9px] font-black font-mono tracking-[0.2em] block" style={{ color: sys.color }}>{sys.code}</span>
                    <span className="text-[5px] font-mono tracking-wider text-muted-foreground/25">{sys.desc}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className={cn("w-1.5 h-1.5 rounded-full", (isArmed || isFiring) && "animate-pulse")} style={{
                    backgroundColor: isFiring ? 'hsl(0 85% 55%)' : isArmed ? 'hsl(45 100% 50%)' : sys.status === 'ONLINE' ? 'hsl(120 70% 40%)' : 'hsl(220 10% 25%)',
                    boxShadow: isFiring ? '0 0 8px hsl(0 85% 48%)' : isArmed ? '0 0 6px hsl(45 100% 50%)' : sys.status === 'ONLINE' ? `0 0 4px ${sys.color}` : 'none',
                  }} />
                  <span className={cn("text-[7px] font-bold font-mono tracking-wider",
                    isFiring ? "text-red-400" : isArmed ? "text-yellow-400" : sys.status === 'ONLINE' ? "text-foreground/50" : "text-muted-foreground/25"
                  )}>{isFiring ? 'FIRING' : sys.status}</span>
                </div>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 relative z-10 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-[6px] font-mono text-muted-foreground/25">CH</span>
                  <span className="text-[10px] font-mono font-bold text-foreground/50">{sys.channels}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[6px] font-mono text-muted-foreground/25">ACTIVE</span>
                  <span className={cn("text-[10px] font-mono font-bold", sys.activeCount > 0 ? "text-red-400" : "text-foreground/30")}>{sys.activeCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[6px] font-mono text-muted-foreground/25">HLTH</span>
                  <span className="text-[10px] font-mono font-bold text-green-400/60">{sys.health}%</span>
                </div>
                {sys.latencyMs !== null && (
                  <div className="flex items-center justify-between">
                    <span className="text-[6px] font-mono text-muted-foreground/25">LAT</span>
                    <span className="text-[10px] font-mono font-bold text-amber-400/60">{Math.min(sys.latencyMs!, 9999)}ms</span>
                  </div>
                )}
              </div>

              {/* Heartbeat + sparkline */}
              <div className="mt-2 relative z-10 space-y-1">
                <HeartbeatLine active={sys.activeCount > 0 || sys.status === 'ONLINE'} color={sys.color} />
                <Sparkline data={sys.activity} color={sys.color} height={16} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Event Log */}
      <div className="shrink-0 border-t relative z-10" style={{ borderColor: 'hsl(32 100% 50% / 0.08)' }}>
        <div className="px-3 py-1.5 flex items-center justify-between" style={{ background: 'hsl(220 12% 5%)' }}>
          <div className="flex items-center gap-2">
            <Activity className="w-3 h-3 text-amber-400/40" />
            <span className="text-[7px] font-mono font-bold tracking-[0.2em] text-muted-foreground/40">LIVE EVENT STREAM</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1 h-1 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[6px] font-mono text-muted-foreground/25">{eventLog.length} EVENTS</span>
          </div>
        </div>
        <ScrollArea className="h-28">
          <div className="px-3 py-1 space-y-[2px]">
            {eventLog.length === 0 ? (
              <div className="text-[8px] font-mono text-muted-foreground/15 text-center py-4 flex items-center justify-center gap-2">
                <Wifi className="w-3 h-3" />MONITORING · NO EVENTS
              </div>
            ) : eventLog.map(e => (
              <div key={e.id} className="flex items-center gap-2 py-0.5" style={{ borderLeft: `2px solid ${e.color}20`, paddingLeft: 4 }}>
                <span className="text-[6px] font-mono text-muted-foreground/20 shrink-0 w-14">
                  {new Date(e.timestamp).toLocaleTimeString('en', { hour12: false })}
                </span>
                {e.severity === 'critical' && <AlertTriangle className="w-2.5 h-2.5 text-red-400 shrink-0" />}
                <div className="w-1 h-1 rounded-full shrink-0" style={{ backgroundColor: e.color }} />
                <span className="text-[7px] font-mono font-bold shrink-0 w-8" style={{ color: e.color }}>{e.system}</span>
                <span className="text-[7px] font-mono text-foreground/40 truncate">{e.message}</span>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
