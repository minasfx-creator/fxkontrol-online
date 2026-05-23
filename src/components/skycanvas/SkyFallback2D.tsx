/**
 * SkyFallback2D — pure HTMLCanvas 2D night-sky placeholder.
 *
 * Used when WebGL2 is unavailable or running on SwiftShader/llvmpipe
 * (sandbox/preview without GPU, ancient browsers, locked-down corp envs).
 *
 * Honest: NÃO é um simulador de show — é uma representação 2D dos cues
 * do ShowPlan (pyro como bursts radiais, drone como pontos pulsantes)
 * suficiente para o operador validar layout/tempo sem 3D.
 *
 * Plano: Experience-only. Zero CommandBus / FieldBus / SafetyStateMachine.
 */
import { useEffect, useRef } from 'react';
import { useProjectStore } from '@/store/useProjectStore';

interface Burst { x: number; y: number; t0: number; color: string; }

export default function SkyFallback2D({ reason }: { reason?: string }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const burstsRef = useRef<Burst[]>([]);
  const lastTimeRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // Pre-spawn star field (deterministic seed for stable look).
    const stars: { x: number; y: number; a: number }[] = [];
    for (let i = 0; i < 140; i++) {
      stars.push({
        x: ((i * 73) % 1000) / 1000,
        y: ((i * 191) % 1000) / 1000,
        a: 0.25 + ((i * 17) % 100) / 200,
      });
    }

    const PYRO_COLORS = ['#FFD27A', '#FF7AA9', '#7AC9FF', '#7FFFB3', '#FFB347', '#E0E0E0'];

    const tick = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;

      // Sky gradient
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#02050a');
      grad.addColorStop(1, '#080d18');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Stars
      ctx.fillStyle = '#9ddcf0';
      for (const s of stars) {
        ctx.globalAlpha = s.a;
        ctx.fillRect(s.x * w, s.y * (h * 0.65), 1.25, 1.25);
      }
      ctx.globalAlpha = 1;

      // Ground line
      ctx.strokeStyle = 'rgba(125,211,252,0.18)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, h * 0.78);
      ctx.lineTo(w, h * 0.78);
      ctx.stroke();

      // Read project store (cheap getState)
      const s = useProjectStore.getState();
      const t = s.currentTime ?? 0;

      // Spawn bursts when crossing cue startTime (since last tick).
      const items = s.timelineItems ?? [];
      for (const c of items) {
        if (c.startTime > lastTimeRef.current && c.startTime <= t) {
          // Map XY/-Z to 2D — center of canvas, scale 6 px/m.
          const px = w / 2 + (c.position?.x ?? 0) * 6;
          const py = h * 0.78 - Math.max(0, (c.position?.y ?? 0)) * 6 - 60;
          const idx = Math.abs(c.id.length * 17) % PYRO_COLORS.length;
          burstsRef.current.push({ x: px, y: py, t0: performance.now(), color: PYRO_COLORS[idx] });
          if (burstsRef.current.length > 64) burstsRef.current.shift();
        }
      }
      lastTimeRef.current = t;

      // Draw bursts (radial).
      const now = performance.now();
      const live: Burst[] = [];
      for (const b of burstsRef.current) {
        const age = (now - b.t0) / 1000;
        if (age > 1.4) continue;
        live.push(b);
        const radius = 6 + age * 70;
        const alpha = Math.max(0, 1 - age / 1.4);
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.fillStyle = b.color;
        ctx.globalAlpha = alpha * 0.85;
        for (let k = 0; k < 24; k++) {
          const ang = (k / 24) * Math.PI * 2;
          ctx.beginPath();
          ctx.arc(Math.cos(ang) * radius, Math.sin(ang) * radius, 1.6, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
      burstsRef.current = live;

      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, []);

  return (
    <div className="absolute inset-0 bg-[#050810]">
      <canvas ref={ref} className="absolute inset-0 h-full w-full" aria-label="SkyCanvas 2D fallback viewport" role="img" />
      <div className="pointer-events-none absolute left-3 top-3 rounded-md border border-cyan-500/30 bg-black/60 px-2 py-1 ds-mono text-[10px] tracking-wider text-cyan-300/90">
        SKYCANVAS · 2D FALLBACK{reason ? ` · ${reason}` : ''}
      </div>
    </div>
  );
}
