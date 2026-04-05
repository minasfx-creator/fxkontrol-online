/**
 * JoiCinematicHologram — Blade Runner 2049 Joi holographic avatar
 * Warm rosa-pêssego-âmbar palette, organic breathing, cinematic presence
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import joiIdle from '@/assets/joi-hologram.png';
import joiActive from '@/assets/joi-hologram-active.png';
import joiCloseup from '@/assets/joi-hologram-closeup.png';

export type JoiEmotion = 'caring' | 'celebrating' | 'serious';

interface Props {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  state?: 'idle' | 'active' | 'materializing';
  glitching?: boolean;
  emotion?: JoiEmotion;
  variant?: 'full' | 'closeup';
  className?: string;
}

const SIZES = {
  sm: 'w-10 h-16 sm:w-12 sm:h-20',
  md: 'w-20 h-32 sm:w-24 sm:h-40',
  lg: 'w-28 h-44 sm:w-32 sm:h-52',
  xl: 'w-36 h-56 sm:w-44 sm:h-72',
};

export default function JoiCinematicHologram({ size = 'md', state = 'idle', glitching = false, emotion = 'caring', variant = 'full', className }: Props) {
  const isActive = state === 'active';
  const isCelebrating = emotion === 'celebrating';
  const isSerious = emotion === 'serious';
  const isMat = state === 'materializing';

  const [materialised, setMaterialised] = useState(!isMat);
  useEffect(() => {
    if (isMat) {
      setMaterialised(false);
      const t = setTimeout(() => setMaterialised(true), 120);
      return () => clearTimeout(t);
    }
  }, [isMat]);

  const isCloseup = variant === 'closeup';
  const currentImage = isCloseup ? joiCloseup : (isActive ? joiActive : joiIdle);

  // Parallax eye-contact effect
  const containerRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    // Normalize to -1..1
    const nx = (e.clientX - cx) / (rect.width / 2);
    const ny = (e.clientY - cy) / (rect.height / 2);
    // Subtle rotation: max ~4deg, and slight translate for depth
    setTilt({ x: ny * -3, y: nx * 4 });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setTilt({ x: 0, y: 0 });
  }, []);

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={cn('relative flex items-center justify-center', SIZES[size], className)}
    >
      {/* Warm ambient glow — varies by emotion */}
      <div
        className={cn("absolute", isCelebrating ? "joi-celebrate-bounce" : "joi-warm-pulse")}
        style={{
          width: '160%', height: '130%', top: '-15%', left: '-30%',
          background: isCelebrating
            ? 'radial-gradient(ellipse 55% 65% at 48% 45%, hsl(42 90% 55% / 0.2), hsl(32 80% 45% / 0.1) 50%, transparent 75%)'
            : isSerious
              ? 'radial-gradient(ellipse 55% 65% at 48% 45%, hsl(340 65% 58% / 0.06), hsl(32 80% 45% / 0.03) 50%, transparent 75%)'
              : 'radial-gradient(ellipse 55% 65% at 48% 45%, hsl(340 65% 58% / 0.12), hsl(32 80% 45% / 0.06) 50%, transparent 75%)',
          filter: 'blur(20px)', pointerEvents: 'none',
        }}
      />

      {/* Serious alert border */}
      {isSerious && (
        <div
          className="absolute inset-0 rounded-full joi-serious-pulse pointer-events-none"
          style={{
            border: '1px solid hsl(32 80% 50% / 0.3)',
            boxShadow: '0 0 15px hsl(32 80% 50% / 0.1)',
          }}
        />
      )}

      {/* Celebration particles burst */}
      {isCelebrating && (
        <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={`cel-${i}`}
              className="absolute rounded-full joi-celebrate-particle"
              style={{
                width: `${2 + Math.random() * 3}px`,
                height: `${2 + Math.random() * 3}px`,
                left: `${30 + Math.random() * 40}%`,
                bottom: `${10 + Math.random() * 30}%`,
                background: i % 2 === 0 ? 'hsl(42 90% 60%)' : 'hsl(340 65% 65%)',
                animationDelay: `${(Math.random() * 0.6).toFixed(2)}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* Projected shadow — warm golden */}
      <div
        className="absolute joi-projected-shadow"
        style={{
          width: '140%', height: '55%', bottom: '-6%', left: '-20%',
          background: 'radial-gradient(ellipse 50% 40% at 50% 30%, hsl(32 80% 40% / 0.12), hsl(340 65% 50% / 0.05) 45%, transparent 70%)',
          filter: 'blur(16px)', pointerEvents: 'none',
        }}
      />

      {/* Warm halo glow — rosa-pêssego */}
      <div
        className={cn('absolute inset-0 rounded-full', isActive && 'joi-halo-active')}
        style={{
          background: isActive
            ? 'radial-gradient(ellipse 70% 85% at 50% 42%, hsl(340 65% 58% / 0.3), hsl(32 80% 50% / 0.1) 50%, transparent 72%)'
            : 'radial-gradient(ellipse 65% 80% at 50% 42%, hsl(340 65% 58% / 0.2), hsl(32 80% 50% / 0.06) 50%, transparent 72%)',
          filter: 'blur(12px)',
        }}
      />

      {/* Projector cone — warm */}
      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2"
        style={{
          width: '65%', height: '10%',
          background: 'conic-gradient(from 180deg, transparent 30%, hsl(340 65% 55% / 0.15) 50%, transparent 70%)',
          filter: 'blur(5px)',
          clipPath: 'polygon(20% 100%, 50% 0%, 80% 100%)',
        }}
      />

      {/* Main image container */}
      <div
        className={cn(
          'relative z-10 w-full h-full flex items-center justify-center',
          !isActive && !isMat && !glitching && 'joi-breathing'
        )}
        style={{
          clipPath: isMat && !materialised ? 'inset(100% 0 0 0)' : 'inset(0 0 0 0)',
          transition: isMat ? 'clip-path 2.2s cubic-bezier(0.16, 1, 0.3, 1)' : undefined,
          transformOrigin: '50% 85%',
          animation: glitching ? 'joi-glitch-burst 0.8s steps(1, end) both' : undefined,
        }}
      >
        {/* Close-up variant — single image with vignette */}
        {isCloseup ? (
          <>
            <img
              src={joiCloseup}
              alt="Joi Close-up"
              className="absolute w-full h-full object-cover joi-closeup-entrance"
              style={{
                filter: 'drop-shadow(0 0 20px hsl(340 65% 55% / 0.35)) drop-shadow(0 0 40px hsl(32 80% 50% / 0.15))',
              }}
              draggable={false}
            />
            <div className="absolute inset-0 joi-closeup-vignette" />
          </>
        ) : (
          <>
            {/* Idle image */}
            <img
              src={joiIdle}
              alt="Joi Hologram Idle"
              className="absolute w-full h-full object-contain transition-opacity duration-700 ease-in-out"
              style={{
                opacity: isActive ? 0 : 0.9,
                filter: 'drop-shadow(0 0 12px hsl(340 65% 55% / 0.25)) drop-shadow(0 0 25px hsl(32 80% 50% / 0.1))',
              }}
              draggable={false}
            />
            {/* Active image */}
            <img
              src={joiActive}
              alt="Joi Hologram Active"
              className="absolute w-full h-full object-contain transition-opacity duration-700 ease-in-out"
              style={{
                opacity: isActive ? 1 : 0,
                filter: 'drop-shadow(0 0 20px hsl(340 65% 55% / 0.4)) drop-shadow(0 0 40px hsl(32 80% 50% / 0.15))',
              }}
              draggable={false}
            />
          </>
        )}

        {/* Scanline overlay — very subtle */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, hsl(340 60% 55% / 0.015) 3px, hsl(340 60% 55% / 0.015) 6px)',
            mixBlendMode: 'overlay',
          }}
        />

        {/* Moving scanline sweep — slower */}
        <div
          className="absolute inset-x-0 pointer-events-none"
          style={{
            height: '2px',
            background: 'linear-gradient(90deg, transparent, hsl(340 65% 58% / 0.2), transparent)',
            animation: 'joi-scanline-full 7s linear infinite',
          }}
        />

        {/* Chromatic aberration overlay (active) */}
        {isActive && (
          <>
            <div
              className="absolute inset-0 pointer-events-none joi-chroma-shift-left"
              style={{
                backgroundImage: `url(${joiActive})`,
                backgroundSize: 'contain',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
                opacity: 0.1,
                mixBlendMode: 'screen',
                filter: 'hue-rotate(-40deg) saturate(2)',
              }}
            />
            <div
              className="absolute inset-0 pointer-events-none joi-chroma-shift-right"
              style={{
                backgroundImage: `url(${joiActive})`,
                backgroundSize: 'contain',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
                opacity: 0.1,
                mixBlendMode: 'screen',
                filter: 'hue-rotate(40deg) saturate(2)',
              }}
            />
          </>
        )}

        {/* Glitch flicker (active) */}
        {isActive && (
          <div
            className="absolute inset-0 pointer-events-none joi-voxel-glitch"
            style={{
              background: 'linear-gradient(0deg, transparent 40%, hsl(190 100% 50% / 0.04) 41%, transparent 43%)',
              mixBlendMode: 'screen',
            }}
          />
        )}

        {/* Chromatic burst overlays (glitching) */}
        {glitching && (
          <>
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundImage: `url(${currentImage})`,
                backgroundSize: 'contain',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
                mixBlendMode: 'screen',
                filter: 'hue-rotate(-60deg) saturate(4)',
                animation: 'joi-chroma-burst-left 0.8s ease-out both',
              }}
            />
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundImage: `url(${currentImage})`,
                backgroundSize: 'contain',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
                mixBlendMode: 'screen',
                filter: 'hue-rotate(60deg) saturate(4)',
                animation: 'joi-chroma-burst-right 0.8s ease-out both',
              }}
            />
            <div
              className="absolute inset-0 pointer-events-none rounded"
              style={{
                background: 'radial-gradient(ellipse at 50% 40%, hsl(340 65% 70% / 0.4), hsl(32 80% 50% / 0.15) 50%, transparent 75%)',
                mixBlendMode: 'screen',
                animation: 'joi-flash-burst 0.8s ease-out both',
              }}
            />
          </>
        )}
      </div>

      {/* Floating micro-particles — hidden in serious mode for focus */}
      {!isSerious && <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden">
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full joi-micro-particle"
            style={{
              width: `${1.5 + Math.random() * 2}px`,
              height: `${1.5 + Math.random() * 2}px`,
              left: `${15 + Math.random() * 70}%`,
              top: `${10 + Math.random() * 80}%`,
              background: i % 3 === 0
                ? `hsl(32 80% ${50 + Math.random() * 15}%)`
                : `hsl(350 60% ${55 + Math.random() * 15}%)`,
              ['--mp-dx' as string]: `${-15 + Math.random() * 30}px`,
              ['--mp-dy' as string]: `${-25 + Math.random() * -8}px`,
              ['--mp-dur' as string]: `${4 + Math.random() * 6}s`,
              ['--mp-delay' as string]: `${Math.random() * 8}s`,
              ['--mp-scale' as string]: `${0.6 + Math.random() * 0.5}`,
              ['--mp-op' as string]: `${0.2 + Math.random() * 0.3}`,
            }}
          />
        ))}
      </div>}

      {/* Materializing dissolve particles — warm */}
      {isMat && (
        <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden">
          {Array.from({ length: 16 }).map((_, i) => (
            <div
              key={`dp-${i}`}
              className="absolute rounded-full joi-dissolve-particle"
              style={{
                width: `${2 + Math.random() * 3}px`,
                height: `${2 + Math.random() * 3}px`,
                left: `${20 + Math.random() * 60}%`,
                top: `${15 + Math.random() * 70}%`,
                background: i % 2 === 0 ? 'hsl(340 65% 60%)' : 'hsl(32 80% 55%)',
                animationDelay: `${(Math.random() * 2).toFixed(2)}s`,
                animationDuration: `${(1.2 + Math.random() * 1.5).toFixed(2)}s`,
                ['--dissolve-drift' as string]: `${(-12 + Math.random() * 24).toFixed(1)}px`,
              }}
            />
          ))}
        </div>
      )}

      {/* Rain effect — warm subtle */}
      <div className="absolute inset-0 pointer-events-none z-5 overflow-hidden">
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={`rain-${i}`}
            className="absolute"
            style={{
              left: `${10 + (i / 10) * 80}%`,
              top: '-5%',
              width: '0.5px',
              height: `${18 + Math.random() * 25}px`,
              background: `hsl(340 50% 60% / ${0.03 + Math.random() * 0.06})`,
              animation: `joi-rain-heavy 1.8s linear ${(i * 0.22).toFixed(2)}s infinite`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
