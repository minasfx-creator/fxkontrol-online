import { useMemo } from 'react';
import {
  getBreakHeight,
  getLiftTime,
  getStarLifetime,
  getMortarVelocity,
  createMultiBreakTimings,
  GRAVITY,
  type BurstPattern,
} from '@/lib/pyroPhysics';
import { useSceneStore } from '@/store/useSceneStore';
import PrefireShell from './PrefireShell';
import ShellBurstRenderer from './ShellBurstRenderer';
import SmokeTrailInner from './SmokeTrail';

/**
 * ShellExplosionManager — Orchestrates the full lifecycle of a shell:
 *   1. Launch phase (PrefireShell: comet trail rising from mortar)
 *   2. Burst phase (ShellBurstRenderer: GPU particle explosion)
 *   3. Smoke phase (SmokeTrail: persistent volumetric smoke)
 *
 * Now supports: multi-break, pistil, color-change, glitter, falling leaves.
 */

interface ShellConfig {
  id: string;
  position: [number, number, number];
  color: string;
  caliber: number;
  pattern: BurstPattern;
  heading: number;
  pitch: number;
  fireTime: number;
  secondaryColor?: string;
  numBreaks?: number;
  hasPistil?: boolean;
  pistilColor?: string;
  colorTransition?: 'none' | 'to' | 'changing' | 'alternating';
  trailType?: 'none' | 'comet' | 'glitter' | 'brocade' | 'charcoal' | 'smoke';
  fallingLeaves?: boolean;
  angleOffset?: number;
  noTrail?: boolean;
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
  const afterglowDuration = useSceneStore(st => st.settings.afterglowDuration);

  const liftTime = useMemo(() => getLiftTime(shell.caliber), [shell.caliber]);
  const starLife = useMemo(() => getStarLifetime(shell.caliber), [shell.caliber]);
  const breakH = useMemo(() => getBreakHeight(shell.caliber), [shell.caliber]);
  const v0 = useMemo(() => getMortarVelocity(shell.caliber), [shell.caliber]);
  const numBreaks = shell.numBreaks || 1;

  const multiBreakTimings = useMemo(
    () => numBreaks > 1 ? createMultiBreakTimings(shell.caliber, numBreaks) : null,
    [shell.caliber, numBreaks]
  );

  const elapsed = currentTime - shell.fireTime;

  // Phase timing
  const liftEnd = liftTime;
  const totalBurstDuration = numBreaks > 1
    ? starLife + (multiBreakTimings ? multiBreakTimings[multiBreakTimings.length - 1].delay : 0)
    : starLife;
  const burstEnd = liftEnd + totalBurstDuration;
  const smokeEnd = burstEnd + Math.max(4, afterglowDuration);

  if (elapsed < 0 || elapsed > smokeEnd) return null;

  // Calculate burst position
  const pitchRad = (shell.pitch || 85) * (Math.PI / 180);
  const headingRad = (shell.heading || 0) * (Math.PI / 180);
  const dirX = Math.sin(headingRad) * Math.cos(pitchRad);
  const dirY = Math.sin(pitchRad);
  const dirZ = -Math.cos(headingRad) * Math.cos(pitchRad);

  const t = liftTime;
  const dist = Math.min(breakH, v0 * t + 0.5 * GRAVITY * t * t);
  const burstPos: [number, number, number] = [
    shell.position[0] + dirX * dist,
    shell.position[1] + dirY * dist,
    shell.position[2] + dirZ * dist,
  ];

  return (
    <>
      {/* Phase 1: Launch */}
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

      {/* Phase 2: Burst(s) */}
      {elapsed > liftEnd && elapsed <= burstEnd && (
        <>
          {numBreaks > 1 && multiBreakTimings ? (
            // Multi-break: render each break at different heights/times
            multiBreakTimings.map((mb, idx) => {
              const breakElapsed = elapsed - liftEnd - mb.delay;
              if (breakElapsed < 0 || breakElapsed > starLife) return null;
              const heightFactor = mb.height / breakH;
              const mbPos: [number, number, number] = [
                burstPos[0],
                shell.position[1] + dirY * dist * heightFactor,
                burstPos[2],
              ];
              return (
                <ShellBurstRenderer
                  key={`mb-${idx}`}
                  position={mbPos}
                  color={shell.color}
                  progress={breakElapsed / starLife}
                  caliber={shell.caliber}
                  pattern={shell.pattern}
                  secondaryColor={shell.secondaryColor}
                  hasPistil={idx === 0 ? shell.hasPistil : false}
                  pistilColor={shell.pistilColor}
                  colorTransition={shell.colorTransition}
                  trailType={shell.trailType}
                  fallingLeaves={shell.fallingLeaves}
                />
              );
            })
          ) : (
            // Single break
            <ShellBurstRenderer
              position={burstPos}
              color={shell.color}
              progress={(elapsed - liftEnd) / starLife}
              caliber={shell.caliber}
              pattern={shell.pattern}
              secondaryColor={shell.secondaryColor}
              hasPistil={shell.hasPistil}
              pistilColor={shell.pistilColor}
              colorTransition={shell.colorTransition}
              trailType={shell.trailType}
              fallingLeaves={shell.fallingLeaves}
            />
          )}
        </>
      )}

      {/* Phase 3: Smoke */}
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
 */
export default function ShellExplosionManager({
  shells,
  currentTime,
}: ShellExplosionManagerProps) {
  const afterglowDuration = useSceneStore(st => st.settings.afterglowDuration);

  const activeShells = useMemo(() => {
    return shells.filter(s => {
      const elapsed = currentTime - s.fireTime;
      const maxDuration = getLiftTime(s.caliber) + getStarLifetime(s.caliber) + Math.max(4, afterglowDuration);
      return elapsed >= -0.1 && elapsed <= maxDuration;
    });
  }, [shells, currentTime, afterglowDuration]);

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
