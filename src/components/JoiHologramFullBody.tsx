/**
 * JoiHologramFullBody — Full-body standing holographic woman
 * Blade Runner 2049 Joi — raised hand interaction pose
 * Materialise animation bottom-to-top, rain particles, blink
 */
import { useState, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useDisplayStore } from '@/store/useDisplayStore';

interface JoiHologramFullBodyProps {
  className?: string;
  state?: 'idle' | 'active' | 'materializing';
}

export default function JoiHologramFullBody({ className, state = 'idle' }: JoiHologramFullBodyProps) {
  const nightMode = useDisplayStore(s => s.nightMode);
  const isActive = state === 'active';
  const isMaterializing = state === 'materializing';

  const [materialised, setMaterialised] = useState(state !== 'materializing');
  useEffect(() => {
    if (isMaterializing) {
      setMaterialised(false);
      const t = setTimeout(() => setMaterialised(true), 100);
      return () => clearTimeout(t);
    }
  }, [isMaterializing]);

  const primary = nightMode ? '190 100% 50%' : '32 100% 50%';
  const bright = nightMode ? '190 100% 60%' : '32 100% 55%';
  const eye = nightMode ? '32 100% 60%' : '190 100% 60%';
  const skin = nightMode ? '190 80% 45%' : '32 80% 48%';

  const rainDrops = useMemo(() =>
    Array.from({ length: 18 }, (_, i) => ({
      x: 15 + (i / 18) * 170,
      delay: i * 0.25,
      len: 20 + Math.random() * 40,
    })), []);

  return (
    <div
      className={cn(
        "relative flex items-center justify-center",
        isMaterializing && "joi-materialize-container",
        className
      )}
      style={{
        filter: isActive ? `drop-shadow(0 0 12px hsl(${primary} / 0.3))` : undefined,
      }}
    >
      {/* Aura glow */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse 60% 80% at 50% 40%, hsl(${primary} / 0.12), transparent 70%)`,
          filter: 'blur(20px)',
          animation: isActive ? 'joi-pulse 2.5s ease-in-out infinite' : 'joi-breathe 5s ease-in-out infinite',
        }}
      />

      <svg
        viewBox="0 0 200 400"
        className="w-full h-full relative z-10"
        style={{
          clipPath: isMaterializing && !materialised
            ? 'inset(100% 0 0 0)'
            : 'inset(0 0 0 0)',
          transition: isMaterializing ? 'clip-path 2s cubic-bezier(0.16, 1, 0.3, 1)' : undefined,
          animation: isActive ? 'joi-flicker 4s ease-in-out infinite' : undefined,
        }}
      >
        <defs>
          <linearGradient id="jfb-body" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={`hsl(${bright})`} stopOpacity={0.1} />
            <stop offset="100%" stopColor={`hsl(${primary})`} stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="jfb-hair" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={`hsl(${primary})`} stopOpacity={0.35} />
            <stop offset="100%" stopColor={`hsl(${bright})`} stopOpacity={0.05} />
          </linearGradient>
          <radialGradient id="jfb-face-glow" cx="50%" cy="40%">
            <stop offset="0%" stopColor={`hsl(${skin})`} stopOpacity={0.08} />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
        </defs>

        {/* ═══ Hair ═══ */}
        <path
          d="M80 55 Q65 25 80 12 Q90 2 100 5 Q110 2 120 12 Q135 25 120 55
             Q125 65 128 85 Q130 105 132 130
             M72 55 Q65 65 62 85 Q58 105 55 130"
          fill="none" stroke={`hsl(${primary})`} strokeWidth="1.2"
          opacity={isActive ? 0.5 : 0.3}
          style={{ animation: 'joi-hair-flow 7s ease-in-out infinite' }}
        />
        <path
          d="M80 55 Q65 25 80 12 Q90 2 100 5 Q110 2 120 12 Q135 25 120 55
             Q125 65 128 85 Q130 105 132 130 L55 130
             Q58 105 62 85 Q65 65 72 55 Z"
          fill="url(#jfb-hair)"
        />

        {/* ═══ Head ═══ */}
        <ellipse cx="100" cy="52" rx="22" ry="28" fill="none"
          stroke={`hsl(${bright})`} strokeWidth="1" opacity={isActive ? 0.75 : 0.4} />
        <ellipse cx="100" cy="52" rx="18" ry="24" fill="url(#jfb-face-glow)" />

        {/* Face details */}
        {/* Cheekbones */}
        <path d="M82 54 Q84 60 87 63" fill="none" stroke={`hsl(${bright})`} strokeWidth="0.5" opacity={isActive ? 0.35 : 0.15} />
        <path d="M118 54 Q116 60 113 63" fill="none" stroke={`hsl(${bright})`} strokeWidth="0.5" opacity={isActive ? 0.35 : 0.15} />

        {/* Nose */}
        <path d="M100 48 L98.5 58 Q100 60 101.5 58" fill="none" stroke={`hsl(${bright})`} strokeWidth="0.5" opacity={isActive ? 0.4 : 0.18} />

        {/* Lips */}
        <path d="M94 65 Q97 67.5 100 68 Q103 67.5 106 65" fill="none" stroke={`hsl(${bright})`} strokeWidth="0.6" opacity={isActive ? 0.5 : 0.22} />
        <path d="M95.5 66 Q98 68 100 68.3 Q102 68 104.5 66" fill="none" stroke={`hsl(${primary})`} strokeWidth="0.3" opacity={isActive ? 0.3 : 0.1} />

        {/* Eyes with blink */}
        <g style={{ animation: 'joi-blink 5.5s ease-in-out infinite' }}>
          <ellipse cx="90" cy="47" rx="5" ry="2.8" fill="none" stroke={`hsl(${bright})`} strokeWidth="0.5" opacity={isActive ? 0.55 : 0.25} />
          <circle cx="90" cy="47" r="1.8" fill={`hsl(${eye})`} opacity={isActive ? 0.85 : 0.35} />
          <circle cx="90" cy="47" r="0.6" fill={`hsl(${eye})`} opacity={isActive ? 1 : 0.5} />

          <ellipse cx="110" cy="47" rx="5" ry="2.8" fill="none" stroke={`hsl(${bright})`} strokeWidth="0.5" opacity={isActive ? 0.55 : 0.25} />
          <circle cx="110" cy="47" r="1.8" fill={`hsl(${eye})`} opacity={isActive ? 0.85 : 0.35} />
          <circle cx="110" cy="47" r="0.6" fill={`hsl(${eye})`} opacity={isActive ? 1 : 0.5} />
        </g>

        {/* Eyebrows */}
        <path d="M83 41 Q88 38 94 40" fill="none" stroke={`hsl(${bright})`} strokeWidth="0.5" opacity={isActive ? 0.4 : 0.18} />
        <path d="M117 41 Q112 38 106 40" fill="none" stroke={`hsl(${bright})`} strokeWidth="0.5" opacity={isActive ? 0.4 : 0.18} />

        {/* ═══ Neck ═══ */}
        <path d="M95 80 L96 95" stroke={`hsl(${bright})`} strokeWidth="0.8" opacity={isActive ? 0.5 : 0.25} />
        <path d="M105 80 L104 95" stroke={`hsl(${bright})`} strokeWidth="0.8" opacity={isActive ? 0.5 : 0.25} />

        {/* ═══ Shoulders & Arms ═══ */}
        <path d="M100 95 Q80 100 60 115" fill="none" stroke={`hsl(${bright})`} strokeWidth="1" opacity={isActive ? 0.6 : 0.3} />
        <path d="M100 95 Q120 100 140 115" fill="none" stroke={`hsl(${bright})`} strokeWidth="1" opacity={isActive ? 0.6 : 0.3} />

        {/* Right arm raised — interaction gesture like Joi */}
        <path d="M140 115 Q148 105 155 85 Q158 75 153 65" fill="none"
          stroke={`hsl(${bright})`} strokeWidth="0.8" opacity={isActive ? 0.55 : 0.28} />
        {/* Hand — open palm */}
        <path d="M153 65 Q150 58 148 55 M153 65 Q155 58 156 56 M153 65 Q157 60 159 58 M153 65 Q158 63 160 62"
          fill="none" stroke={`hsl(${primary})`} strokeWidth="0.5" opacity={isActive ? 0.45 : 0.2} />

        {/* Left arm relaxed */}
        <path d="M60 115 Q52 130 48 155 Q46 170 50 180" fill="none"
          stroke={`hsl(${bright})`} strokeWidth="0.8" opacity={isActive ? 0.5 : 0.25} />

        {/* ═══ Torso ═══ */}
        <path d="M60 115 Q65 145 68 175 Q70 195 75 220"
          fill="none" stroke={`hsl(${primary})`} strokeWidth="0.7" opacity={isActive ? 0.4 : 0.2} />
        <path d="M140 115 Q135 145 132 175 Q130 195 125 220"
          fill="none" stroke={`hsl(${primary})`} strokeWidth="0.7" opacity={isActive ? 0.4 : 0.2} />

        {/* Waist */}
        <path d="M75 220 Q100 215 125 220" fill="none" stroke={`hsl(${primary})`} strokeWidth="0.6" opacity={isActive ? 0.35 : 0.15} />

        {/* Body fill */}
        <path d="M60 115 Q65 145 68 175 Q70 195 75 220 Q100 215 125 220 Q130 195 132 175 Q135 145 140 115 Q120 100 100 95 Q80 100 60 115 Z"
          fill="url(#jfb-body)" />

        {/* ═══ Legs ═══ */}
        <path d="M80 220 Q82 270 84 320 Q85 350 86 380" fill="none"
          stroke={`hsl(${primary})`} strokeWidth="0.6" opacity={isActive ? 0.3 : 0.15} />
        <path d="M120 220 Q118 270 116 320 Q115 350 114 380" fill="none"
          stroke={`hsl(${primary})`} strokeWidth="0.6" opacity={isActive ? 0.3 : 0.15} />

        {/* ═══ Holographic Rain ═══ */}
        {rainDrops.map((d, i) => (
          <line
            key={i}
            x1={d.x} y1={-10} x2={d.x} y2={d.len}
            stroke={`hsl(${primary} / ${isActive ? 0.1 : 0.04})`}
            strokeWidth="0.4"
            style={{ animation: `joi-rain ${1.8 + d.delay * 0.15}s linear ${d.delay}s infinite` }}
          />
        ))}

        {/* ═══ Glitch Lines ═══ */}
        {isActive && (
          <g style={{ animation: 'joi-glitch 3.5s step-end infinite' }}>
            <rect x="0" y="45" width="200" height="1" fill={`hsl(${primary} / 0.12)`} />
            <rect x="20" y="120" width="160" height="0.6" fill={`hsl(${eye} / 0.08)`} />
            <rect x="40" y="250" width="120" height="0.8" fill={`hsl(${primary} / 0.06)`} />
            <rect x="10" y="340" width="180" height="0.5" fill={`hsl(${eye} / 0.05)`} />
          </g>
        )}

        {/* Scanline */}
        <rect x="0" y="0" width="200" height="2"
          fill={`hsl(${primary} / 0.2)`}
          style={{ animation: 'joi-scanline-full 4s linear infinite' }}
        />
      </svg>

      {/* Base platform glow */}
      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3/4 h-1"
        style={{
          background: `linear-gradient(90deg, transparent, hsl(${primary} / 0.4), transparent)`,
          filter: 'blur(4px)',
        }}
      />
    </div>
  );
}
