/**
 * JoiHologramAvatar — CSS-only holographic woman silhouette
 * Inspired by Joi from Blade Runner 2049
 * Amber/cyan glow, scanline sweep, dissolve entrance, idle/active states
 * Night mode: shifts to cyan palette automatically
 */
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useDisplayStore } from '@/store/useDisplayStore';

interface JoiHologramAvatarProps {
  size?: 'sm' | 'md' | 'lg';
  state?: 'idle' | 'active';
  animate?: boolean; // entrance dissolve
  className?: string;
}

const SIZES = {
  sm: { container: 'w-8 h-8', figure: 'w-5 h-5', glow: 6 },
  md: { container: 'w-16 h-16', figure: 'w-10 h-10', glow: 12 },
  lg: { container: 'w-24 h-24', figure: 'w-16 h-16', glow: 20 },
} as const;

export default function JoiHologramAvatar({ size = 'md', state = 'idle', animate = false, className }: JoiHologramAvatarProps) {
  const s = SIZES[size];
  const isActive = state === 'active';
  const nightMode = useDisplayStore(s2 => s2.nightMode);

  // Entrance dissolve state
  const [entered, setEntered] = useState(!animate);
  useEffect(() => {
    if (animate) {
      const t = requestAnimationFrame(() => setEntered(true));
      return () => cancelAnimationFrame(t);
    }
  }, [animate]);

  // Color palette: amber default, cyan in night mode
  const primary = nightMode ? '190 100% 50%' : '32 100% 50%';
  const primaryBright = nightMode ? '190 100% 60%' : '32 100% 55%';
  const eyeColor = nightMode ? '32 100% 60%' : '190 100% 60%'; // inverted for contrast

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
        className={cn(
          "absolute inset-0 rounded-full transition-opacity duration-700",
          isActive ? "opacity-60" : "opacity-25"
        )}
        style={{
          background: `radial-gradient(circle, hsl(${primary} / 0.2), hsl(${eyeColor} / 0.05), transparent 70%)`,
          filter: `blur(${s.glow}px)`,
          animation: isActive ? 'joi-pulse 2s ease-in-out infinite' : 'joi-breathe 4s ease-in-out infinite',
        }}
      />

      {/* Ring */}
      <div
        className={cn(
          "absolute inset-[2px] rounded-full transition-all duration-500",
          isActive ? "opacity-80" : "opacity-40"
        )}
        style={{
          border: `1px solid hsl(${primary} / 0.3)`,
          boxShadow: isActive
            ? `0 0 8px hsl(${primary} / 0.3), inset 0 0 6px hsl(${eyeColor} / 0.1)`
            : `0 0 4px hsl(${primary} / 0.1)`,
        }}
      />

      {/* Silhouette — SVG woman bust */}
      <svg
        viewBox="0 0 40 40"
        className={cn(s.figure, "relative z-10")}
        style={{
          filter: isActive
            ? `drop-shadow(0 0 4px hsl(${primary} / 0.5))`
            : `drop-shadow(0 0 2px hsl(${primary} / 0.2))`,
          animation: isActive ? 'joi-flicker 3s ease-in-out infinite' : undefined,
        }}
      >
        {/* Head */}
        <ellipse cx="20" cy="12" rx="5.5" ry="6.5" fill="none" stroke={`hsl(${primaryBright})`} strokeWidth="0.8" opacity={isActive ? 0.8 : 0.5} />
        {/* Hair outline */}
        <path d="M14 10 Q14 5 20 4 Q26 5 26 10" fill="none" stroke={`hsl(${primary})`} strokeWidth="0.5" opacity={isActive ? 0.6 : 0.3} />
        {/* Neck */}
        <line x1="20" y1="18.5" x2="20" y2="21" stroke={`hsl(${primaryBright})`} strokeWidth="0.7" opacity={isActive ? 0.7 : 0.4} />
        {/* Shoulders */}
        <path d="M20 21 Q14 22 10 26" fill="none" stroke={`hsl(${primaryBright})`} strokeWidth="0.8" opacity={isActive ? 0.7 : 0.4} />
        <path d="M20 21 Q26 22 30 26" fill="none" stroke={`hsl(${primaryBright})`} strokeWidth="0.8" opacity={isActive ? 0.7 : 0.4} />
        {/* Body silhouette */}
        <path d="M10 26 Q11 32 13 38" fill="none" stroke={`hsl(${primary})`} strokeWidth="0.6" opacity={isActive ? 0.5 : 0.25} />
        <path d="M30 26 Q29 32 27 38" fill="none" stroke={`hsl(${primary})`} strokeWidth="0.6" opacity={isActive ? 0.5 : 0.25} />
        {/* Inner glow fill */}
        <ellipse cx="20" cy="12" rx="4" ry="5" fill={`hsl(${primary} / 0.06)`} />
        {/* Eyes hint */}
        <circle cx="17.5" cy="11.5" r="0.6" fill={`hsl(${eyeColor})`} opacity={isActive ? 0.8 : 0.3} />
        <circle cx="22.5" cy="11.5" r="0.6" fill={`hsl(${eyeColor})`} opacity={isActive ? 0.8 : 0.3} />
      </svg>

      {/* Scanline sweep */}
      <div
        className="absolute inset-0 rounded-full overflow-hidden pointer-events-none"
        style={{ zIndex: 11 }}
      >
        <div
          className="absolute left-0 right-0 h-[1px]"
          style={{
            background: `linear-gradient(90deg, transparent, hsl(${primary} / 0.3), transparent)`,
            animation: 'joi-scanline 3s linear infinite',
          }}
        />
      </div>

      {/* Dissolve particles — only on entrance */}
      {animate && !entered && (
        <div className="absolute inset-0 pointer-events-none">
          {Array.from({ length: 6 }, (_, i) => (
            <div
              key={i}
              className="absolute w-[2px] h-[2px] rounded-full"
              style={{
                background: `hsl(${primary})`,
                left: `${20 + Math.cos(i * 1.05) * 40}%`,
                top: `${20 + Math.sin(i * 1.05) * 40}%`,
                animation: `joi-particle ${0.6 + i * 0.1}s ease-out forwards`,
                opacity: 0.6,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
