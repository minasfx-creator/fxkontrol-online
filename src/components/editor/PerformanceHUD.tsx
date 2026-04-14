/**
 * PerformanceHUD — In-viewport debug overlay + R3F stats collector.
 * 
 * Now uses shared usePerfMetrics + pushGPUStats from the centralized hook.
 */
import { useRef, useState, useCallback, forwardRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Activity } from 'lucide-react';
import { pushGPUStats, usePerfMetrics, type PerfMetrics } from '@/hooks/usePerfMetrics';

// ── Legacy types re-exported for backward compat ──
export type PerfStats = PerfMetrics;

/**
 * In-scene stats collector — runs inside <Canvas>.
 * Pushes GPU stats to the shared singleton via pushGPUStats().
 * 
 * The statsRef prop is kept for backward compat but now also
 * feeds the centralized usePerfMetrics hook.
 */
export const PerfCollector = forwardRef<any, { statsRef: React.MutableRefObject<PerfStats> }>(function PerfCollector({ statsRef }, _ref) {
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
      const gpuStats = {
        drawCalls: info.render.calls,
        triangles: info.render.triangles,
        geometries: info.memory.geometries,
        textures: info.memory.textures,
      };

      // Feed legacy statsRef
      statsRef.current = {
        fps,
        ...gpuStats,
        memory: 0,
        frameTime: +(delta / frames.current).toFixed(1),
        workerLatency: 0,
        isScaledDown: false,
      };

      // Feed centralized singleton
      pushGPUStats(gpuStats);

      frames.current = 0;
      lastTime.current = now;
    }
  });

  return null;
});

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
  const metrics = usePerfMetrics();

  const toggle = useCallback(() => {
    setVisible(v => !v);
  }, []);

  const fpsColor = metrics.fps >= 55 ? 'text-green-400' : metrics.fps >= 30 ? 'text-yellow-400' : 'text-red-400';

  return (
    <>
      <button
        onClick={toggle}
        className="absolute top-3 right-16 bg-surface-1/80 text-muted-foreground border border-border/50 hover:text-foreground hover:bg-surface-2/80 px-2 py-1 rounded-sm transition-all"
        title="Performance Stats"
      >
        <Activity className="w-3.5 h-3.5" />
      </button>

      {visible && (
        <div className="absolute top-10 right-16 bg-surface-0/90 backdrop-blur-sm border border-border/60 rounded-sm p-2 font-mono text-[10px] leading-relaxed min-w-[140px] select-none pointer-events-none">
          <div className="flex items-center gap-1.5 mb-1 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Activity className="w-3 h-3" /> FX Kontrol
          </div>
          <div className="space-y-0.5">
            <Row label="FPS" value={metrics.fps} className={fpsColor} />
            <Row label="Draw Calls" value={metrics.drawCalls} />
            <Row label="Triangles" value={formatK(metrics.triangles)} />
            <Row label="Geometries" value={metrics.geometries} />
            <Row label="Textures" value={metrics.textures} />
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
