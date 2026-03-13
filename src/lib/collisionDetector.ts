/**
 * Advanced Drone Formation Collision Detection Engine
 * Checks inter-drone distances within and between formations during transitions
 */

import type { DroneFormation } from '@/store/useProjectStore';

export interface FormationCollision {
  severity: 'warning' | 'critical';
  formationAId: string;
  formationBId?: string;
  droneIndexA: number;
  droneIndexB: number;
  distance: number;
  time: number;
  message: string;
}

export interface CollisionSummary {
  totalCollisions: number;
  criticalCount: number;
  warningCount: number;
  worstDistance: number;
  worstTime: number;
  collisions: FormationCollision[];
  minDistanceOverTime: { time: number; minDist: number }[];
}

const MIN_SAFE_DISTANCE = 1.5; // meters
const CRITICAL_DISTANCE = 0.8; // meters

/**
 * Interpolate drone positions between two formations
 */
function interpolateFormations(
  fromPts: { x: number; z: number }[],
  toPts: { x: number; z: number }[],
  t: number, // 0-1
  fromHeight: number,
  toHeight: number,
): { x: number; y: number; z: number }[] {
  const count = Math.min(fromPts.length, toPts.length);
  const result: { x: number; y: number; z: number }[] = [];
  const s = t * t * (3 - 2 * t); // smoothstep

  for (let i = 0; i < count; i++) {
    result.push({
      x: fromPts[i].x + (toPts[i].x - fromPts[i].x) * s,
      y: fromHeight + (toHeight - fromHeight) * s,
      z: fromPts[i].z + (toPts[i].z - fromPts[i].z) * s,
    });
  }
  return result;
}

/**
 * Check minimum distance between all drone pairs at a given set of positions
 */
function checkMinDistance(positions: { x: number; y: number; z: number }[]): { minDist: number; idxA: number; idxB: number } {
  let minDist = Infinity;
  let idxA = -1, idxB = -1;

  // Use spatial grid for O(n) average case instead of O(n²)
  const cellSize = MIN_SAFE_DISTANCE * 2;
  const grid = new Map<string, number[]>();

  for (let i = 0; i < positions.length; i++) {
    const cx = Math.floor(positions[i].x / cellSize);
    const cy = Math.floor(positions[i].y / cellSize);
    const cz = Math.floor(positions[i].z / cellSize);

    // Check neighboring cells
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          const key = `${cx + dx},${cy + dy},${cz + dz}`;
          const cell = grid.get(key);
          if (!cell) continue;
          for (const j of cell) {
            const a = positions[i], b = positions[j];
            const dist = Math.sqrt(
              (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2
            );
            if (dist < minDist) {
              minDist = dist;
              idxA = j;
              idxB = i;
            }
          }
        }
      }
    }

    // Add to grid
    const key = `${cx},${cy},${cz}`;
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key)!.push(i);
  }

  return { minDist, idxA, idxB };
}

/**
 * Run full collision analysis across all formations and transitions
 */
export function analyzeFormationCollisions(
  formations: DroneFormation[],
  sampleRate: number = 0.5,
): CollisionSummary {
  const collisions: FormationCollision[] = [];
  const minDistanceOverTime: { time: number; minDist: number }[] = [];
  const sorted = [...formations].sort((a, b) => a.startTime - b.startTime);

  for (let fi = 0; fi < sorted.length; fi++) {
    const f = sorted[fi];
    const nextF = sorted[fi + 1];

    // Check hold phase (static formation)
    const holdStart = f.startTime + f.transitionDuration;
    const holdEnd = holdStart + f.holdDuration;

    // Static check for hold phase
    const staticPositions = f.points.map(p => ({ x: p.x, y: f.height, z: p.z }));
    const staticCheck = checkMinDistance(staticPositions);
    minDistanceOverTime.push({ time: holdStart, minDist: staticCheck.minDist });

    if (staticCheck.minDist < MIN_SAFE_DISTANCE) {
      collisions.push({
        severity: staticCheck.minDist < CRITICAL_DISTANCE ? 'critical' : 'warning',
        formationAId: f.id,
        droneIndexA: staticCheck.idxA,
        droneIndexB: staticCheck.idxB,
        distance: staticCheck.minDist,
        time: holdStart,
        message: `Drones #${staticCheck.idxA} ↔ #${staticCheck.idxB}: ${staticCheck.minDist.toFixed(2)}m (formação "${f.formationType}")`,
      });
    }

    // Check transition phase to next formation
    if (nextF) {
      const transStart = nextF.startTime;
      const transEnd = transStart + nextF.transitionDuration;
      const count = Math.min(f.points.length, nextF.points.length);

      for (let t = transStart; t <= transEnd; t += sampleRate) {
        const progress = (t - transStart) / nextF.transitionDuration;
        const positions = interpolateFormations(
          f.points.slice(0, count),
          nextF.points.slice(0, count),
          progress,
          f.height,
          nextF.height,
        );

        const check = checkMinDistance(positions);
        minDistanceOverTime.push({ time: t, minDist: check.minDist });

        if (check.minDist < MIN_SAFE_DISTANCE) {
          collisions.push({
            severity: check.minDist < CRITICAL_DISTANCE ? 'critical' : 'warning',
            formationAId: f.id,
            formationBId: nextF.id,
            droneIndexA: check.idxA,
            droneIndexB: check.idxB,
            distance: check.minDist,
            time: t,
            message: `Transição: Drones #${check.idxA} ↔ #${check.idxB}: ${check.minDist.toFixed(2)}m at t=${t.toFixed(1)}s`,
          });
        }
      }
    }
  }

  // Deduplicate close-in-time collisions
  const deduped: FormationCollision[] = [];
  for (const c of collisions) {
    const existing = deduped.find(d =>
      d.droneIndexA === c.droneIndexA && d.droneIndexB === c.droneIndexB &&
      Math.abs(d.time - c.time) < 1.0
    );
    if (!existing || c.distance < existing.distance) {
      if (existing) deduped.splice(deduped.indexOf(existing), 1);
      deduped.push(c);
    }
  }

  const sorted2 = deduped.sort((a, b) => a.time - b.time);
  const worst = sorted2.reduce((min, c) => c.distance < min.distance ? c : min, { distance: Infinity, time: 0 } as FormationCollision);

  return {
    totalCollisions: sorted2.length,
    criticalCount: sorted2.filter(c => c.severity === 'critical').length,
    warningCount: sorted2.filter(c => c.severity === 'warning').length,
    worstDistance: worst.distance === Infinity ? -1 : worst.distance,
    worstTime: worst.time,
    collisions: sorted2.slice(0, 50), // limit to 50
    minDistanceOverTime: minDistanceOverTime.sort((a, b) => a.time - b.time),
  };
}

/**
 * Quick check: just get minimum distance for current formation
 */
export function getFormationMinDistance(points: { x: number; z: number }[], height: number): number {
  const positions = points.map(p => ({ x: p.x, y: height, z: p.z }));
  return checkMinDistance(positions).minDist;
}
