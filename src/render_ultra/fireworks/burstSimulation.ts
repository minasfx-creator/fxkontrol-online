/**
 * FX KONTROL · Burst Pattern Simulation
 * Realistic firework burst patterns — peony, chrysanthemum, willow, palm, ring, heart.
 */

import * as THREE from 'three';

export type BurstPattern = 'peony' | 'chrysanthemum' | 'willow' | 'palm' | 'ring' | 'heart' | 'crossette' | 'kamuro' | 'brocade';

interface BurstConfig {
  starCount: number;
  velocity: number;
  spread: number;         // angular spread factor
  tailFactor: number;     // how much stars trail
  gravityMult: number;    // gravity influence
  symmetry: number;       // radial symmetry count
}

const BURST_CONFIGS: Record<BurstPattern, BurstConfig> = {
  peony: { starCount: 300, velocity: 45, spread: 1.0, tailFactor: 0.3, gravityMult: 1.0, symmetry: 0 },
  chrysanthemum: { starCount: 500, velocity: 55, spread: 1.0, tailFactor: 0.9, gravityMult: 0.8, symmetry: 0 },
  willow: { starCount: 400, velocity: 35, spread: 0.8, tailFactor: 1.5, gravityMult: 1.4, symmetry: 0 },
  palm: { starCount: 200, velocity: 50, spread: 0.6, tailFactor: 1.2, gravityMult: 1.2, symmetry: 6 },
  ring: { starCount: 150, velocity: 40, spread: 0.1, tailFactor: 0.5, gravityMult: 0.6, symmetry: 0 },
  heart: { starCount: 200, velocity: 38, spread: 0.0, tailFactor: 0.4, gravityMult: 0.7, symmetry: 0 },
  crossette: { starCount: 120, velocity: 50, spread: 0.9, tailFactor: 0.6, gravityMult: 1.0, symmetry: 4 },
  kamuro: { starCount: 600, velocity: 30, spread: 1.0, tailFactor: 2.0, gravityMult: 1.5, symmetry: 0 },
  brocade: { starCount: 500, velocity: 40, spread: 1.0, tailFactor: 1.8, gravityMult: 1.3, symmetry: 0 },
};

/**
 * Generate burst star velocities for a given pattern.
 */
export function generateBurst(
  origin: THREE.Vector3,
  pattern: BurstPattern,
  caliber: number
): { positions: Float32Array; velocities: Float32Array; config: BurstConfig } {
  const cfg = BURST_CONFIGS[pattern];
  const scale = caliber / 75; // normalize to 75mm baseline
  const count = Math.round(cfg.starCount * scale);
  const positions = new Float32Array(count * 3);
  const velocities = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    positions[i3] = origin.x;
    positions[i3 + 1] = origin.y;
    positions[i3 + 2] = origin.z;

    let vx: number, vy: number, vz: number;

    if (pattern === 'ring') {
      // Torus burst — stars in a ring plane
      const angle = (i / count) * Math.PI * 2;
      const speed = cfg.velocity * scale * (0.9 + Math.random() * 0.2);
      vx = Math.cos(angle) * speed;
      vy = (Math.random() - 0.5) * speed * cfg.spread;
      vz = Math.sin(angle) * speed;
    } else if (pattern === 'heart') {
      // Heart curve parametric
      const t = (i / count) * Math.PI * 2;
      const hx = 16 * Math.pow(Math.sin(t), 3);
      const hy = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
      const speed = cfg.velocity * scale * 0.06;
      vx = hx * speed + (Math.random() - 0.5) * 3;
      vy = hy * speed + (Math.random() - 0.5) * 3;
      vz = (Math.random() - 0.5) * speed * 5;
    } else if (pattern === 'palm') {
      // Upward-biased with radial symmetry
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI * 0.4; // mostly upward
      const speed = cfg.velocity * scale * (0.6 + Math.random() * 0.4);
      vx = Math.sin(phi) * Math.cos(theta) * speed;
      vy = Math.cos(phi) * speed;
      vz = Math.sin(phi) * Math.sin(theta) * speed;
    } else {
      // Spherical burst (peony, chrysanthemum, willow, etc.)
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const speed = cfg.velocity * scale * (0.5 + Math.random() * 0.5) * cfg.spread;
      vx = Math.sin(phi) * Math.cos(theta) * speed;
      vy = Math.sin(phi) * Math.sin(theta) * speed + cfg.velocity * 0.15;
      vz = Math.cos(phi) * speed;
    }

    velocities[i3] = vx;
    velocities[i3 + 1] = vy;
    velocities[i3 + 2] = vz;
  }

  return { positions, velocities, config: cfg };
}

export function getBurstConfig(pattern: BurstPattern): BurstConfig {
  return BURST_CONFIGS[pattern];
}

export function getAllPatterns(): BurstPattern[] {
  return Object.keys(BURST_CONFIGS) as BurstPattern[];
}
