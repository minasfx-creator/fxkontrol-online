/**
 * ─── ParticleStateModel ─────────────────────────────────────────────
 * Struct-of-Arrays (SoA) particle pool for zero-GC simulation.
 * Pre-allocates flat typed arrays — no per-frame object creation.
 */

export type DecayCurveType = 0 | 1 | 2; // 0=exponential, 1=linear, 2=hybrid

export interface ParticlePool {
  maxCount: number;
  activeCount: number;

  // Position (meters)
  posX: Float32Array;
  posY: Float32Array;
  posZ: Float32Array;

  // Velocity (m/s)
  velX: Float32Array;
  velY: Float32Array;
  velZ: Float32Array;

  // Physical properties
  mass: Float32Array;           // kg
  dragCoefficient: Float32Array;
  turbulenceFactor: Float32Array;

  // Thermal / combustion
  temperature: Float32Array;    // Kelvin
  brightness: Float32Array;     // 0-1 normalized
  fuelMass: Float32Array;       // kg remaining
  fuelInitial: Float32Array;    // kg at spawn
  burnRate: Float32Array;       // kg/s

  // Lifecycle
  lifetime: Float32Array;       // seconds remaining
  age: Float32Array;            // seconds since spawn
  decayCurve: Uint8Array;       // DecayCurveType

  // State flags
  alive: Uint8Array;            // 0 or 1

  // Color (emission base from chemistry)
  colorR: Float32Array;
  colorG: Float32Array;
  colorB: Float32Array;
}

/**
 * Create a pre-allocated particle pool.
 */
export function createParticlePool(maxCount: number): ParticlePool {
  return {
    maxCount,
    activeCount: 0,
    posX: new Float32Array(maxCount),
    posY: new Float32Array(maxCount),
    posZ: new Float32Array(maxCount),
    velX: new Float32Array(maxCount),
    velY: new Float32Array(maxCount),
    velZ: new Float32Array(maxCount),
    mass: new Float32Array(maxCount),
    dragCoefficient: new Float32Array(maxCount),
    turbulenceFactor: new Float32Array(maxCount),
    temperature: new Float32Array(maxCount),
    brightness: new Float32Array(maxCount),
    fuelMass: new Float32Array(maxCount),
    fuelInitial: new Float32Array(maxCount),
    burnRate: new Float32Array(maxCount),
    lifetime: new Float32Array(maxCount),
    age: new Float32Array(maxCount),
    decayCurve: new Uint8Array(maxCount),
    alive: new Uint8Array(maxCount),
    colorR: new Float32Array(maxCount),
    colorG: new Float32Array(maxCount),
    colorB: new Float32Array(maxCount),
  };
}

/**
 * Allocate a particle from the pool. Returns index or -1 if full.
 */
export function allocateParticle(pool: ParticlePool): number {
  if (pool.activeCount >= pool.maxCount) return -1;
  const idx = pool.activeCount;
  pool.activeCount++;
  pool.alive[idx] = 1;
  pool.age[idx] = 0;
  return idx;
}

/**
 * Compact the pool by removing dead particles (swap-and-pop).
 */
export function compactPool(pool: ParticlePool): void {
  let write = 0;
  for (let read = 0; read < pool.activeCount; read++) {
    if (pool.alive[read] === 0) continue;
    if (write !== read) {
      // Swap all arrays
      pool.posX[write] = pool.posX[read];
      pool.posY[write] = pool.posY[read];
      pool.posZ[write] = pool.posZ[read];
      pool.velX[write] = pool.velX[read];
      pool.velY[write] = pool.velY[read];
      pool.velZ[write] = pool.velZ[read];
      pool.mass[write] = pool.mass[read];
      pool.dragCoefficient[write] = pool.dragCoefficient[read];
      pool.turbulenceFactor[write] = pool.turbulenceFactor[read];
      pool.temperature[write] = pool.temperature[read];
      pool.brightness[write] = pool.brightness[read];
      pool.fuelMass[write] = pool.fuelMass[read];
      pool.fuelInitial[write] = pool.fuelInitial[read];
      pool.burnRate[write] = pool.burnRate[read];
      pool.lifetime[write] = pool.lifetime[read];
      pool.age[write] = pool.age[read];
      pool.decayCurve[write] = pool.decayCurve[read];
      pool.alive[write] = pool.alive[read];
      pool.colorR[write] = pool.colorR[read];
      pool.colorG[write] = pool.colorG[read];
      pool.colorB[write] = pool.colorB[read];
    }
    write++;
  }
  pool.activeCount = write;
}

/**
 * Reset the entire pool.
 */
export function resetPool(pool: ParticlePool): void {
  pool.activeCount = 0;
  pool.alive.fill(0);
}
