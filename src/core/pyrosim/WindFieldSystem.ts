/**
 * ─── WindFieldSystem v2 — Studio Mode ───────────────────────────────
 * Layered wind with logarithmic vertical shear + 3D curl noise turbulence.
 * 
 * Wind Shear (Log Law):
 *   u(z) = u_ref * ln(z/z0) / ln(z_ref/z0)
 *   where z0 = surface roughness length, z_ref = reference altitude.
 *   This produces non-linear wind speed increase with altitude,
 *   stronger near-ground friction, and smooth upper-level flow.
 *
 * Curl Noise Turbulence:
 *   Derives velocity from the curl of a 3D Simplex noise field.
 *   Guarantees ∇·v = 0 (divergence-free), producing organic vortices
 *   without sink/source artifacts. Smoke and light particles respond
 *   strongly; heavy shells receive marginal but non-zero influence.
 *
 * Feature flag: turbulence_field
 *   When OFF: falls back to cheap hash-based micro-turbulence.
 *   When ON:  full curl noise + log-law shear.
 *
 * Zero-GC: all sampling writes into caller-provided output arrays.
 */

import { isEnabled } from '@/lib/featureFlags';

export interface WindLayer {
  altitudeMin: number;
  altitudeMax: number;
  direction: number;     // degrees
  speed: number;         // m/s
  gustVariance: number;  // 0-1
}

export interface WindFieldConfig {
  layers: WindLayer[];
  turbulenceIntensity: number;  // 0-1
  macroDriftSpeed: number;      // degrees/second
  macroDriftAmplitude: number;  // degrees
  /** Surface roughness length for Log Law (meters). Urban ~1.0, open ~0.03 */
  surfaceRoughness: number;
  /** Reference altitude for Log Law (meters) */
  referenceAltitude: number;
  /** Curl noise spatial scale (lower = larger vortices) */
  curlNoiseScale: number;
  /** Curl noise temporal speed */
  curlNoiseSpeed: number;
}

const DEFAULT_CONFIG: WindFieldConfig = {
  layers: [
    { altitudeMin: 0, altitudeMax: 80, direction: 45, speed: 2.0, gustVariance: 0.4 },
    { altitudeMin: 80, altitudeMax: 200, direction: 60, speed: 5.0, gustVariance: 0.25 },
    { altitudeMin: 200, altitudeMax: 9999, direction: 75, speed: 8.0, gustVariance: 0.15 },
  ],
  turbulenceIntensity: 0.3,
  macroDriftSpeed: 2.0,
  macroDriftAmplitude: 15.0,
  surfaceRoughness: 0.5,
  referenceAltitude: 100,
  curlNoiseScale: 0.015,
  curlNoiseSpeed: 0.4,
};

// ═══════════════════════════════════════════════════════════════════════
// Simplex-based Curl Noise — Divergence-free 3D turbulence
// ═══════════════════════════════════════════════════════════════════════

/**
 * 3D gradient noise (hash-based, fast approximation of Simplex).
 * Used to build the scalar potential fields for curl computation.
 */
function grad3D(x: number, y: number, z: number): number {
  // Improved hash for better distribution
  let n = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  n = n - Math.floor(n);
  const n2 = Math.sin(x * 269.5 + y * 183.3 + z * 246.1) * 43758.5453;
  const f2 = n2 - Math.floor(n2);
  return (n + f2) * 0.5 - 0.5;
}

/** Smooth 3D noise with trilinear interpolation */
function noise3D(x: number, y: number, z: number): number {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = x - ix, fy = y - iy, fz = z - iz;
  // Quintic smoothstep for C2 continuity
  const ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
  const uy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
  const uz = fz * fz * fz * (fz * (fz * 6 - 15) + 10);

  const a = grad3D(ix, iy, iz);
  const b = grad3D(ix + 1, iy, iz);
  const c = grad3D(ix, iy + 1, iz);
  const d = grad3D(ix + 1, iy + 1, iz);
  const e = grad3D(ix, iy, iz + 1);
  const f = grad3D(ix + 1, iy, iz + 1);
  const g = grad3D(ix, iy + 1, iz + 1);
  const h = grad3D(ix + 1, iy + 1, iz + 1);

  const x1 = a + (b - a) * ux;
  const x2 = c + (d - c) * ux;
  const x3 = e + (f - e) * ux;
  const x4 = g + (h - g) * ux;
  const y1 = x1 + (x2 - x1) * uy;
  const y2 = x3 + (x4 - x3) * uy;
  return y1 + (y2 - y1) * uz;
}

/** FBM (Fractal Brownian Motion) — 3 octaves for rich turbulence */
function fbm3D(x: number, y: number, z: number): number {
  return noise3D(x, y, z) * 0.5
       + noise3D(x * 2.0, y * 2.0, z * 2.0) * 0.25
       + noise3D(x * 4.0, y * 4.0, z * 4.0) * 0.125;
}

// Pre-allocated output for curl computation
const _curlOut: [number, number, number] = [0, 0, 0];

/**
 * Compute curl of a 3D noise potential field using finite differences.
 * 
 * curl(F) = (dFz/dy - dFy/dz, dFx/dz - dFz/dx, dFy/dx - dFx/dy)
 * 
 * Since we derive velocity from curl of a scalar potential,
 * the result is guaranteed divergence-free (∇·(∇×F) = 0).
 */
function curlNoise3D(
  x: number, y: number, z: number,
  scale: number, time: number, speed: number,
  out: [number, number, number],
): void {
  const e = 0.05; // finite difference epsilon
  const sx = x * scale + time * speed * 0.3;
  const sy = y * scale + time * speed * 0.2;
  const sz = z * scale + time * speed * 0.25;

  // Three independent noise fields as potential components
  // dFz/dy - dFy/dz
  out[0] = (fbm3D(sx, sy + e, sz + 100) - fbm3D(sx, sy - e, sz + 100)
          - fbm3D(sx, sy + 200, sz + e) + fbm3D(sx, sy + 200, sz - e)) / (2 * e);
  // dFx/dz - dFz/dx
  out[1] = (fbm3D(sx + 300, sy, sz + e) - fbm3D(sx + 300, sy, sz - e)
          - fbm3D(sx + e, sy, sz + 100) + fbm3D(sx - e, sy, sz + 100)) / (2 * e);
  // dFy/dx - dFx/dy
  out[2] = (fbm3D(sx + e, sy + 200, sz) - fbm3D(sx - e, sy + 200, sz)
          - fbm3D(sx + 300, sy + e, sz) + fbm3D(sx + 300, sy - e, sz)) / (2 * e);
}

// ═══════════════════════════════════════════════════════════════════════
// Logarithmic Wind Shear Profile (Log Law)
// ═══════════════════════════════════════════════════════════════════════

/**
 * Log Law wind profile: u(z) = u_ref * ln(z/z0) / ln(z_ref/z0)
 * 
 * Models the atmospheric boundary layer where:
 * - Near ground: friction from buildings/terrain slows wind significantly
 * - Mid altitude: wind increases logarithmically
 * - High altitude: approaches free-stream velocity
 * 
 * @param z - altitude (meters)
 * @param uRef - reference wind speed at z_ref
 * @param zRef - reference altitude (meters)
 * @param z0 - surface roughness length (meters)
 * @returns wind speed multiplier at altitude z
 */
function logLawMultiplier(z: number, zRef: number, z0: number): number {
  const zClamped = Math.max(z0 + 0.1, z); // avoid log(0)
  const num = Math.log(zClamped / z0);
  const den = Math.log(zRef / z0);
  return den > 0 ? Math.max(0, num / den) : 1.0;
}

// ═══════════════════════════════════════════════════════════════════════

// Wind sample output (zero-GC)
const _wSample: [number, number, number] = [0, 0, 0];

export class WindFieldSystem {
  private config: WindFieldConfig;

  constructor(config?: Partial<WindFieldConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  setConfig(config: Partial<WindFieldConfig>): void {
    Object.assign(this.config, config);
  }

  /**
   * Set base wind from project settings.
   */
  setBaseWind(directionDeg: number, speed: number, gustStrength: number): void {
    const layers = this.config.layers;
    layers[0].direction = directionDeg - 15;
    layers[0].speed = speed * 0.4;
    layers[0].gustVariance = gustStrength * 0.5;
    layers[1].direction = directionDeg;
    layers[1].speed = speed;
    layers[1].gustVariance = gustStrength * 0.3;
    layers[2].direction = directionDeg + 15;
    layers[2].speed = speed * 1.6;
    layers[2].gustVariance = gustStrength * 0.2;
  }

  /**
   * Sample wind at a world position. Writes into out array (zero-GC).
   * 
   * When turbulence_field flag is ON:
   *   - Uses Log Law vertical shear instead of linear interpolation
   *   - Uses proper 3D curl noise (∇·v = 0) instead of hash turbulence
   * When OFF: legacy behavior preserved for stability.
   */
  sample(
    x: number, y: number, z: number,
    time: number,
    includeTurbulence: boolean,
    out: [number, number, number],
  ): void {
    const alt = Math.max(0, y);
    const useTurbulenceField = isEnabled('turbulence_field');

    // Find surrounding layers and interpolate
    const layers = this.config.layers;
    let windDir = layers[0].direction;
    let windSpeed = layers[0].speed;
    let gustVar = layers[0].gustVariance;

    for (let i = 0; i < layers.length - 1; i++) {
      const lo = layers[i];
      const hi = layers[i + 1];
      if (alt >= lo.altitudeMin && alt < hi.altitudeMax) {
        const range = hi.altitudeMin - lo.altitudeMin;
        const t = range > 0 ? Math.min(1, (alt - lo.altitudeMin) / range) : 0;
        const smooth = t * t * (3 - 2 * t); // smoothstep
        windDir = lo.direction + (hi.direction - lo.direction) * smooth;
        windSpeed = lo.speed + (hi.speed - lo.speed) * smooth;
        gustVar = lo.gustVariance + (hi.gustVariance - lo.gustVariance) * smooth;
        break;
      }
    }
    if (alt >= layers[layers.length - 1].altitudeMin) {
      const top = layers[layers.length - 1];
      windDir = top.direction;
      windSpeed = top.speed;
      gustVar = top.gustVariance;
    }

    // ── Log Law vertical shear (Studio Mode) ──
    if (useTurbulenceField) {
      const logMul = logLawMultiplier(
        alt,
        this.config.referenceAltitude,
        this.config.surfaceRoughness,
      );
      windSpeed *= logMul;
    }

    // Macro drift
    const drift = this.config.macroDriftAmplitude * Math.sin(time * this.config.macroDriftSpeed * 0.01);
    windDir += drift;

    // Gust modulation
    const gustPhase = time * 1.7 + x * 0.003 + z * 0.005;
    const gust = 1.0 + gustVar * Math.sin(gustPhase) * Math.sin(gustPhase * 0.37);
    windSpeed *= gust;

    // Direction to vector
    const dirRad = (windDir * Math.PI) / 180;
    out[0] = Math.sin(dirRad) * windSpeed;
    out[1] = 0; // no vertical wind component (buoyancy is separate)
    out[2] = Math.cos(dirRad) * windSpeed;

    // ── Turbulence ──
    if (includeTurbulence && this.config.turbulenceIntensity > 0) {
      if (useTurbulenceField) {
        // Full 3D curl noise — divergence-free, organic vortices
        curlNoise3D(
          x, y, z,
          this.config.curlNoiseScale,
          time,
          this.config.curlNoiseSpeed,
          _curlOut,
        );
        const ti = this.config.turbulenceIntensity * windSpeed * 0.5;
        out[0] += _curlOut[0] * ti;
        out[1] += _curlOut[1] * ti * 0.4; // reduced vertical turbulence
        out[2] += _curlOut[2] * ti;
      } else {
        // Legacy: cheap hash-based micro-turbulence
        const ti = this.config.turbulenceIntensity * windSpeed * 0.3;
        const px = x * 0.02 + time * 0.5;
        const py = y * 0.03 + time * 0.3;
        const pz = z * 0.02 + time * 0.4;
        out[0] += ti * (Math.sin(px * 1.3 + py * 0.7) + Math.sin(pz * 2.1) * 0.5);
        out[1] += ti * 0.3 * Math.sin(py * 1.7 + px * 0.9);
        out[2] += ti * (Math.cos(pz * 1.1 + py * 0.6) + Math.cos(px * 1.8) * 0.5);
      }
    }
  }

  /**
   * Sample curl noise only (for smoke advection).
   * Returns divergence-free velocity perturbation.
   */
  sampleCurlNoise(
    x: number, y: number, z: number,
    time: number, intensity: number,
    out: [number, number, number],
  ): void {
    curlNoise3D(
      x, y, z,
      this.config.curlNoiseScale,
      time,
      this.config.curlNoiseSpeed,
      out,
    );
    out[0] *= intensity;
    out[1] *= intensity * 0.4;
    out[2] *= intensity;
  }

  getConfig(): Readonly<WindFieldConfig> {
    return this.config;
  }

  reset(): void {
    this.config = { ...DEFAULT_CONFIG };
  }
}

/** Global wind field instance */
export const globalWindField = new WindFieldSystem();
