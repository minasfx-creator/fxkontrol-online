/**
 * PerformanceProfilerTab — Visual performance profiler
 * Flame chart, memory timeline, degradation alerts.
 */
import { useState, useEffect, useMemo } from 'react';
import { AlertTriangle, Activity, Cpu, Gauge, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import Sparkline from '@/components/ui/Sparkline';
import {
  getFrameHistory,
  getMemoryHistory,
  getDegradationLog,
  getActiveAlerts,
  getAllAlerts,
  type FrameSample,
  type MemorySnapshot,
  type PerfAlert,
  type DegradationTransition,
} from '@/core/performance/PerformanceProfilerService';
import { getDegradationLevel } from '@/lib/hardening/runtimeSafety';
import { getMetricsSnapshot } from '@/lib/hardening/observability';

// ── Flame Chart ──────────────────────────────────────────────
function FlameChart({ frames }: { frames: FrameSample[] }) {
  const visible = frames.slice(-300);
  const W = 600;
  const H = 100;
  const BUDGET = 16.67;
  const barW = visible.length > 0 ? Math.max(W / visible.length, 1) : 2;

  const maxFt = Math.max(33, ...visible.map(f => f.frameTimeMs));

  const [hover, setHover] = useState<number | null>(null);
  const hovered = hover !== null ? visible[hover] : null;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between px-1">
        <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/50">
          Frame Time Distribution
        </span>
        {hovered && (
          <span className="text-[8px] font-mono text-muted-foreground">
            {hovered.frameTimeMs.toFixed(1)}ms · {hovered.drawCalls} draws · {(hovered.triangles / 1000).toFixed(0)}k tris
          </span>
        )}
      </div>
      <div className="rounded-lg border border-border/10 bg-card/20 p-1 overflow-x-auto">
        <svg
          width={W}
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          style={{ minWidth: 300 }}
          onMouseLeave={() => setHover(null)}
        >
          {/* Budget line */}
          <line
            x1={0}
            y1={H - (BUDGET / maxFt) * H}
            x2={W}
            y2={H - (BUDGET / maxFt) * H}
            stroke="hsl(var(--destructive))"
            strokeWidth="0.5"
            strokeDasharray="4 2"
            opacity={0.5}
          />
          <text
            x={4}
            y={H - (BUDGET / maxFt) * H - 2}
            fill="hsl(var(--destructive))"
            fontSize="7"
            opacity={0.6}
          >
            16.67ms
          </text>

          {visible.map((f, i) => {
            const h = Math.min((f.frameTimeMs / maxFt) * H, H);
            const color =
              f.frameTimeMs < 16 ? 'hsl(142, 71%, 45%)' :
              f.frameTimeMs < 33 ? 'hsl(38, 92%, 50%)' :
              'hsl(0, 84%, 60%)';
            return (
              <rect
                key={i}
                x={i * barW}
                y={H - h}
                width={Math.max(barW - 0.5, 0.5)}
                height={h}
                fill={color}
                opacity={hover === i ? 1 : 0.7}
                onMouseEnter={() => setHover(i)}
                className="cursor-crosshair"
              />
            );
          })}
        </svg>
      </div>
    </div>
  );
}

// ── Memory Timeline ──────────────────────────────────────────
function MemoryTimeline({ snapshots }: { snapshots: MemorySnapshot[] }) {
  const W = 600;
  const H = 80;

  if (snapshots.length < 2) {
    return (
      <div className="text-center py-4 text-[9px] text-muted-foreground/40">
        Aguardando amostras de memória...
      </div>
    );
  }

  const maxHeap = Math.max(100, ...snapshots.map(s => s.jsHeapMB));
  const maxVRAM = Math.max(50, ...snapshots.map(s => s.estimatedVRAM));
  const scaleY = (v: number, max: number) => H - (v / max) * (H - 4) - 2;

  // JS Heap area
  const heapPoints = snapshots.map((s, i) => {
    const x = (i / (snapshots.length - 1)) * W;
    const y = scaleY(s.jsHeapMB, maxHeap);
    return `${x},${y}`;
  });
  const heapArea = `M0,${H} L${heapPoints.join(' L')} L${W},${H} Z`;
  const heapLine = `M${heapPoints.join(' L')}`;

  // VRAM line
  const vramLine = `M${snapshots.map((s, i) => {
    const x = (i / (snapshots.length - 1)) * W;
    const y = scaleY(s.estimatedVRAM, maxVRAM);
    return `${x},${y}`;
  }).join(' L')}`;

  const lastSnap = snapshots[snapshots.length - 1];

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between px-1">
        <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/50">
          Memory Timeline
        </span>
        <div className="flex items-center gap-2">
          <span className="text-[8px] font-mono text-blue-400">Heap: {lastSnap.jsHeapMB}MB</span>
          <span className="text-[8px] font-mono text-amber-400">VRAM: ~{lastSnap.estimatedVRAM.toFixed(1)}MB</span>
        </div>
      </div>
      <div className="rounded-lg border border-border/10 bg-card/20 p-1">
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="w-full">
          {/* Heap area */}
          <path d={heapArea} fill="hsl(217, 91%, 60%)" opacity={0.15} />
          <path d={heapLine} fill="none" stroke="hsl(217, 91%, 60%)" strokeWidth="1.2" />
          {/* VRAM line */}
          <path d={vramLine} fill="none" stroke="hsl(38, 92%, 50%)" strokeWidth="1" strokeDasharray="3 2" />
        </svg>
      </div>
      {/* Geo/Tex badges */}
      <div className="flex items-center gap-2 px-1">
        <Badge variant="outline" className="text-[7px] h-4 px-1 border-border/10 text-muted-foreground/40">
          {lastSnap.geometries} geo
        </Badge>
        <Badge variant="outline" className="text-[7px] h-4 px-1 border-border/10 text-muted-foreground/40">
          {lastSnap.textures} tex
        </Badge>
      </div>
    </div>
  );
}

// ── Alert Feed ───────────────────────────────────────────────
function AlertFeed({ alerts, degradation }: { alerts: PerfAlert[]; degradation: string }) {
  const degColors: Record<string, string> = {
    none: 'border-green-500/30 text-green-400',
    mild: 'border-amber-500/30 text-amber-400',
    moderate: 'border-orange-500/30 text-orange-400',
    severe: 'border-red-500/30 text-red-400',
    critical: 'border-red-500/50 text-red-400',
  };

  const sevColors: Record<string, string> = {
    warning: 'border-amber-500/20 bg-amber-500/5 text-amber-400',
    critical: 'border-red-500/20 bg-red-500/5 text-red-400',
  };

  const activeAlerts = alerts.filter(a => !a.resolved).slice(-10);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between px-1">
        <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/50">
          Degradation & Alerts
        </span>
        <Badge variant="outline" className={cn("text-[8px] h-4 px-1.5", degColors[degradation] ?? degColors.none)}>
          {degradation.toUpperCase()}
        </Badge>
      </div>

      {activeAlerts.length === 0 ? (
        <div className="text-center py-2 text-[8px] text-muted-foreground/30">
          Sem alertas ativos
        </div>
      ) : (
        <div className="space-y-1">
          {activeAlerts.map(a => (
            <div
              key={a.id}
              className={cn(
                "flex items-center gap-1.5 px-2 py-1 rounded-md border text-[8px]",
                sevColors[a.severity]
              )}
            >
              <AlertTriangle className="w-3 h-3 shrink-0" />
              <span className="font-bold">{a.type}</span>
              <span className="text-muted-foreground/60 truncate flex-1">{a.message}</span>
              <span className="font-mono text-muted-foreground/30">
                {new Date(a.timestamp).toLocaleTimeString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────
export default function PerformanceProfilerTab() {
  const [frames, setFrames] = useState<FrameSample[]>([]);
  const [memory, setMemory] = useState<MemorySnapshot[]>([]);
  const [alerts, setAlerts] = useState<PerfAlert[]>([]);
  const [degradation, setDegradation] = useState(getDegradationLevel());

  // Poll at 2Hz
  useEffect(() => {
    const id = setInterval(() => {
      setFrames(getFrameHistory());
      setMemory(getMemoryHistory());
      setAlerts(getAllAlerts());
      setDegradation(getDegradationLevel());
    }, 500);
    return () => clearInterval(id);
  }, []);

  // FPS sparkline data
  const fpsData = useMemo(() => {
    const last60 = frames.slice(-60);
    return last60.map(f => f.frameTimeMs > 0 ? 1000 / f.frameTimeMs : 60);
  }, [frames]);

  // `frames` is a forced-recompute signal — getMetricsSnapshot() reads external state.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const obs = useMemo(() => getMetricsSnapshot(), [frames]);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-muted-foreground/50" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-foreground">
            Performance Profiler
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[8px] font-mono text-muted-foreground/40">
            Session: {obs.sessionDurationSec.toFixed(0)}s
          </span>
          {fpsData.length > 5 && (
            <Sparkline data={fpsData} width={60} height={16} />
          )}
          <span className="text-[9px] font-mono font-bold text-foreground">
            {obs.fps.avg.toFixed(0)} FPS
          </span>
        </div>
      </div>

      <FlameChart frames={frames} />
      <MemoryTimeline snapshots={memory} />
      <AlertFeed alerts={alerts} degradation={degradation} />
    </div>
  );
}
