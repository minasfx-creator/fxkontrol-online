/**
 * ─── AsymmetricDispersion ───────────────────────────────────────────
 * Per-particle ejection tensor with asymmetric dispersion matrix.
 * 
 * Instead of perfect spherical symmetry, applies a 3×3 stretch tensor
 * to the ejection direction, creating natural lobe-asymmetry seen in
 * real pyrotechnic bursts (uneven packing, off-center ignition).
 * 
 * Zero-GC: uses pre-allocated buffers, inline math, seeded RNG.
 */

import { simRNG } from '@/core/reliability/seededRandom';

// ═══ Dispersion Matrix (row-major 3×3) ═══

/**
 * Generate a per-burst asymmetric dispersion tensor.
 * Models manufacturing imperfections in shell geometry.
 * 
 * The tensor is a rotation-stretch composition:
 *   M = R(θ) · S · R(-θ)
 * where S = diag(1 + εx, 1 + εy, 1 + εz) and R is a random rotation.
 * 
 * @param asymmetry 0 = perfect sphere, 1 = extreme lobe (typically 0.05–0.25)
 * @param out Pre-allocated Float32Array(9) for the 3×3 matrix
 */
export function generateDispersionTensor(
  asymmetry: number,
  out: Float32Array,
): void {
  // Random axis for asymmetry orientation
  const axisTheta = simRNG.next() * Math.PI * 2;
  const axisPhi = Math.acos(1 - 2 * simRNG.next());

  const ax = Math.sin(axisPhi) * Math.cos(axisTheta);
  const ay = Math.sin(axisPhi) * Math.sin(axisTheta);
  const az = Math.cos(axisPhi);

  // Per-axis stretch factors (asymmetric — one axis elongated, another compressed)
  const e1 = 1.0 + asymmetry * (simRNG.next() * 2 - 0.5);  // primary lobe
  const e2 = 1.0 - asymmetry * (simRNG.next() * 0.5);        // compressed
  const e3 = 1.0 + asymmetry * (simRNG.next() - 0.5) * 0.3;  // minor variation

  // Build rotation matrix from axis (Rodrigues' rotation formula simplified)
  // We use the axis to define a preferred stretch direction
  const c = Math.cos(axisTheta * 0.5);
  const s = Math.sin(axisTheta * 0.5);

  // Simplified: apply stretch along random axis via outer product perturbation
  // M = I + asymmetry * (a ⊗ a - I/3) + noise
  // This gives a symmetric positive-definite tensor with controllable anisotropy
  const aaX = ax * ax, aaY = ay * ay, aaZ = az * az;
  const aXY = ax * ay, aXZ = ax * az, aYZ = ay * az;

  // Row-major 3×3: M[row][col] = out[row*3 + col]
  out[0] = e1 * aaX + e2 * (1 - aaX);        // M00
  out[1] = (e1 - e2) * aXY;                    // M01
  out[2] = (e1 - e2) * aXZ;                    // M02
  out[3] = (e1 - e2) * aXY;                    // M10
  out[4] = e1 * aaY + e2 * (1 - aaY);          // M11
  out[5] = (e1 - e2) * aYZ;                    // M12
  out[6] = (e1 - e2) * aXZ;                    // M20
  out[7] = (e1 - e2) * aYZ;                    // M21
  out[8] = e1 * aaZ + e3 * (1 - aaZ);          // M22
}

/**
 * Apply dispersion tensor to an ejection direction vector (in-place).
 * result = M · dir, then re-normalize.
 */
export function applyDispersionTensor(
  tensor: Float32Array,
  dirX: number, dirY: number, dirZ: number,
): [number, number, number] {
  const rx = tensor[0] * dirX + tensor[1] * dirY + tensor[2] * dirZ;
  const ry = tensor[3] * dirX + tensor[4] * dirY + tensor[5] * dirZ;
  const rz = tensor[6] * dirX + tensor[7] * dirY + tensor[8] * dirZ;

  // Re-normalize to preserve velocity magnitude
  const len = Math.sqrt(rx * rx + ry * ry + rz * rz);
  if (len < 1e-6) return [dirX, dirY, dirZ];

  const invLen = 1.0 / len;
  return [rx * invLen, ry * invLen, rz * invLen];
}

// ═══ Per-Particle Natural Variability ═══

/**
 * Noise profiles for injecting manufacturing-realistic variance.
 * Each parameter has a distribution shape and bounds.
 */
export interface VarianceProfile {
  massVariance: number;         // 0-1, fraction of base mass (e.g., 0.15 = ±15%)
  velocityVariance: number;     // 0-1, fraction of burst velocity
  dragVariance: number;         // 0-1, fraction of drag coefficient
  burnRateVariance: number;     // 0-1, fraction of burn rate
  fuelVariance: number;         // 0-1, fraction of fuel mass
  turbulenceVariance: number;   // 0-1, fraction of turbulence factor
  angularJitter: number;        // radians, max angular deviation from ideal direction
  asymmetry: number;            // 0-1, burst shape asymmetry
}

/**
 * Default variance profiles per effect family.
 * Based on real manufacturing tolerances:
 * - Hand-rolled shells: high variance (artisan)
 * - Machine-pressed: low variance (industrial)
 */
export const VARIANCE_PROFILES: Record<string, VarianceProfile> = {
  peony: {
    massVariance: 0.12,
    velocityVariance: 0.15,
    dragVariance: 0.10,
    burnRateVariance: 0.10,
    fuelVariance: 0.12,
    turbulenceVariance: 0.20,
    angularJitter: 0.08,
    asymmetry: 0.10,
  },
  chrysanthemum: {
    massVariance: 0.08,
    velocityVariance: 0.10,
    dragVariance: 0.08,
    burnRateVariance: 0.08,
    fuelVariance: 0.10,
    turbulenceVariance: 0.15,
    angularJitter: 0.05,
    asymmetry: 0.06,
  },
  willow: {
    massVariance: 0.15,
    velocityVariance: 0.12,
    dragVariance: 0.06,
    burnRateVariance: 0.12,
    fuelVariance: 0.15,
    turbulenceVariance: 0.10,
    angularJitter: 0.04,
    asymmetry: 0.08,
  },
  brocade: {
    massVariance: 0.18,
    velocityVariance: 0.14,
    dragVariance: 0.12,
    burnRateVariance: 0.15,
    fuelVariance: 0.18,
    turbulenceVariance: 0.25,
    angularJitter: 0.10,
    asymmetry: 0.15,
  },
  salute: {
    massVariance: 0.25,
    velocityVariance: 0.20,
    dragVariance: 0.15,
    burnRateVariance: 0.05,
    fuelVariance: 0.10,
    turbulenceVariance: 0.35,
    angularJitter: 0.15,
    asymmetry: 0.20,
  },
};

/** Default variance for unknown families */
export const DEFAULT_VARIANCE: VarianceProfile = {
  massVariance: 0.12,
  velocityVariance: 0.15,
  dragVariance: 0.10,
  burnRateVariance: 0.10,
  fuelVariance: 0.12,
  turbulenceVariance: 0.20,
  angularJitter: 0.08,
  asymmetry: 0.10,
};

/**
 * Apply gaussian-ish variance to a base value.
 * Uses Box-Muller approximation (2 uniform → 1 normal) for bell-curve distribution.
 * Clamps to prevent negative physical quantities.
 */
export function applyVariance(base: number, variance: number, minClamp: number = 0.01): number {
  if (variance <= 0) return base;
  
  // Box-Muller approximation using seeded RNG
  const u1 = Math.max(simRNG.next(), 1e-6);
  const u2 = simRNG.next();
  const normal = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);

  // Scale to desired variance (normal has σ=1, we want σ=variance*base)
  const result = base * (1.0 + normal * variance);
  return Math.max(result, minClamp);
}

/**
 * Apply angular jitter to spherical coordinates.
 * Perturbs theta/phi with gaussian noise for natural star placement.
 */
export function applyAngularJitter(
  theta: number, phi: number, jitterRad: number,
): [number, number] {
  if (jitterRad <= 0) return [theta, phi];

  const u1 = Math.max(simRNG.next(), 1e-6);
  const u2 = simRNG.next();
  const normal1 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  const normal2 = Math.sqrt(-2 * Math.log(u1)) * Math.sin(2 * Math.PI * u2);

  return [
    theta + normal1 * jitterRad,
    phi + normal2 * jitterRad * 0.5, // less jitter on elevation
  ];
}

// Pre-allocated tensor buffer (reused per burst)
export const _burstTensor = new Float32Array(9);
