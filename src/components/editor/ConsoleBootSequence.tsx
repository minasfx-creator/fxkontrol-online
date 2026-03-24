/**
 * ConsoleBootSequence — Apple × BR2049 Military Boot-Up
 * MacBook Pro-inspired reveal with holographic amber overlay.
 */
import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { CONSOLE_LOGOS } from './ConsoleLogos';

interface ConsoleBootSequenceProps {
  consoleKey: string;
  label: string;
  subtitle: string;
  accentColor: string;
  onComplete: () => void;
}

const BOOT_LINES = [
  { text: 'BIOS CHECK', status: 'OK' },
  { text: 'SECURE HANDSHAKE', status: 'OK' },
  { text: 'PROTOCOL INIT', status: 'OK' },
  { text: 'FIELD BUS SCAN', status: 'OK' },
  { text: 'TELEMETRY LINK', status: 'OK' },
  { text: 'RENDER PIPELINE', status: 'OK' },
];

export default function ConsoleBootSequence({ consoleKey, label, subtitle, accentColor, onComplete }: ConsoleBootSequenceProps) {
  const [phase, setPhase] = useState<'sweep' | 'text' | 'logo' | 'out'>('sweep');
  const [visibleLines, setVisibleLines] = useState(0);
  const [logoReveal, setLogoReveal] = useState(false);
  const [progressWidth, setProgressWidth] = useState(0);
  const timerRef = useRef<number[]>([]);

  useEffect(() => {
    const t = timerRef.current;
    const LINE_DELAY = 65;
    const SWEEP_DUR = 350;

    // Phase 1: sweep (350ms)
    t.push(window.setTimeout(() => setPhase('text'), SWEEP_DUR));

    // Phase 2: text lines + progress bar
    BOOT_LINES.forEach((_, i) => {
      t.push(window.setTimeout(() => {
        setVisibleLines(i + 1);
        setProgressWidth(((i + 1) / BOOT_LINES.length) * 100);
      }, SWEEP_DUR + (i + 1) * LINE_DELAY));
    });

    const textEnd = SWEEP_DUR + BOOT_LINES.length * LINE_DELAY + 150;

    // Phase 3: logo reveal with Apple spring
    t.push(window.setTimeout(() => {
      setPhase('logo');
      setLogoReveal(true);
    }, textEnd));

    // Phase 4: out
    t.push(window.setTimeout(() => setPhase('out'), textEnd + 550));

    // Complete
    t.push(window.setTimeout(() => onComplete(), textEnd + 900));

    return () => t.forEach(clearTimeout);
  }, [onComplete]);

  const Logo = CONSOLE_LOGOS[consoleKey];

  return (
    <div
      className={cn(
        "fixed inset-0 z-[200] flex items-center justify-center transition-all pointer-events-none",
        phase === 'out' ? 'opacity-0 scale-[1.02]' : 'opacity-100 scale-100'
      )}
      style={{
        background: 'hsl(220 22% 2% / 0.97)',
        transitionDuration: phase === 'out' ? '400ms' : '0ms',
        transitionTimingFunction: 'cubic-bezier(0.32, 0, 0.67, 0)',
      }}
    >
      {/* Subtle noise texture */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, hsl(0 0% 100% / 0.06) 2px, hsl(0 0% 100% / 0.06) 4px)',
      }} />

      {/* Horizontal light sweep — MacBook lid-open */}
      {phase === 'sweep' && (
        <div className="absolute inset-0 overflow-hidden">
          <div
            className="absolute top-0 bottom-0 w-[3px]"
            style={{
              background: `linear-gradient(to bottom, transparent 10%, ${accentColor} 50%, transparent 90%)`,
              boxShadow: `0 0 60px 20px ${accentColor}30, 0 0 120px 40px ${accentColor}10`,
              animation: 'boot-lid-sweep 0.35s cubic-bezier(0.25, 0.1, 0.25, 1) forwards',
            }}
          />
        </div>
      )}

      {/* Corner accents — minimal */}
      <div className="absolute inset-5 pointer-events-none">
        {[['top-0 left-0', 'border-t border-l'], ['top-0 right-0', 'border-t border-r'],
          ['bottom-0 left-0', 'border-b border-l'], ['bottom-0 right-0', 'border-b border-r']].map(([pos, brd], i) => (
          <div key={i} className={`absolute ${pos} w-5 h-5 ${brd} transition-opacity duration-500`}
            style={{ borderColor: accentColor + '25', opacity: phase === 'out' ? 0 : 0.6 }} />
        ))}
      </div>

      {/* Boot text — top-left terminal */}
      {(phase === 'text' || phase === 'logo' || phase === 'out') && (
        <div className={cn(
          "absolute top-7 left-7 transition-all duration-500",
          phase === 'logo' || phase === 'out' ? 'opacity-15 translate-y-[-4px]' : 'opacity-80'
        )}>
          <p className="text-[7px] font-mono tracking-[0.4em] uppercase mb-2.5 opacity-40" style={{ color: accentColor }}>
            SYS.BOOT // {label}
          </p>
          {BOOT_LINES.slice(0, visibleLines).map((line, i) => (
            <div key={i} className="flex items-center gap-2 leading-[18px]">
              <span className="text-[8px] font-mono tracking-wide" style={{ color: 'hsl(0 0% 30%)' }}>
                › {line.text}
              </span>
              <span className="text-[7px] font-mono font-bold" style={{ color: 'hsl(120 70% 45%)', textShadow: '0 0 4px hsl(120 70% 45% / 0.3)' }}>
                {line.status}
              </span>
            </div>
          ))}
          {/* Progress bar */}
          <div className="mt-3 w-32 h-[2px] rounded-full overflow-hidden" style={{ background: 'hsl(0 0% 12%)' }}>
            <div className="h-full rounded-full transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
              style={{ width: `${progressWidth}%`, background: accentColor, boxShadow: `0 0 8px ${accentColor}40` }} />
          </div>
        </div>
      )}

      {/* Center logo — Apple spring reveal */}
      <div className={cn(
        "flex flex-col items-center gap-5 transition-all",
        logoReveal ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-[0.92] translate-y-6'
      )} style={{
        transitionDuration: '600ms',
        transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
      }}>
        {/* Logo container — frosted glass */}
        <div className="w-20 h-20 rounded-2xl flex items-center justify-center relative"
          style={{
            background: `linear-gradient(135deg, ${accentColor}10, hsl(220 22% 6% / 0.8))`,
            border: `1px solid ${accentColor}20`,
            boxShadow: `0 8px 40px ${accentColor}12, 0 0 0 1px ${accentColor}06, inset 0 1px 0 hsl(0 0% 100% / 0.04)`,
            backdropFilter: 'blur(20px)',
          }}
        >
          {Logo ? <Logo size={44} active /> : (
            <span className="text-3xl font-black font-mono" style={{ color: accentColor }}>{label[0]}</span>
          )}
        </div>

        <h1 className="text-2xl font-black tracking-[0.35em] uppercase font-mono"
          style={{ color: accentColor, textShadow: `0 0 30px ${accentColor}30` }}>
          {label}
        </h1>

        {/* Divider — Apple thin line */}
        <div className="w-16 h-[1px] rounded-full" style={{
          background: `linear-gradient(90deg, transparent, ${accentColor}35, transparent)`,
        }} />

        <p className="text-[8px] font-mono tracking-[0.3em] uppercase opacity-40" style={{ color: accentColor }}>
          {subtitle}
        </p>
      </div>

      {/* Version — bottom right */}
      <div className="absolute bottom-6 right-7">
        <p className="text-[6px] font-mono tracking-[0.25em] uppercase opacity-20" style={{ color: accentColor }}>
          FXK ENGINE v2.0
        </p>
      </div>

      <style>{`
        @keyframes boot-lid-sweep {
          0% { left: -3px; opacity: 0; }
          15% { opacity: 1; }
          85% { opacity: 0.8; }
          100% { left: 100%; opacity: 0; }
        }
      `}</style>
    </div>
  );
}
