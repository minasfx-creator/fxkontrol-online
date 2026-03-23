import { useMemo } from 'react';
import { useProjectStore, type DroneFormation } from '@/store/useProjectStore';
import { interpolateColor, type ColorTransitionMode } from '@/lib/colorInterpolation';
import InstancedDroneSwarm from './InstancedDroneSwarm';
import TransitionParticles from './TransitionParticles';
import LightTrails from './LightTrails';

// Pre-allocated result array to avoid per-frame GC
let _positionsCache: { x: number; y: number; z: number; color: string }[] = [];

function ensurePositionsCacheSize(size: number) {
  if (_positionsCache.length < size) {
    _positionsCache = Array.from({ length: size }, () => ({ x: 0, y: 0, z: 0, color: '' }));
  }
}

/**
 * Computes drone positions at a given time based on the formation sequence.
 * IMPORTANT: Formations are generated as 2D (x, z) points.
 * For aerial display, we map them UPRIGHT:
 *   formation.x → world X (horizontal spread)
 *   formation.z → world Y offset (vertical shape, added to base height)
 *   world Z = 0 (facing audience)
 * 
 * Zero-GC: reuses _positionsCache to avoid creating new arrays every frame.
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

  if (currentTime < firstStart) return null;
  if (currentTime > lastEnd + landingDuration) return null;

  ensurePositionsCacheSize(droneCount);

  // Landing phase
  if (currentTime > lastEnd) {
    const t = (currentTime - lastEnd) / landingDuration;
    const easeOut = 1 - (1 - t) * (1 - t);
    const holdColor = lastFormation.endColor || lastFormation.color;
    const cols = Math.ceil(Math.sqrt(droneCount));
    const rows = Math.ceil(droneCount / cols);
    const spacing = 2.5;

    for (let idx = 0; idx < droneCount; idx++) {
      const p = lastFormation.points[idx];
      if (!p) continue;
      const uprightX = p.x;
      const uprightY = lastFormation.height + p.z;
      const uprightZ = 0;

      const row = Math.floor(idx / cols);
      const col = idx % cols;
      const groundX = (col - (cols - 1) / 2) * spacing;
      const groundZ = (row - (rows - 1) / 2) * spacing;
      const landColor = interpolateColor(holdColor, '#111111', t, 'linear', idx, droneCount);

      const out = _positionsCache[idx];
      out.x = uprightX + (groundX - uprightX) * easeOut;
      out.y = uprightY * (1 - easeOut);
      out.z = uprightZ + (groundZ - uprightZ) * easeOut;
      out.color = landColor;
    }
    return _positionsCache.slice(0, droneCount);
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

        const cols = Math.ceil(Math.sqrt(droneCount));
        const rows = Math.ceil(droneCount / cols);
        const spacing = 2.5;

        for (let idx = 0; idx < droneCount; idx++) {
          const p = f.points[idx];
          if (!p) continue;
          const targetX = p.x;
          const targetY = f.height + p.z;
          const targetZ = 0;

          let prevX: number, prevY: number, prevZ: number;
          if (i === 0) {
            const row = Math.floor(idx / cols);
            const col = idx % cols;
            prevX = (col - (cols - 1) / 2) * spacing;
            prevY = 0.1;
            prevZ = (row - (rows - 1) / 2) * spacing;
          } else {
            const pp = formations[i - 1].points[idx];
            if (pp) {
              prevX = pp.x;
              prevY = formations[i - 1].height + pp.z;
              prevZ = 0;
            } else {
              prevX = 0; prevY = 0; prevZ = 0;
            }
          }

          const distFromCenter = Math.sqrt(p.x * p.x + p.z * p.z);
          const maxDist = Math.sqrt(f.radius * f.radius * 2) || 30;
          const staggerDelay = i === 0 ? (distFromCenter / maxDist) * 0.15 : 0;
          const staggeredT = Math.max(0, Math.min(1, (t - staggerDelay) / (1 - staggerDelay)));
          const effT = i === 0 ? (staggeredT < 0.5 ? 16 * staggeredT ** 5 : 1 - Math.pow(-2 * staggeredT + 2, 5) / 2) : smoothT;

          const arcHeight = i === 0 ? Math.sin(effT * Math.PI) * 5 : Math.sin(smoothT * Math.PI) * 3;
          const droneColor = interpolateColor(prevColor, targetColor, effT, colorMode, idx, droneCount);

          const out = _positionsCache[idx];
          out.x = prevX + (targetX - prevX) * effT;
          out.y = prevY + (targetY - prevY) * effT + arcHeight;
          out.z = prevZ + (targetZ - prevZ) * effT;
          out.color = droneColor;
        }
        return _positionsCache.slice(0, droneCount);
      }

      // During hold: color transition
      if (endColor !== targetColor) {
        const holdT = (currentTime - transEnd) / f.holdDuration;
        for (let idx = 0; idx < droneCount; idx++) {
          const p = f.points[idx];
          if (!p) continue;
          const out = _positionsCache[idx];
          out.x = p.x;
          out.y = f.height + p.z;
          out.z = 0;
          out.color = interpolateColor(targetColor, endColor, holdT, colorMode, idx, droneCount);
        }
        return _positionsCache.slice(0, droneCount);
      }

      // Static hold
      for (let idx = 0; idx < droneCount; idx++) {
        const p = f.points[idx];
        if (!p) continue;
        const out = _positionsCache[idx];
        out.x = p.x;
        out.y = f.height + p.z;
        out.z = 0;
        out.color = targetColor;
      }
      return _positionsCache.slice(0, droneCount);
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
