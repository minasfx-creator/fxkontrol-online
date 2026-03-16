import { useMemo } from 'react';
import { useProjectStore, type DroneFormation } from '@/store/useProjectStore';
import { interpolateColor, type ColorTransitionMode } from '@/lib/colorInterpolation';
import InstancedDroneSwarm from './InstancedDroneSwarm';
import TransitionParticles from './TransitionParticles';
import LightTrails from './LightTrails';

/**
 * Computes drone positions at a given time based on the formation sequence.
 * IMPORTANT: Formations are generated as 2D (x, z) points.
 * For aerial display, we map them UPRIGHT:
 *   formation.x → world X (horizontal spread)
 *   formation.z → world Y offset (vertical shape, added to base height)
 *   world Z = 0 (facing audience)
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

  // Helper: convert formation point to upright 3D position
  const toUpright = (p: { x: number; z: number }, height: number) => ({
    x: p.x,
    y: height + p.z, // z becomes vertical offset from base height
    z: 0,
  });

  // Before any formation starts: hide drones (no ground grid clutter)
  if (currentTime < firstStart) {
    return null;
  }

  // After all formations + landing
  if (currentTime > lastEnd + landingDuration) return null;

  // Landing phase
  if (currentTime > lastEnd) {
    const t = (currentTime - lastEnd) / landingDuration;
    const easeOut = 1 - (1 - t) * (1 - t);
    const holdColor = lastFormation.endColor || lastFormation.color;
    return lastFormation.points.slice(0, droneCount).map((p, idx) => {
      const uprightPos = toUpright(p, lastFormation.height);
      const landColor = interpolateColor(holdColor, '#111111', t, 'linear', idx, droneCount);
      // Land to ground grid
      const cols = Math.ceil(Math.sqrt(droneCount));
      const row = Math.floor(idx / cols);
      const col = idx % cols;
      const spacing = 2.5;
      const groundX = (col - (cols - 1) / 2) * spacing;
      const groundZ = (row - (Math.ceil(droneCount / cols) - 1) / 2) * spacing;
      return {
        x: uprightPos.x + (groundX - uprightPos.x) * easeOut,
        y: uprightPos.y * (1 - easeOut),
        z: uprightPos.z + (groundZ - uprightPos.z) * easeOut,
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
      const prevColor = i === 0 ? f.color : (formations[i - 1].endColor || formations[i - 1].color);
      const targetColor = f.color;
      const endColor = f.endColor || f.color;
      const colorMode: ColorTransitionMode = f.colorTransition || 'linear';

      if (currentTime < transEnd) {
        const t = (currentTime - f.startTime) / f.transitionDuration;
        const smoothT = t < 0.5
          ? 16 * t * t * t * t * t
          : 1 - Math.pow(-2 * t + 2, 5) / 2;

        // Previous positions
        const prevPositions = i === 0
          ? f.points.slice(0, droneCount).map((_, idx) => {
              const cols = Math.ceil(Math.sqrt(droneCount));
              const row = Math.floor(idx / cols);
              const col = idx % cols;
              const spacing = 2.5;
              return { x: (col - (cols - 1) / 2) * spacing, y: 0.1, z: (row - (Math.ceil(droneCount / cols) - 1) / 2) * spacing };
            })
          : formations[i - 1].points.slice(0, droneCount).map(p => toUpright(p, formations[i - 1].height));

        return f.points.slice(0, droneCount).map((p, idx) => {
          const target = toUpright(p, f.height);
          const prev = prevPositions[idx] || { x: 0, y: 0, z: 0 };
          
          // Staggered launch for first formation
          const distFromCenter = Math.sqrt(p.x * p.x + p.z * p.z);
          const maxDist = Math.sqrt(f.radius * f.radius * 2) || 30;
          const staggerDelay = i === 0 ? (distFromCenter / maxDist) * 0.15 : 0;
          const staggeredT = Math.max(0, Math.min(1, (t - staggerDelay) / (1 - staggerDelay)));
          const effT = i === 0 ? (staggeredT < 0.5 ? 16 * staggeredT ** 5 : 1 - Math.pow(-2 * staggeredT + 2, 5) / 2) : smoothT;

          const arcHeight = i === 0 ? Math.sin(effT * Math.PI) * 5 : Math.sin(smoothT * Math.PI) * 3;
          const droneColor = interpolateColor(prevColor, targetColor, effT, colorMode, idx, droneCount);
          
          return {
            x: prev.x + (target.x - prev.x) * effT,
            y: prev.y + (target.y - prev.y) * effT + arcHeight,
            z: prev.z + (target.z - prev.z) * effT,
            color: droneColor,
          };
        });
      }

      // During hold: color transition
      if (endColor !== targetColor) {
        const holdT = (currentTime - transEnd) / f.holdDuration;
        return f.points.slice(0, droneCount).map((p, idx) => {
          const pos = toUpright(p, f.height);
          return {
            ...pos,
            color: interpolateColor(targetColor, endColor, holdT, colorMode, idx, droneCount),
          };
        });
      }

      // Static hold
      return f.points.slice(0, droneCount).map((p) => {
        const pos = toUpright(p, f.height);
        return { ...pos, color: targetColor };
      });
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
      <LightTrails dronePositions={positions} intensity={0.4} />
      <TransitionParticles />
    </>
  );
}

export { computeDronePositions };
