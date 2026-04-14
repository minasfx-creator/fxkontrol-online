/**
 * ─── SmokeVolumeSystem ──────────────────────────────────────────────
 * Semi-volumetric smoke with density, buoyancy, wind advection,
 * cluster breakup, and dissipation.
 * 
 * Not a full fluid solver — uses particle-based puffs with
 * physically-motivated behavior for real-time performance.
 */

import type { WindFieldSystem } from './WindFieldSystem';

export interface SmokePuff {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  density: number;          // 0-1
  temperature: number;      // K (residual heat drives buoyancy)
  radius: number;           // meters
  age: number;              // seconds
  maxAge: number;           // seconds until fully dissipated
  initialEnergy: number;    // determines expansion rate
  alive: boolean;
}

const MAX_PUFFS = 512;
const BUOYANCY_FACTOR = 0.08;    // m/s² per 100K above ambient
const AMBIENT_TEMP = 293;        // ~20°C
const EXPANSION_RATE = 0.8;      // base expansion m/s
const DISSIPATION_BASE = 0.15;   // density loss per second (base)
const TEMP_DECAY_RATE = 50;      // K/s cooling
const CLUSTER_BREAK_AGE = 2.5;   // seconds before breakup
const CLUSTER_BREAK_CHANCE = 0.3;

// Wind sample output (zero-GC)
const _wSample: [number, number, number] = [0, 0, 0];

export class SmokeVolumeSystem {
  private puffs: SmokePuff[] = [];
  private pool: SmokePuff[] = [];

  /**
   * Spawn a smoke puff at burst location.
   */
  spawn(
    x: number, y: number, z: number,
    energy: number,
    initialTemp: number = 2000,
    density: number = 0.8,
  ): void {
    if (this.puffs.length >= MAX_PUFFS) {
      // Recycle oldest
      const oldest = this.puffs.reduce((a, b) => a.age > b.age ? a : b);
      oldest.alive = false;
    }

    const puff = this.pool.pop() ?? ({} as SmokePuff);
    puff.x = x;
    puff.y = y;
    puff.z = z;
    puff.vx = (Math.random() - 0.5) * 2;
    puff.vy = 1.5 + Math.random() * 2; // initial upward velocity
    puff.vz = (Math.random() - 0.5) * 2;
    puff.density = density;
    puff.temperature = initialTemp;
    puff.radius = 2 + energy * 0.5;
    puff.age = 0;
    puff.maxAge = 8 + energy * 2;
    puff.initialEnergy = energy;
    puff.alive = true;

    this.puffs.push(puff);
  }

  /**
   * Tick the smoke system.
   */
  update(dt: number, wind: WindFieldSystem | null, time: number): void {
    const toSpawn: SmokePuff[] = [];

    for (let i = this.puffs.length - 1; i >= 0; i--) {
      const p = this.puffs[i];
      if (!p.alive) {
        this.pool.push(p);
        this.puffs.splice(i, 1);
        continue;
      }

      p.age += dt;

      // ── Temperature decay ──
      p.temperature = Math.max(AMBIENT_TEMP, p.temperature - TEMP_DECAY_RATE * dt);

      // ── Buoyancy (hot smoke rises) ──
      const tempDelta = p.temperature - AMBIENT_TEMP;
      const buoyancy = (tempDelta / 100) * BUOYANCY_FACTOR;
      p.vy += buoyancy * dt;

      // ── Wind advection ──
      if (wind) {
        wind.sample(p.x, p.y, p.z, time, false, _wSample);
        // Smoke is lighter than particles → more affected by wind
        p.vx += (_wSample[0] - p.vx) * 0.3 * dt;
        p.vy += _wSample[1] * 0.1 * dt;
        p.vz += (_wSample[2] - p.vz) * 0.3 * dt;
      }

      // ── Natural drag on smoke movement ──
      p.vx *= (1 - 0.5 * dt);
      p.vy *= (1 - 0.3 * dt);
      p.vz *= (1 - 0.5 * dt);

      // ── Position integration ──
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;

      // ── Expansion (fast initially, decelerating) ──
      const expansionDecay = 1.0 / (1.0 + p.age * 0.5);
      p.radius += EXPANSION_RATE * p.initialEnergy * 0.3 * expansionDecay * dt;

      // ── Dissipation (accelerated by wind speed) ──
      const windSpeed = wind ? Math.sqrt(_wSample[0] ** 2 + _wSample[2] ** 2) : 0;
      const dissipation = DISSIPATION_BASE * (1 + windSpeed * 0.1);
      p.density -= dissipation * dt;

      // ── Cluster breakup ──
      if (p.age > CLUSTER_BREAK_AGE && p.density > 0.2 && Math.random() < CLUSTER_BREAK_CHANCE * dt) {
        // Spawn a child puff offset from parent
        const child: SmokePuff = {
          x: p.x + (Math.random() - 0.5) * p.radius,
          y: p.y + (Math.random() - 0.5) * p.radius * 0.5,
          z: p.z + (Math.random() - 0.5) * p.radius,
          vx: p.vx + (Math.random() - 0.5) * 1.5,
          vy: p.vy + Math.random() * 0.5,
          vz: p.vz + (Math.random() - 0.5) * 1.5,
          density: p.density * 0.4,
          temperature: p.temperature,
          radius: p.radius * 0.5,
          age: p.age * 0.8,
          maxAge: p.maxAge,
          initialEnergy: p.initialEnergy * 0.3,
          alive: true,
        };
        toSpawn.push(child);
        p.density *= 0.7; // parent loses density
      }

      // ── Kill check ──
      if (p.density <= 0.02 || p.age >= p.maxAge) {
        p.alive = false;
      }
    }

    // Add child puffs
    for (const child of toSpawn) {
      if (this.puffs.length < MAX_PUFFS) {
        this.puffs.push(child);
      }
    }
  }

  /**
   * Get all active puffs for rendering.
   */
  getActivePuffs(): readonly SmokePuff[] {
    return this.puffs;
  }

  /**
   * Get puff count for diagnostics.
   */
  getCount(): number {
    return this.puffs.length;
  }

  /**
   * Clear all smoke.
   */
  clear(): void {
    for (const p of this.puffs) this.pool.push(p);
    this.puffs.length = 0;
  }
}

/** Global smoke volume instance */
export const globalSmokeVolume = new SmokeVolumeSystem();
