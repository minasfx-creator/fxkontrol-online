/**
 * ConsoleBootSequence — Military terminal boot-up animation
 * Plays when switching consoles: scanlines, text crawl, system checks, logo reveal.
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
  'BIOS CHECK .............. OK',
  'MEMORY ALLOC ............ OK',
  'SECURE HANDSHAKE ........ OK',
  'DMX PROTOCOL INIT ....... OK',
  'FIELD BUS SCAN .......... OK',
  'TELEMETRY LINK .......... OK',
  'RENDER PIPELINE ......... OK',
  'SYSTEM READY',
];

export default function ConsoleBootSequence({ consoleKey, label, subtitle, accentColor, onComplete }: ConsoleBootSequenceProps) {
  const [phase, setPhase] = useState<'scanline' | 'text' | 'logo' | 'out'>('scanline');
  const [visibleLines, setVisibleLines] = useState(0);
  const [logoVisible, setLogoVisible] = useState(false);
  const timerRef = useRef<number[]>([]);

  useEffect(() => {
    const t = timerRef.current;

    // Phase 1: scanline flash (300ms)
    t.push(window.setTimeout(() => setPhase('text'), 300));

    // Phase 2: text crawl — each line appears every 80ms
    BOOT_LINES.forEach((_, i) => {
      t.push(window.setTimeout(() => setVisibleLines(i + 1), 300 + (i + 1) * 80));
    });

    const textEnd = 300 + BOOT_LINES.length * 80 + 200;

    // Phase 3: logo reveal
    t.push(window.setTimeout(() => {
      setPhase('logo');
      setLogoVisible(true);
    }, textEnd));

    // Phase 4: fade out
    t.push(window.setTimeout(() => setPhase('out'), textEnd + 600));

    // Complete
    t.push(window.setTimeout(() => onComplete(), textEnd + 1000));

    return () => t.forEach(clearTimeout);
  }, [onComplete]);

  const Logo = CONSOLE_LOGOS[consoleKey];

  return (
    <div
      className={cn(
        "fixed inset-0 z-[200] flex items-center justify-center pointer-events-none transition-opacity duration-400",
        phase === 'out' ? 'opacity-0' : 'opacity-100'
      )}
      style={{ background: 'hsl(220 22% 2% / 0.97)' }}
    >
      {/* CRT scanlines */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.06]"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, hsl(0 0% 100% / 0.08) 2px, hsl(0 0% 100% / 0.08) 4px)',
        }}
      />

      {/* Horizontal sweep line */}
      {phase === 'scanline' && (
        <div
          className="absolute left-0 right-0 h-[2px] z-10"
          style={{
            background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)`,
            boxShadow: `0 0 30px 8px ${accentColor}40`,
            animation: 'boot-sweep 0.3s linear forwards',
          }}
        />
      )}

      {/* Corner brackets */}
      <div className="absolute inset-6 pointer-events-none">
        <div className="absolute top-0 left-0 w-6 h-6 border-t border-l" style={{ borderColor: accentColor + '40' }} />
        <div className="absolute top-0 right-0 w-6 h-6 border-t border-r" style={{ borderColor: accentColor + '40' }} />
        <div className="absolute bottom-0 left-0 w-6 h-6 border-b border-l" style={{ borderColor: accentColor + '40' }} />
        <div className="absolute bottom-0 right-0 w-6 h-6 border-b border-r" style={{ borderColor: accentColor + '40' }} />
      </div>

      {/* Boot text crawl */}
      {(phase === 'text' || phase === 'logo' || phase === 'out') && (
        <div className={cn(
          "absolute top-8 left-8 transition-opacity duration-300",
          phase === 'logo' || phase === 'out' ? 'opacity-20' : 'opacity-100'
        )}>
          <p className="text-[8px] font-mono tracking-[0.3em] uppercase mb-2" style={{ color: accentColor + '60' }}>
            ── SYS.BOOT // {label} ──
          </p>
          {BOOT_LINES.slice(0, visibleLines).map((line, i) => {
            const isLast = i === visibleLines - 1;
            const isReady = line === 'SYSTEM READY';
            return (
              <p
                key={i}
                className={cn(
                  "text-[9px] font-mono tracking-wider leading-5",
                  isLast && 'animate-pulse'
                )}
                style={{
                  color: isReady ? accentColor : 'hsl(0 0% 40%)',
                  textShadow: isReady ? `0 0 8px ${accentColor}60` : 'none',
                }}
              >
                {isReady ? `█ ${line}` : `› ${line}`}
              </p>
            );
          })}
        </div>
      )}

      {/* Center logo + label reveal */}
      <div className={cn(
        "flex flex-col items-center gap-4 transition-all duration-500",
        logoVisible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-90 translate-y-4'
      )}>
        {/* Logo glow ring */}
        <div
          className="w-20 h-20 rounded-lg flex items-center justify-center relative"
          style={{
            background: `linear-gradient(135deg, ${accentColor}15, transparent)`,
            border: `1px solid ${accentColor}30`,
            boxShadow: `0 0 40px ${accentColor}15, inset 0 0 20px ${accentColor}05`,
          }}
        >
          {/* Crosshair ticks */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3 h-px" style={{ background: accentColor + '50' }} />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3 h-px" style={{ background: accentColor + '50' }} />
          <div className="absolute left-0 top-1/2 -translate-y-1/2 h-3 w-px" style={{ background: accentColor + '50' }} />
          <div className="absolute right-0 top-1/2 -translate-y-1/2 h-3 w-px" style={{ background: accentColor + '50' }} />

          {Logo ? <Logo size={48} active /> : (
            <span className="text-2xl font-black font-mono" style={{ color: accentColor }}>{label[0]}</span>
          )}
        </div>

        <h1
          className="text-2xl font-black tracking-[0.4em] uppercase font-mono"
          style={{ color: accentColor, textShadow: `0 0 20px ${accentColor}40` }}
        >
          {label}
        </h1>

        <div className="flex items-center gap-2 w-40">
          <div className="flex-1 h-px" style={{ background: `linear-gradient(90deg, transparent, ${accentColor}30)` }} />
          <div className="w-1 h-1 rotate-45" style={{ border: `1px solid ${accentColor}40` }} />
          <div className="flex-1 h-px" style={{ background: `linear-gradient(90deg, ${accentColor}30, transparent)` }} />
        </div>

        <p className="text-[9px] font-mono tracking-[0.25em] uppercase" style={{ color: accentColor + '50' }}>
          {subtitle}
        </p>
      </div>

      {/* Version stamp */}
      <div className="absolute bottom-8 right-8">
        <p className="text-[7px] font-mono tracking-[0.2em] uppercase" style={{ color: accentColor + '25' }}>
          FXK ENGINE v2.0
        </p>
      </div>

      <style>{`
        @keyframes boot-sweep {
          0% { top: 0; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
      `}</style>
    </div>
  );
}
