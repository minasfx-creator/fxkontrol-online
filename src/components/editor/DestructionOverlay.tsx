/**
 * DestructionOverlay — "Luv Missile Strike" cinematic sequence
 * Phases: targeting → incoming → impact → aftermath (nuclear)
 * With synthesized sound effects and nuclear visual destruction
 */
import { useState, useEffect, useCallback } from 'react';
import { useSceneStore } from '@/store/useSceneStore';
import { haptics } from '@/lib/haptics';
import { ambientSound } from '@/lib/ambientSound';
import DestructionTargeting from './destruction/DestructionTargeting';
import DestructionIncoming from './destruction/DestructionIncoming';
import DestructionNuclearAftermath from './destruction/DestructionNuclearAftermath';

type Phase = 'idle' | 'targeting' | 'incoming' | 'impact' | 'aftermath';

const PHASE_DURATIONS: Record<Phase, number> = {
  idle: 0,
  targeting: 2500,
  incoming: 3000,
  impact: 600,
  aftermath: 5000,
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
    ambientSound.play('alarm');
    await wait(PHASE_DURATIONS.targeting);

    // Incoming — countdown
    setPhase('incoming');
    haptics.arm();
    for (let i = 3; i >= 1; i--) {
      setCountdown(i);
      ambientSound.play('missile');
      await wait(1000);
    }

    // Impact
    setPhase('impact');
    setFlashOpacity(1);
    haptics.fire();
    ambientSound.play('explosion');
    const shakeInterval = setInterval(() => {
      setShakeOffset({
        x: (Math.random() - 0.5) * 16,
        y: (Math.random() - 0.5) * 16,
      });
    }, 40);
    await wait(PHASE_DURATIONS.impact);
    clearInterval(shakeInterval);
    setShakeOffset({ x: 0, y: 0 });
    setFlashOpacity(0);

    // Aftermath — nuclear
    setPhase('aftermath');
    ambientSound.play('radiation');
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
      {phase === 'targeting' && <DestructionTargeting />}
      {phase === 'incoming' && <DestructionIncoming countdown={countdown} />}

      {/* Impact flash */}
      <div
        className="absolute inset-0 bg-white pointer-events-none"
        style={{
          opacity: flashOpacity,
          transition: flashOpacity > 0 ? 'none' : 'opacity 0.4s ease-out',
        }}
      />

      {phase === 'aftermath' && <DestructionNuclearAftermath />}
    </div>
  );
}

function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
