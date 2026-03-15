import { useState, useEffect, forwardRef } from 'react';
import fxkLogo from '@/assets/fxk-logo.png';
import { cn } from '@/lib/utils';

interface SplashScreenProps {
  onStart: () => void;
  showVideoBackground?: boolean;
}

const SplashScreen = forwardRef<HTMLDivElement, SplashScreenProps>(function SplashScreen({ onStart, showVideoBackground = false }, ref) {
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
      style={{ background: 'hsl(225 14% 4%)' }}
      onClick={phase === 'ready' ? handleStart : undefined}
    >
      {/* Ambient background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: `
              linear-gradient(hsl(195 100% 50% / 0.5) 1px, transparent 1px),
              linear-gradient(90deg, hsl(195 100% 50% / 0.5) 1px, transparent 1px)
            `,
            backgroundSize: '80px 80px',
          }}
        />
        <div
          className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full"
          style={{
            background: 'radial-gradient(circle, hsl(195 100% 50% / 0.06), transparent 70%)',
            filter: 'blur(60px)',
          }}
        />
        <div
          className="absolute bottom-1/4 right-1/3 w-[400px] h-[400px] rounded-full"
          style={{
            background: 'radial-gradient(circle, hsl(18 100% 55% / 0.04), transparent 70%)',
            filter: 'blur(80px)',
          }}
        />
        <div
          className="absolute top-0 left-0 right-0 h-32"
          style={{ background: 'linear-gradient(to bottom, hsl(225 14% 3%), transparent)' }}
        />
        <div
          className="absolute bottom-0 left-0 right-0 h-32"
          style={{ background: 'linear-gradient(to top, hsl(225 14% 3%), transparent)' }}
        />
      </div>

      <div
        className={cn(
          "relative flex flex-col items-center gap-10 transition-all duration-700 ease-out",
          phase === 'intro' ? 'opacity-0 translate-y-8 scale-95' : 'opacity-100 translate-y-0 scale-100'
        )}
      >
        {/* Logo */}
        <div className="flex flex-col items-center gap-4">
          <div
            className="w-20 h-20 flex items-center justify-center rounded-2xl"
            style={{
              background: 'linear-gradient(135deg, hsl(195 100% 50% / 0.1), hsl(18 100% 55% / 0.08))',
              boxShadow: '0 0 60px hsl(195 100% 50% / 0.15), inset 0 1px 0 hsl(195 100% 80% / 0.1)',
              border: '1px solid hsl(195 100% 50% / 0.12)',
            }}
          >
            <img src={fxkLogo} alt="FX Kontrol" className="w-14 h-14 object-contain drop-shadow-[0_0_24px_hsl(195_100%_50%/0.35)]" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-[0.35em] uppercase font-display text-fxk-gradient">
            FX KONTROL
          </h1>
          <p className="text-[10px] text-muted-foreground/60 tracking-[0.25em] uppercase font-display">
            Show Design Platform · Minas FX
          </p>
        </div>

        {/* Divider */}
        <div
          className="w-32 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, hsl(195 100% 50% / 0.3), transparent)' }}
        />

        {/* Pulsing START */}
        <div className="flex flex-col items-center gap-3">
          <div
            className="px-12 py-3.5 text-sm font-bold tracking-[0.25em] uppercase font-display rounded-lg transition-all duration-500 animate-pulse"
            style={{
              background: 'linear-gradient(135deg, hsl(195 100% 50% / 0.15), hsl(18 100% 55% / 0.1))',
              border: '1px solid hsl(195 100% 50% / 0.2)',
              color: 'hsl(195 100% 70%)',
              boxShadow: '0 0 40px hsl(195 100% 50% / 0.15)',
            }}
          >
            Click to Start
          </div>
        </div>

        <p className="text-[9px] text-muted-foreground/30 font-mono tracking-wider">
          v2.0 · FX KONTROL ENGINE
        </p>
      </div>
    </div>
  );
});

export default SplashScreen;
