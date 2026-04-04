/**
 * DestructionOverlay — "Luv Missile Strike" cinematic sequence
 * Phases: targeting → incoming → impact → aftermath
 * Inspired by the scene where Luv blinks to fire missiles
 */
import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useSceneStore } from '@/store/useSceneStore';
import { haptics } from '@/lib/haptics';

type Phase = 'idle' | 'targeting' | 'incoming' | 'impact' | 'aftermath';

const PHASE_DURATIONS: Record<Phase, number> = {
  idle: 0,
  targeting: 2500,
  incoming: 3000,
  impact: 600,
  aftermath: 4000,
};

export default function DestructionOverlay() {
  const destructionMode = useSceneStore(s => s.environment.destructionMode);
  const updateEnv = useSceneStore(s => s.updateEnvironment);
  const [phase, setPhase] = useState<Phase>('idle');
  const [countdown, setCountdown] = useState(3);
  const [shakeOffset, setShakeOffset] = useState({ x: 0, y: 0 });
  const [flashOpacity, setFlashOpacity] = useState(0);

  const runSequence = useCallback(async () => {
    // Targeting
    setPhase('targeting');
    haptics.fire();
    await wait(PHASE_DURATIONS.targeting);

    // Incoming — countdown
    setPhase('incoming');
    haptics.arm();
    for (let i = 3; i >= 1; i--) {
      setCountdown(i);
      await wait(1000);
    }

    // Impact
    setPhase('impact');
    setFlashOpacity(1);
    haptics.fire();
    // Screen shake
    const shakeInterval = setInterval(() => {
      setShakeOffset({
        x: (Math.random() - 0.5) * 12,
        y: (Math.random() - 0.5) * 12,
      });
    }, 50);
    await wait(PHASE_DURATIONS.impact);
    clearInterval(shakeInterval);
    setShakeOffset({ x: 0, y: 0 });
    setFlashOpacity(0);

    // Aftermath
    setPhase('aftermath');
    await wait(PHASE_DURATIONS.aftermath);

    // Reset
    setPhase('idle');
    updateEnv({ destructionMode: false, destructionPhase: 'idle' });
  }, [updateEnv]);

  useEffect(() => {
    if (destructionMode && phase === 'idle') {
      runSequence();
    }
  }, [destructionMode, phase, runSequence]);

  useEffect(() => {
    if (!destructionMode) setPhase('idle');
  }, [destructionMode]);

  if (phase === 'idle') return null;

  return (
    <div
      className="absolute inset-0 z-50 pointer-events-none overflow-hidden"
      style={{
        transform: `translate(${shakeOffset.x}px, ${shakeOffset.y}px)`,
        transition: phase === 'impact' ? 'none' : 'transform 0.1s ease-out',
      }}
    >
      {/* ═══ TARGETING PHASE ═══ */}
      {phase === 'targeting' && (
        <div className="absolute inset-0 flex items-center justify-center animate-fade-in">
          {/* Pulsing border */}
          <div className="absolute inset-0 border-2 border-destructive/40" style={{ animation: 'destruction-border-pulse 0.5s ease-in-out infinite' }} />

          {/* Blinking Eye — Luv's targeting iris */}
          <svg viewBox="0 0 200 200" className="w-40 h-40 md:w-56 md:h-56">
            {/* Outer iris ring */}
            <circle cx="100" cy="100" r="70" fill="none" stroke="hsl(0 85% 48% / 0.3)" strokeWidth="1"
              style={{ animation: 'destruction-iris-converge 2s ease-in forwards' }} />
            <circle cx="100" cy="100" r="50" fill="none" stroke="hsl(0 85% 48% / 0.5)" strokeWidth="0.8"
              style={{ animation: 'destruction-iris-converge 2s ease-in 0.3s forwards' }} />

            {/* Iris detail lines */}
            {Array.from({ length: 12 }, (_, i) => {
              const angle = (i / 12) * Math.PI * 2;
              return (
                <line key={i}
                  x1={100 + Math.cos(angle) * 30}
                  y1={100 + Math.sin(angle) * 30}
                  x2={100 + Math.cos(angle) * 65}
                  y2={100 + Math.sin(angle) * 65}
                  stroke="hsl(0 85% 48% / 0.2)" strokeWidth="0.5"
                />
              );
            })}

            {/* Pupil */}
            <circle cx="100" cy="100" r="18" fill="hsl(0 85% 48% / 0.15)"
              stroke="hsl(0 85% 48% / 0.6)" strokeWidth="1.5" />
            <circle cx="100" cy="100" r="6" fill="hsl(0 85% 48% / 0.8)" />

            {/* Eyelids — blink animation */}
            <path d="M30 100 Q100 50 170 100" fill="none"
              stroke="hsl(0 85% 48% / 0.4)" strokeWidth="2"
              style={{ animation: 'destruction-blink 1s ease-in-out infinite' }} />
            <path d="M30 100 Q100 150 170 100" fill="none"
              stroke="hsl(0 85% 48% / 0.4)" strokeWidth="2"
              style={{ animation: 'destruction-blink 1s ease-in-out infinite reverse' }} />

            {/* Crosshairs */}
            <line x1="100" y1="10" x2="100" y2="45" stroke="hsl(0 85% 48% / 0.3)" strokeWidth="0.5" />
            <line x1="100" y1="155" x2="100" y2="190" stroke="hsl(0 85% 48% / 0.3)" strokeWidth="0.5" />
            <line x1="10" y1="100" x2="45" y2="100" stroke="hsl(0 85% 48% / 0.3)" strokeWidth="0.5" />
            <line x1="155" y1="100" x2="190" y2="100" stroke="hsl(0 85% 48% / 0.3)" strokeWidth="0.5" />
          </svg>

          {/* FUI Labels */}
          <div className="absolute top-8 left-1/2 -translate-x-1/2 font-mono text-[10px] text-destructive tracking-[0.3em] animate-pulse">
            TGT ACQUIRED
          </div>
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 font-mono text-[8px] text-destructive/60 tracking-widest">
            ORDNANCE STANDBY
          </div>
        </div>
      )}

      {/* ═══ INCOMING PHASE ═══ */}
      {phase === 'incoming' && (
        <div className="absolute inset-0 flex items-center justify-center">
          {/* Red border intensifying */}
          <div className="absolute inset-0 border-4 border-destructive/60" style={{ animation: 'destruction-border-pulse 0.3s ease-in-out infinite' }} />

          {/* Missile trails — converging lines */}
          <svg className="absolute inset-0 w-full h-full">
            {[
              { x1: '0%', y1: '0%' },
              { x1: '100%', y1: '0%' },
              { x1: '0%', y1: '100%' },
              { x1: '100%', y1: '100%' },
            ].map((trail, i) => (
              <line key={i}
                x1={trail.x1} y1={trail.y1} x2="50%" y2="50%"
                stroke="hsl(0 85% 48% / 0.5)" strokeWidth="2"
                strokeDasharray="8 12"
                style={{ animation: `destruction-missile-trail 1s linear ${i * 0.2}s infinite` }}
              />
            ))}
          </svg>

          {/* Countdown */}
          <div className="relative z-10 font-mono text-6xl md:text-8xl font-black text-destructive" style={{ animation: 'destruction-countdown-pulse 1s ease-in-out infinite', textShadow: '0 0 30px hsl(0 85% 48% / 0.5)' }}>
            {countdown}
          </div>

          <div className="absolute top-8 left-1/2 -translate-x-1/2 font-mono text-[11px] text-destructive tracking-[0.4em]" style={{ animation: 'destruction-border-pulse 0.3s ease-in-out infinite' }}>
            IMPACT T-{countdown}
          </div>
        </div>
      )}

      {/* ═══ IMPACT FLASH ═══ */}
      <div
        className="absolute inset-0 bg-white pointer-events-none"
        style={{
          opacity: flashOpacity,
          transition: flashOpacity > 0 ? 'none' : 'opacity 0.4s ease-out',
        }}
      />

      {/* ═══ AFTERMATH PHASE ═══ */}
      {phase === 'aftermath' && (
        <div className="absolute inset-0">
          {/* Static noise overlay */}
          <div className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E")`,
              animation: 'destruction-static 0.1s steps(5) infinite',
            }}
          />

          {/* Debris particles */}
          {Array.from({ length: 20 }, (_, i) => {
            const angle = (i / 20) * Math.PI * 2;
            const dist = 20 + Math.random() * 30;
            return (
              <div
                key={i}
                className="absolute w-1 h-1 rounded-full bg-destructive/60"
                style={{
                  left: '50%',
                  top: '50%',
                  animation: `destruction-debris ${1 + Math.random() * 2}s ease-out ${i * 0.05}s forwards`,
                  '--debris-x': `${Math.cos(angle) * dist}vw`,
                  '--debris-y': `${Math.sin(angle) * dist}vh`,
                } as React.CSSProperties}
              />
            );
          })}

          {/* Aftermath label */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 font-mono text-[9px] text-destructive/40 tracking-[0.5em]"
            style={{ animation: 'destruction-fade-in 1s ease-out forwards' }}>
            SIGNAL LOST
          </div>
        </div>
      )}
    </div>
  );
}

function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
