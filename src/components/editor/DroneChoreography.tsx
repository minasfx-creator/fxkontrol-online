import { useMemo } from 'react';
import { useProjectStore, type DroneFormation } from '@/store/useProjectStore';
import { interpolateColor, type ColorTransitionMode } from '@/lib/colorInterpolation';
import InstancedDroneSwarm from './InstancedDroneSwarm';
import TransitionParticles from './TransitionParticles';

/**
 * Computes drone positions at a given time based on the formation sequence.
 * Uses smoothstep interpolation with easing for cinematic transitions.
 * Includes per-drone synchronized color interpolation.
 */
function computeDronePositions(
  formations: DroneFormation[],
  currentTime: number,
): { x: number; y: number; z: number; color: string }[] | null {
  if (formations.length === 0) return null;

  const droneCount = formations[0].droneCount;
  const firstStart = formations[0].startTime;
  const lastFormation = formations[formations.length - 1];
  const lastEnd = lastFormation.startTime + lastFormation.transitionDuration + lastFormation.holdDuration;
  const landingDuration = 10;

  // Before any formation starts: staggered ground positions with wave takeoff anticipation
  if (currentTime < firstStart) {
    const preTime = firstStart - currentTime;
    return formations[0].points.slice(0, droneCount).map((p, idx) => {
      // Subtle breathing pulse on ground before launch
      const breathe = preTime < 3 ? Math.sin((3 - preTime) * Math.PI * 2 + idx * 0.1) * 0.02 : 0;
      return {
        x: p.x, y: 0.1 + breathe, z: p.z, color: formations[0].color,
      };
    });
  }

  // After all formations + landing
  if (currentTime > lastEnd + landingDuration) return null;

  // Landing phase with ease-out
  if (currentTime > lastEnd) {
    const t = (currentTime - lastEnd) / landingDuration;
    const easeOut = 1 - (1 - t) * (1 - t);
    const holdColor = lastFormation.endColor || lastFormation.color;
    return lastFormation.points.slice(0, droneCount).map((p, idx) => {
      // Fade to dim during landing
      const landColor = interpolateColor(holdColor, '#111111', t, 'linear', idx, droneCount);
      return {
        x: p.x,
        y: lastFormation.height * (1 - easeOut),
        z: p.z,
        color: landColor,
      };
    });
  }

  // Find active formation
  for (let i = 0; i < formations.length; i++) {
    const f = formations[i];
    const transEnd = f.startTime + f.transitionDuration;
    const holdEnd = transEnd + f.holdDuration;

    if (currentTime >= f.startTime && currentTime <= holdEnd) {
      // Determine colors
      const prevColor = i === 0 ? f.color : (formations[i - 1].endColor || formations[i - 1].color);
      const targetColor = f.color;
      const endColor = f.endColor || f.color;
      const colorMode: ColorTransitionMode = f.colorTransition || 'linear';

      if (currentTime < transEnd) {
        const t = (currentTime - f.startTime) / f.transitionDuration;
        // Quintic ease-in-out for position
        const smoothT = t < 0.5
          ? 16 * t * t * t * t * t
          : 1 - Math.pow(-2 * t + 2, 5) / 2;

        const prevPositions = i === 0
          ? f.points.slice(0, droneCount).map(p => ({ x: p.x, y: 0.1, z: p.z }))
          : formations[i - 1].points.slice(0, droneCount).map(p => ({
            x: p.x, y: formations[i - 1].height, z: p.z,
          }));

        return f.points.slice(0, droneCount).map((p, idx) => {
          const prev = prevPositions[idx] || { x: 0, y: 0, z: 0 };
          const arcHeight = i === 0 ? 0 : Math.sin(smoothT * Math.PI) * 3;
          // Color interpolation: from previous formation color → this formation color
          const droneColor = interpolateColor(prevColor, targetColor, smoothT, colorMode, idx, droneCount);
          return {
            x: prev.x + (p.x - prev.x) * smoothT,
            y: prev.y + (f.height - prev.y) * smoothT + arcHeight,
            z: prev.z + (p.z - prev.z) * smoothT,
            color: droneColor,
          };
        });
      }

      // During hold: interpolate from color → endColor over hold duration
      if (endColor !== targetColor) {
        const holdT = (currentTime - transEnd) / f.holdDuration;
        return f.points.slice(0, droneCount).map((p, idx) => ({
          x: p.x, y: f.height, z: p.z,
          color: interpolateColor(targetColor, endColor, holdT, colorMode, idx, droneCount),
        }));
      }

      // Static hold
      return f.points.slice(0, droneCount).map((p) => ({
        x: p.x, y: f.height, z: p.z, color: targetColor,
      }));
    }
  }

  return null;
}

export default function DroneChoreography() {
  const { droneFormations, currentTime, showFormations } = useProjectStore();

  const positions = useMemo(
    () => computeDronePositions(droneFormations, currentTime),
    [droneFormations, currentTime]
  );

  if (!showFormations || !positions) return null;

  return (
    <>
      <InstancedDroneSwarm positions={positions} scale={0.6} />
      <TransitionParticles />
    </>
  );
}


export { computeDronePositions };
