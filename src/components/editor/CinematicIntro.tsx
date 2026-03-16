/**
 * ─── FX KONTROL Cinematic Intro ────────────────────────────────────
 * PS5-inspired intro sequence:
 *   1. Fade from black → Minas FX vinheta
 *   2. Smooth cross-dissolve with cyan light sweep
 *   3. FX KONTROL cinematic
 *   4. Elegant fade to START overlay with particle ambience
 *   5. On START → callback (splash screen)
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  const [startGlowPulse, setStartGlowPulse] = useState(false);
  const video1Ref = useRef<HTMLVideoElement>(null);
  const video2Ref = useRef<HTMLVideoElement>(null);

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
    return () => {clearTimeout(t1);clearTimeout(t2);};
  }, [phase]);

  // ── Phase: video1 — play Minas FX
  useEffect(() => {
    if (phase !== 'video1' || !video1Ref.current) return;
    video1Ref.current.currentTime = 0;
    video1Ref.current.play().catch(() => setPhase('cross-fade'));
  }, [phase]);

  // ── Phase: cross-fade
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
    return () => {clearTimeout(t1);clearTimeout(t2);};
  }, [phase]);

  // ── Phase: video2 — play FX Kontrol
  useEffect(() => {
    if (phase !== 'video2' || !video2Ref.current) return;
    video2Ref.current.currentTime = 0;
    video2Ref.current.play().catch(() => setPhase('start-wait'));
  }, [phase]);

  // ── Phase: start-wait — dim video, show START
  useEffect(() => {
    if (phase !== 'start-wait') return;
    // Dim the frozen video frame
    setV2Opacity(0.3);
    setBlackOpacity(0);
    const t1 = setTimeout(() => setStartVisible(true), 500);
    const t2 = setTimeout(() => setStartGlowPulse(true), 1200);
    return () => {clearTimeout(t1);clearTimeout(t2);};
  }, [phase]);

  // ── Phase: fade-out → done
  useEffect(() => {
    if (phase !== 'fade-out') return;
    setBlackOpacity(1);
    const t = setTimeout(() => {
      setPhase('done');
      onComplete();
    }, 800);
    return () => clearTimeout(t);
  }, [phase, onComplete]);

  const handleVideo1End = useCallback(() => setPhase('cross-fade'), []);
  const handleVideo2End = useCallback(() => setPhase('start-wait'), []);

  const handleSkip = useCallback(() => {
    if (!canSkip || phase === 'start-wait') return;
    video1Ref.current?.pause();
    video2Ref.current?.pause();
    setV1Opacity(0);
    setV2Opacity(0.3);
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
        if (phase === 'start-wait' && (e.key === 'Enter' || e.key === ' ')) handleStart();else
        if (e.key === 'Escape' || e.key === ' ') handleSkip();
      }}
      tabIndex={0}>
      
      {/* Video 1 — Minas FX */}
      <video
        ref={video1Ref}
        src="/videos/minas-fx-intro.mp4"
        className="absolute inset-0 w-full h-full object-contain"
        style={{
          opacity: v1Opacity,
          transition: 'opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
        playsInline muted preload="auto"
        onEnded={handleVideo1End} />
      

      {/* Video 2 — FX Kontrol */}
      <video
        ref={video2Ref}
        src="/videos/fx-kontrol-intro.mp4"
        className="absolute inset-0 w-full h-full object-contain"
        style={{
          opacity: v2Opacity,
          transition: 'opacity 1.2s cubic-bezier(0.4, 0, 0.2, 1)',
          filter: phase === 'start-wait' ? 'blur(6px) brightness(0.4)' : 'none'
        }}
        playsInline muted preload="auto"
        onEnded={handleVideo2End} />
      

      {/* Cross-fade light sweep */}
      {sweepActive &&
      <div className="absolute inset-0 z-30 pointer-events-none overflow-hidden">
          <div
          className="absolute top-0 bottom-0 w-[2px]"
          style={{
            background: 'linear-gradient(to bottom, transparent 5%, hsl(195 100% 60% / 0.9) 50%, transparent 95%)',
            boxShadow: '0 0 80px 30px hsl(195 100% 55% / 0.25), 0 0 160px 60px hsl(195 100% 50% / 0.08)',
            animation: 'fxk-sweep 1s cubic-bezier(0.25, 0.1, 0.25, 1) forwards'
          }} />
        
        </div>
      }

      {/* Vignette */}
      <div
        className="absolute inset-0 pointer-events-none z-20"
        style={{
          background: `
            radial-gradient(ellipse 80% 70% at 50% 50%, transparent 40%, hsl(225 14% 3% / 0.6) 100%),
            linear-gradient(to bottom, hsl(225 14% 3% / 0.4) 0%, transparent 12%, transparent 88%, hsl(225 14% 3% / 0.4) 100%)
          `
        }} />
      

      {/* Black overlay */}
      <div
        className="absolute inset-0 z-40 pointer-events-none"
        style={{
          backgroundColor: 'hsl(225 14% 3%)',
          opacity: blackOpacity,
          transition: 'opacity 1.2s cubic-bezier(0.4, 0, 0.2, 1)'
        }} />
      

      {/* ═══ START SCREEN — full centered layout ═══ */}
      {phase === 'start-wait' &&
      <div className="absolute inset-0 z-50 flex flex-col items-center justify-center">
          {/* Top-to-bottom gradient overlay */}
          <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `
                radial-gradient(ellipse 60% 50% at 50% 45%, hsl(195 100% 50% / 0.04) 0%, transparent 70%),
                linear-gradient(to bottom, hsl(225 14% 3% / 0.6) 0%, hsl(225 14% 3% / 0.3) 40%, hsl(225 14% 3% / 0.6) 100%)
              `
          }} />
        

          <div
          className={cn(
            "relative flex flex-col items-center gap-10 transition-all duration-1000 ease-out",
            startVisible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-12 scale-95'
          )}>
          
            {/* Brand logo */}
            <div className="flex flex-col items-center gap-3">
              <div
              className="w-16 h-16 rounded-xl flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, hsl(195 100% 50% / 0.1), hsl(18 100% 55% / 0.1))',
                boxShadow: '0 0 40px hsl(195 100% 50% / 0.15)'
              }}>
              
                <img

                alt="FX Kontrol"
                className="w-10 h-10 object-contain"
                onError={(e) => {(e.target as HTMLImageElement).style.display = 'none';}} src="/lovable-uploads/d126a5cd-edaa-41ee-bcc5-484a1774dee4.png" />
              
              </div>
              <h1 className="font-extrabold tracking-[0.35em] uppercase text-white/90 font-display text-4xl">
                FX KONTROL
              </h1>
              <p className="text-[10px] text-white/30 tracking-[0.3em] uppercase font-display">
                Show Design Platform
              </p>
            </div>

            {/* Divider line */}
            <div
            className="w-24 h-px"
            style={{
              background: 'linear-gradient(90deg, transparent, hsl(195 100% 50% / 0.4), transparent)'
            }} />
          

            {/* START button */}
            <button
            onClick={handleStart}
            className={cn(
              "group relative px-16 py-5 rounded-lg border transition-all duration-500 cursor-pointer",
              "border-white/10 bg-white/[0.03] backdrop-blur-md",
              "hover:bg-white/[0.08] hover:border-white/20",
              startGlowPulse && "animate-[fxk-btn-glow_3s_ease-in-out_infinite]"
            )}>
            
              {/* Glow ring */}
              <div
              className="absolute -inset-px rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-700"
              style={{
                background: 'linear-gradient(135deg, hsl(195 100% 50% / 0.15), hsl(18 100% 55% / 0.1))'
              }} />
            
              <div
              className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500"
              style={{
                boxShadow: '0 0 60px 15px hsl(195 100% 55% / 0.12), inset 0 0 30px hsl(195 100% 55% / 0.04)'
              }} />
            
              <span className="relative text-xl font-bold tracking-[0.5em] uppercase text-white/80 group-hover:text-white transition-colors duration-300 font-display">
                START
              </span>
            </button>

            <span className="text-[9px] text-white/20 tracking-[0.3em] uppercase font-display">
              Press Enter or Click
            </span>
          </div>
        </div>
      }

      {/* Skip hint */}
      {canSkip && phase !== 'fade-out' && phase !== 'start-wait' &&
      <div
        className="absolute bottom-6 right-6 z-50 flex items-center gap-2"
        style={{ animation: 'fxk-fade-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}>
        
          <span className="text-[10px] text-white/30 uppercase tracking-[0.25em] font-display font-medium">
            Pular
          </span>
          <div className="w-7 h-7 rounded-md border border-white/15 flex items-center justify-center backdrop-blur-sm bg-white/5">
            <span className="text-[9px] text-white/30 font-bold font-mono">ESC</span>
          </div>
        </div>
      }

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
          0%, 100% { box-shadow: 0 0 20px 5px hsl(195 100% 55% / 0.05); }
          50% { box-shadow: 0 0 40px 10px hsl(195 100% 55% / 0.12); }
        }
      `}</style>
    </div>);

}