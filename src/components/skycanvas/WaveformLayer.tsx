/**
 * WaveformLayer — paints decoded audio peaks across the timeline width.
 * Pure presentational; consumes a Float32Array of [min,max] pairs.
 */
import { useEffect, useRef } from 'react';

export default function WaveformLayer({
  peaks,
  height,
  color = 'rgba(126, 211, 255, 0.55)',
  midColor = 'rgba(126, 211, 255, 0.18)',
}: {
  peaks: Float32Array | null;
  height: number;
  color?: string;
  midColor?: string;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv || !peaks) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cssW = cv.clientWidth;
    const cssH = cv.clientHeight || height;
    cv.width = Math.max(1, Math.floor(cssW * dpr));
    cv.height = Math.max(1, Math.floor(cssH * dpr));
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, cssW, cssH);

    const buckets = peaks.length / 2;
    const mid = cssH / 2;
    const xStep = cssW / buckets;

    // Mid line.
    ctx.strokeStyle = midColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, mid);
    ctx.lineTo(cssW, mid);
    ctx.stroke();

    // Peaks as 1px vertical lines.
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, xStep * 0.9);
    ctx.beginPath();
    for (let b = 0; b < buckets; b++) {
      const mn = peaks[b * 2];
      const mx = peaks[b * 2 + 1];
      const x = Math.floor(b * xStep) + 0.5;
      const y1 = mid - mx * (mid - 2);
      const y2 = mid - mn * (mid - 2);
      ctx.moveTo(x, y1);
      ctx.lineTo(x, y2);
    }
    ctx.stroke();
  }, [peaks, height, color, midColor]);

  return (
    <canvas
      ref={ref}
      className="pointer-events-none absolute inset-x-0 bottom-0"
      style={{ height, width: '100%' }}
      aria-hidden
    />
  );
}
