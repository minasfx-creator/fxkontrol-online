/**
 * DroneCommandPanel — FXK-DRONES · SWARM OPS 2.0
 * Mission control HUD with 4-quadrant layout, launch sequence, telemetry
 */
import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { useProjectStore } from '@/store/useProjectStore';
import {
  Shield, ShieldAlert, Radio, Signal, Battery, MapPin,
  Navigation, Activity, Layers, ChevronRight, Crosshair
} from 'lucide-react';

interface DroneCommandPanelProps {
  fs?: boolean;
}

type LaunchState = 'idle' | 'armed' | 'launching' | 'airborne';

// Simulated telemetry per drone
interface DroneTelemetry {
  id: number;
  alt: number;
  speed: number;
  heading: number;
  battery: number;
}

export default function DroneCommandPanel({ fs = false }: DroneCommandPanelProps) {
  const droneFormations = useProjectStore(s => s.droneFormations);
  const selectedFormationId = useProjectStore(s => s.selectedFormationId);

  const [launchState, setLaunchState] = useState<LaunchState>('idle');
  const [missionTimer, setMissionTimer] = useState(0);
  const [telemetry, setTelemetry] = useState<DroneTelemetry[]>([]);
  const svgRef = useRef<SVGSVGElement>(null);

  const fleetSize = useMemo(() => {
    if (droneFormations.length === 0) return 100;
    return droneFormations[0]?.droneCount ?? 100;
  }, [droneFormations]);

  const currentFormation = useMemo(() => {
    return droneFormations.find(f => f.id === selectedFormationId) ?? droneFormations[0];
  }, [droneFormations, selectedFormationId]);

  // Mission timer
  useEffect(() => {
    if (launchState !== 'airborne') return;
    const iv = setInterval(() => setMissionTimer(p => p + 1), 1000);
    return () => clearInterval(iv);
  }, [launchState]);

  // Simulated telemetry
  useEffect(() => {
    const iv = setInterval(() => {
      setTelemetry(
        Array.from({ length: Math.min(8, fleetSize) }, (_, i) => ({
          id: i + 1,
          alt: 25 + Math.random() * 55,
          speed: 2 + Math.random() * 8,
          heading: Math.floor(Math.random() * 360),
          battery: 75 + Math.random() * 25,
        }))
      );
    }, 1500);
    return () => clearInterval(iv);
  }, [fleetSize]);

  const preflight = useMemo(() => ({
    gps: true,
    battery: true,
    geofence: true,
    safety: launchState !== 'idle' || true,
    clearance: launchState === 'armed' || launchState === 'airborne' || launchState === 'launching',
  }), [launchState]);

  const allClear = Object.values(preflight).every(Boolean);

  const handleArm = useCallback(() => {
    if (launchState === 'idle') setLaunchState('armed');
  }, [launchState]);

  const handleLaunch = useCallback(() => {
    if (launchState === 'armed') {
      setLaunchState('launching');
      setTimeout(() => setLaunchState('airborne'), 2000);
    }
  }, [launchState]);

  const handleAbort = useCallback(() => {
    setLaunchState('idle');
    setMissionTimer(0);
  }, []);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  };

  return (
    <div
      className={cn("flex flex-col h-full overflow-hidden", fs ? "p-3" : "p-2")}
      style={{
        background: 'hsl(165 8% 5%)',
        backgroundImage: `
          repeating-linear-gradient(0deg, transparent, transparent 39px, hsl(165 100% 42% / 0.04) 39px, hsl(165 100% 42% / 0.04) 40px),
          repeating-linear-gradient(90deg, transparent, transparent 39px, hsl(165 100% 42% / 0.04) 39px, hsl(165 100% 42% / 0.04) 40px)
        `,
      }}
    >
      {/* ── Header ── */}
      <div className="mb-2 rounded overflow-hidden" style={{ border: '1px solid hsl(165 40% 18%)' }}>
        <div className="flex items-center justify-between px-3 py-2" style={{
          background: 'linear-gradient(135deg, hsl(165 15% 7%) 0%, hsl(165 10% 5%) 100%)',
          borderBottom: '2px solid hsl(165 100% 42%)',
        }}>
          <div className="flex items-center gap-2.5">
            <div className={cn("rounded flex items-center justify-center font-black text-white",
              fs ? "w-8 h-8 text-[10px]" : "w-6 h-6 text-[8px]"
            )} style={{ background: 'linear-gradient(135deg, hsl(165 100% 42%), hsl(165 60% 28%))' }}>
              DR
            </div>
            <div>
              <h3 className={cn("font-black uppercase tracking-[0.2em] font-mono", fs ? "text-sm" : "text-[10px]")} style={{ color: 'hsl(165 80% 60%)' }}>
                FXK-DRONES
              </h3>
              <p className={cn("font-mono tracking-wider", fs ? "text-[9px]" : "text-[7px]")} style={{ color: 'hsl(165 30% 35%)' }}>
                SWARM OPS 2.0 · {fleetSize} UNITS
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[7px] h-4 px-1.5 font-mono border-teal-500/20 text-teal-400">
              T+ {formatTime(missionTimer)}
            </Badge>
            <div className={cn("h-2 w-2 rounded-full", launchState === 'airborne' ? 'bg-teal-400 animate-pulse' : launchState === 'armed' ? 'bg-amber-400 animate-pulse' : 'bg-muted-foreground/20')}
              style={{ boxShadow: launchState === 'airborne' ? '0 0 8px hsl(165 100% 42%)' : 'none' }} />
          </div>
        </div>
      </div>

      {/* ── 4 Quadrant HUD ── */}
      <div className="flex-1 grid grid-cols-2 grid-rows-2 gap-1.5 min-h-0">
        {/* Q1: Fleet Status */}
        <div className="rounded border overflow-hidden flex flex-col" style={{ borderColor: 'hsl(165 20% 15%)', background: 'hsl(165 6% 7%)' }}>
          {/* HUD corner brackets */}
          <div className="relative flex-1 p-2">
            <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2" style={{ borderColor: 'hsl(165 100% 42% / 0.3)' }} />
            <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2" style={{ borderColor: 'hsl(165 100% 42% / 0.3)' }} />
            <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2" style={{ borderColor: 'hsl(165 100% 42% / 0.3)' }} />
            <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2" style={{ borderColor: 'hsl(165 100% 42% / 0.3)' }} />

            <p className="text-[7px] font-mono font-bold uppercase tracking-[0.2em] mb-1.5" style={{ color: 'hsl(165 60% 45%)' }}>Fleet Status</p>
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Layers className="w-3 h-3 text-teal-400/60" />
                <span className="text-[9px] font-mono text-teal-300 font-bold">{fleetSize}</span>
                <span className="text-[7px] font-mono text-muted-foreground/40">UNITS</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Battery className="w-3 h-3 text-teal-400/60" />
                <Progress value={88} className="h-1.5 flex-1" />
                <span className="text-[7px] font-mono text-teal-300">88%</span>
              </div>
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3 h-3 text-teal-400/60" />
                <span className="text-[8px] font-mono text-emerald-400">{fleetSize} GPS LOCK</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Signal className="w-3 h-3 text-teal-400/60" />
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map(b => (
                    <div key={b} className="w-1 rounded-sm" style={{ height: 4 + b * 2, backgroundColor: b <= 4 ? 'hsl(165 100% 42%)' : 'hsl(165 10% 20%)' }} />
                  ))}
                </div>
                <span className="text-[7px] font-mono text-muted-foreground/40">-42dBm</span>
              </div>
            </div>
          </div>
        </div>

        {/* Q2: Formation Preview */}
        <div className="rounded border overflow-hidden flex flex-col" style={{ borderColor: 'hsl(165 20% 15%)', background: 'hsl(165 6% 7%)' }}>
          <div className="relative flex-1 p-2">
            <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2" style={{ borderColor: 'hsl(165 100% 42% / 0.3)' }} />
            <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2" style={{ borderColor: 'hsl(165 100% 42% / 0.3)' }} />
            <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2" style={{ borderColor: 'hsl(165 100% 42% / 0.3)' }} />
            <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2" style={{ borderColor: 'hsl(165 100% 42% / 0.3)' }} />

            <p className="text-[7px] font-mono font-bold uppercase tracking-[0.2em] mb-1" style={{ color: 'hsl(165 60% 45%)' }}>Formation Preview</p>
            <svg ref={svgRef} viewBox="-50 -50 100 100" className="w-full h-full max-h-[120px]" style={{ background: 'hsl(165 4% 4%)' }}>
              {/* Grid */}
              <line x1="-50" y1="0" x2="50" y2="0" stroke="hsl(165 100% 42% / 0.08)" strokeWidth="0.3" />
              <line x1="0" y1="-50" x2="0" y2="50" stroke="hsl(165 100% 42% / 0.08)" strokeWidth="0.3" />
              {/* Crosshair */}
              <circle cx="0" cy="0" r="2" stroke="hsl(165 100% 42% / 0.15)" fill="none" strokeWidth="0.3" />
              {/* Formation dots */}
              {(currentFormation?.points || []).slice(0, 200).map((p, i) => (
                <circle key={i} cx={p.x * 2} cy={p.z * 2} r="0.6" fill="hsl(165 100% 55%)" opacity={0.8} />
              ))}
              {(!currentFormation?.points || currentFormation.points.length === 0) && (
                <text x="0" y="3" textAnchor="middle" fill="hsl(165 30% 30%)" fontSize="5" fontFamily="monospace">NO FORMATION</text>
              )}
            </svg>
          </div>
        </div>

        {/* Q3: Mission Timeline */}
        <div className="rounded border overflow-hidden flex flex-col" style={{ borderColor: 'hsl(165 20% 15%)', background: 'hsl(165 6% 7%)' }}>
          <div className="relative flex-1 p-2">
            <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2" style={{ borderColor: 'hsl(165 100% 42% / 0.3)' }} />
            <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2" style={{ borderColor: 'hsl(165 100% 42% / 0.3)' }} />
            <p className="text-[7px] font-mono font-bold uppercase tracking-[0.2em] mb-1.5" style={{ color: 'hsl(165 60% 45%)' }}>Mission Timeline</p>
            <ScrollArea className="h-full max-h-[100px]">
              <div className="flex items-center gap-1 overflow-x-auto pb-1">
                {droneFormations.length === 0 && (
                  <span className="text-[8px] font-mono text-muted-foreground/30">NO WAYPOINTS</span>
                )}
                {droneFormations.map((f, i) => (
                  <div key={f.id} className="flex items-center gap-1 shrink-0">
                    <div className={cn(
                      "rounded px-1.5 py-1 border font-mono text-[7px] uppercase",
                      f.id === selectedFormationId
                        ? "border-teal-500/50 bg-teal-500/15 text-teal-300"
                        : "border-teal-500/10 bg-teal-500/5 text-teal-400/50"
                    )}>
                      <div className="font-bold">{f.formationType?.slice(0, 6) || `F${i + 1}`}</div>
                      <div className="text-[6px] text-muted-foreground/30">{f.transitionDuration}s</div>
                    </div>
                    {i < droneFormations.length - 1 && (
                      <ChevronRight className="w-2.5 h-2.5 text-teal-500/20 shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>

        {/* Q4: Telemetry Feed */}
        <div className="rounded border overflow-hidden flex flex-col" style={{ borderColor: 'hsl(165 20% 15%)', background: 'hsl(165 6% 7%)' }}>
          <div className="relative flex-1 p-2">
            <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2" style={{ borderColor: 'hsl(165 100% 42% / 0.3)' }} />
            <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2" style={{ borderColor: 'hsl(165 100% 42% / 0.3)' }} />
            <p className="text-[7px] font-mono font-bold uppercase tracking-[0.2em] mb-1" style={{ color: 'hsl(165 60% 45%)' }}>Telemetry Feed</p>
            <ScrollArea className="h-full max-h-[100px]">
              <div className="space-y-0.5 font-mono text-[7px]">
                {telemetry.map(t => (
                  <div key={t.id} className="flex items-center gap-2 text-teal-300/60">
                    <span className="text-teal-500/40 w-4">D{String(t.id).padStart(2, '0')}</span>
                    <span>ALT:{t.alt.toFixed(0)}m</span>
                    <span>SPD:{t.speed.toFixed(1)}m/s</span>
                    <span>HDG:{t.heading}°</span>
                    <span className={t.battery < 80 ? 'text-amber-400' : ''}>{t.battery.toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>
      </div>

      {/* ── Launch Bar ── */}
      <div className="mt-2 rounded border overflow-hidden" style={{ borderColor: 'hsl(165 20% 15%)', background: 'hsl(165 6% 8%)' }}>
        <div className="px-3 py-2">
          {/* Pre-flight checklist */}
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            {Object.entries(preflight).map(([key, ok]) => (
              <div key={key} className={cn(
                "flex items-center gap-1 rounded px-1.5 py-0.5 border font-mono text-[7px] font-bold uppercase",
                ok
                  ? "border-teal-500/20 bg-teal-500/8 text-teal-400"
                  : "border-red-500/20 bg-red-500/8 text-red-400"
              )}>
                <span>{ok ? '✓' : '✗'}</span>
                <span>{key}</span>
              </div>
            ))}
          </div>

          {/* ARM / LAUNCH buttons */}
          <div className="flex gap-2">
            {launchState === 'idle' && (
              <button
                onClick={handleArm}
                disabled={!allClear}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 rounded border-2 font-black uppercase tracking-[0.2em] font-mono transition-all min-h-[48px]",
                  allClear
                    ? "border-amber-500/50 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 active:scale-[0.97]"
                    : "border-border/10 text-muted-foreground/20"
                )}
                style={{ boxShadow: allClear ? 'inset 0 2px 4px rgba(0,0,0,0.3)' : 'none' }}
              >
                <Shield className="w-4 h-4" />
                ARM SWARM
              </button>
            )}
            {launchState === 'armed' && (
              <>
                <button
                  onClick={handleAbort}
                  className="flex-1 flex items-center justify-center gap-2 rounded border-2 border-red-500/40 bg-red-500/10 text-red-400 font-black uppercase tracking-[0.15em] font-mono min-h-[48px] hover:bg-red-500/20 transition-all active:scale-[0.97]"
                >
                  ABORT
                </button>
                <button
                  onClick={handleLaunch}
                  className="flex-[2] flex items-center justify-center gap-2 rounded border-2 border-teal-500/60 font-black uppercase tracking-[0.2em] font-mono min-h-[48px] transition-all active:scale-[0.97] animate-pulse"
                  style={{
                    background: 'linear-gradient(180deg, hsl(165 40% 15%) 0%, hsl(165 30% 8%) 100%)',
                    color: 'hsl(165 100% 60%)',
                    boxShadow: '0 0 20px hsl(165 100% 42% / 0.2), inset 0 2px 4px rgba(0,0,0,0.3)',
                  }}
                >
                  <Navigation className="w-5 h-5" />
                  LAUNCH
                </button>
              </>
            )}
            {(launchState === 'launching' || launchState === 'airborne') && (
              <>
                <button
                  onClick={handleAbort}
                  className="flex-1 flex items-center justify-center gap-2 rounded border-2 border-red-500/40 bg-red-500/10 text-red-400 font-black uppercase tracking-[0.15em] font-mono min-h-[48px] hover:bg-red-500/20 transition-all"
                >
                  RTL
                </button>
                <div className="flex-[2] flex items-center justify-center gap-2 rounded border-2 border-teal-500/30 font-bold uppercase tracking-[0.15em] font-mono min-h-[48px]"
                  style={{ background: 'hsl(165 20% 10%)', color: 'hsl(165 80% 55%)' }}>
                  <Activity className="w-4 h-4 animate-pulse" />
                  {launchState === 'launching' ? 'LAUNCHING...' : `AIRBORNE · T+${formatTime(missionTimer)}`}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
