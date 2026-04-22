/**
 * ─── SmokeVolumeSystem v2 — Studio Mode ─────────────────────────────
 * Semi-volumetric smoke with 5-phase lifecycle, curl noise advection,
 * density fields, cluster breakup, buoyancy, and wind-driven dissipation.
 *
 * 5 Lifecycle Phases (per spec):
 *   0. EMISSION    — Initial density injection at burst location
 *   1. EXPANSION   — Thermal buoyancy drives rapid upward expansion
 *   2. DRIFT       — Wind advection moves the body laterally
 *   3. FRAGMENTATION — Micro-vortices tear clouds into smaller clusters
 *   4. DISSIPATION — Volume dilutes into ambient air, increases scattering
 *
 * Curl noise from WindFieldSystem ensures divergence-free advection:
 * smoke flows along continuous organic arcs forming real eddies,
 * without clumping into sink points.
 *
 * Feature flag: smoke_volume_system
 * Zero-GC: object pool for SmokePuff recycling.
 */

import type { WindFieldSystem } from './WindFieldSystem';
import { isEnabled } from '@/lib/featureFlags';

// ═══ Smoke Phase Enum ═══

export const enum SmokePhase {
  EMISSION = 0,
  EXPANSION = 1,
  DRIFT = 2,
  FRAGMENTATION = 3,
  DISSIPATION = 4,
}

export interface SmokePuff {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  density: number;          // 0-1
  temperature: number;      // K (residual heat drives buoyancy)
  radius: number;           // meters
  age: number;              // seconds
  maxAge: number;           // seconds until fully dissipated
  initialEnergy: number;    // determines expansion rate
  phase: SmokePhase;        // current lifecycle phase
  alive: boolean;
}

const MAX_PUFFS = 512;
const AMBIENT_TEMP = 293;        // ~20°C

// ── Phase transition thresholds ──
const EMISSION_DURATION = 0.3;   // seconds in emission phase
const EXPANSION_DURATION = 2.0;  // seconds of thermal expansion
const DRIFT_DURATION = 5.0;      // seconds of wind-dominated drift
const FRAG_DENSITY_THRESHOLD = 0.25; // density below which dissipation begins

// ── Physics constants ──
const BUOYANCY_FACTOR = 0.12;    // m/s² per 100K above ambient (increased for realism)
const EXPANSION_RATE = 1.0;      // base expansion m/s
const TEMP_DECAY_RATE = 60;      // K/s cooling rate
const CLUSTER_BREAK_CHANCE = 0.25; // probability per second during fragmentation
const CURL_NOISE_SMOKE_INTENSITY = 3.0; // smoke responds strongly to curl noise

// Wind sample output (zero-GC)
const _wSample: [number, number, number] = [0, 0, 0];
const _curlSample: [number, number, number] = [0, 0, 0];

/**
 * Determine the current phase based on age, density, and temperature.
 */
function computePhase(p: SmokePuff): SmokePhase {
  if (p.age < EMISSION_DURATION) return SmokePhase.EMISSION;
  if (p.age < EMISSION_DURATION + EXPANSION_DURATION && p.temperature > AMBIENT_TEMP + 50) {
    return SmokePhase.EXPANSION;
  }
  if (p.age < EMISSION_DURATION + EXPANSION_DURATION + DRIFT_DURATION && p.density > FRAG_DENSITY_THRESHOLD) {
    return SmokePhase.DRIFT;
  }
  if (p.density > 0.08) return SmokePhase.FRAGMENTATION;
  return SmokePhase.DISSIPATION;
}

export class SmokeVolumeSystem {
  private puffs: SmokePuff[] = [];
  private pool: SmokePuff[] = [];

  /**
   * Spawn a smoke puff at burst location (Phase 0: Emission).
   */
  spawn(
    x: number, y: number, z: number,
    energy: number,
    initialTemp: number = 2000,
    density: number = 0.8,
  ): void {
    if (this.puffs.length >= MAX_PUFFS) {
      // Recycle oldest
      let oldestIdx = 0;
      let oldestAge = 0;
      for (let i = 0; i < this.puffs.length; i++) {
        if (this.puffs[i].age > oldestAge) {
          oldestAge = this.puffs[i].age;
          oldestIdx = i;
        }
      }
      this.puffs[oldestIdx].alive = false;
    }

    const puff = this.pool.pop() ?? ({} as SmokePuff);
    puff.x = x;
    puff.y = y;
    puff.z = z;
    puff.vx = (Math.random() - 0.5) * 2;
    puff.vy = 1.5 + Math.random() * 2;
    puff.vz = (Math.random() - 0.5) * 2;
    puff.density = density;
    puff.temperature = initialTemp;
    puff.radius = 2 + energy * 0.5;
    puff.age = 0;
    puff.maxAge = 10 + energy * 2.5;
    puff.initialEnergy = energy;
    puff.phase = SmokePhase.EMISSION;
    puff.alive = true;

    this.puffs.push(puff);
  }

  /**
   * Tick the smoke system with phase-aware behavior.
   */
  update(dt: number, wind: WindFieldSystem | null, time: number): void {
    const toSpawn: SmokePuff[] = [];
    const useAdvanced = isEnabled('smoke_volume_system');

    for (let i = this.puffs.length - 1; i >= 0; i--) {
      const p = this.puffs[i];
      if (!p.alive) {
        this.pool.push(p);
        this.puffs.splice(i, 1);
        continue;
      }

      p.age += dt;

      // ── Phase transition ──
      if (useAdvanced) {
        p.phase = computePhase(p);
      }

      // ── Temperature decay ──
      const tempDecayMul = p.phase === SmokePhase.EXPANSION ? 0.7 : 1.0;
      p.temperature = Math.max(AMBIENT_TEMP, p.temperature - TEMP_DECAY_RATE * tempDecayMul * dt);

      // ── Buoyancy (hot smoke rises) ──
      const tempDelta = p.temperature - AMBIENT_TEMP;
      const buoyancy = (tempDelta / 100) * BUOYANCY_FACTOR;

      // Buoyancy is strongest during EXPANSION phase
      const buoyancyMul = p.phase === SmokePhase.EXPANSION ? 1.5
                        : p.phase === SmokePhase.EMISSION ? 1.2
                        : p.phase === SmokePhase.DRIFT ? 0.6
                        : 0.3;
      p.vy += buoyancy * buoyancyMul * dt;

      // ── Wind advection ──
      if (wind) {
        // Turbulence disabled in base sample — we apply curl separately
        wind.sample(p.x, p.y, p.z, time, false, _wSample);

        // Wind influence increases through phases (smoke gets lighter)
        const windCoupling = p.phase === SmokePhase.EMISSION ? 0.1
                           : p.phase === SmokePhase.EXPANSION ? 0.2
                           : p.phase === SmokePhase.DRIFT ? 0.5
                           : 0.7;

        p.vx += (_wSample[0] - p.vx) * windCoupling * dt;
        p.vy += _wSample[1] * windCoupling * 0.1 * dt;
        p.vz += (_wSample[2] - p.vz) * windCoupling * dt;

        // ── Curl noise advection (divergence-free) ──
        if (useAdvanced && wind.sampleCurlNoise) {
          const curlIntensity = CURL_NOISE_SMOKE_INTENSITY
            * (p.phase === SmokePhase.FRAGMENTATION ? 1.5 : 1.0)
            * (p.phase === SmokePhase.EMISSION ? 0.2 : 1.0);

          wind.sampleCurlNoise(p.x, p.y, p.z, time, curlIntensity, _curlSample);
          p.vx += _curlSample[0] * dt;
          p.vy += _curlSample[1] * dt;
          p.vz += _curlSample[2] * dt;
        }
      }

      // ── Natural drag on smoke movement ──
      const dragMul = p.phase === SmokePhase.EMISSION ? 0.3
                    : p.phase === SmokePhase.EXPANSION ? 0.4
                    : 0.6;
      p.vx *= (1 - dragMul * dt);
      p.vy *= (1 - dragMul * 0.6 * dt);
      p.vz *= (1 - dragMul * dt);

      // ── Position integration ──
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;

      // ── Expansion ──
      // Fast during EMISSION/EXPANSION, decelerating through later phases
      const expansionMul = p.phase === SmokePhase.EMISSION ? 2.0
                         : p.phase === SmokePhase.EXPANSION ? 1.2
                         : p.phase === SmokePhase.DRIFT ? 0.3
                         : 0.05;
      const expansionDecay = 1.0 / (1.0 + p.age * 0.5);
      p.radius += EXPANSION_RATE * p.initialEnergy * 0.3 * expansionDecay * expansionMul * dt;

      // ── Dissipation ──
      // Rate varies by phase: slow during expansion, fast during dissipation
      const dissipBase = p.phase === SmokePhase.EMISSION ? 0.02
                       : p.phase === SmokePhase.EXPANSION ? 0.05
                       : p.phase === SmokePhase.DRIFT ? 0.1
                       : p.phase === SmokePhase.FRAGMENTATION ? 0.18
                       : 0.3; // DISSIPATION phase
      const windSpeed = wind ? Math.sqrt(_wSample[0] ** 2 + _wSample[2] ** 2) : 0;
      const dissipation = dissipBase * (1 + windSpeed * 0.1);
      p.density -= dissipation * dt;

      // ── Cluster breakup (FRAGMENTATION phase) ──
      if (useAdvanced && p.phase === SmokePhase.FRAGMENTATION
        && p.density > 0.12 && Math.random() < CLUSTER_BREAK_CHANCE * dt) {
        const child: SmokePuff = {
          x: p.x + (Math.random() - 0.5) * p.radius,
          y: p.y + (Math.random() - 0.5) * p.radius * 0.5,
          z: p.z + (Math.random() - 0.5) * p.radius,
          vx: p.vx + (Math.random() - 0.5) * 1.5,
          vy: p.vy + Math.random() * 0.5,
          vz: p.vz + (Math.random() - 0.5) * 1.5,
          density: p.density * 0.35,
          temperature: p.temperature,
          radius: p.radius * 0.45,
          age: p.age * 0.9,
          maxAge: p.maxAge,
          initialEnergy: p.initialEnergy * 0.25,
          phase: SmokePhase.FRAGMENTATION,
          alive: true,
        };
        toSpawn.push(child);
        p.density *= 0.65;
      } else if (!useAdvanced && p.age > 2.5 && p.density > 0.2 && Math.random() < 0.3 * dt) {
        // Legacy breakup
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
          phase: SmokePhase.DRIFT,
          alive: true,
        };
        toSpawn.push(child);
        p.density *= 0.7;
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

  getActivePuffs(): readonly SmokePuff[] {
    return this.puffs;
  }

  getCount(): number {
    return this.puffs.length;
  }

  clear(): void {
    for (const p of this.puffs) this.pool.push(p);
    this.puffs.length = 0;
  }
}

/** Global smoke volume instance */
export const globalSmokeVolume = new SmokeVolumeSystem();
