/**
 * Boids Engine — Bio-inspired swarm behavior for drone formations.
 * Implements three core rules: Separation, Alignment, Cohesion.
 * Plus optional: obstacle avoidance, target seeking, and boundary containment.
 */

export interface BoidAgent {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
}

export interface BoidsConfig {
  separationWeight: number;   // Repulsion strength (default: 1.5)
  alignmentWeight: number;    // Velocity matching (default: 1.0)
  cohesionWeight: number;     // Group centering (default: 1.0)
  separationRadius: number;   // Min distance before repulsion (default: 3.0m)
  neighborRadius: number;     // Perception radius (default: 10.0m)
  maxSpeed: number;           // Max velocity m/s (default: 5.0)
  maxForce: number;           // Max steering force (default: 0.5)
  boundaryRadius: number;     // Containment sphere radius (default: 40m)
  boundaryHeight: number;     // Max height (default: 50m)
  targetWeight: number;       // Target seeking weight (default: 0.5)
}

export const DEFAULT_BOIDS_CONFIG: BoidsConfig = {
  separationWeight: 1.5,
  alignmentWeight: 1.0,
  cohesionWeight: 1.0,
  separationRadius: 3.0,
  neighborRadius: 10.0,
  maxSpeed: 5.0,
  maxForce: 0.5,
  boundaryRadius: 40,
  boundaryHeight: 50,
  targetWeight: 0.5,
};

function clampVec(vx: number, vy: number, vz: number, max: number): [number, number, number] {
  const mag = Math.sqrt(vx * vx + vy * vy + vz * vz);
  if (mag > max && mag > 0) {
    const s = max / mag;
    return [vx * s, vy * s, vz * s];
  }
  return [vx, vy, vz];
}

function distSq(a: BoidAgent, b: BoidAgent): number {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2;
}

/**
 * Initialize agents at positions with zero velocity.
 */
export function initBoids(
  positions: { x: number; y: number; z: number }[],
): BoidAgent[] {
  return positions.map(p => ({
    x: p.x, y: p.y, z: p.z,
    vx: 0, vy: 0, vz: 0,
  }));
}

/**
 * Step the boids simulation forward by `dt` seconds.
 * Optionally provide target positions for each agent (formation seeking).
 */
export function stepBoids(
  agents: BoidAgent[],
  dt: number,
  config: BoidsConfig,
  targets?: { x: number; y: number; z: number }[],
): BoidAgent[] {
  const n = agents.length;
  if (n === 0) return [];

  const sepRadSq = config.separationRadius * config.separationRadius;
  const nbrRadSq = config.neighborRadius * config.neighborRadius;

  return agents.map((agent, i) => {
    // Accumulate forces
    let sepX = 0, sepY = 0, sepZ = 0, sepCount = 0;
    let aliX = 0, aliY = 0, aliZ = 0, aliCount = 0;
    let cohX = 0, cohY = 0, cohZ = 0, cohCount = 0;

    for (let j = 0; j < n; j++) {
      if (j === i) continue;
      const dSq = distSq(agent, agents[j]);

      // Separation
      if (dSq < sepRadSq && dSq > 0.001) {
        const d = Math.sqrt(dSq);
        const strength = 1 - d / config.separationRadius;
        sepX += (agent.x - agents[j].x) / d * strength;
        sepY += (agent.y - agents[j].y) / d * strength;
        sepZ += (agent.z - agents[j].z) / d * strength;
        sepCount++;
      }

      // Alignment + Cohesion (within neighbor radius)
      if (dSq < nbrRadSq) {
        aliX += agents[j].vx;
        aliY += agents[j].vy;
        aliZ += agents[j].vz;
        aliCount++;

        cohX += agents[j].x;
        cohY += agents[j].y;
        cohZ += agents[j].z;
        cohCount++;
      }
    }

    let fx = 0, fy = 0, fz = 0;

    // Separation force
    if (sepCount > 0) {
      fx += (sepX / sepCount) * config.separationWeight;
      fy += (sepY / sepCount) * config.separationWeight;
      fz += (sepZ / sepCount) * config.separationWeight;
    }

    // Alignment force
    if (aliCount > 0) {
      const avgVx = aliX / aliCount;
      const avgVy = aliY / aliCount;
      const avgVz = aliZ / aliCount;
      fx += (avgVx - agent.vx) * config.alignmentWeight * 0.1;
      fy += (avgVy - agent.vy) * config.alignmentWeight * 0.1;
      fz += (avgVz - agent.vz) * config.alignmentWeight * 0.1;
    }

    // Cohesion force
    if (cohCount > 0) {
      const centerX = cohX / cohCount;
      const centerY = cohY / cohCount;
      const centerZ = cohZ / cohCount;
      fx += (centerX - agent.x) * config.cohesionWeight * 0.01;
      fy += (centerY - agent.y) * config.cohesionWeight * 0.01;
      fz += (centerZ - agent.z) * config.cohesionWeight * 0.01;
    }

    // Target seeking
    if (targets && targets[i]) {
      const t = targets[i];
      const dx = t.x - agent.x;
      const dy = t.y - agent.y;
      const dz = t.z - agent.z;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d > 0.1) {
        fx += (dx / d) * config.targetWeight;
        fy += (dy / d) * config.targetWeight;
        fz += (dz / d) * config.targetWeight;
      }
    }

    // Boundary containment (soft sphere + floor + ceiling)
    const distFromCenter = Math.sqrt(agent.x * agent.x + agent.z * agent.z);
    if (distFromCenter > config.boundaryRadius * 0.9) {
      const push = (distFromCenter - config.boundaryRadius * 0.9) / (config.boundaryRadius * 0.1);
      fx -= (agent.x / distFromCenter) * push * 2;
      fz -= (agent.z / distFromCenter) * push * 2;
    }
    if (agent.y < 1) fy += (1 - agent.y) * 3;
    if (agent.y > config.boundaryHeight * 0.95) {
      fy -= (agent.y - config.boundaryHeight * 0.95) / (config.boundaryHeight * 0.05) * 2;
    }

    // Clamp force
    const [cfx, cfy, cfz] = clampVec(fx, fy, fz, config.maxForce);

    // Integrate velocity
    let nvx = agent.vx + cfx * dt;
    let nvy = agent.vy + cfy * dt;
    let nvz = agent.vz + cfz * dt;
    [nvx, nvy, nvz] = clampVec(nvx, nvy, nvz, config.maxSpeed);

    // Integrate position
    return {
      x: agent.x + nvx * dt,
      y: Math.max(0.1, agent.y + nvy * dt),
      z: agent.z + nvz * dt,
      vx: nvx,
      vy: nvy,
      vz: nvz,
    };
  });
}

/**
 * Compute the minimum distance between any two agents.
 */
export function minPairDistance(agents: BoidAgent[]): number {
  let min = Infinity;
  for (let i = 0; i < agents.length; i++) {
    for (let j = i + 1; j < agents.length; j++) {
      const d = Math.sqrt(distSq(agents[i], agents[j]));
      if (d < min) min = d;
    }
  }
  return min;
}
