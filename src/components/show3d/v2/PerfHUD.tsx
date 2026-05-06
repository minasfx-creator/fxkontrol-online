/**
 * PerfHUD — DOM overlay (rendered OUTSIDE <Canvas>) that surfaces FPS,
 * draw calls, triangles and current DPR every frame WITHOUT triggering
 * React re-renders. We expose a tiny event bus the canvas-side
 * `PerfHUDProbe` writes into; this component reads via ref + RAF and
 * mutates innerText directly.
 */
import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';

interface PerfFrame {
  fps: number;
  draws: number;
  triangles: number;
  dpr: number;
  bursts: number;
}

const _state: PerfFrame = { fps: 0, draws: 0, triangles: 0, dpr: 1, bursts: 0 };

/** Called by external systems (e.g. ExplosionsLayer) to publish counts. */
export function setPerfBursts(n: number): void {
  _state.bursts = n;
}

/**
 * Mount inside <Canvas>. Scrapes `gl.info.render` after each frame.
 * Zero React state; writes into the shared `_state` object.
 */
export function PerfHUDProbe({ dprRef }: { dprRef?: { current: number } }) {
  const gl = useThree((s) => s.gl);
  const lastTRef = useRef<number>(performance.now());

  useFrame(() => {
    const now = performance.now();
    const dt = Math.max(1, now - lastTRef.current);
    lastTRef.current = now;
    _state.fps = 1000 / dt;
    _state.draws = gl.info.render.calls;
    _state.triangles = gl.info.render.triangles;
    _state.dpr = dprRef?.current ?? gl.getPixelRatio();
  });

  return null;
}

/** DOM overlay; mount OUTSIDE <Canvas>. */
export function PerfHUDOverlay() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    const fpsHist = new Float32Array(30);
    let idx = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const el = ref.current;
      if (!el) return;
      fpsHist[idx] = _state.fps;
      idx = (idx + 1) % fpsHist.length;
      let sum = 0;
      for (let i = 0; i < fpsHist.length; i++) sum += fpsHist[i] || _state.fps;
      const avg = sum / fpsHist.length;
      el.textContent =
        `fps ${avg.toFixed(0).padStart(3, ' ')} · ` +
        `draws ${_state.draws} · ` +
        `tri ${(_state.triangles / 1000).toFixed(1)}k · ` +
        `dpr ${_state.dpr.toFixed(2)} · ` +
        `bursts ${_state.bursts}`;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        top: 8,
        right: 8,
        zIndex: 50,
        padding: '4px 8px',
        fontSize: 11,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        color: '#7dd3fc',
        background: 'rgba(0,0,0,0.55)',
        border: '1px solid rgba(45,212,255,0.3)',
        borderRadius: 4,
        pointerEvents: 'none',
      }}
    >
      perf hud
    </div>
  );
}
