/**
 * AdaptiveDPRController — Internal R3F component that monitors FPS and
 * gently adjusts the renderer device-pixel-ratio between [minDpr, maxDpr].
 *
 * Algorithm (zero-alloc, runs each frame):
 *   - Measure dt via performance.now (clamped 1..200 ms).
 *   - Maintain running FPS over a 60-frame window (≈1s @60fps).
 *   - If avg < 35 sustained 2s → step DPR down by 0.25 (floor minDpr).
 *   - If avg > 110 sustained 4s → step DPR up by 0.25 (ceil maxDpr).
 *   - Cooldown 1s between any change to avoid oscillation.
 *
 * We never call setDpr() if the new value equals current — saves a
 * canvas resize per frame.
 */
import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';

interface Props {
  minDpr?: number;
  maxDpr?: number;
  /** Called on every step so the optional PerfHUD can display current dpr. */
  onChange?: (dpr: number) => void;
}

export function AdaptiveDPRController({ minDpr = 1, maxDpr = 1.75, onChange }: Props) {
  const setDpr = useThree((s) => s.setDpr);
  const gl = useThree((s) => s.gl);
  // Initialise from current renderer pixel ratio (clamped to bounds).
  const dprRef = useRef<number>(Math.min(maxDpr, Math.max(minDpr, gl.getPixelRatio())));
  const lastTRef = useRef<number>(performance.now());
  const fpsBufRef = useRef<Float32Array>(new Float32Array(60));
  const fpsIdxRef = useRef<number>(0);
  const lowSinceRef = useRef<number>(0);
  const highSinceRef = useRef<number>(0);
  const lastChangeRef = useRef<number>(0);

  useEffect(() => { onChange?.(dprRef.current); }, [onChange]);

  useFrame(() => {
    const now = performance.now();
    const dt = Math.min(200, Math.max(1, now - lastTRef.current));
    lastTRef.current = now;
    const fps = 1000 / dt;

    const buf = fpsBufRef.current;
    buf[fpsIdxRef.current] = fps;
    fpsIdxRef.current = (fpsIdxRef.current + 1) % buf.length;

    // Cheap moving average.
    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += buf[i] || fps;
    const avg = sum / buf.length;

    // Gate cooldown.
    if (now - lastChangeRef.current < 1000) return;

    if (avg < 35) {
      if (lowSinceRef.current === 0) lowSinceRef.current = now;
      highSinceRef.current = 0;
      if (now - lowSinceRef.current > 2000) {
        const next = Math.max(minDpr, +(dprRef.current - 0.25).toFixed(2));
        if (next !== dprRef.current) {
          dprRef.current = next;
          setDpr(next);
          onChange?.(next);
          lastChangeRef.current = now;
        }
        lowSinceRef.current = 0;
      }
    } else if (avg > 110) {
      if (highSinceRef.current === 0) highSinceRef.current = now;
      lowSinceRef.current = 0;
      if (now - highSinceRef.current > 4000) {
        const next = Math.min(maxDpr, +(dprRef.current + 0.25).toFixed(2));
        if (next !== dprRef.current) {
          dprRef.current = next;
          setDpr(next);
          onChange?.(next);
          lastChangeRef.current = now;
        }
        highSinceRef.current = 0;
      }
    } else {
      lowSinceRef.current = 0;
      highSinceRef.current = 0;
    }
  });

  return null;
}

export default AdaptiveDPRController;
