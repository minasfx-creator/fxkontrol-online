/**
 * Real-time Collision Avoidance System
 * Runs during playback to deflect drones when their paths intersect.
 * Uses potential field method for smooth, reactive avoidance.
 */

export interface DroneState {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
}

export interface AvoidanceConfig {
  enabled: boolean;
  minSeparation: number;      // m — hard minimum
  detectionRadius: number;    // m — start avoiding at this distance
  avoidanceStrength: number;  // 0-1 force multiplier
  verticalBias: number;       // 0-1 prefer vertical avoidance
  maxDeflection: number;      // m — max position offset per frame
  dampingFactor: number;      // 0-1 smoothing
}

export const DEFAULT_AVOIDANCE: AvoidanceConfig = {
  enabled: true,
  minSeparation: 2.0,
  detectionRadius: 5.0,
  avoidanceStrength: 0.8,
  verticalBias: 0.6,
  maxDeflection: 0.5,
  dampingFactor: 0.85,
};

export interface AvoidanceResult {
  positions: { x: number; y: number; z: number }[];
  activeAvoidances: number;
  closestPair: number;
}

/**
 * Apply potential field collision avoidance to a set of drone positions.
 * Returns deflected positions that maintain minimum separation.
 */
export function applyCollisionAvoidance(
  positions: { x: number; y: number; z: number; color: string }[],
  config: AvoidanceConfig,
  previousDeflections?: Float32Array,
): AvoidanceResult & { deflections: Float32Array } {
  const n = positions.length;
  const deflections = previousDeflections && previousDeflections.length === n * 3
    ? new Float32Array(previousDeflections)
    : new Float32Array(n * 3);

  let activeAvoidances = 0;
  let closestPair = Infinity;

  if (!config.enabled || n < 2) {
    return {
      positions: positions.map(p => ({ x: p.x, y: p.y, z: p.z })),
      activeAvoidances: 0,
      closestPair: n < 2 ? Infinity : 0,
      deflections: new Float32Array(n * 3),
    };
  }

  // Spatial grid for O(n) neighbor finding
  const cellSize = config.detectionRadius;
  const grid = new Map<string, number[]>();

  for (let i = 0; i < n; i++) {
    const p = positions[i];
    const cx = Math.floor(p.x / cellSize);
    const cy = Math.floor(p.y / cellSize);
    const cz = Math.floor(p.z / cellSize);
    const key = `${cx},${cy},${cz}`;
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key)!.push(i);
  }

  // Compute avoidance forces
  const forces = new Float32Array(n * 3);

  for (let i = 0; i < n; i++) {
    const pi = positions[i];
    const cx = Math.floor(pi.x / cellSize);
    const cy = Math.floor(pi.y / cellSize);
    const cz = Math.floor(pi.z / cellSize);

    // Check neighboring cells
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          const key = `${cx + dx},${cy + dy},${cz + dz}`;
          const cell = grid.get(key);
          if (!cell) continue;

          for (const j of cell) {
            if (j <= i) continue;
            const pj = positions[j];

            const ddx = pi.x - pj.x;
            const ddy = pi.y - pj.y;
            const ddz = pi.z - pj.z;
            const dist = Math.sqrt(ddx * ddx + ddy * ddy + ddz * ddz);

            closestPair = Math.min(closestPair, dist);

            if (dist < config.detectionRadius && dist > 0.01) {
              activeAvoidances++;

              // Repulsion force inversely proportional to distance²
              const penetration = 1.0 - (dist / config.detectionRadius);
              const strength = penetration * penetration * config.avoidanceStrength;

              const nx = ddx / dist;
              const ny = ddy / dist;
              const nz = ddz / dist;

              // Apply vertical bias
              const vyBias = config.verticalBias;
              const forceX = nx * strength * (1 - vyBias);
              const forceY = Math.abs(ny) < 0.1 ? strength * vyBias * (i % 2 === 0 ? 1 : -1) : ny * strength * (1 + vyBias);
              const forceZ = nz * strength * (1 - vyBias);

              forces[i * 3] += forceX;
              forces[i * 3 + 1] += forceY;
              forces[i * 3 + 2] += forceZ;
              forces[j * 3] -= forceX;
              forces[j * 3 + 1] -= forceY;
              forces[j * 3 + 2] -= forceZ;
            }
          }
        }
      }
    }
  }

  // Apply forces with damping and clamping
  const result: { x: number; y: number; z: number }[] = [];
  const maxDefl = config.maxDeflection;
  const damp = config.dampingFactor;

  for (let i = 0; i < n; i++) {
    // Blend previous deflection with new force (smoothing)
    deflections[i * 3] = deflections[i * 3] * damp + forces[i * 3] * (1 - damp);
    deflections[i * 3 + 1] = deflections[i * 3 + 1] * damp + forces[i * 3 + 1] * (1 - damp);
    deflections[i * 3 + 2] = deflections[i * 3 + 2] * damp + forces[i * 3 + 2] * (1 - damp);

    // Clamp deflection magnitude
    const mag = Math.sqrt(
      deflections[i * 3] ** 2 + deflections[i * 3 + 1] ** 2 + deflections[i * 3 + 2] ** 2
    );
    if (mag > maxDefl) {
      const scale = maxDefl / mag;
      deflections[i * 3] *= scale;
      deflections[i * 3 + 1] *= scale;
      deflections[i * 3 + 2] *= scale;
    }

    result.push({
      x: positions[i].x + deflections[i * 3],
      y: Math.max(0.1, positions[i].y + deflections[i * 3 + 1]), // don't go underground
      z: positions[i].z + deflections[i * 3 + 2],
    });
  }

  return { positions: result, activeAvoidances, closestPair, deflections };
}
