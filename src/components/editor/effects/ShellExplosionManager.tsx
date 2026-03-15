import { useMemo } from 'react';
import { useProjectStore } from '@/store/useProjectStore';
import {
  getBreakHeight,
  getLiftTime,
  getStarLifetime,
  getMortarVelocity,
  GRAVITY,
  type BurstPattern,
} from '@/lib/pyroPhysics';
import PrefireShell from './PrefireShell';
import ShellBurstRenderer from './ShellBurstRenderer';
import SmokeTrailInner from './SmokeTrail';

/**
 * ShellExplosionManager — Orchestrates the full lifecycle of a shell:
 *   1. Launch phase (PrefireShell: comet trail rising from mortar)
 *   2. Burst phase (ShellBurstRenderer: GPU particle explosion)
 *   3. Smoke phase (SmokeTrail: persistent volumetric smoke)
 *
 * Equivalent to UE5's AFireworkActor::Launch() + Tick() + Destroy()
 * but with GPU-accelerated rendering and physically accurate ballistics.
 */

interface ShellConfig {
  id: string;
  position: [number, number, number];
  color: string;
  caliber: number;
  pattern: BurstPattern;
  heading: number;
  pitch: number;
  fireTime: number; // absolute time in show
  secondaryColor?: string;
}

interface ShellExplosionManagerProps {
  shells: ShellConfig[];
  currentTime: number;
}

function SingleShellLifecycle({
  shell,
  currentTime,
}: {
  shell: ShellConfig;
  currentTime: number;
}) {
  const liftTime = useMemo(() => getLiftTime(shell.caliber), [shell.caliber]);
  const starLife = useMemo(() => getStarLifetime(shell.caliber), [shell.caliber]);
  const breakH = useMemo(() => getBreakHeight(shell.caliber), [shell.caliber]);
  const v0 = useMemo(() => getMortarVelocity(shell.caliber), [shell.caliber]);

  const elapsed = currentTime - shell.fireTime;

  // Phase timing
  const liftEnd = liftTime;
  const burstEnd = liftEnd + starLife;
  const smokeEnd = burstEnd + 4; // smoke lingers 4s after stars fade

  // Not yet fired or fully done
  if (elapsed < 0 || elapsed > smokeEnd) return null;

  // Calculate burst position (where the shell detonates)
  const pitchRad = (shell.pitch || 85) * (Math.PI / 180);
  const headingRad = (shell.heading || 0) * (Math.PI / 180);
  const dirX = Math.sin(headingRad) * Math.cos(pitchRad);
  const dirY = Math.sin(pitchRad);
  const dirZ = -Math.cos(headingRad) * Math.cos(pitchRad);

  // Shell position at break height
  const t = liftTime;
  const dist = Math.min(breakH, v0 * t + 0.5 * GRAVITY * t * t);
  const burstPos: [number, number, number] = [
    shell.position[0] + dirX * dist,
    shell.position[1] + dirY * dist,
    shell.position[2] + dirZ * dist,
  ];

  return (
    <>
      {/* Phase 1: Launch — comet trail rising */}
      {elapsed >= 0 && elapsed <= liftEnd && (
        <PrefireShell
          position={shell.position}
          color={shell.color}
          progress={elapsed / liftEnd}
          caliber={shell.caliber}
          heading={shell.heading}
          pitch={shell.pitch}
        />
      )}

      {/* Phase 2: Burst — GPU particle explosion */}
      {elapsed > liftEnd && elapsed <= burstEnd && (
        <ShellBurstRenderer
          position={burstPos}
          color={shell.color}
          progress={(elapsed - liftEnd) / starLife}
          caliber={shell.caliber}
          pattern={shell.pattern}
          secondaryColor={shell.secondaryColor}
        />
      )}

      {/* Phase 3: Smoke — persistent volumetric cloud */}
      {elapsed > liftEnd && elapsed <= smokeEnd && (
        <SmokeTrailInner
          position={burstPos}
          progress={Math.min(1, (elapsed - liftEnd) / (smokeEnd - liftEnd))}
          intensity={0.6 + shell.caliber * 0.08}
        />
      )}
    </>
  );
}

/**
 * Renders all active shells in the show.
 * Optimized: only renders shells within a time window.
 */
export default function ShellExplosionManager({
  shells,
  currentTime,
}: ShellExplosionManagerProps) {
  // Filter to shells that could be visible (within lifecycle window)
  const activeShells = useMemo(() => {
    return shells.filter(s => {
      const elapsed = currentTime - s.fireTime;
      const maxDuration = getLiftTime(s.caliber) + getStarLifetime(s.caliber) + 4;
      return elapsed >= -0.1 && elapsed <= maxDuration;
    });
  }, [shells, currentTime]);

  if (activeShells.length === 0) return null;

  return (
    <>
      {activeShells.map(shell => (
        <SingleShellLifecycle
          key={shell.id}
          shell={shell}
          currentTime={currentTime}
        />
      ))}
    </>
  );
}

export type { ShellConfig };
