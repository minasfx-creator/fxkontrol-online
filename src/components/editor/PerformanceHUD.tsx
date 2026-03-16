import { useRef, useState, useCallback, forwardRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Activity } from 'lucide-react';

/**
 * In-scene stats collector — runs inside <Canvas>.
 * Pushes stats to a shared ref that the HTML overlay reads.
 */
export function PerfCollector({ statsRef }: { statsRef: React.MutableRefObject<PerfStats> }) {
  const { gl } = useThree();
  const frames = useRef(0);
  const lastTime = useRef(performance.now());

  useFrame(() => {
    frames.current++;
    const now = performance.now();
    const delta = now - lastTime.current;

    if (delta >= 500) {
      const fps = Math.round((frames.current / delta) * 1000);
      const info = gl.info;
      statsRef.current = {
        fps,
        drawCalls: info.render.calls,
        triangles: info.render.triangles,
        geometries: info.memory.geometries,
        textures: info.memory.textures,
      };
      frames.current = 0;
      lastTime.current = now;
    }
  });

  return null;
}

export interface PerfStats {
  fps: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
}

/**
 * HTML overlay HUD showing real-time performance metrics.
 * Rendered outside Canvas as a DOM element.
 */
export function PerformanceHUD({
  statsRef,
  droneCount,
}: {
  statsRef: React.MutableRefObject<PerfStats>;
  droneCount: number;
}) {
  const [visible, setVisible] = useState(false);
  const [stats, setStats] = useState<PerfStats>({ fps: 0, drawCalls: 0, triangles: 0, geometries: 0, textures: 0 });

  // Poll the ref at ~4Hz to avoid re-render storms
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const toggle = useCallback(() => {
    setVisible((v) => {
      const next = !v;
      if (next && !intervalRef.current) {
        intervalRef.current = setInterval(() => {
          setStats({ ...statsRef.current });
        }, 250);
      } else if (!next && intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return next;
    });
  }, [statsRef]);

  const fpsColor = stats.fps >= 55 ? 'text-green-400' : stats.fps >= 30 ? 'text-yellow-400' : 'text-red-400';

  return (
    <>
      <button
        onClick={toggle}
        className="absolute top-3 right-3 bg-surface-1/80 text-muted-foreground border border-border/50 hover:text-foreground hover:bg-surface-2/80 px-2 py-1 rounded-sm transition-all"
        title="Performance Stats"
      >
        <Activity className="w-3.5 h-3.5" />
      </button>

      {visible && (
        <div className="absolute top-10 right-3 bg-surface-0/90 backdrop-blur-sm border border-border/60 rounded-sm p-2 font-mono text-[10px] leading-relaxed min-w-[140px] select-none pointer-events-none">
          <div className="flex items-center gap-1.5 mb-1 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Activity className="w-3 h-3" /> FX Kontrol
          </div>
          <div className="space-y-0.5">
            <Row label="FPS" value={stats.fps} className={fpsColor} />
            <Row label="Draw Calls" value={stats.drawCalls} />
            <Row label="Triangles" value={formatK(stats.triangles)} />
            <Row label="Geometries" value={stats.geometries} />
            <Row label="Textures" value={stats.textures} />
            <div className="border-t border-border/40 my-1" />
            <Row label="Drones" value={droneCount} className="text-primary" />
          </div>
        </div>
      )}
    </>
  );
}

function Row({ label, value, className = 'text-foreground' }: { label: string; value: number | string; className?: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className={className}>{value}</span>
    </div>
  );
}

function formatK(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}
