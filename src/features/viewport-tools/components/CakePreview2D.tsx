/**
 * CakePreview2D — top-down 2D canvas preview of a parametric cake.
 *
 * Anchor at center, fan arcs per row, shot dots colored by firing order.
 * Pure visual — no store coupling.
 */

import { useEffect, useRef } from 'react';
import { generateCakeDetailed, type CakeParams } from '../generators/cakeGenerator';

interface Props {
  params: CakeParams;
  /** Logical max distance shown (m). Default 30. */
  rangeM?: number;
}

export default function CakePreview2D({ params, rangeM = 30 }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    // Background
    ctx.fillStyle = '#02040a';
    ctx.fillRect(0, 0, w, h);

    // Concentric range rings
    const cx = w / 2;
    const cy = h * 0.85; // anchor near bottom — fan opens upward
    const pxPerM = Math.min(w, h * 1.4) / (rangeM * 2.2);

    ctx.strokeStyle = 'rgba(80, 200, 255, 0.12)';
    ctx.lineWidth = 1;
    for (let r = 5; r <= rangeM; r += 5) {
      ctx.beginPath();
      ctx.arc(cx, cy, r * pxPerM, Math.PI, 2 * Math.PI);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(120, 200, 255, 0.5)';
    ctx.font = '9px ui-monospace, monospace';
    for (let r = 10; r <= rangeM; r += 10) {
      ctx.fillText(`${r}m`, cx + r * pxPerM + 2, cy - 2);
    }

    // Anchor
    ctx.fillStyle = '#00e5ff';
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    ctx.fill();

    // Compute and draw shots
    const { items, report } = generateCakeDetailed(params);
    const bearing = ((params.bearingDeg ?? 0) * Math.PI) / 180;

    // Shot trajectory length proportional to caliber (visual proxy).
    const shotLen = (params.caliber ?? 3) * 3 * pxPerM;

    items.forEach((it, idx) => {
      const panRad = (((it.pan ?? 0)) * Math.PI) / 180;
      // Top-down: pan rotates around anchor; positive = clockwise from "up".
      // Up vector = (0, -1); rotate by panRad + bearing.
      const ang = -Math.PI / 2 + panRad + bearing;
      const dx = Math.cos(ang);
      const dy = Math.sin(ang);

      // Trajectory line
      ctx.strokeStyle = `hsla(${190 + (idx % 60)}, 90%, 60%, 0.35)`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + dx * shotLen, cy + dy * shotLen);
      ctx.stroke();

      // Burst point
      const t = items.length === 1 ? 0 : idx / (items.length - 1);
      const hue = 190 - t * 40; // cyan → blue
      ctx.fillStyle = `hsl(${hue}, 95%, 65%)`;
      ctx.beginPath();
      ctx.arc(cx + dx * shotLen, cy + dy * shotLen, 2.4, 0, Math.PI * 2);
      ctx.fill();
    });

    // HUD
    ctx.fillStyle = 'rgba(120, 220, 255, 0.85)';
    ctx.font = '10px ui-monospace, monospace';
    ctx.fillText(
      `${report.shotsTotal} shots · ${report.rows} row(s) · ${report.durationSec.toFixed(2)}s · ${report.effectiveStaggerMs}ms`,
      8,
      14,
    );
  }, [params, rangeM]);

  return (
    <div className="relative h-56 w-full rounded border border-cyan-500/20 bg-[#02040a] overflow-hidden">
      <canvas ref={ref} className="w-full h-full block" />
      <div className="absolute top-1 right-2 text-[10px] text-cyan-300/70 font-mono">
        TOP-DOWN
      </div>
    </div>
  );
}
