/**
 * ProceduralWidgets — BR2049 styled widget components
 * Replicated from UE5 WB_Box, WB_Fade, WB_SliderX, M_Wave, M_Round, M_ScrollboxFade
 */
import { useState, useRef, useEffect, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/* ═══ WB_Box — Holographic box container with glow border ═══ */
export function HoloBox({
  children,
  className,
  glowColor = 'hsl(270, 60%, 55%)',
  padding = 'p-3',
}: {
  children: ReactNode;
  className?: string;
  glowColor?: string;
  padding?: string;
}) {
  return (
    <div
      className={cn(
        'relative rounded-lg border overflow-hidden',
        padding,
        className
      )}
      style={{
        borderColor: `${glowColor}33`,
        background: 'hsl(220, 12%, 5%)',
        boxShadow: `inset 0 0 20px ${glowColor}08, 0 0 15px ${glowColor}0a`,
      }}
    >
      {/* Corner accents */}
      {['top-left', 'top-right', 'bottom-left', 'bottom-right'].map(corner => {
        const isTop = corner.includes('top');
        const isLeft = corner.includes('left');
        return (
          <div
            key={corner}
            className="absolute w-3 h-3 pointer-events-none"
            style={{
              [isTop ? 'top' : 'bottom']: -1,
              [isLeft ? 'left' : 'right']: -1,
              borderTop: isTop ? `2px solid ${glowColor}` : 'none',
              borderBottom: !isTop ? `2px solid ${glowColor}` : 'none',
              borderLeft: isLeft ? `2px solid ${glowColor}` : 'none',
              borderRight: !isLeft ? `2px solid ${glowColor}` : 'none',
            }}
          />
        );
      })}
      {children}
    </div>
  );
}

/* ═══ WB_Fade — Fade-in/out wrapper with configurable direction ═══ */
export function FadeWidget({
  children,
  visible = true,
  direction = 'up',
  duration = 300,
  className,
}: {
  children: ReactNode;
  visible?: boolean;
  direction?: 'up' | 'down' | 'left' | 'right';
  duration?: number;
  className?: string;
}) {
  const [mounted, setMounted] = useState(visible);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      requestAnimationFrame(() => setAnimating(true));
    } else {
      setAnimating(false);
      const timer = setTimeout(() => setMounted(false), duration);
      return () => clearTimeout(timer);
    }
  }, [visible, duration]);

  if (!mounted) return null;

  const transforms: Record<string, string> = {
    up: 'translateY(10px)',
    down: 'translateY(-10px)',
    left: 'translateX(10px)',
    right: 'translateX(-10px)',
  };

  return (
    <div
      className={className}
      style={{
        opacity: animating ? 1 : 0,
        transform: animating ? 'none' : transforms[direction],
        transition: `opacity ${duration}ms ease-out, transform ${duration}ms ease-out`,
      }}
    >
      {children}
    </div>
  );
}

/* ═══ WB_SliderX — Horizontal slider with BR2049 styling ═══ */
export function HoloSlider({
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.01,
  label,
  color = 'hsl(270, 60%, 55%)',
  className,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  color?: string;
  className?: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div className={cn('space-y-1', className)}>
      {label && (
        <div className="flex items-center justify-between">
          <span className="text-[6px] font-mono font-bold tracking-[0.15em] uppercase" style={{ color }}>{label}</span>
          <span className="text-[7px] font-mono" style={{ color }}>{value.toFixed(2)}</span>
        </div>
      )}
      <div className="relative h-3 rounded-full" style={{ background: 'hsl(220, 12%, 8%)' }}>
        {/* Track fill */}
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${color}44, ${color})`,
            boxShadow: `0 0 8px ${color}40`,
          }}
        />
        {/* Thumb */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border-2"
          style={{
            left: `calc(${pct}% - 5px)`,
            borderColor: color,
            background: 'hsl(220, 12%, 6%)',
            boxShadow: `0 0 6px ${color}60`,
          }}
        />
        <input
          type="range"
          min={min} max={max} step={step} value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full opacity-0 cursor-pointer"
        />
      </div>
    </div>
  );
}

/* ═══ M_Wave — Animated wave background effect ═══ */
export function WaveEffect({
  className,
  color = 'hsl(270, 60%, 55%)',
  amplitude = 8,
  frequency = 3,
  speed = 1,
}: {
  className?: string;
  color?: string;
  amplitude?: number;
  frequency?: number;
  speed?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf: number;
    const w = canvas.width;
    const h = canvas.height;

    const draw = (time: number) => {
      ctx.clearRect(0, 0, w, h);
      const t = time * 0.001 * speed;

      for (let wave = 0; wave < 3; wave++) {
        ctx.beginPath();
        ctx.moveTo(0, h / 2);
        for (let x = 0; x <= w; x++) {
          const y = h / 2 + Math.sin(x * frequency * 0.02 + t + wave * 0.8) * amplitude * (1 - wave * 0.25);
          ctx.lineTo(x, y);
        }
        ctx.strokeStyle = `${color}${wave === 0 ? '60' : wave === 1 ? '30' : '15'}`;
        ctx.lineWidth = 1.5 - wave * 0.4;
        ctx.stroke();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [color, amplitude, frequency, speed]);

  return <canvas ref={canvasRef} width={200} height={40} className={cn('w-full', className)} />;
}

/* ═══ M_Round — Circular progress/gauge indicator ═══ */
export function RoundGauge({
  value,
  max = 1,
  size = 40,
  color = 'hsl(270, 60%, 55%)',
  label,
  className,
}: {
  value: number;
  max?: number;
  size?: number;
  color?: string;
  label?: string;
  className?: string;
}) {
  const pct = Math.min(value / max, 1);
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct);

  return (
    <div className={cn('inline-flex flex-col items-center gap-0.5', className)}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(220, 12%, 10%)" strokeWidth={3} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth={3}
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ filter: `drop-shadow(0 0 3px ${color}60)` }}
        />
        <text x={size / 2} y={size / 2 + 1} textAnchor="middle" dominantBaseline="middle"
          fill={color} fontSize={size * 0.22} fontFamily="monospace" fontWeight="bold">
          {Math.round(pct * 100)}%
        </text>
      </svg>
      {label && <span className="text-[5px] font-mono tracking-wider" style={{ color: `${color}88` }}>{label}</span>}
    </div>
  );
}

/* ═══ M_ScrollboxFade — Scrollable container with faded edges ═══ */
export function ScrollboxFade({
  children,
  className,
  maxHeight = '200px',
  fadeColor = 'hsl(220, 12%, 5%)',
}: {
  children: ReactNode;
  className?: string;
  maxHeight?: string;
  fadeColor?: string;
}) {
  return (
    <div className={cn('relative', className)} style={{ maxHeight }}>
      <div className="overflow-y-auto h-full scrollbar-thin" style={{ maxHeight }}>
        {children}
      </div>
      {/* Top fade */}
      <div
        className="absolute top-0 left-0 right-0 h-4 pointer-events-none"
        style={{ background: `linear-gradient(${fadeColor}, transparent)` }}
      />
      {/* Bottom fade */}
      <div
        className="absolute bottom-0 left-0 right-0 h-4 pointer-events-none"
        style={{ background: `linear-gradient(transparent, ${fadeColor})` }}
      />
    </div>
  );
}
