/**
 * SkyCanvasDiagnosticsHUD — overlay leve para medir FPS e bursts ativos.
 *
 * - Toggle: tecla F8 (ou prop `defaultOpen`).
 * - FPS: média móvel (1s) via RAF, sem alocação por frame.
 * - Bursts: lê `getActiveBurstCount()` do sharedState (atualizado por
 *   FireworkRenderer.scanActiveBursts a cada frame).
 * - JS heap (quando exposto pelo Chromium).
 *
 * NÃO toca em hardware/safety. Apenas presentation/diagnostics.
 */
import { useEffect, useRef, useState } from 'react';
import { getActiveBurstCount } from '@/components/editor/skycanvas/sharedState';

const SAMPLE_WINDOW_MS = 1000;

interface PerfMemoryLike {
  usedJSHeapSize?: number;
  jsHeapSizeLimit?: number;
}

function readHeapMb(): { used: number; limit: number } | null {
  const mem = (performance as Performance & { memory?: PerfMemoryLike }).memory;
  if (!mem?.usedJSHeapSize) return null;
  return {
    used: mem.usedJSHeapSize / 1048576,
    limit: (mem.jsHeapSizeLimit ?? 0) / 1048576,
  };
}

export interface SkyCanvasDiagnosticsHUDProps {
  defaultOpen?: boolean;
  /** Tecla de toggle (default 'F8'). */
  toggleKey?: string;
}

export default function SkyCanvasDiagnosticsHUD({
  defaultOpen = false,
  toggleKey = 'F8',
}: SkyCanvasDiagnosticsHUDProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [fps, setFps] = useState(0);
  const [fpsMin, setFpsMin] = useState(0);
  const [bursts, setBursts] = useState(0);
  const [burstsPeak, setBurstsPeak] = useState(0);
  const [heap, setHeap] = useState<{ used: number; limit: number } | null>(null);

  // Toggle hotkey
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === toggleKey) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleKey]);

  // RAF loop apenas quando aberto — zero custo quando fechado.
  useEffect(() => {
    if (!open) return;

    let rafId = 0;
    let frames = 0;
    let windowStart = performance.now();
    let lastFrame = windowStart;
    let worstFrameMs = 0;
    let peak = 0;

    const tick = () => {
      const now = performance.now();
      const dt = now - lastFrame;
      lastFrame = now;
      if (dt > worstFrameMs) worstFrameMs = dt;
      frames++;

      const elapsed = now - windowStart;
      if (elapsed >= SAMPLE_WINDOW_MS) {
        const avg = (frames * 1000) / elapsed;
        const min = worstFrameMs > 0 ? 1000 / worstFrameMs : avg;
        setFps(avg);
        setFpsMin(min);
        setHeap(readHeapMb());
        frames = 0;
        worstFrameMs = 0;
        windowStart = now;
      }

      // Burst sampling (cheap — só lê variável de módulo)
      const b = getActiveBurstCount();
      setBursts(b);
      if (b > peak) {
        peak = b;
        setBurstsPeak(peak);
      }

      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [open]);

  if (!open) return null;

  const fpsColor =
    fps >= 55 ? 'text-emerald-400' : fps >= 30 ? 'text-amber-400' : 'text-red-400';
  const minColor =
    fpsMin >= 45 ? 'text-emerald-400/80' : fpsMin >= 24 ? 'text-amber-400/80' : 'text-red-400/80';
  const burstColor =
    bursts < 32 ? 'text-cyan-300' : bursts < 96 ? 'text-amber-300' : 'text-red-300';

  return (
    <div
      className="pointer-events-auto fixed bottom-4 left-4 z-[9000] rounded-md border border-cyan-500/30 bg-black/80 px-3 py-2 font-mono text-[11px] text-cyan-100 shadow-[0_0_24px_rgba(0,180,220,.15)] backdrop-blur-sm"
      role="status"
      aria-label="SkyCanvas diagnostics"
    >
      <div className="mb-1 flex items-center justify-between gap-3">
        <span className="text-cyan-300/70">SKYCANVAS · DIAG</span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-cyan-300/60 hover:text-cyan-100"
          aria-label="Close diagnostics"
        >
          ×
        </button>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 tabular-nums">
        <span className="text-cyan-200/60">FPS</span>
        <span className={fpsColor}>{fps.toFixed(1)}</span>
        <span className="text-cyan-200/60">min/1s</span>
        <span className={minColor}>{fpsMin.toFixed(1)}</span>
        <span className="text-cyan-200/60">bursts</span>
        <span className={burstColor}>{bursts}</span>
        <span className="text-cyan-200/60">peak</span>
        <span className="text-cyan-200/80">{burstsPeak}</span>
        {heap && (
          <>
            <span className="text-cyan-200/60">heap</span>
            <span className="text-cyan-200/80">
              {heap.used.toFixed(0)}/{heap.limit.toFixed(0)} MB
            </span>
          </>
        )}
      </div>
      <div className="mt-1 text-[10px] text-cyan-300/40">{toggleKey} to toggle</div>
    </div>
  );
}
