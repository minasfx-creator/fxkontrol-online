/**
 * ─── FX KONTROL Cinematic Intro ────────────────────────────────────
 * PS5-inspired intro sequence:
 *   1. Fade from black → Minas FX vinheta
 *   2. Smooth cross-dissolve with cyan light sweep
 *   3. FX KONTROL cinematic
 *   4. Freeze on logo → START button
 *   5. On START → callback (splash screen shows with video bg)
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';

type IntroPhase = 'black-in' | 'video1' | 'cross-fade' | 'video2' | 'start-wait' | 'fade-out' | 'done';

interface CinematicIntroProps {
  onComplete: () => void;
}

export default function CinematicIntro({ onComplete }: CinematicIntroProps) {
  const [phase, setPhase] = useState<IntroPhase>('black-in');
  const [canSkip, setCanSkip] = useState(false);
  const [blackOpacity, setBlackOpacity] = useState(1);
  const [v1Opacity, setV1Opacity] = useState(0);
  const [v2Opacity, setV2Opacity] = useState(0);
  const [sweepActive, setSweepActive] = useState(false);
  const [startVisible, setStartVisible] = useState(false);
  const video1Ref = useRef<HTMLVideoElement>(null);
  const video2Ref = useRef<HTMLVideoElement>(null);

  // Allow skip after 1.5s
  useEffect(() => {
    const t = setTimeout(() => setCanSkip(true), 1500);
    return () => clearTimeout(t);
  }, []);

  // ── Phase: black-in → fade reveal video1
  useEffect(() => {
    if (phase !== 'black-in') return;
    const t1 = setTimeout(() => {
      setBlackOpacity(0);
      setV1Opacity(1);
    }, 400);
    const t2 = setTimeout(() => setPhase('video1'), 1200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [phase]);

  // ── Phase: video1 — play Minas FX
  useEffect(() => {
    if (phase !== 'video1' || !video1Ref.current) return;
    video1Ref.current.currentTime = 0;
    video1Ref.current.play().catch(() => setPhase('cross-fade'));
  }, [phase]);

  // ── Phase: cross-fade — cinematic dissolve
  useEffect(() => {
    if (phase !== 'cross-fade') return;
    setSweepActive(true);
    const t1 = setTimeout(() => {
      setV1Opacity(0);
      setV2Opacity(1);
    }, 200);
    const t2 = setTimeout(() => {
      setSweepActive(false);
      setPhase('video2');
    }, 1200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [phase]);

  // ── Phase: video2 — play FX Kontrol
  useEffect(() => {
    if (phase !== 'video2' || !video2Ref.current) return;
    video2Ref.current.currentTime = 0;
    video2Ref.current.play().catch(() => setPhase('start-wait'));
  }, [phase]);

  // ── Phase: start-wait — freeze on logo, show START button
  useEffect(() => {
    if (phase !== 'start-wait') return;
    // Keep v2 visible (frozen on last frame)
    setV2Opacity(1);
    setBlackOpacity(0);
    // Animate in the START button
    const t = setTimeout(() => setStartVisible(true), 300);
    return () => clearTimeout(t);
  }, [phase]);

  // ── Phase: fade-out → done
  useEffect(() => {
    if (phase !== 'fade-out') return;
    // Don't fade to black — just signal done so splash shows with video bg
    const t = setTimeout(() => {
      setPhase('done');
      onComplete();
    }, 600);
    return () => clearTimeout(t);
  }, [phase, onComplete]);

  const handleVideo1End = useCallback(() => setPhase('cross-fade'), []);
  // Video2 ends → go to start-wait (freeze on logo)
  const handleVideo2End = useCallback(() => setPhase('start-wait'), []);

  const handleSkip = useCallback(() => {
    if (!canSkip) return;
    if (phase === 'start-wait') return; // Don't skip the START screen
    video1Ref.current?.pause();
    video2Ref.current?.pause();
    // Skip directly to start-wait
    setV1Opacity(0);
    setV2Opacity(1);
    setBlackOpacity(0);
    setPhase('start-wait');
  }, [canSkip, phase]);

  const handleStart = useCallback(() => {
    setStartVisible(false);
    setPhase('fade-out');
  }, []);

  if (phase === 'done') return null;

  return (
    <div
      className="fixed inset-0 z-[100] select-none overflow-hidden"
      style={{ background: 'hsl(225 14% 3%)' }}
      onClick={phase !== 'start-wait' ? handleSkip : undefined}
      onKeyDown={(e) => {
        if (phase === 'start-wait' && (e.key === 'Enter' || e.key === ' ')) handleStart();
        else if (e.key === 'Escape' || e.key === ' ') handleSkip();
      }}
      tabIndex={0}
    >
      {/* Video 1 — Minas FX */}
      <video
        ref={video1Ref}
        src="/videos/minas-fx-intro.mp4"
        className="absolute inset-0 w-full h-full object-contain"
        style={{
          opacity: v1Opacity,
          transition: 'opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
        playsInline
        muted
        preload="auto"
        onEnded={handleVideo1End}
      />

      {/* Video 2 — FX Kontrol */}
      <video
        ref={video2Ref}
        src="/videos/fx-kontrol-intro.mp4"
        className="absolute inset-0 w-full h-full object-contain"
        style={{
          opacity: v2Opacity,
          transition: 'opacity 1s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
        playsInline
        muted
        preload="auto"
        onEnded={handleVideo2End}
      />

      {/* Cross-fade light sweep */}
      {sweepActive && (
        <div className="absolute inset-0 z-30 pointer-events-none overflow-hidden">
          <div
            className="absolute top-0 bottom-0 w-[2px]"
            style={{
              background: 'linear-gradient(to bottom, transparent 5%, hsl(195 100% 60% / 0.9) 50%, transparent 95%)',
              boxShadow: '0 0 80px 30px hsl(195 100% 55% / 0.25), 0 0 160px 60px hsl(195 100% 50% / 0.08)',
              animation: 'fxk-sweep 1s cubic-bezier(0.25, 0.1, 0.25, 1) forwards',
            }}
          />
        </div>
      )}

      {/* Vignette */}
      <div
        className="absolute inset-0 pointer-events-none z-20"
        style={{
          background: `
            radial-gradient(ellipse 80% 70% at 50% 50%, transparent 40%, hsl(225 14% 3% / 0.5) 100%),
            linear-gradient(to bottom, hsl(225 14% 3% / 0.4) 0%, transparent 12%, transparent 88%, hsl(225 14% 3% / 0.4) 100%)
          `,
        }}
      />

      {/* Black overlay — fade in/out */}
      <div
        className="absolute inset-0 z-40 pointer-events-none"
        style={{
          backgroundColor: 'hsl(225 14% 3%)',
          opacity: blackOpacity,
          transition: 'opacity 1.2s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      />

      {/* ═══ START BUTTON — shown after video2 ends ═══ */}
      {phase === 'start-wait' && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-end pb-[15vh]">
          {/* Subtle overlay gradient for readability */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'linear-gradient(to top, hsl(225 14% 3% / 0.7) 0%, transparent 50%)',
            }}
          />

          <div
            className={cn(
              "relative flex flex-col items-center gap-6 transition-all duration-700 ease-out",
              startVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            )}
          >
            <button
              onClick={handleStart}
              className="group relative px-12 py-4 rounded-lg border border-white/10 bg-white/5 backdrop-blur-md hover:bg-white/10 hover:border-white/20 transition-all duration-300 cursor-pointer"
            >
              {/* Glow behind button */}
              <div
                className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{
                  boxShadow: '0 0 40px 10px hsl(195 100% 55% / 0.15), inset 0 0 20px hsl(195 100% 55% / 0.05)',
                }}
              />
              <span className="relative text-lg font-bold tracking-[0.4em] uppercase text-white/90 group-hover:text-white transition-colors font-display">
                START
              </span>
            </button>

            <span className="text-[10px] text-white/25 tracking-[0.3em] uppercase font-display animate-pulse">
              Press Enter or Click
            </span>
          </div>
        </div>
      )}

      {/* Skip hint — not shown during start-wait */}
      {canSkip && phase !== 'fade-out' && phase !== 'start-wait' && (
        <div
          className="absolute bottom-6 right-6 z-50 flex items-center gap-2"
          style={{ animation: 'fxk-fade-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}
        >
          <span className="text-[10px] text-white/30 uppercase tracking-[0.25em] font-display font-medium">
            Pular
          </span>
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
      `}</style>
    </div>
  );
}
