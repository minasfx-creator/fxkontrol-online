import { useState, useEffect, forwardRef } from 'react';
import fxkLogo from '@/assets/fxk-logo-new.png';
import { cn } from '@/lib/utils';
import { ambientSound } from '@/lib/ambientSound';

interface SplashScreenProps {
  onStart: () => void;
  showVideoBackground?: boolean;
}

const PRODUCT_LINES = [
  { label: 'PYRO', color: 'hsl(0 85% 55%)' },
  { label: 'DMX', color: 'hsl(200 80% 48%)' },
  { label: 'LIGHT', color: 'hsl(240 50% 52%)' },
  { label: 'DRONES', color: 'hsl(180 70% 45%)' },
];

const BOOT_LINES = [
  { text: 'NEXUS KERNEL v4.2.1 LOADED', delay: 200 },
  { text: 'ARTNET BRIDGE ............ OK', delay: 400 },
  { text: 'DMX UNIVERSE SCAN ........ OK', delay: 650 },
  { text: 'PYRO SAFETY INTERLOCK .... ARMED', delay: 900 },
  { text: 'GPS MODULE ............... SYNC', delay: 1100 },
  { text: 'TACTICAL HUD ............. READY', delay: 1350 },
];

const SplashScreen = forwardRef<HTMLDivElement, SplashScreenProps>(function SplashScreen({ onStart }, ref) {
  const [phase, setPhase] = useState<'blackout' | 'boot' | 'logo' | 'ready' | 'exit'>('blackout');
  const [visibleLines, setVisibleLines] = useState(0);

  useEffect(() => {
    // Phase 1: Blackout with scanline
    const t1 = setTimeout(() => setPhase('boot'), 300);
    // Phase 2: Boot terminal lines
    const t2 = setTimeout(() => setPhase('logo'), 1800);
    // Phase 3: Logo reveal
    const t3 = setTimeout(() => setPhase('ready'), 2800);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  useEffect(() => {
    if (phase !== 'boot') return;
    const timers = BOOT_LINES.map((line, i) =>
      setTimeout(() => setVisibleLines(i + 1), line.delay)
    );
    return () => timers.forEach(clearTimeout);
  }, [phase]);

  const handleStart = () => {
    setPhase('exit');
    ambientSound.play('boot');
    setTimeout(() => onStart(), 700);
  };

  return (
    <div
      ref={ref}
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center transition-all duration-700 ease-out cursor-pointer overflow-hidden",
        phase === 'exit' ? 'opacity-0 scale-[1.05] pointer-events-none' : 'opacity-100 scale-100'
      )}
      style={{ background: '#040608' }}
      onClick={phase === 'ready' ? handleStart : undefined}
    >
      {/* Animated scanline sweep */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute w-full h-[2px] animate-scanline-sweep"
          style={{ background: 'linear-gradient(90deg, transparent 0%, hsl(32 100% 50% / 0.4) 50%, transparent 100%)' }}
        />
      </div>

      {/* Grid overlay */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{
        backgroundImage: 'linear-gradient(hsl(32 100% 50% / 0.8) 1px, transparent 1px), linear-gradient(90deg, hsl(32 100% 50% / 0.8) 1px, transparent 1px)',
        backgroundSize: '48px 48px',
      }} />

      {/* Center radial glow */}
      <div className={cn(
        "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full transition-all duration-[2000ms]",
        phase === 'blackout' ? 'opacity-0 scale-50' : 'opacity-100 scale-100'
      )} style={{
        background: 'radial-gradient(circle, hsl(32 100% 50% / 0.06), transparent 70%)',
        filter: 'blur(60px)',
      }} />

      {/* CRT noise overlay */}
      <div className="absolute inset-0 opacity-[0.015] pointer-events-none" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        backgroundSize: '128px 128px',
      }} />

      {/* Corner brackets — tactical HUD */}
      <div className={cn(
        "absolute inset-6 pointer-events-none transition-opacity duration-1000",
        phase === 'blackout' ? 'opacity-0' : 'opacity-100'
      )}>
        <div className="absolute top-0 left-0 w-10 h-10 border-t border-l" style={{ borderColor: 'hsl(32 100% 50% / 0.25)' }} />
        <div className="absolute top-0 right-0 w-10 h-10 border-t border-r" style={{ borderColor: 'hsl(32 100% 50% / 0.25)' }} />
        <div className="absolute bottom-0 left-0 w-10 h-10 border-b border-l" style={{ borderColor: 'hsl(32 100% 50% / 0.25)' }} />
        <div className="absolute bottom-0 right-0 w-10 h-10 border-b border-r" style={{ borderColor: 'hsl(32 100% 50% / 0.25)' }} />
      </div>

      {/* Corner labels */}
      <div className={cn(
        "absolute top-8 left-10 font-mono text-[8px] tracking-[0.3em] uppercase transition-opacity duration-700",
        phase === 'blackout' ? 'opacity-0' : 'opacity-100'
      )} style={{ color: 'hsl(32 100% 50% / 0.2)' }}>SYS.INIT</div>
      <div className={cn(
        "absolute top-8 right-10 font-mono text-[8px] tracking-[0.3em] uppercase transition-opacity duration-700",
        phase === 'blackout' ? 'opacity-0' : 'opacity-100'
      )} style={{ color: 'hsl(32 100% 50% / 0.2)' }}>MINAS FX</div>

      {/* Boot terminal — phase 2 */}
      <div className={cn(
        "absolute top-[20%] left-1/2 -translate-x-1/2 w-80 transition-all duration-500",
        phase === 'boot' ? 'opacity-100 translate-y-0' : phase === 'logo' || phase === 'ready' ? 'opacity-0 -translate-y-8' : 'opacity-0 translate-y-4'
      )}>
        <div className="space-y-1">
          {BOOT_LINES.slice(0, visibleLines).map((line, i) => (
            <p key={i} className="font-mono text-[9px] tracking-wider" style={{
              color: line.text.includes('ARMED') ? 'hsl(0 85% 55% / 0.8)' :
                     line.text.includes('READY') ? 'hsl(120 70% 45% / 0.8)' :
                     'hsl(32 100% 50% / 0.5)',
            }}>
              {'> '}{line.text}
            </p>
          ))}
          {phase === 'boot' && (
            <span className="inline-block w-2 h-3 animate-pulse" style={{ background: 'hsl(32 100% 50% / 0.6)' }} />
          )}
        </div>
      </div>

      {/* Main logo + content — phase 3+ */}
      <div className={cn(
        "relative flex flex-col items-center gap-6 transition-all duration-[1200ms] ease-out",
        (phase === 'logo' || phase === 'ready') ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-12 scale-90'
      )}>
        {/* Logo with holographic frame */}
        <div className="relative">
          {/* Outer ring glow */}
          <div className={cn(
            "absolute -inset-4 rounded-full transition-opacity duration-[1500ms]",
            phase === 'ready' ? 'opacity-100' : 'opacity-0'
          )} style={{
            background: 'radial-gradient(circle, hsl(32 100% 50% / 0.08), transparent 70%)',
          }} />

          <div className="w-28 h-28 flex items-center justify-center relative" style={{
            border: '1px solid hsl(32 100% 50% / 0.2)',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, hsl(32 100% 50% / 0.04), transparent)',
            boxShadow: '0 0 40px hsl(32 100% 50% / 0.06), inset 0 0 20px hsl(32 100% 50% / 0.02)',
          }}>
            {/* Crosshair marks */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3 h-px" style={{ background: 'hsl(32 100% 50% / 0.3)' }} />
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3 h-px" style={{ background: 'hsl(32 100% 50% / 0.3)' }} />
            <div className="absolute left-0 top-1/2 -translate-y-1/2 h-3 w-px" style={{ background: 'hsl(32 100% 50% / 0.3)' }} />
            <div className="absolute right-0 top-1/2 -translate-y-1/2 h-3 w-px" style={{ background: 'hsl(32 100% 50% / 0.3)' }} />

            <img
              src={fxkLogo}
              alt="FX Kontrol"
              className="w-24 h-24 object-contain"
              style={{ filter: 'drop-shadow(0 0 16px hsl(32 100% 50% / 0.35))' }}
            />
          </div>
        </div>

        {/* Title */}
        <div className="text-center">
          <h1 className="text-2xl font-extrabold tracking-[0.4em] uppercase" style={{
            color: 'hsl(32 100% 50%)',
            textShadow: '0 0 30px hsl(32 100% 50% / 0.3)',
          }}>
            FX KONTROL
          </h1>
          <p className="mt-1 font-mono text-[9px] tracking-[0.25em] uppercase" style={{ color: 'hsl(38 100% 58% / 0.4)' }}>
            Professional Show Control System
          </p>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-2 w-56">
          <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, transparent, hsl(32 100% 50% / 0.2))' }} />
          <div className="w-1 h-1 rotate-45" style={{ border: '1px solid hsl(32 100% 50% / 0.3)' }} />
          <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, hsl(32 100% 50% / 0.2), transparent)' }} />
        </div>

        {/* Product line indicators */}
        <div className="flex items-center gap-4">
          {PRODUCT_LINES.map((p) => (
            <div key={p.label} className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: p.color, boxShadow: `0 0 6px ${p.color}` }} />
              <span className="font-mono text-[7px] tracking-[0.2em] uppercase" style={{ color: 'hsl(0 0% 40%)' }}>
                {p.label}
              </span>
            </div>
          ))}
        </div>

        {/* Initialize button */}
        <div className={cn(
          "transition-all duration-700",
          phase === 'ready' ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        )}>
          <div className="px-12 py-2.5 text-xs font-bold tracking-[0.3em] uppercase font-mono rounded-sm animate-pulse" style={{
            background: 'hsl(32 100% 50% / 0.08)',
            border: '1px solid hsl(32 100% 50% / 0.25)',
            color: 'hsl(32 100% 55%)',
            boxShadow: '0 0 24px hsl(32 100% 50% / 0.08)',
          }}>
            ▶ INITIALIZE
          </div>
        </div>

        <p className="font-mono text-[7px] tracking-[0.2em] uppercase" style={{ color: 'hsl(0 0% 20%)' }}>
          v2.0 · MINAS FX TACTICAL ENGINE
        </p>
      </div>
    </div>
  );
});

export default SplashScreen;
