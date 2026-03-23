/**
 * TacticalMinimap — Canvas-based field overview for landscape HUD
 * Shows module positions, PBUS devices, safety zones
 */
import { useRef, useEffect } from 'react';
import { useFireOneHardware } from '@/hooks/useFireOneHardware';
import { usePBusHardware } from '@/hooks/usePBusHardware';

interface TacticalMinimapProps {
  accentColor: string;
  width?: number;
  height?: number;
}

export default function TacticalMinimap({ accentColor, width = 100, height = 80 }: TacticalMinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fireone = useFireOneHardware();
  const pbus = usePBusHardware();
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      // Background
      ctx.fillStyle = 'rgba(8, 10, 14, 0.85)';
      ctx.fillRect(0, 0, width, height);

      // Grid lines
      ctx.strokeStyle = `${accentColor}18`;
      ctx.lineWidth = 0.5;
      for (let x = 0; x <= width; x += 20) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
      }
      for (let y = 0; y <= height; y += 20) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
      }

      // Center crosshair
      ctx.strokeStyle = `${accentColor}30`;
      ctx.lineWidth = 0.5;
      ctx.setLineDash([2, 2]);
      ctx.beginPath(); ctx.moveTo(width / 2, 0); ctx.lineTo(width / 2, height); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, height / 2); ctx.lineTo(width, height / 2); ctx.stroke();
      ctx.setLineDash([]);

      const cx = width / 2;
      const cy = height / 2;

      // Transmitter position (center, pulsing cyan dot)
      const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 500);
      ctx.fillStyle = `rgba(0, 200, 255, ${0.4 + pulse * 0.4})`;
      ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(0, 200, 255, ${0.15 + pulse * 0.15})`;
      ctx.beginPath(); ctx.arc(cx, cy, 6, 0, Math.PI * 2); ctx.fill();

      // FireOne modules — spread around center
      if (fireone.isConnected) {
        const r = Math.min(width, height) * 0.3;
        for (let i = 0; i < 4; i++) {
          const angle = (i / 4) * Math.PI * 2 - Math.PI / 2;
          const px = cx + Math.cos(angle) * r;
          const py = cy + Math.sin(angle) * r;

          // Safety radius
          ctx.fillStyle = 'rgba(255, 50, 30, 0.08)';
          ctx.beginPath(); ctx.arc(px, py, 10, 0, Math.PI * 2); ctx.fill();

          // Module dot
          ctx.fillStyle = '#22cc44';
          ctx.beginPath(); ctx.arc(px, py, 2.5, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = 'rgba(34, 204, 68, 0.3)';
          ctx.beginPath(); ctx.arc(px, py, 4, 0, Math.PI * 2); ctx.fill();
        }
      }

      // PBUS devices — smaller amber dots
      if (pbus.isConnected && pbus.deviceCount > 0) {
        const r = Math.min(width, height) * 0.2;
        let i = 0;
        pbus.devices.forEach(() => {
          const angle = (i / Math.max(pbus.deviceCount, 1)) * Math.PI * 2;
          const px = cx + Math.cos(angle) * r;
          const py = cy + Math.sin(angle) * r;
          ctx.fillStyle = 'hsl(32 100% 50%)';
          ctx.beginPath(); ctx.arc(px, py, 2, 0, Math.PI * 2); ctx.fill();
          i++;
        });
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, [width, height, accentColor, fireone.isConnected, pbus.isConnected, pbus.deviceCount, pbus.devices]);

  return (
    <div className="ff-tactical-minimap" style={{ width, height }}>
      <span className="absolute top-1 left-1.5 text-[6px] font-mono font-bold tracking-[0.2em] uppercase" style={{ color: `${accentColor}60` }}>
        FIELD
      </span>
      <canvas
        ref={canvasRef}
        style={{ width, height }}
        className="rounded-lg"
      />
    </div>
  );
}
