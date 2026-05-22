/**
 * ─── Render Counter & Performance Debug Overlay ─────────────────────
 * Shows live re-render counts, FPS, frame time, and memory usage.
 * Toggle with Ctrl+Shift+R (Cmd+Shift+R on Mac).
 * Dev-only — tree-shaken in production.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { getRenderCounters, subscribeRenderCounters, resetRenderCounters } from '@/hooks/useRenderCounter';

interface FrameMetrics {
  fps: number;
  frameTime: number;    // ms
  frameTimeMax: number;  // ms (worst frame in window)
  jsHeapMB: number;
}

const SAMPLE_WINDOW = 60; // frames to average

function useFrameMetrics(enabled: boolean): FrameMetrics {
  const [metrics, setMetrics] = useState<FrameMetrics>({ fps: 0, frameTime: 0, frameTimeMax: 0, jsHeapMB: 0 });
  const rafRef = useRef<number>(0);
  const timesRef = useRef<number[]>([]);
  const lastRef = useRef(performance.now());

  useEffect(() => {
    if (!enabled) return;

    timesRef.current = [];
    lastRef.current = performance.now();

    let running = true;

    const tick = () => {
      if (!running) return;
      const now = performance.now();
      const dt = now - lastRef.current;
      lastRef.current = now;

      const times = timesRef.current;
      times.push(dt);
      if (times.length > SAMPLE_WINDOW) times.shift();

      // Update metrics every 15 frames (~250ms at 60fps)
      if (times.length % 15 === 0 && times.length > 0) {
        const avg = times.reduce((a, b) => a + b, 0) / times.length;
        const max = Math.max(...times);
        const fps = avg > 0 ? 1000 / avg : 0;

        const perf = performance as any;
        const heap = perf.memory ? perf.memory.usedJSHeapSize / (1024 * 1024) : 0;

        setMetrics({ fps: Math.round(fps), frameTime: +avg.toFixed(1), frameTimeMax: +max.toFixed(1), jsHeapMB: +heap.toFixed(1) });
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [enabled]);

  return metrics;
}

export default function RenderCounterOverlay() {
  const [visible, setVisible] = useState(false);
  const [counters, setCounters] = useState<Record<string, number>>({});
  const subRafRef = useRef<number | null>(null);

  const { fps, frameTime, frameTimeMax, jsHeapMB } = useFrameMetrics(visible);

  // Subscribe to counter updates and batch via rAF
  useEffect(() => {
    if (!visible) return;

    const update = () => {
      if (subRafRef.current !== null) return;
      subRafRef.current = requestAnimationFrame(() => {
        subRafRef.current = null;
        setCounters({ ...getRenderCounters() });
      });
    };

    setCounters({ ...getRenderCounters() });

    const unsub = subscribeRenderCounters(update);
    return () => {
      unsub();
      if (subRafRef.current !== null) {
        cancelAnimationFrame(subRafRef.current);
        subRafRef.current = null;
      }
    };
  }, [visible]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'R') {
      e.preventDefault();
      setVisible(v => !v);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!visible) return null;

  const entries = Object.entries(counters).sort((a, b) => b[1] - a[1]);

  const fpsColor = fps >= 55 ? '#66ff66' : fps >= 30 ? '#ffaa00' : '#ff4444';
  const ftColor = frameTime <= 18 ? '#66ff66' : frameTime <= 33 ? '#ffaa00' : '#ff4444';

  return (
    <div
      className="fixed z-[99999] font-mono text-[10px] leading-tight pointer-events-auto select-none"
      style={{
        top: 8,
        right: 8,
        background: 'rgba(0, 0, 0, 0.88)',
        backdropFilter: 'blur(12px)',
        border: '1px solid hsl(32 100% 50% / 0.25)',
        borderRadius: 8,
        padding: '8px 10px',
        minWidth: 200,
        maxHeight: '60vh',
        overflowY: 'auto',
        color: 'hsl(32 100% 70%)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
      }}
    >
      {/* ── FPS & Frame Metrics ── */}
      <div className="mb-2 pb-1.5" style={{ borderBottom: '1px solid hsl(32 100% 50% / 0.15)' }}>
        <div className="flex items-center justify-between mb-1">
          <span className="tracking-widest uppercase text-[9px] opacity-70">📊 Performance</span>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
          <div className="flex justify-between">
            <span className="opacity-60">FPS</span>
            <span style={{ color: fpsColor, fontWeight: 700 }}>{fps}</span>
          </div>
          <div className="flex justify-between">
            <span className="opacity-60">Frame</span>
            <span style={{ color: ftColor }}>{frameTime}ms</span>
          </div>
          <div className="flex justify-between">
            <span className="opacity-60">Worst</span>
            <span style={{ color: frameTimeMax > 33 ? '#ff4444' : '#ffaa00' }}>{frameTimeMax}ms</span>
          </div>
          <div className="flex justify-between">
            <span className="opacity-60">Heap</span>
            <span style={{ color: jsHeapMB > 500 ? '#ff4444' : jsHeapMB > 200 ? '#ffaa00' : '#66ff66' }}>
              {jsHeapMB}MB
            </span>
          </div>
        </div>
      </div>

      {/* ── Render Counters ── */}
      <div className="flex items-center justify-between mb-1">
        <span className="tracking-widest uppercase text-[9px] opacity-70">⚡ Renders</span>
        <button
          onClick={() => {
            resetRenderCounters();
            setCounters({});
          }}
          className="text-[8px] uppercase tracking-wider opacity-50 hover:opacity-100 transition-opacity"
          title="Reset counters"
        >
          Reset
        </button>
      </div>

      {entries.length === 0 ? (
        <div className="opacity-40 text-[9px]">No instrumented components</div>
      ) : (
        entries.map(([name, count]) => (
          <div key={name} className="flex justify-between gap-3 py-px">
            <span className="truncate opacity-80">{name}</span>
            <span
              style={{
                color: count > 100 ? '#ff4444' : count > 30 ? '#ffaa00' : '#66ff66',
              }}
            >
              {count}
            </span>
          </div>
        ))
      )}

      <div className="mt-1.5 pt-1 text-[8px] opacity-30 text-center" style={{ borderTop: '1px solid hsl(32 100% 50% / 0.1)' }}>
        Ctrl+Shift+R to toggle
      </div>
    </div>
  );
}
