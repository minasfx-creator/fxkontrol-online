/**
 * ─── PS5-Style Cinematic Intro ─────────────────────────────────────
 * Plays two videos sequentially with PlayStation 5-inspired transitions:
 *   1. Minas FX logo vinheta
 *   2. FX Kontrol Unreal Engine cinematic
 * Then fades to the main splash/app.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';

type IntroPhase = 'black-in' | 'video1' | 'transition' | 'video2' | 'fade-out' | 'done';

interface CinematicIntroProps {
  onComplete: () => void;
}

export default function CinematicIntro({ onComplete }: CinematicIntroProps) {
  const [phase, setPhase] = useState<IntroPhase>('black-in');
  const [canSkip, setCanSkip] = useState(false);
  const video1Ref = useRef<HTMLVideoElement>(null);
  const video2Ref = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Allow skip after 2s
  useEffect(() => {
    const t = setTimeout(() => setCanSkip(true), 2000);
    return () => clearTimeout(t);
  }, []);

  // Phase: black-in → video1
  useEffect(() => {
    if (phase === 'black-in') {
      const t = setTimeout(() => setPhase('video1'), 800);
      return () => clearTimeout(t);
    }
  }, [phase]);

  // Phase: video1 play
  useEffect(() => {
    if (phase === 'video1' && video1Ref.current) {
      video1Ref.current.currentTime = 0;
      video1Ref.current.play().catch(() => {
        // Autoplay blocked — skip to video2
        setPhase('transition');
      });
    }
  }, [phase]);

  // Phase: transition → video2
  useEffect(() => {
    if (phase === 'transition') {
      const t = setTimeout(() => setPhase('video2'), 900);
      return () => clearTimeout(t);
    }
  }, [phase]);

  // Phase: video2 play
  useEffect(() => {
    if (phase === 'video2' && video2Ref.current) {
      video2Ref.current.currentTime = 0;
      video2Ref.current.play().catch(() => {
        setPhase('fade-out');
      });
    }
  }, [phase]);

  // Phase: fade-out → done
  useEffect(() => {
    if (phase === 'fade-out') {
      const t = setTimeout(() => {
        setPhase('done');
        onComplete();
      }, 1200);
      return () => clearTimeout(t);
    }
  }, [phase, onComplete]);

  const handleVideo1End = useCallback(() => {
    setPhase('transition');
  }, []);

  const handleVideo2End = useCallback(() => {
    setPhase('fade-out');
  }, []);

  const handleSkip = useCallback(() => {
    if (!canSkip) return;
    if (video1Ref.current) { video1Ref.current.pause(); }
    if (video2Ref.current) { video2Ref.current.pause(); }
    setPhase('fade-out');
  }, [canSkip]);

  if (phase === 'done') return null;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[100] bg-black cursor-pointer select-none"
      onClick={handleSkip}
      onKeyDown={(e) => { if (e.key === 'Escape' || e.key === ' ') handleSkip(); }}
      tabIndex={0}
    >
      {/* PS5-style ambient particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
        {Array.from({ length: 30 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              width: `${2 + Math.random() * 3}px`,
              height: `${2 + Math.random() * 3}px`,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              background: `hsl(${210 + Math.random() * 30}, 80%, ${60 + Math.random() * 30}%)`,
              opacity: 0.15 + Math.random() * 0.25,
              animation: `cinematic-float ${6 + Math.random() * 8}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 5}s`,
            }}
          />
        ))}
      </div>

      {/* Video 1 — Minas FX */}
      <div
        className={cn(
          "absolute inset-0 flex items-center justify-center transition-all duration-700 z-20",
          phase === 'video1' ? 'opacity-100 scale-100' : 'opacity-0 scale-[1.02]',
        )}
      >
        <video
          ref={video1Ref}
          src="/videos/minas-fx-intro.mp4"
          className="w-full h-full object-contain"
          muted={false}
          playsInline
          preload="auto"
          onEnded={handleVideo1End}
        />
      </div>

      {/* PS5 transition flash */}
      <div
        className={cn(
          "absolute inset-0 z-30 pointer-events-none transition-opacity duration-500",
          phase === 'transition' ? 'opacity-100' : 'opacity-0',
        )}
      >
        {/* Horizontal light wipe */}
        <div
          className={cn(
            "absolute top-0 h-full w-[3px] bg-gradient-to-b from-transparent via-white to-transparent transition-all duration-700 ease-out",
            phase === 'transition' ? 'left-full' : 'left-0',
          )}
          style={{
            boxShadow: '0 0 60px 20px rgba(255,255,255,0.3), 0 0 120px 40px rgba(100,150,255,0.15)',
          }}
        />
        {/* Center flash */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className={cn(
              "w-1 h-1 rounded-full bg-white transition-all duration-500",
              phase === 'transition' ? 'w-[200vw] h-[200vh] opacity-30' : 'opacity-0',
            )}
            style={{
              boxShadow: '0 0 100px 50px rgba(255,255,255,0.2)',
            }}
          />
        </div>
      </div>

      {/* Video 2 — FX Kontrol */}
      <div
        className={cn(
          "absolute inset-0 flex items-center justify-center transition-all duration-700 z-20",
          phase === 'video2' ? 'opacity-100 scale-100' : phase === 'fade-out' ? 'opacity-0 scale-[1.05]' : 'opacity-0 scale-95',
        )}
      >
        <video
          ref={video2Ref}
          src="/videos/fx-kontrol-intro.mp4"
          className="w-full h-full object-contain"
          muted={false}
          playsInline
          preload="auto"
          onEnded={handleVideo2End}
        />
      </div>

      {/* Vignette overlay — PS5 style */}
      <div
        className="absolute inset-0 pointer-events-none z-40"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.6) 100%)',
        }}
      />

      {/* Top/bottom cinematic bars */}
      <div className={cn(
        "absolute top-0 left-0 right-0 h-[8%] bg-gradient-to-b from-black to-transparent z-40 pointer-events-none transition-opacity duration-500",
        phase === 'black-in' ? 'opacity-100' : 'opacity-60',
      )} />
      <div className={cn(
        "absolute bottom-0 left-0 right-0 h-[8%] bg-gradient-to-t from-black to-transparent z-40 pointer-events-none transition-opacity duration-500",
        phase === 'black-in' ? 'opacity-100' : 'opacity-60',
      )} />

      {/* Fade-out overlay */}
      <div className={cn(
        "absolute inset-0 bg-black z-50 pointer-events-none transition-opacity duration-1000",
        phase === 'fade-out' ? 'opacity-100' : phase === 'black-in' ? 'opacity-100' : 'opacity-0',
      )} />

      {/* Skip hint */}
      {canSkip && phase !== 'fade-out' && (
        <div className="absolute bottom-6 right-6 z-50 flex items-center gap-2 animate-pulse">
          <span className="text-[10px] text-white/40 uppercase tracking-[0.2em] font-medium">
            Press to skip
          </span>
          <div className="w-6 h-6 rounded border border-white/20 flex items-center justify-center">
            <span className="text-[9px] text-white/40 font-bold">ESC</span>
          </div>
        </div>
      )}

      {/* CSS animation */}
      <style>{`
        @keyframes cinematic-float {
          0%, 100% { transform: translateY(0) translateX(0); opacity: 0.15; }
          25% { transform: translateY(-20px) translateX(10px); opacity: 0.3; }
          50% { transform: translateY(-10px) translateX(-15px); opacity: 0.1; }
          75% { transform: translateY(-30px) translateX(5px); opacity: 0.25; }
        }
      `}</style>
    </div>
  );
}
