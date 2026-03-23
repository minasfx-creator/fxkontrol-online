/**
 * ─── FX KONTROL Cinematic Intro ────────────────────────────────────
 * Dual-mode: plays video files if available, falls back to CSS-only
 * boot sequence with terminal aesthetics + holographic reveal.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';

type IntroPhase = 'black-in' | 'video1' | 'cross-fade' | 'video2' | 'start-wait' | 'fade-out' | 'done'
  | 'boot-text' | 'boot-logo' | 'boot-start';

interface CinematicIntroProps {
  onComplete: () => void;
}

const BOOT_LINES = [
  { text: 'BIOS CHECK', delay: 0 },
  { text: 'SECURE HANDSHAKE', delay: 80 },
  { text: 'PROTOCOL INIT', delay: 160 },
  { text: 'ART-NET SCAN', delay: 240 },
  { text: 'TELEMETRY LINK', delay: 320 },
  { text: 'SMPTE SYNC', delay: 400 },
  { text: 'RENDER PIPELINE', delay: 480 },
  { text: 'SYS ONLINE', delay: 560 },
];

const CinematicIntro = React.forwardRef<HTMLDivElement, CinematicIntroProps>(function CinematicIntro({ onComplete }, _ref) {
  const [phase, setPhase] = useState<IntroPhase>('black-in');
  const [canSkip, setCanSkip] = useState(false);
  const [blackOpacity, setBlackOpacity] = useState(1);
  const [v1Opacity, setV1Opacity] = useState(0);
  const [v2Opacity, setV2Opacity] = useState(0);
  const [sweepActive, setSweepActive] = useState(false);
  const [startVisible, setStartVisible] = useState(false);
  const [startGlowPulse, setStartGlowPulse] = useState(false);
  const [useFallback, setUseFallback] = useState(false);
  const [visibleLines, setVisibleLines] = useState(0);
  const [logoReveal, setLogoReveal] = useState(false);
  const [progressWidth, setProgressWidth] = useState(0);
  const video1Ref = useRef<HTMLVideoElement>(null);
  const video2Ref = useRef<HTMLVideoElement>(null);
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    const t = setTimeout(() => setCanSkip(true), 1500);
    return () => clearTimeout(t);
  }, []);

  // Cleanup all timers
  useEffect(() => {
    return () => timersRef.current.forEach(clearTimeout);
  }, []);

  // ── Phase: black-in → try video or fallback
  useEffect(() => {
    if (phase !== 'black-in') return;
    const t1 = setTimeout(() => {
      setBlackOpacity(0);
      if (!useFallback) setV1Opacity(1);
    }, 400);
    const t2 = setTimeout(() => {
      if (useFallback) {
        setPhase('boot-text');
      } else {
        setPhase('video1');
      }
    }, 1200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [phase, useFallback]);

  // ── Phase: video1 — play Minas FX
  useEffect(() => {
    if (phase !== 'video1' || !video1Ref.current) return;
    video1Ref.current.currentTime = 0;
    video1Ref.current.play().catch(() => {
      // Video failed — switch to CSS fallback
      setUseFallback(true);
      setV1Opacity(0);
      setPhase('boot-text');
    });
  }, [phase]);

  // ── Phase: cross-fade
  useEffect(() => {
    if (phase !== 'cross-fade') return;
    setSweepActive(true);
    const t1 = setTimeout(() => { setV1Opacity(0); setV2Opacity(1); }, 200);
    const t2 = setTimeout(() => { setSweepActive(false); setPhase('video2'); }, 1200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [phase]);

  // ── Phase: video2 — play FX Kontrol
  useEffect(() => {
    if (phase !== 'video2' || !video2Ref.current) return;
    video2Ref.current.currentTime = 0;
    video2Ref.current.play().catch(() => setPhase('start-wait'));
  }, [phase]);

  // ── Phase: start-wait — dim video, show START
  useEffect(() => {
    if (phase !== 'start-wait' && phase !== 'boot-start') return;
    setV2Opacity(0.3);
    setBlackOpacity(0);
    const t1 = setTimeout(() => setStartVisible(true), 500);
    const t2 = setTimeout(() => setStartGlowPulse(true), 1200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [phase]);

  // ── CSS Fallback: boot-text phase
  useEffect(() => {
    if (phase !== 'boot-text') return;
    const t = timersRef.current;
    BOOT_LINES.forEach((line, i) => {
      t.push(window.setTimeout(() => {
        setVisibleLines(i + 1);
        setProgressWidth(((i + 1) / BOOT_LINES.length) * 100);
      }, line.delay + 200));
    });
    // After all lines, go to logo
    t.push(window.setTimeout(() => setPhase('boot-logo'), BOOT_LINES[BOOT_LINES.length - 1].delay + 600));
  }, [phase]);

  // ── CSS Fallback: boot-logo phase
  useEffect(() => {
    if (phase !== 'boot-logo') return;
    setLogoReveal(true);
    const t1 = setTimeout(() => setPhase('boot-start'), 900);
    return () => clearTimeout(t1);
  }, [phase]);

  // ── Phase: fade-out → done
  useEffect(() => {
    if (phase !== 'fade-out') return;
    setBlackOpacity(1);
    const t = setTimeout(() => { setPhase('done'); onComplete(); }, 800);
    return () => clearTimeout(t);
  }, [phase, onComplete]);

  const handleVideo1End = useCallback(() => setPhase('cross-fade'), []);
  const handleVideo2End = useCallback(() => setPhase('start-wait'), []);

  const handleSkip = useCallback(() => {
    if (!canSkip) return;
    if (phase === 'start-wait' || phase === 'boot-start') return;
    video1Ref.current?.pause();
    video2Ref.current?.pause();
    setV1Opacity(0);
    setV2Opacity(0);
    if (useFallback || phase === 'boot-text' || phase === 'boot-logo') {
      setPhase('boot-start');
    } else {
      setV2Opacity(0.3);
      setPhase('start-wait');
    }
  }, [canSkip, phase, useFallback]);

  const handleStart = useCallback(() => {
    setStartVisible(false);
    setPhase('fade-out');
  }, []);

  // Handle video load errors → fallback
  const handleVideoError = useCallback(() => {
    setUseFallback(true);
    if (phase === 'black-in') return; // will be caught in black-in effect
    setV1Opacity(0);
    setV2Opacity(0);
    setPhase('boot-text');
  }, [phase]);

  if (phase === 'done') return null;

  const isStartPhase = phase === 'start-wait' || phase === 'boot-start';
  const isBootFallback = phase === 'boot-text' || phase === 'boot-logo' || phase === 'boot-start';

  return (
    <div
      className="fixed inset-0 z-[100] select-none overflow-hidden"
      style={{ background: 'hsl(225 14% 3%)' }}
      onClick={!isStartPhase ? handleSkip : undefined}
      onKeyDown={(e) => {
        if (isStartPhase && (e.key === 'Enter' || e.key === ' ')) handleStart();
        else if (e.key === 'Escape' || e.key === ' ') handleSkip();
      }}
      tabIndex={0}
    >
      {/* Video 1 — Minas FX */}
      {!useFallback && (
        <video
          ref={video1Ref}
          src="/videos/minas-fx-intro.mp4"
          className="absolute inset-0 w-full h-full object-contain"
          style={{ opacity: v1Opacity, transition: 'opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1)' }}
          playsInline muted preload="auto"
          onEnded={handleVideo1End}
          onError={handleVideoError}
        />
      )}

      {/* Video 2 — FX Kontrol */}
      {!useFallback && (
        <video
          ref={video2Ref}
          src="/videos/fx-kontrol-intro.mp4"
          className="absolute inset-0 w-full h-full object-contain"
          style={{
            opacity: v2Opacity,
            transition: 'opacity 1.2s cubic-bezier(0.4, 0, 0.2, 1)',
            filter: isStartPhase ? 'blur(6px) brightness(0.4)' : 'none'
          }}
          playsInline muted preload="auto"
          onEnded={handleVideo2End}
          onError={handleVideoError}
        />
      )}

      {/* ═══ CSS FALLBACK BOOT SEQUENCE ═══ */}
      {isBootFallback && (
        <>
          {/* Subtle noise texture */}
          <div className="absolute inset-0 opacity-[0.03]" style={{
            backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, hsl(0 0% 100% / 0.06) 2px, hsl(0 0% 100% / 0.06) 4px)',
          }} />

          {/* Horizontal light sweep */}
          {phase === 'boot-text' && visibleLines === 0 && (
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute top-0 bottom-0 w-[3px]" style={{
                background: 'linear-gradient(to bottom, transparent 10%, hsl(32 100% 50%) 50%, transparent 90%)',
                boxShadow: '0 0 60px 20px hsl(32 100% 50% / 0.3)',
                animation: 'boot-lid-sweep 0.4s cubic-bezier(0.25, 0.1, 0.25, 1) forwards',
              }} />
            </div>
          )}

          {/* Corner accents */}
          <div className="absolute inset-5 pointer-events-none">
            {[['top-0 left-0', 'border-t border-l'], ['top-0 right-0', 'border-t border-r'],
              ['bottom-0 left-0', 'border-b border-l'], ['bottom-0 right-0', 'border-b border-r']].map(([pos, brd], i) => (
              <div key={i} className={`absolute ${pos} w-5 h-5 ${brd} transition-opacity duration-500`}
                style={{ borderColor: 'hsl(32 100% 50% / 0.15)', opacity: phase === 'boot-start' ? 0.3 : 0.6 }} />
            ))}
          </div>

          {/* Boot text — top-left terminal */}
          {(phase === 'boot-text' || phase === 'boot-logo' || phase === 'boot-start') && (
            <div className={cn(
              "absolute top-7 left-7 transition-all duration-500",
              phase !== 'boot-text' ? 'opacity-15 translate-y-[-4px]' : 'opacity-80'
            )}>
              <p className="text-[7px] font-mono tracking-[0.4em] uppercase mb-2.5 opacity-40" style={{ color: 'hsl(32 100% 50%)' }}>
                SYS.BOOT // FX KONTROL v2.0
              </p>
              {BOOT_LINES.slice(0, visibleLines).map((line, i) => (
                <div key={i} className="flex items-center gap-2 leading-[18px]">
                  <span className="text-[8px] font-mono tracking-wide" style={{ color: 'hsl(0 0% 30%)' }}>
                    › {line.text}
                  </span>
                  <span className="text-[7px] font-mono font-bold" style={{ color: 'hsl(120 70% 45%)', textShadow: '0 0 4px hsl(120 70% 45% / 0.3)' }}>
                    OK
                  </span>
                </div>
              ))}
              <div className="mt-3 w-32 h-[2px] rounded-full overflow-hidden" style={{ background: 'hsl(0 0% 12%)' }}>
                <div className="h-full rounded-full transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
                  style={{ width: `${progressWidth}%`, background: 'hsl(32 100% 50%)', boxShadow: '0 0 8px hsl(32 100% 50% / 0.4)' }} />
              </div>
            </div>
          )}

          {/* Center logo — Apple spring reveal */}
          {(phase === 'boot-logo' || phase === 'boot-start') && (
            <div className={cn(
              "absolute inset-0 flex flex-col items-center justify-center gap-5 transition-all",
              logoReveal ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-[0.92] translate-y-6'
            )} style={{
              transitionDuration: '600ms',
              transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
            }}>
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center relative"
                style={{
                  background: 'linear-gradient(135deg, hsl(32 100% 50% / 0.1), hsl(220 22% 6% / 0.8))',
                  border: '1px solid hsl(32 100% 50% / 0.2)',
                  boxShadow: '0 8px 40px hsl(32 100% 50% / 0.12), inset 0 1px 0 hsl(0 0% 100% / 0.04)',
                  backdropFilter: 'blur(20px)',
                }}
              >
                <img
                  alt="FX Kontrol"
                  className="w-11 h-11 object-contain"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  src="/lovable-uploads/d126a5cd-edaa-41ee-bcc5-484a1774dee4.png"
                />
              </div>
              <h1 className="text-2xl font-black tracking-[0.35em] uppercase font-mono"
                style={{ color: 'hsl(32 100% 50%)', textShadow: '0 0 30px hsl(32 100% 50% / 0.3)' }}>
                FX KONTROL
              </h1>
              <div className="w-16 h-[1px] rounded-full" style={{
                background: 'linear-gradient(90deg, transparent, hsl(32 100% 50% / 0.35), transparent)',
              }} />
              <p className="text-[8px] font-mono tracking-[0.3em] uppercase opacity-40" style={{ color: 'hsl(32 100% 50%)' }}>
                SHOW DESIGN PLATFORM
              </p>
            </div>
          )}
        </>
      )}

      {/* Cross-fade light sweep */}
      {sweepActive && (
        <div className="absolute inset-0 z-30 pointer-events-none overflow-hidden">
          <div className="absolute top-0 bottom-0 w-[2px]" style={{
            background: 'linear-gradient(to bottom, transparent 5%, hsl(195 100% 60% / 0.9) 50%, transparent 95%)',
            boxShadow: '0 0 80px 30px hsl(195 100% 55% / 0.25)',
            animation: 'fxk-sweep 1s cubic-bezier(0.25, 0.1, 0.25, 1) forwards'
          }} />
        </div>
      )}

      {/* Vignette */}
      <div className="absolute inset-0 pointer-events-none z-20" style={{
        background: `radial-gradient(ellipse 80% 70% at 50% 50%, transparent 40%, hsl(225 14% 3% / 0.6) 100%),
          linear-gradient(to bottom, hsl(225 14% 3% / 0.4) 0%, transparent 12%, transparent 88%, hsl(225 14% 3% / 0.4) 100%)`
      }} />

      {/* Black overlay */}
      <div className="absolute inset-0 z-40 pointer-events-none" style={{
        backgroundColor: 'hsl(225 14% 3%)',
        opacity: blackOpacity,
        transition: 'opacity 1.2s cubic-bezier(0.4, 0, 0.2, 1)'
      }} />

      {/* ═══ START SCREEN ═══ */}
      {isStartPhase && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center">
          <div className="absolute inset-0 pointer-events-none" style={{
            background: `radial-gradient(ellipse 60% 50% at 50% 45%, hsl(32 100% 50% / 0.04) 0%, transparent 70%),
              linear-gradient(to bottom, hsl(225 14% 3% / 0.6) 0%, hsl(225 14% 3% / 0.3) 40%, hsl(225 14% 3% / 0.6) 100%)`
          }} />
          <div className={cn(
            "relative flex flex-col items-center gap-10 transition-all duration-1000 ease-out",
            startVisible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-12 scale-95'
          )}>
            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 rounded-xl flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, hsl(32 100% 50% / 0.1), hsl(18 100% 55% / 0.1))',
                  boxShadow: '0 0 40px hsl(32 100% 50% / 0.15)'
                }}>
                <img alt="FX Kontrol" className="w-10 h-10 object-contain"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  src="/lovable-uploads/d126a5cd-edaa-41ee-bcc5-484a1774dee4.png" />
              </div>
              <h1 className="font-extrabold tracking-[0.35em] uppercase text-white/90 font-display text-4xl">
                FX KONTROL
              </h1>
              <p className="text-[10px] text-white/30 tracking-[0.3em] uppercase font-display">
                Show Design Platform
              </p>
            </div>
            <div className="w-24 h-px" style={{ background: 'linear-gradient(90deg, transparent, hsl(32 100% 50% / 0.4), transparent)' }} />
            <button
              onClick={handleStart}
              className={cn(
                "group relative px-16 py-5 rounded-lg border transition-all duration-500 cursor-pointer",
                "border-white/10 bg-white/[0.03] backdrop-blur-md",
                "hover:bg-white/[0.08] hover:border-white/20",
                startGlowPulse && "animate-[fxk-btn-glow_3s_ease-in-out_infinite]"
              )}
            >
              <div className="absolute -inset-px rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-700"
                style={{ background: 'linear-gradient(135deg, hsl(32 100% 50% / 0.15), hsl(18 100% 55% / 0.1))' }} />
              <div className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{ boxShadow: '0 0 60px 15px hsl(32 100% 50% / 0.12), inset 0 0 30px hsl(32 100% 50% / 0.04)' }} />
              <span className="relative text-xl font-bold tracking-[0.5em] uppercase text-white/80 group-hover:text-white transition-colors duration-300 font-display">
                START
              </span>
            </button>
            <span className="text-[9px] text-white/20 tracking-[0.3em] uppercase font-display">
              Press Enter or Click
            </span>
          </div>
        </div>
      )}

      {/* Skip hint */}
      {canSkip && phase !== 'fade-out' && !isStartPhase && (
        <div className="absolute bottom-6 right-6 z-50 flex items-center gap-2"
          style={{ animation: 'fxk-fade-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}>
          <span className="text-[10px] text-white/30 uppercase tracking-[0.25em] font-display font-medium">Pular</span>
          <div className="w-7 h-7 rounded-md border border-white/15 flex items-center justify-center backdrop-blur-sm bg-white/5">
            <span className="text-[9px] text-white/30 font-bold font-mono">ESC</span>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fxk-sweep {
          0% { left: -2px; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { left: 100%; opacity: 0; }
        }
        @keyframes fxk-fade-up {
          0% { opacity: 0; transform: translateY(12px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes fxk-btn-glow {
          0%, 100% { box-shadow: 0 0 20px 5px hsl(32 100% 50% / 0.05); }
          50% { box-shadow: 0 0 40px 10px hsl(32 100% 50% / 0.12); }
        }
        @keyframes boot-lid-sweep {
          0% { left: -3px; opacity: 0; }
          15% { opacity: 1; }
          85% { opacity: 0.8; }
          100% { left: 100%; opacity: 0; }
        }
      `}</style>
    </div>
  );
});

export default CinematicIntro;
