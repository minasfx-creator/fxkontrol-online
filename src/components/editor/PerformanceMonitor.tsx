/**
 * PerformanceMonitor — Real-time system health display for Show Commander.
 * Shows FPS, memory, worker latency with emergency visual scale-down.
 * 
 * Now uses shared usePerfMetrics hook.
 */
import { Cpu, Gauge, Activity, AlertTriangle, Zap, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePerfMetrics } from '@/hooks/usePerfMetrics';

// Re-export for backward compat
export { usePerfMetrics as usePerformanceMetrics } from '@/hooks/usePerfMetrics';

export default function PerformanceMonitor({ workerFPS = 0 }: { workerFPS?: number }) {
  const m = usePerfMetrics();

  const fpsColor = m.fps >= 50 ? 'text-green-400' : m.fps >= 30 ? 'text-amber-400' : 'text-red-400';
  const memColor = m.memory > 1500 ? 'text-red-400' : m.memory > 800 ? 'text-amber-400' : 'text-green-400';

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
        <BarChart3 className="w-3 h-3" />
        Stability Monitor
      </div>

      {m.isScaledDown && (
        <div className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/30 rounded px-2 py-1 animate-pulse">
          <AlertTriangle className="w-3 h-3 text-amber-400" />
          <span className="text-[8px] font-bold text-amber-400 uppercase">
            Emergency Scale-Down Active — Bloom & VFX Disabled
          </span>
        </div>
      )}

      <div className="grid grid-cols-3 gap-1">
        {/* FPS */}
        <div className="bg-card/30 rounded px-2 py-1.5 text-center">
          <Gauge className="w-3 h-3 mx-auto text-muted-foreground mb-0.5" />
          <p className={cn("text-sm font-mono font-bold", fpsColor)}>{m.fps}</p>
          <p className="text-[7px] text-muted-foreground uppercase">FPS</p>
        </div>

        {/* Memory */}
        <div className="bg-card/30 rounded px-2 py-1.5 text-center">
          <Cpu className="w-3 h-3 mx-auto text-muted-foreground mb-0.5" />
          <p className={cn("text-sm font-mono font-bold", memColor)}>{m.memory || '—'}</p>
          <p className="text-[7px] text-muted-foreground uppercase">MB RAM</p>
        </div>

        {/* Worker */}
        <div className="bg-card/30 rounded px-2 py-1.5 text-center">
          <Activity className="w-3 h-3 mx-auto text-muted-foreground mb-0.5" />
          <p className="text-sm font-mono font-bold text-green-400">{m.workerLatency}</p>
          <p className="text-[7px] text-muted-foreground uppercase">W.LAT ms</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1">
        {/* Frame Time */}
        <div className="flex items-center gap-1 bg-card/20 rounded px-2 py-1">
          <Zap className="w-2.5 h-2.5 text-muted-foreground" />
          <span className="text-[8px] text-muted-foreground">Frame:</span>
          <span className="text-[9px] font-mono font-bold text-foreground">{m.frameTime}ms</span>
        </div>

        {/* Worker FPS */}
        <div className="flex items-center gap-1 bg-card/20 rounded px-2 py-1">
          <Activity className="w-2.5 h-2.5 text-muted-foreground" />
          <span className="text-[8px] text-muted-foreground">Worker:</span>
          <span className="text-[9px] font-mono font-bold text-foreground">{workerFPS || '—'} Hz</span>
        </div>
      </div>
    </div>
  );
}
