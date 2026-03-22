import { useState, useEffect, forwardRef } from 'react';
import fxkLogo from '@/assets/fxk-logo.png';
import { cn } from '@/lib/utils';

interface SplashScreenProps {
  onStart: () => void;
  showVideoBackground?: boolean;
}

const PRODUCT_LINES = [
  { label: 'PYRO', color: 'hsl(0 85% 55%)' },
  { label: 'DMX', color: 'hsl(195 100% 50%)' },
  { label: 'LIGHT', color: 'hsl(260 80% 65%)' },
  { label: 'DRONES', color: 'hsl(165 100% 42%)' },
];

const SplashScreen = forwardRef<HTMLDivElement, SplashScreenProps>(function SplashScreen({ onStart }, ref) {
  const [phase, setPhase] = useState<'intro' | 'ready' | 'exit'>('intro');

  useEffect(() => {
    const timer = setTimeout(() => setPhase('ready'), 400);
    return () => clearTimeout(timer);
  }, []);

  const handleStart = () => {
    setPhase('exit');
    setTimeout(() => onStart(), 600);
  };

  return (
    <div
      ref={ref}
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center transition-all duration-600 ease-out cursor-pointer",
        phase === 'exit' ? 'opacity-0 scale-[1.03] pointer-events-none' : 'opacity-100 scale-100'
      )}
      style={{ background: '#080a0f' }}
      onClick={phase === 'ready' ? handleStart : undefined}
    >
      {/* Tactical grid overlay */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `
              linear-gradient(hsl(165 100% 42% / 0.6) 1px, transparent 1px),
              linear-gradient(90deg, hsl(165 100% 42% / 0.6) 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px',
          }}
        />
        {/* Scanline overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, hsl(165 100% 42% / 0.15) 2px, hsl(165 100% 42% / 0.15) 4px)',
          }}
        />
        {/* Center glow */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full"
          style={{
            background: 'radial-gradient(circle, hsl(165 100% 42% / 0.06), transparent 70%)',
            filter: 'blur(80px)',
          }}
        />
      </div>

      {/* Corner brackets — military HUD */}
      <div className="absolute inset-8 pointer-events-none">
        {/* Top-left */}
        <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2" style={{ borderColor: 'hsl(165 100% 42% / 0.4)' }} />
        {/* Top-right */}
        <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2" style={{ borderColor: 'hsl(165 100% 42% / 0.4)' }} />
        {/* Bottom-left */}
        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2" style={{ borderColor: 'hsl(165 100% 42% / 0.4)' }} />
        {/* Bottom-right */}
        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2" style={{ borderColor: 'hsl(165 100% 42% / 0.4)' }} />
      </div>

      {/* Corner labels */}
      <div className="absolute top-10 left-12 font-tactical text-[9px] tracking-[0.3em] uppercase" style={{ color: 'hsl(165 100% 42% / 0.3)' }}>
        SYS.INIT
      </div>
      <div className="absolute top-10 right-12 font-tactical text-[9px] tracking-[0.3em] uppercase" style={{ color: 'hsl(165 100% 42% / 0.3)' }}>
        MINAS FX
      </div>
      <div className="absolute bottom-10 left-12 font-tactical text-[9px] tracking-[0.3em] uppercase" style={{ color: 'hsl(165 100% 42% / 0.3)' }}>
        SECURE
      </div>
      <div className="absolute bottom-10 right-12 font-tactical text-[9px] tracking-[0.3em] uppercase" style={{ color: 'hsl(165 100% 42% / 0.3)' }}>
        v2.0
      </div>

      {/* Main content */}
      <div
        className={cn(
          "relative flex flex-col items-center gap-8 transition-all duration-700 ease-out",
          phase === 'intro' ? 'opacity-0 translate-y-8 scale-95' : 'opacity-100 translate-y-0 scale-100'
        )}
      >
        {/* Logo in tactical frame */}
        <div className="flex flex-col items-center gap-5">
          <div
            className="w-32 h-32 flex items-center justify-center rounded-sm relative"
            style={{
              border: '1px solid hsl(165 100% 42% / 0.25)',
              background: 'linear-gradient(135deg, hsl(165 100% 42% / 0.05), transparent)',
              boxShadow: '0 0 60px hsl(165 100% 42% / 0.08), inset 0 0 30px hsl(165 100% 42% / 0.03)',
            }}
          >
            {/* Crosshair marks on frame */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-4 h-px" style={{ background: 'hsl(165 100% 42% / 0.4)' }} />
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-px" style={{ background: 'hsl(165 100% 42% / 0.4)' }} />
            <div className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-px" style={{ background: 'hsl(165 100% 42% / 0.4)' }} />
            <div className="absolute right-0 top-1/2 -translate-y-1/2 h-4 w-px" style={{ background: 'hsl(165 100% 42% / 0.4)' }} />

            <img
              src={fxkLogo}
              alt="FX Kontrol"
              className="w-28 h-28 object-contain"
              style={{ filter: 'drop-shadow(0 0 20px hsl(165 100% 42% / 0.3))' }}
            />
          </div>

          <h1
            className="text-3xl font-extrabold tracking-[0.35em] uppercase font-display"
            style={{ color: 'hsl(165 100% 42%)' }}
          >
            FX KONTROL
          </h1>

          <p className="font-tactical text-[10px] tracking-[0.25em] uppercase" style={{ color: 'hsl(45 90% 55% / 0.5)' }}>
            Professional Show Control System
          </p>
        </div>

        {/* Tactical divider */}
        <div className="flex items-center gap-2 w-64">
          <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, transparent, hsl(165 100% 42% / 0.3))' }} />
          <div className="w-1.5 h-1.5 rotate-45" style={{ border: '1px solid hsl(165 100% 42% / 0.4)' }} />
          <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, hsl(165 100% 42% / 0.3), transparent)' }} />
        </div>

        {/* Product line indicators */}
        <div className="flex items-center gap-5">
          {PRODUCT_LINES.map((p) => (
            <div key={p.label} className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: p.color, boxShadow: `0 0 6px ${p.color}` }} />
              <span className="font-tactical text-[8px] tracking-[0.2em] uppercase" style={{ color: 'hsl(0 0% 45%)' }}>
                {p.label}
              </span>
            </div>
          ))}
        </div>

        {/* Start button */}
        <div
          className="px-14 py-3 text-sm font-bold tracking-[0.3em] uppercase font-tactical rounded-sm transition-all duration-500 animate-pulse"
          style={{
            background: 'hsl(165 100% 42% / 0.1)',
            border: '1px solid hsl(165 100% 42% / 0.3)',
            color: 'hsl(165 100% 60%)',
            boxShadow: '0 0 30px hsl(165 100% 42% / 0.1)',
          }}
        >
          ▶ INITIALIZE
        </div>

        <p className="font-tactical text-[8px] tracking-[0.2em] uppercase" style={{ color: 'hsl(0 0% 25%)' }}>
          v2.0 · FXK TACTICAL ENGINE
        </p>
      </div>
    </div>
  );
});

export default SplashScreen;
