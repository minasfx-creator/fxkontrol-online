import { useState, useEffect, forwardRef } from 'react';
import fxkLogo from '@/assets/fxk-logo-tactical.png';
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
  const [productLineVisible, setProductLineVisible] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('boot'), 300);
    const t2 = setTimeout(() => setPhase('logo'), 1800);
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

  // Stagger product line indicators
  useEffect(() => {
    if (phase !== 'logo' && phase !== 'ready') return;
    const timers = PRODUCT_LINES.map((_, i) =>
      setTimeout(() => setProductLineVisible(i + 1), 400 + i * 120)
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
        "fixed inset-0 z-50 flex items-center justify-center transition-all duration-700 ease-out overflow-hidden",
        phase === 'exit' ? 'opacity-0 scale-[1.03] pointer-events-none' : 'opacity-100 scale-100'
      )}
      style={{ background: '#040608' }}
    >
      {/* Animated scanline sweep */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute w-full h-[1px] animate-scanline-sweep"
          style={{ background: 'linear-gradient(90deg, transparent 0%, hsl(32 100% 50% / 0.25) 50%, transparent 100%)' }}
        />
      </div>

      {/* Subtle grid overlay */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.02]" style={{
        backgroundImage: 'linear-gradient(hsl(32 100% 50% / 0.8) 1px, transparent 1px), linear-gradient(90deg, hsl(32 100% 50% / 0.8) 1px, transparent 1px)',
        backgroundSize: '48px 48px',
      }} />

      {/* Center radial glow — breathes subtly */}
      <div className={cn(
        "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full transition-all duration-[2500ms]",
        phase === 'blackout' ? 'opacity-0 scale-50' : phase === 'ready' ? 'opacity-100 scale-110' : 'opacity-80 scale-100'
      )} style={{
        background: 'radial-gradient(circle, hsl(32 100% 50% / 0.05), transparent 65%)',
        filter: 'blur(80px)',
      }} />

      {/* CRT noise overlay */}
      <div className="absolute inset-0 opacity-[0.012] pointer-events-none" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        backgroundSize: '128px 128px',
      }} />

      {/* Corner brackets — tactical HUD */}
      <div className={cn(
        "absolute inset-6 pointer-events-none transition-all duration-1000",
        phase === 'blackout' ? 'opacity-0 scale-[0.98]' : 'opacity-100 scale-100'
      )}>
        {[
          'top-0 left-0 border-t border-l',
          'top-0 right-0 border-t border-r',
          'bottom-0 left-0 border-b border-l',
          'bottom-0 right-0 border-b border-r',
        ].map((cls, i) => (
          <div key={i} className={`absolute w-8 h-8 ${cls} transition-all duration-700`}
            style={{
              borderColor: 'hsl(32 100% 50% / 0.2)',
              transitionDelay: `${i * 80}ms`,
            }} />
        ))}
      </div>

      {/* Corner labels */}
      <div className={cn(
        "absolute top-8 left-10 font-mono text-[7px] tracking-[0.35em] uppercase transition-all duration-700",
        phase === 'blackout' ? 'opacity-0 -translate-x-2' : 'opacity-100 translate-x-0'
      )} style={{ color: 'hsl(32 100% 50% / 0.18)' }}>SYS.INIT</div>
      <div className={cn(
        "absolute top-8 right-10 font-mono text-[7px] tracking-[0.35em] uppercase transition-all duration-700",
        phase === 'blackout' ? 'opacity-0 translate-x-2' : 'opacity-100 translate-x-0'
      )} style={{ color: 'hsl(32 100% 50% / 0.18)' }}>MINAS FX</div>

      {/* Boot terminal — phase 2 */}
      <div className={cn(
        "absolute top-[18%] left-1/2 -translate-x-1/2 w-80 transition-all duration-600",
        phase === 'boot' ? 'opacity-100 translate-y-0' : phase === 'logo' || phase === 'ready' ? 'opacity-0 -translate-y-6 scale-95' : 'opacity-0 translate-y-4'
      )}>
        <div className="space-y-1.5">
          {BOOT_LINES.slice(0, visibleLines).map((line, i) => (
            <p key={i} className="font-mono text-[9px] tracking-wider animate-in fade-in slide-in-from-left-2 duration-300" style={{
              color: line.text.includes('ARMED') ? 'hsl(0 85% 55% / 0.8)' :
                     line.text.includes('READY') ? 'hsl(120 70% 45% / 0.8)' :
                     'hsl(32 100% 50% / 0.45)',
            }}>
              <span style={{ color: 'hsl(32 100% 50% / 0.2)' }}>{'>'} </span>{line.text}
            </p>
          ))}
          {phase === 'boot' && (
            <span className="inline-block w-1.5 h-3 mt-1" style={{
              background: 'hsl(32 100% 50% / 0.6)',
              animation: 'splash-cursor 0.8s steps(2) infinite',
            }} />
          )}
        </div>
      </div>

      {/* Main logo + content — phase 3+ */}
      <div className={cn(
        "relative flex flex-col items-center gap-7 transition-all duration-[1200ms]",
        (phase === 'logo' || phase === 'ready') ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-10 scale-[0.92]'
      )} style={{ transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }}>
        {/* Logo with holographic frame */}
        <div className="relative">
          {/* Outer ring glow */}
          <div className={cn(
            "absolute -inset-6 rounded-full transition-all duration-[2000ms]",
            phase === 'ready' ? 'opacity-100 scale-100' : 'opacity-0 scale-90'
          )} style={{
            background: 'radial-gradient(circle, hsl(32 100% 50% / 0.07), transparent 70%)',
          }} />

          <div className="w-28 h-28 flex items-center justify-center relative" style={{
            border: '1px solid hsl(32 100% 50% / 0.18)',
            borderRadius: '14px',
            background: 'linear-gradient(145deg, hsl(32 100% 50% / 0.04), hsl(220 30% 4% / 0.9))',
            boxShadow: '0 0 50px hsl(32 100% 50% / 0.05), inset 0 1px 0 hsl(0 0% 100% / 0.03), inset 0 0 20px hsl(32 100% 50% / 0.02)',
          }}>
            {/* Crosshair marks */}
            {['top-0 left-1/2 -translate-x-1/2 w-2.5 h-px', 'bottom-0 left-1/2 -translate-x-1/2 w-2.5 h-px',
              'left-0 top-1/2 -translate-y-1/2 h-2.5 w-px', 'right-0 top-1/2 -translate-y-1/2 h-2.5 w-px'].map((cls, i) => (
              <div key={i} className={`absolute ${cls}`} style={{ background: 'hsl(32 100% 50% / 0.25)' }} />
            ))}

            <img
              src={fxkLogo}
              alt="FX Kontrol"
              className="w-24 h-24 object-contain"
              style={{ filter: 'drop-shadow(0 0 20px hsl(32 100% 50% / 0.3))' }}
            />
          </div>
        </div>

        {/* Title */}
        <div className="text-center">
          <h1 className="text-[26px] font-extrabold tracking-[0.45em] uppercase" style={{
            color: 'hsl(32 100% 50%)',
            textShadow: '0 0 40px hsl(32 100% 50% / 0.25), 0 2px 20px hsl(0 0% 0% / 0.5)',
          }}>
            FX KONTROL
          </h1>
          <p className="mt-1.5 font-mono text-[8px] tracking-[0.3em] uppercase" style={{ color: 'hsl(38 100% 58% / 0.35)' }}>
            Professional Show Control System
          </p>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-2 w-56">
          <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, transparent, hsl(32 100% 50% / 0.15))' }} />
          <div className="w-1.5 h-1.5 rotate-45" style={{ border: '1px solid hsl(32 100% 50% / 0.25)', background: 'hsl(32 100% 50% / 0.08)' }} />
          <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, hsl(32 100% 50% / 0.15), transparent)' }} />
        </div>

        {/* Product line indicators — staggered reveal */}
        <div className="flex items-center gap-5">
          {PRODUCT_LINES.map((p, i) => (
            <div key={p.label} className={cn(
              "flex items-center gap-1.5 transition-all duration-500",
              i < productLineVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
            )} style={{ transitionDelay: `${i * 60}ms` }}>
              <div className="w-1.5 h-1.5 rounded-full transition-all duration-700" style={{
                background: i < productLineVisible ? p.color : 'hsl(0 0% 20%)',
                boxShadow: i < productLineVisible ? `0 0 8px ${p.color}` : 'none',
              }} />
              <span className="font-mono text-[7px] tracking-[0.2em] uppercase" style={{ color: 'hsl(0 0% 38%)' }}>
                {p.label}
              </span>
            </div>
          ))}
        </div>

        {/* Initialize button — proper interactive button */}
        <div className={cn(
          "transition-all duration-700",
          phase === 'ready' ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
        )} style={{ transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }}>
          <button
            onClick={handleStart}
            className="group relative px-14 py-3 text-xs font-bold tracking-[0.35em] uppercase font-mono rounded-md cursor-pointer transition-all duration-300 focus:outline-none focus-visible:ring-1"
            style={{
              background: 'hsl(32 100% 50% / 0.06)',
              border: '1px solid hsl(32 100% 50% / 0.2)',
              color: 'hsl(32 100% 55%)',
              boxShadow: '0 0 30px hsl(32 100% 50% / 0.06)',
              focusVisibleRingColor: 'hsl(32 100% 50% / 0.4)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'hsl(32 100% 50% / 0.12)';
              e.currentTarget.style.borderColor = 'hsl(32 100% 50% / 0.35)';
              e.currentTarget.style.boxShadow = '0 0 50px hsl(32 100% 50% / 0.12), inset 0 0 20px hsl(32 100% 50% / 0.04)';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'hsl(32 100% 50% / 0.06)';
              e.currentTarget.style.borderColor = 'hsl(32 100% 50% / 0.2)';
              e.currentTarget.style.boxShadow = '0 0 30px hsl(32 100% 50% / 0.06)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.transform = 'scale(0.97)';
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
          >
            <span className="relative flex items-center gap-2">
              <span className="w-0 h-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-l-[7px]" style={{ borderLeftColor: 'hsl(32 100% 55%)' }} />
              INITIALIZE
            </span>
            {/* Breathing glow ring */}
            <div className="absolute -inset-px rounded-md pointer-events-none" style={{
              animation: 'splash-btn-breathe 3s ease-in-out infinite',
            }} />
          </button>
        </div>

        {/* Click hint */}
        <p className={cn(
          "font-mono text-[7px] tracking-[0.25em] uppercase transition-all duration-500",
          phase === 'ready' ? 'opacity-100' : 'opacity-0'
        )} style={{ color: 'hsl(0 0% 22%)' }}>
          Click or press Enter
        </p>
      </div>

      {/* Footer — Powered by MinasFX */}
      <div className={cn(
        "absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 transition-all duration-700",
        phase === 'ready' ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      )}>
        <p className="font-mono text-[6px] tracking-[0.4em] uppercase" style={{ color: 'hsl(0 0% 18%)' }}>
          v2.0 · POWERED BY MINAS FX
        </p>
      </div>

      {/* Keyboard listener for Enter */}
      {phase === 'ready' && (
        <div className="fixed inset-0 z-[51] cursor-pointer" onClick={handleStart}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleStart(); }}
          tabIndex={0}
          style={{ background: 'transparent' }}
        />
      )}

      <style>{`
        @keyframes splash-cursor {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
        @keyframes splash-btn-breathe {
          0%, 100% { box-shadow: 0 0 15px 2px hsl(32 100% 50% / 0.04); }
          50% { box-shadow: 0 0 35px 6px hsl(32 100% 50% / 0.1); }
        }
      `}</style>
    </div>
  );
});

export default SplashScreen;
