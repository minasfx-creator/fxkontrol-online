/**
 * JoiHologramAvatar — Detailed holographic woman silhouette
 * Inspired by Joi from Blade Runner 2049
 * Features: detailed face, flowing hair, blink animation, holographic rain, glitch lines
 */
import { useState, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useDisplayStore } from '@/store/useDisplayStore';

interface JoiHologramAvatarProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  state?: 'idle' | 'active';
  animate?: boolean;
  className?: string;
}

const SIZES = {
  sm: { container: 'w-8 h-8', figure: 'w-6 h-6', glow: 6, rain: 4 },
  md: { container: 'w-16 h-16', figure: 'w-12 h-12', glow: 12, rain: 6 },
  lg: { container: 'w-24 h-24', figure: 'w-18 h-18', glow: 20, rain: 8 },
  xl: { container: 'w-40 h-40', figure: 'w-32 h-32', glow: 30, rain: 12 },
} as const;

export default function JoiHologramAvatar({ size = 'md', state = 'idle', animate = false, className }: JoiHologramAvatarProps) {
  const s = SIZES[size];
  const isActive = state === 'active';
  const nightMode = useDisplayStore(s2 => s2.nightMode);

  const [entered, setEntered] = useState(!animate);
  useEffect(() => {
    if (animate) {
      const t = requestAnimationFrame(() => setEntered(true));
      return () => cancelAnimationFrame(t);
    }
  }, [animate]);

  // Color palette
  const primary = nightMode ? '190 100% 50%' : '32 100% 50%';
  const primaryBright = nightMode ? '190 100% 60%' : '32 100% 55%';
  const eyeColor = nightMode ? '32 100% 60%' : '190 100% 60%';
  const skinGlow = nightMode ? '190 80% 45%' : '32 80% 48%';

  // Rain lines
  const rainLines = useMemo(() =>
    Array.from({ length: s.rain }, (_, i) => ({
      x: 8 + (i / s.rain) * 84,
      delay: i * 0.3,
      height: 15 + Math.random() * 25,
    })), [s.rain]);

  return (
    <div
      className={cn(
        "relative flex items-center justify-center transition-all",
        s.container,
        animate && "joi-dissolve-entrance",
        entered ? "opacity-100" : "opacity-0",
        className
      )}
      style={{
        transition: animate ? 'opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1), filter 0.8s ease-out' : undefined,
        filter: entered ? 'blur(0px)' : 'blur(8px)',
      }}
    >
      {/* Outer aura */}
      <div
        className={cn("absolute inset-0 rounded-full transition-opacity duration-700", isActive ? "opacity-60" : "opacity-25")}
        style={{
          background: `radial-gradient(circle, hsl(${primary} / 0.25), hsl(${eyeColor} / 0.08), transparent 70%)`,
          filter: `blur(${s.glow}px)`,
          animation: isActive ? 'joi-pulse 2s ease-in-out infinite' : 'joi-breathe 4s ease-in-out infinite',
        }}
      />

      {/* Ring */}
      <div
        className={cn("absolute inset-[2px] rounded-full transition-all duration-500", isActive ? "opacity-80" : "opacity-40")}
        style={{
          border: `1px solid hsl(${primary} / 0.3)`,
          boxShadow: isActive
            ? `0 0 8px hsl(${primary} / 0.3), inset 0 0 6px hsl(${eyeColor} / 0.1)`
            : `0 0 4px hsl(${primary} / 0.1)`,
        }}
      />

      {/* Detailed Silhouette SVG */}
      <svg
        viewBox="0 0 60 60"
        className={cn(s.figure, "relative z-10")}
        style={{
          filter: isActive
            ? `drop-shadow(0 0 6px hsl(${primary} / 0.5))`
            : `drop-shadow(0 0 2px hsl(${primary} / 0.2))`,
          animation: isActive ? 'joi-flicker 3s ease-in-out infinite' : undefined,
        }}
      >
        <defs>
          <linearGradient id="joi-body-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={`hsl(${primaryBright})`} stopOpacity={isActive ? 0.15 : 0.06} />
            <stop offset="100%" stopColor={`hsl(${primary})`} stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="joi-hair-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={`hsl(${primary})`} stopOpacity={isActive ? 0.4 : 0.2} />
            <stop offset="100%" stopColor={`hsl(${primaryBright})`} stopOpacity={0.05} />
          </linearGradient>
        </defs>

        {/* Hair — flowing long hair with animation */}
        <path
          d="M22 12 Q18 6 22 3 Q27 0 30 2 Q33 0 38 3 Q42 6 38 12
             Q40 14 40 18 Q41 24 42 30 Q43 34 41 38
             M18 12 Q16 14 16 18 Q15 24 14 30 Q13 34 15 38"
          fill="none"
          stroke={`hsl(${primary})`}
          strokeWidth="0.6"
          opacity={isActive ? 0.5 : 0.25}
          style={{ animation: 'joi-hair-flow 6s ease-in-out infinite' }}
        />
        {/* Hair volume fill */}
        <path
          d="M22 12 Q18 6 22 3 Q27 0 30 2 Q33 0 38 3 Q42 6 38 12
             Q40 14 40 18 Q41 24 42 30 Q43 34 41 38
             L15 38 Q13 34 14 30 Q15 24 16 18 Q16 14 18 12 Z"
          fill="url(#joi-hair-grad)"
        />

        {/* Head — refined oval face shape */}
        <ellipse cx="30" cy="14" rx="7" ry="8.5"
          fill="none" stroke={`hsl(${primaryBright})`} strokeWidth="0.7"
          opacity={isActive ? 0.8 : 0.45} />
        {/* Inner face glow */}
        <ellipse cx="30" cy="14" rx="5.5" ry="7"
          fill={`hsl(${skinGlow} / ${isActive ? 0.08 : 0.03})`} />

        {/* Face contours — cheekbones */}
        <path d="M24.5 14 Q25 16 26 17" fill="none" stroke={`hsl(${primaryBright})`} strokeWidth="0.3" opacity={isActive ? 0.4 : 0.15} />
        <path d="M35.5 14 Q35 16 34 17" fill="none" stroke={`hsl(${primaryBright})`} strokeWidth="0.3" opacity={isActive ? 0.4 : 0.15} />

        {/* Nose — delicate */}
        <path d="M30 12 L29.5 16 Q30 16.8 30.5 16" fill="none" stroke={`hsl(${primaryBright})`} strokeWidth="0.3" opacity={isActive ? 0.5 : 0.2} />

        {/* Lips */}
        <path d="M28 18.5 Q29 19.2 30 19.3 Q31 19.2 32 18.5" fill="none" stroke={`hsl(${primaryBright})`} strokeWidth="0.35" opacity={isActive ? 0.5 : 0.2} />
        <path d="M28.5 18.8 Q29.5 19.5 30 19.6 Q30.5 19.5 31.5 18.8" fill="none" stroke={`hsl(${primary})`} strokeWidth="0.2" opacity={isActive ? 0.3 : 0.1} />

        {/* Eyes with blink animation */}
        <g style={{ animation: 'joi-blink 5s ease-in-out infinite' }}>
          {/* Left eye */}
          <ellipse cx="26.5" cy="13" rx="1.8" ry="1" fill="none" stroke={`hsl(${primaryBright})`} strokeWidth="0.3" opacity={isActive ? 0.6 : 0.3} />
          <circle cx="26.5" cy="13" r="0.7" fill={`hsl(${eyeColor})`} opacity={isActive ? 0.9 : 0.4} />
          <circle cx="26.5" cy="13" r="0.25" fill={`hsl(${eyeColor})`} opacity={isActive ? 1 : 0.5} />
          {/* Right eye */}
          <ellipse cx="33.5" cy="13" rx="1.8" ry="1" fill="none" stroke={`hsl(${primaryBright})`} strokeWidth="0.3" opacity={isActive ? 0.6 : 0.3} />
          <circle cx="33.5" cy="13" r="0.7" fill={`hsl(${eyeColor})`} opacity={isActive ? 0.9 : 0.4} />
          <circle cx="33.5" cy="13" r="0.25" fill={`hsl(${eyeColor})`} opacity={isActive ? 1 : 0.5} />
        </g>

        {/* Eyebrows */}
        <path d="M24 10.8 Q26 9.8 28.5 10.5" fill="none" stroke={`hsl(${primaryBright})`} strokeWidth="0.3" opacity={isActive ? 0.5 : 0.2} />
        <path d="M36 10.8 Q34 9.8 31.5 10.5" fill="none" stroke={`hsl(${primaryBright})`} strokeWidth="0.3" opacity={isActive ? 0.5 : 0.2} />

        {/* Neck — elegant */}
        <line x1="30" y1="22.5" x2="30" y2="26" stroke={`hsl(${primaryBright})`} strokeWidth="0.6" opacity={isActive ? 0.6 : 0.3} />
        <line x1="28" y1="23" x2="28.5" y2="26" stroke={`hsl(${primary})`} strokeWidth="0.3" opacity={isActive ? 0.3 : 0.1} />
        <line x1="32" y1="23" x2="31.5" y2="26" stroke={`hsl(${primary})`} strokeWidth="0.3" opacity={isActive ? 0.3 : 0.1} />

        {/* Shoulders & upper body — feminine curve */}
        <path d="M30 26 Q24 27 18 31" fill="none" stroke={`hsl(${primaryBright})`} strokeWidth="0.7" opacity={isActive ? 0.65 : 0.35} />
        <path d="M30 26 Q36 27 42 31" fill="none" stroke={`hsl(${primaryBright})`} strokeWidth="0.7" opacity={isActive ? 0.65 : 0.35} />

        {/* Torso silhouette */}
        <path d="M18 31 Q19 36 20 40 Q22 46 24 52"
          fill="none" stroke={`hsl(${primary})`} strokeWidth="0.5" opacity={isActive ? 0.4 : 0.2} />
        <path d="M42 31 Q41 36 40 40 Q38 46 36 52"
          fill="none" stroke={`hsl(${primary})`} strokeWidth="0.5" opacity={isActive ? 0.4 : 0.2} />

        {/* Inner body glow */}
        <path d="M18 31 Q19 36 20 40 Q22 46 24 52 L36 52 Q38 46 40 40 Q41 36 42 31 Q36 27 30 26 Q24 27 18 31 Z"
          fill="url(#joi-body-grad)" />

        {/* Collar/neckline detail */}
        <path d="M25 27 Q30 29.5 35 27" fill="none" stroke={`hsl(${primary})`} strokeWidth="0.3" opacity={isActive ? 0.35 : 0.15} />

        {/* Holographic rain lines */}
        {rainLines.map((line, i) => (
          <line
            key={i}
            x1={line.x}
            y1={-5}
            x2={line.x}
            y2={line.height}
            stroke={`hsl(${primary} / ${isActive ? 0.12 : 0.05})`}
            strokeWidth="0.2"
            style={{ animation: `joi-rain ${1.5 + line.delay * 0.2}s linear ${line.delay}s infinite` }}
          />
        ))}

        {/* Glitch lines — horizontal cuts */}
        {isActive && (
          <g style={{ animation: 'joi-glitch 4s step-end infinite' }}>
            <rect x="0" y="11" width="60" height="0.5" fill={`hsl(${primary} / 0.15)`} />
            <rect x="5" y="28" width="50" height="0.3" fill={`hsl(${eyeColor} / 0.1)`} />
            <rect x="10" y="42" width="40" height="0.4" fill={`hsl(${primary} / 0.08)`} />
          </g>
        )}
      </svg>

      {/* Scanline sweep */}
      <div className="absolute inset-0 rounded-full overflow-hidden pointer-events-none" style={{ zIndex: 11 }}>
        <div
          className="absolute left-0 right-0 h-[1px]"
          style={{
            background: `linear-gradient(90deg, transparent, hsl(${primary} / 0.3), transparent)`,
            animation: 'joi-scanline 3s linear infinite',
          }}
        />
      </div>

      {/* Dissolve particles */}
      {animate && !entered && (
        <div className="absolute inset-0 pointer-events-none">
          {Array.from({ length: 8 }, (_, i) => (
            <div
              key={i}
              className="absolute w-[2px] h-[2px] rounded-full"
              style={{
                background: `hsl(${primary})`,
                left: `${20 + Math.cos(i * 0.78) * 40}%`,
                top: `${20 + Math.sin(i * 0.78) * 40}%`,
                animation: `joi-particle ${0.5 + i * 0.08}s ease-out forwards`,
                opacity: 0.6,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
