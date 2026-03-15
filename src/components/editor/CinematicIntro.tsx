/**
 * ─── FX KONTROL Cinematic Intro ────────────────────────────────────
 * PS5-inspired intro sequence with refined fades and transitions:
 *   1. Fade from black → Minas FX vinheta
 *   2. Smooth cross-dissolve with cyan light sweep
 *   3. FX KONTROL Unreal Engine cinematic
 *   4. Elegant fade to platform
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';

type IntroPhase = 'black-in' | 'video1' | 'cross-fade' | 'video2' | 'fade-out' | 'done';

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
  const video1Ref = useRef<HTMLVideoElement>(null);
  const video2Ref = useRef<HTMLVideoElement>(null);

  // Allow skip after 1.5s
  useEffect(() => {
    const t = setTimeout(() => setCanSkip(true), 1500);
    return () => clearTimeout(t);
  }, []);

  // ── Phase: black-in → fade reveal video1 ─────────────────────
  useEffect(() => {
    if (phase !== 'black-in') return;
    // Start fading black out after a brief pause
    const t1 = setTimeout(() => {
      setBlackOpacity(0);
      setV1Opacity(1);
    }, 400);
    const t2 = setTimeout(() => setPhase('video1'), 1200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [phase]);

  // ── Phase: video1 — play Minas FX ────────────────────────────
  useEffect(() => {
    if (phase !== 'video1' || !video1Ref.current) return;
    video1Ref.current.currentTime = 0;
    video1Ref.current.play().catch(() => setPhase('cross-fade'));
  }, [phase]);

  // ── Phase: cross-fade — cinematic dissolve ───────────────────
  useEffect(() => {
    if (phase !== 'cross-fade') return;
    setSweepActive(true);

    // Dissolve: fade v1 out + v2 in simultaneously
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

  // ── Phase: video2 — play FX Kontrol ──────────────────────────
  useEffect(() => {
    if (phase !== 'video2' || !video2Ref.current) return;
    video2Ref.current.currentTime = 0;
    video2Ref.current.play().catch(() => setPhase('fade-out'));
  }, [phase]);

  // ── Phase: fade-out → done ───────────────────────────────────
  useEffect(() => {
    if (phase !== 'fade-out') return;
    setBlackOpacity(1);
    setV2Opacity(0);
    const t = setTimeout(() => {
      setPhase('done');
      onComplete();
    }, 1400);
    return () => clearTimeout(t);
  }, [phase, onComplete]);

  const handleVideo1End = useCallback(() => setPhase('cross-fade'), []);
  const handleVideo2End = useCallback(() => setPhase('fade-out'), []);

  const handleSkip = useCallback(() => {
    if (!canSkip) return;
    video1Ref.current?.pause();
    video2Ref.current?.pause();
    setPhase('fade-out');
  }, [canSkip]);

  if (phase === 'done') return null;

  return (
    <div
      className="fixed inset-0 z-[100] select-none cursor-pointer overflow-hidden"
      style={{ background: 'hsl(225 14% 3%)' }}
      onClick={handleSkip}
      onKeyDown={(e) => { if (e.key === 'Escape' || e.key === ' ') handleSkip(); }}
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
        preload="auto"
        onEnded={handleVideo2End}
      />

      {/* Cross-fade light sweep — PS5 style cyan wipe */}
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

      {/* Vignette — cinematic depth */}
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

      {/* Skip hint */}
      {canSkip && phase !== 'fade-out' && (
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
