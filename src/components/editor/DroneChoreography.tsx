import { useMemo } from 'react';
import { useProjectStore, type DroneFormation } from '@/store/useProjectStore';
import QuadcopterModel from './QuadcopterModel';

/**
 * Computes drone positions at a given time based on the formation sequence.
 * All formations reuse the same drone fleet (from formation #1).
 * Between formations, drones interpolate with smoothstep.
 */
function computeDronePositions(
  formations: DroneFormation[],
  currentTime: number,
): { x: number; y: number; z: number; color: string }[] | null {
  if (formations.length === 0) return null;

  const droneCount = formations[0].droneCount;

  // Find which formation phase we're in
  // Before first formation: drones on ground at formation 1 positions
  // During transition: interpolate from previous to current
  // During hold: at current formation positions
  // After all formations: drones descend back to ground

  const firstStart = formations[0].startTime;
  const lastFormation = formations[formations.length - 1];
  const lastEnd = lastFormation.startTime + lastFormation.transitionDuration + lastFormation.holdDuration;
  const landingDuration = 10; // seconds to land

  // Before any formation starts: on ground
  if (currentTime < firstStart) {
    return formations[0].points.slice(0, droneCount).map((p) => ({
      x: p.x, y: 0.1, z: p.z, color: formations[0].color,
    }));
  }

  // After all formations + landing
  if (currentTime > lastEnd + landingDuration) {
    return null; // drones landed, not visible
  }

  // Landing phase
  if (currentTime > lastEnd) {
    const t = (currentTime - lastEnd) / landingDuration;
    const smoothT = t * t * (3 - 2 * t);
    return lastFormation.points.slice(0, droneCount).map((p) => ({
      x: p.x,
      y: lastFormation.height * (1 - smoothT),
      z: p.z,
      color: lastFormation.color,
    }));
  }

  // Find active formation
  for (let i = 0; i < formations.length; i++) {
    const f = formations[i];
    const transEnd = f.startTime + f.transitionDuration;
    const holdEnd = transEnd + f.holdDuration;

    if (currentTime >= f.startTime && currentTime <= holdEnd) {
      // During transition
      if (currentTime < transEnd) {
        const t = (currentTime - f.startTime) / f.transitionDuration;
        const smoothT = t * t * (3 - 2 * t);

        // Previous positions
        const prevPositions = i === 0
          ? f.points.slice(0, droneCount).map(p => ({ x: p.x, y: 0.1, z: p.z }))
          : formations[i - 1].points.slice(0, droneCount).map(p => ({
            x: p.x, y: formations[i - 1].height, z: p.z,
          }));

        return f.points.slice(0, droneCount).map((p, idx) => {
          const prev = prevPositions[idx] || { x: 0, y: 0, z: 0 };
          return {
            x: prev.x + (p.x - prev.x) * smoothT,
            y: prev.y + (f.height - prev.y) * smoothT,
            z: prev.z + (p.z - prev.z) * smoothT,
            color: f.color,
          };
        });
      }

      // During hold
      return f.points.slice(0, droneCount).map((p) => ({
        x: p.x, y: f.height, z: p.z, color: f.color,
      }));
    }
  }

  return null;
}

export default function DroneChoreography() {
  const { droneFormations, currentTime } = useProjectStore();

  const positions = useMemo(
    () => computeDronePositions(droneFormations, currentTime),
    [droneFormations, currentTime]
  );

  if (!positions) return null;

  return (
    <>
      {positions.map((pos, i) => (
        <QuadcopterModel
          key={`choreo-drone-${i}`}
          position={[pos.x, pos.y, pos.z]}
          color={pos.color}
          scale={0.6}
        />
      ))}
    </>
  );
}

// Export for use in export engine
export { computeDronePositions };
