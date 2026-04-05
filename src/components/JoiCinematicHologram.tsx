/**
 * JoiCinematicHologram — Blade Runner 2049 Joi holographic avatar
 * Dual-image version: idle pose + active pose with crossfade transition
 */
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import joiIdle from '@/assets/joi-hologram.png';
import joiActive from '@/assets/joi-hologram-active.png';

interface Props {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  state?: 'idle' | 'active' | 'materializing';
  className?: string;
}

const SIZES = {
  sm: 'w-10 h-16 sm:w-12 sm:h-20',
  md: 'w-20 h-32 sm:w-24 sm:h-40',
  lg: 'w-28 h-44 sm:w-32 sm:h-52',
  xl: 'w-36 h-56 sm:w-44 sm:h-72',
};

export default function JoiCinematicHologram({ size = 'md', state = 'idle', className }: Props) {
  const isActive = state === 'active';
  const isMat = state === 'materializing';

  const [materialised, setMaterialised] = useState(!isMat);
  useEffect(() => {
    if (isMat) {
      setMaterialised(false);
      const t = setTimeout(() => setMaterialised(true), 120);
      return () => clearTimeout(t);
    }
  }, [isMat]);

  const currentImage = isActive ? joiActive : joiIdle;

  return (
    <div className={cn('relative flex items-center justify-center', SIZES[size], className)}>
      {/* Projected shadow */}
      <div
        className="absolute joi-projected-shadow"
        style={{
          width: '140%', height: '55%', bottom: '-6%', left: '-20%',
          background: 'radial-gradient(ellipse 50% 40% at 50% 30%, hsl(280 80% 45% / 0.15), hsl(280 80% 55% / 0.05) 45%, transparent 70%)',
          filter: 'blur(16px)', pointerEvents: 'none',
        }}
      />

      {/* Magenta halo glow — pulses stronger when active */}
      <div
        className={cn('absolute inset-0 rounded-full', isActive && 'joi-halo-active')}
        style={{
          background: isActive
            ? 'radial-gradient(ellipse 70% 85% at 50% 42%, hsl(280 80% 55% / 0.35), hsl(280 80% 55% / 0.1) 50%, transparent 72%)'
            : 'radial-gradient(ellipse 65% 80% at 50% 42%, hsl(280 80% 55% / 0.25), hsl(280 80% 55% / 0.08) 50%, transparent 72%)',
          filter: 'blur(12px)',
        }}
      />

      {/* Projector cone */}
      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2"
        style={{
          width: '65%', height: '10%',
          background: 'conic-gradient(from 180deg, transparent 30%, hsl(280 80% 55% / 0.2) 50%, transparent 70%)',
          filter: 'blur(5px)',
          clipPath: 'polygon(20% 100%, 50% 0%, 80% 100%)',
        }}
      />

      {/* Main image container */}
      <div
        className={cn(
          'relative z-10 w-full h-full flex items-center justify-center',
          !isActive && !isMat && 'joi-breathing'
        )}
        style={{
          clipPath: isMat && !materialised ? 'inset(100% 0 0 0)' : 'inset(0 0 0 0)',
          transition: isMat ? 'clip-path 2.2s cubic-bezier(0.16, 1, 0.3, 1)' : undefined,
          transformOrigin: '50% 85%',
        }}
      >
        {/* Idle image — fades out when active */}
        <img
          src={joiIdle}
          alt="Joi Hologram Idle"
          className="absolute w-full h-full object-contain transition-opacity duration-700 ease-in-out"
          style={{
            opacity: isActive ? 0 : 0.88,
            filter: 'drop-shadow(0 0 12px hsl(280 80% 55% / 0.3)) drop-shadow(0 0 25px hsl(280 80% 55% / 0.1))',
          }}
          draggable={false}
        />

        {/* Active image — fades in when active */}
        <img
          src={joiActive}
          alt="Joi Hologram Active"
          className="absolute w-full h-full object-contain transition-opacity duration-700 ease-in-out"
          style={{
            opacity: isActive ? 1 : 0,
            filter: 'drop-shadow(0 0 20px hsl(280 80% 55% / 0.5)) drop-shadow(0 0 40px hsl(280 80% 55% / 0.2))',
          }}
          draggable={false}
        />

        {/* Scanline overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, hsl(280 80% 55% / 0.04) 2px, hsl(280 80% 55% / 0.04) 4px)',
            mixBlendMode: 'overlay',
          }}
        />

        {/* Moving scanline sweep */}
        <div
          className="absolute inset-x-0 pointer-events-none"
          style={{
            height: '3px',
            background: 'linear-gradient(90deg, transparent, hsl(280 80% 55% / 0.35), transparent)',
            animation: 'joi-scanline-full 4s linear infinite',
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
                opacity: 0.15,
                mixBlendMode: 'screen',
                filter: 'hue-rotate(-60deg) saturate(3)',
              }}
            />
            <div
              className="absolute inset-0 pointer-events-none joi-chroma-shift-right"
              style={{
                backgroundImage: `url(${joiActive})`,
                backgroundSize: 'contain',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
                opacity: 0.15,
                mixBlendMode: 'screen',
                filter: 'hue-rotate(60deg) saturate(3)',
              }}
            />
          </>
        )}

        {/* Glitch flicker (active) */}
        {isActive && (
          <div
            className="absolute inset-0 pointer-events-none joi-voxel-glitch"
            style={{
              background: 'linear-gradient(0deg, transparent 40%, hsl(190 100% 50% / 0.06) 41%, transparent 43%)',
              mixBlendMode: 'screen',
            }}
          />
        )}
      </div>

      {/* Floating micro-particles */}
      <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden">
        {Array.from({ length: 14 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full joi-micro-particle"
            style={{
              width: `${2 + Math.random() * 3}px`,
              height: `${2 + Math.random() * 3}px`,
              left: `${15 + Math.random() * 70}%`,
              top: `${10 + Math.random() * 80}%`,
              background: i % 3 === 0
                ? `hsl(190 90% ${50 + Math.random() * 15}%)`
                : `hsl(280 80% ${55 + Math.random() * 15}%)`,
              ['--mp-dx' as string]: `${-20 + Math.random() * 40}px`,
              ['--mp-dy' as string]: `${-30 + Math.random() * -10}px`,
              ['--mp-dur' as string]: `${3 + Math.random() * 5}s`,
              ['--mp-delay' as string]: `${Math.random() * 6}s`,
              ['--mp-scale' as string]: `${0.8 + Math.random() * 0.6}`,
              ['--mp-op' as string]: `${0.3 + Math.random() * 0.4}`,
            }}
          />
        ))}
      </div>

      {/* Materializing dissolve particles */}
      {isMat && (
        <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={`dp-${i}`}
              className="absolute rounded-full joi-dissolve-particle"
              style={{
                width: `${2 + Math.random() * 4}px`,
                height: `${2 + Math.random() * 4}px`,
                left: `${20 + Math.random() * 60}%`,
                top: `${15 + Math.random() * 70}%`,
                background: 'hsl(280 80% 65%)',
                animationDelay: `${(Math.random() * 2).toFixed(2)}s`,
                animationDuration: `${(1.2 + Math.random() * 1.5).toFixed(2)}s`,
                ['--dissolve-drift' as string]: `${(-12 + Math.random() * 24).toFixed(1)}px`,
              }}
            />
          ))}
        </div>
      )}

      {/* Rain effect */}
      <div className="absolute inset-0 pointer-events-none z-5 overflow-hidden">
        {Array.from({ length: 15 }).map((_, i) => (
          <div
            key={`rain-${i}`}
            className="absolute"
            style={{
              left: `${10 + (i / 15) * 80}%`,
              top: '-5%',
              width: '0.5px',
              height: `${20 + Math.random() * 30}px`,
              background: `hsl(190 100% 60% / ${0.06 + Math.random() * 0.1})`,
              animation: `joi-rain-heavy 1.4s linear ${(i * 0.19).toFixed(2)}s infinite`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
