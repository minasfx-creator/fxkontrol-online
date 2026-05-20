/**
 * sparkChildEmitter — pure helper for emitting secondary sparks from
 * primary particles late in their life. Zero-GC: writes into preallocated
 * pools (consumer-provided SoA arrays). Stateless apart from the cursor.
 *
 * Integration target: BurstSimulation.tick() should call emitSparks() each
 * substep using the burst's child pool. We keep this isolated so it stays
 * unit-testable without three.js.
 */

export interface SparkPool {
  /** Current count of live sparks. */
  count: number;
  /** Max capacity. */
  capacity: number;
  posX: Float32Array;
  posY: Float32Array;
  posZ: Float32Array;
  velX: Float32Array;
  velY: Float32Array;
  velZ: Float32Array;
  life: Float32Array;        // remaining lifetime in seconds
  maxLife: Float32Array;     // initial lifetime
  /** Optional color slot (linear RGB packed contiguously). */
  colorR?: Float32Array;
  colorG?: Float32Array;
  colorB?: Float32Array;
}

export function createSparkPool(capacity: number): SparkPool {
  return {
    count: 0,
    capacity,
    posX: new Float32Array(capacity),
    posY: new Float32Array(capacity),
    posZ: new Float32Array(capacity),
    velX: new Float32Array(capacity),
    velY: new Float32Array(capacity),
    velZ: new Float32Array(capacity),
    life: new Float32Array(capacity),
    maxLife: new Float32Array(capacity),
    colorR: new Float32Array(capacity),
    colorG: new Float32Array(capacity),
    colorB: new Float32Array(capacity),
  };
}

export interface EmitOptions {
  /** Parent position. */
  px: number; py: number; pz: number;
  /** Parent velocity (sparks inherit a fraction). */
  vx: number; vy: number; vz: number;
  /** How many child sparks to spawn (clamped to remaining capacity). */
  n: number;
  /** Optional parent linear-RGB tint to inherit. */
  r?: number; g?: number; b?: number;
  /** Inherited velocity fraction in [0..1]. Default 0.35. */
  inheritFrac?: number;
  /** Random isotropic scatter speed (m/s). Default 1.4. */
  scatterSpeed?: number;
  /** Lifetime in seconds. Default 0.22 (≈220 ms). */
  lifetimeSec?: number;
  /** PRNG hook (testable). Default Math.random. */
  rng?: () => number;
}

/**
 * Emit up to `n` sparks. Returns the number actually spawned.
 * Will not exceed `pool.capacity`.
 */
export function emitSparks(pool: SparkPool, opts: EmitOptions): number {
  const rng = opts.rng ?? Math.random;
  const inh = opts.inheritFrac ?? 0.35;
  const sp = opts.scatterSpeed ?? 1.4;
  const life = opts.lifetimeSec ?? 0.22;
  const slots = Math.min(opts.n | 0, pool.capacity - pool.count);
  if (slots <= 0) return 0;

  for (let k = 0; k < slots; k++) {
    const i = pool.count++;
    // isotropic scatter (cheap pseudo-spherical)
    const phi = rng() * Math.PI * 2;
    const cosT = 1 - 2 * rng();
    const sinT = Math.sqrt(Math.max(0, 1 - cosT * cosT));
    const dx = sinT * Math.cos(phi);
    const dy = sinT * Math.sin(phi);
    const dz = cosT;

    pool.posX[i] = opts.px;
    pool.posY[i] = opts.py;
    pool.posZ[i] = opts.pz;
    pool.velX[i] = opts.vx * inh + dx * sp;
    pool.velY[i] = opts.vy * inh + dy * sp;
    pool.velZ[i] = opts.vz * inh + dz * sp;
    const jitter = 0.85 + rng() * 0.30;
    pool.life[i] = life * jitter;
    pool.maxLife[i] = life * jitter;
    if (pool.colorR && pool.colorG && pool.colorB) {
      pool.colorR[i] = opts.r ?? 1;
      pool.colorG[i] = opts.g ?? 0.7;
      pool.colorB[i] = opts.b ?? 0.35;
    }
  }
  return slots;
}

/**
 * Advance sparks by dt: integrates simple gravity+drag, decays life,
 * compacts the pool in place (swap-with-last on death). Zero allocations.
 */
export function stepSparks(pool: SparkPool, dt: number, gravity = -9.81, dragPerSec = 1.2): void {
  if (pool.count === 0 || dt <= 0) return;
  const damp = Math.exp(-dragPerSec * dt);
  let i = 0;
  while (i < pool.count) {
    pool.life[i] -= dt;
    if (pool.life[i] <= 0) {
      const last = --pool.count;
      if (i !== last) {
        pool.posX[i] = pool.posX[last]; pool.posY[i] = pool.posY[last]; pool.posZ[i] = pool.posZ[last];
        pool.velX[i] = pool.velX[last]; pool.velY[i] = pool.velY[last]; pool.velZ[i] = pool.velZ[last];
        pool.life[i] = pool.life[last]; pool.maxLife[i] = pool.maxLife[last];
        if (pool.colorR && pool.colorG && pool.colorB) {
          pool.colorR[i] = pool.colorR[last];
          pool.colorG[i] = pool.colorG[last];
          pool.colorB[i] = pool.colorB[last];
        }
      }
      continue;
    }
    pool.velY[i] += gravity * dt;
    pool.velX[i] *= damp;
    pool.velY[i] *= damp;
    pool.velZ[i] *= damp;
    pool.posX[i] += pool.velX[i] * dt;
    pool.posY[i] += pool.velY[i] * dt;
    pool.posZ[i] += pool.velZ[i] * dt;
    i++;
  }
}
