/**
 * FX KONTROL · Burst Pattern Simulation
 * Realistic firework burst patterns — peony, chrysanthemum, willow, palm, ring, heart.
 */

import * as THREE from 'three';

export type BurstPattern = 'peony' | 'chrysanthemum' | 'willow' | 'palm' | 'ring' | 'heart' | 'crossette' | 'kamuro' | 'brocade' | 'dragon_egg' | 'multi_break' | 'time_rain' | 'falling_leaves' | 'glitter' | 'horsetail' | 'brocade_crown' | 'saturn' | 'dahlia' | 'coconut_tree' | 'spider_web';

interface BurstConfig {
  starCount: number;
  velocity: number;
  spread: number;         // angular spread factor
  tailFactor: number;     // how much stars trail
  gravityMult: number;    // gravity influence
  symmetry: number;       // radial symmetry count
}

// Star counts calibrated to Finale 3D reference at 3" (75mm) baseline
const BURST_CONFIGS: Record<BurstPattern, BurstConfig> = {
  peony:         { starCount: 150, velocity: 28, spread: 1.0, tailFactor: 0.3, gravityMult: 1.0, symmetry: 0 },
  chrysanthemum: { starCount: 200, velocity: 30, spread: 1.0, tailFactor: 0.9, gravityMult: 0.8, symmetry: 0 },
  willow:        { starCount: 180, velocity: 20, spread: 0.8, tailFactor: 1.5, gravityMult: 1.4, symmetry: 0 },
  palm:          { starCount: 60,  velocity: 24, spread: 0.6, tailFactor: 1.2, gravityMult: 1.2, symmetry: 6 },
  ring:          { starCount: 80,  velocity: 28, spread: 0.1, tailFactor: 0.5, gravityMult: 0.6, symmetry: 0 },
  heart:         { starCount: 100, velocity: 26, spread: 0.0, tailFactor: 0.4, gravityMult: 0.7, symmetry: 0 },
  crossette:     { starCount: 36,  velocity: 32, spread: 0.9, tailFactor: 0.6, gravityMult: 1.0, symmetry: 4 },
  kamuro:        { starCount: 300, velocity: 18, spread: 1.0, tailFactor: 2.0, gravityMult: 1.5, symmetry: 0 },
  brocade:       { starCount: 250, velocity: 25, spread: 1.0, tailFactor: 1.8, gravityMult: 1.3, symmetry: 0 },
  dragon_egg:    { starCount: 40,  velocity: 15, spread: 0.6, tailFactor: 0.3, gravityMult: 1.8, symmetry: 0 },
  multi_break:   { starCount: 120, velocity: 26, spread: 1.0, tailFactor: 0.5, gravityMult: 1.0, symmetry: 0 },
  time_rain:     { starCount: 100, velocity: 22, spread: 0.9, tailFactor: 0.2, gravityMult: 0.3, symmetry: 0 },
  falling_leaves:{ starCount: 80,  velocity: 24, spread: 1.0, tailFactor: 0.8, gravityMult: 1.6, symmetry: 0 },
  glitter:       { starCount: 200, velocity: 26, spread: 1.0, tailFactor: 0.4, gravityMult: 1.0, symmetry: 0 },
  horsetail:     { starCount: 160, velocity: 16, spread: 0.7, tailFactor: 2.5, gravityMult: 2.0, symmetry: 0 },
  brocade_crown: { starCount: 220, velocity: 24, spread: 1.0, tailFactor: 1.6, gravityMult: 1.2, symmetry: 0 },
  saturn:        { starCount: 140, velocity: 28, spread: 1.0, tailFactor: 0.5, gravityMult: 0.8, symmetry: 0 },
  dahlia:        { starCount: 80,  velocity: 38, spread: 0.8, tailFactor: 0.2, gravityMult: 1.1, symmetry: 0 },
  coconut_tree:  { starCount: 40,  velocity: 22, spread: 0.5, tailFactor: 1.8, gravityMult: 1.5, symmetry: 5 },
  spider_web:    { starCount: 120, velocity: 32, spread: 1.0, tailFactor: 1.4, gravityMult: 0.6, symmetry: 0 },
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
      // Torus burst — evenly distributed ring with minimal jitter
      const angle = (i / count) * Math.PI * 2;
      const jitter = (Math.random() - 0.5) * 0.06;
      const speed = cfg.velocity * scale * (0.92 + Math.random() * 0.08);
      vx = Math.cos(angle + jitter) * speed;
      vy = (Math.random() - 0.5) * speed * 0.04;
      vz = Math.sin(angle + jitter) * speed;
    } else if (pattern === 'heart') {
      // Heart curve parametric
      const t = (i / count) * Math.PI * 2;
      const hx = 16 * Math.pow(Math.sin(t), 3);
      const hy = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
      const speed = cfg.velocity * scale * 0.06;
      vx = hx * speed + (Math.random() - 0.5) * 0.8;
      vy = hy * speed + (Math.random() - 0.5) * 0.8;
      vz = (Math.random() - 0.5) * speed * 0.8;
    } else if (pattern === 'palm') {
      // Upward-biased with stronger vertical lift
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI * 0.35; // tighter upward cone
      const speed = cfg.velocity * scale * (0.6 + Math.random() * 0.4);
      vx = Math.sin(phi) * Math.cos(theta) * speed * 0.48;
      vy = Math.cos(phi) * speed + cfg.velocity * 0.2;
      vz = Math.sin(phi) * Math.sin(theta) * speed * 0.48;
    } else if (pattern === 'chrysanthemum') {
      // Slightly elevated sphere — Finale 3D reference
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const speed = cfg.velocity * scale * (0.5 + Math.random() * 0.5);
      vx = Math.sin(phi) * Math.cos(theta) * speed;
      vy = Math.sin(phi) * Math.sin(theta) * speed + cfg.velocity * 0.25;
      vz = Math.cos(phi) * speed;
    } else if (pattern === 'crossette') {
      // 4-6 arms with slight upward bias
      const armCount = cfg.symmetry || 4;
      const arm = i % armCount;
      const armAngle = (arm / armCount) * Math.PI * 2;
      const jitter = (Math.random() - 0.5) * 0.15;
      const speed = cfg.velocity * scale * (0.8 + Math.random() * 0.2);
      vx = Math.sin(Math.PI * 0.42) * Math.cos(armAngle + jitter) * speed;
      vy = Math.cos(Math.PI * 0.42) * speed + cfg.velocity * 0.1;
      vz = Math.sin(Math.PI * 0.42) * Math.sin(armAngle + jitter) * speed;
    } else if (pattern === 'willow') {
      // Willow: uniform spread, slight downward bias (heavy charcoal stars)
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const speed = cfg.velocity * scale * (0.85 + Math.random() * 0.15);
      vx = Math.sin(phi) * Math.cos(theta) * speed;
      vy = Math.sin(phi) * Math.sin(theta) * speed - cfg.velocity * 0.05;
      vz = Math.cos(phi) * speed;
    } else if (pattern === 'kamuro') {
      // Kamuro: low velocity, max spread, heavy gravitational droop
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const speed = cfg.velocity * scale * (0.7 + Math.random() * 0.3);
      vx = Math.sin(phi) * Math.cos(theta) * speed;
      vy = Math.sin(phi) * Math.sin(theta) * speed - cfg.velocity * 0.08;
      vz = Math.cos(phi) * speed;
    } else if (pattern === 'brocade') {
      // Brocade: like chrysanthemum but slower, more uniform spread
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const speed = cfg.velocity * scale * (0.6 + Math.random() * 0.4);
      vx = Math.sin(phi) * Math.cos(theta) * speed;
      vy = Math.sin(phi) * Math.sin(theta) * speed + cfg.velocity * 0.10;
      vz = Math.cos(phi) * speed;
    } else if (pattern === 'dragon_egg') {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const speed = cfg.velocity * scale * (0.5 + Math.random() * 0.5);
      vx = Math.sin(phi) * Math.cos(theta) * speed;
      vy = Math.sin(phi) * Math.sin(theta) * speed + cfg.velocity * 0.12;
      vz = Math.cos(phi) * speed;
    } else if (pattern === 'multi_break') {
      // Multi-break: standard spherical initial burst, secondary breaks handled in renderer
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const speed = cfg.velocity * scale * (0.5 + Math.random() * 0.5);
      vx = Math.sin(phi) * Math.cos(theta) * speed;
      vy = Math.sin(phi) * Math.sin(theta) * speed + cfg.velocity * 0.12;
      vz = Math.cos(phi) * speed;
    } else if (pattern === 'time_rain') {
      // Time rain: initial burst with very low gravity, stars hang then rain down
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const speed = cfg.velocity * scale * (0.7 + Math.random() * 0.3);
      vx = Math.sin(phi) * Math.cos(theta) * speed * 0.6;
      vy = Math.abs(Math.sin(phi) * Math.sin(theta)) * speed * 0.4 + cfg.velocity * 0.35; // upward bias
      vz = Math.cos(phi) * speed * 0.6;
    } else if (pattern === 'falling_leaves') {
      // Falling leaves: wide spread, heavy tumbling drag — stars flutter down
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const speed = cfg.velocity * scale * (0.6 + Math.random() * 0.4);
      vx = Math.sin(phi) * Math.cos(theta) * speed;
      vy = Math.sin(phi) * Math.sin(theta) * speed * 0.5 + cfg.velocity * 0.08; // slight upward
      vz = Math.cos(phi) * speed;
    } else if (pattern === 'glitter') {
      // Glitter: spherical burst, delayed secondary scatter handled in renderer
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const speed = cfg.velocity * scale * (0.5 + Math.random() * 0.5);
      vx = Math.sin(phi) * Math.cos(theta) * speed;
      vy = Math.sin(phi) * Math.sin(theta) * speed + cfg.velocity * 0.12;
      vz = Math.cos(phi) * speed;
    } else if (pattern === 'horsetail') {
      // Horsetail: heavy charcoal stars, tight upward cone, extreme droop
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI * 0.25; // tight upward cone
      const speed = cfg.velocity * scale * (0.7 + Math.random() * 0.3);
      vx = Math.sin(phi) * Math.cos(theta) * speed * 0.4;
      vy = Math.cos(phi) * speed;
      vz = Math.sin(phi) * Math.sin(theta) * speed * 0.4;
    } else if (pattern === 'brocade_crown') {
      // Brocade crown: like brocade but with wider spread and auto-pistil
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const speed = cfg.velocity * scale * (0.55 + Math.random() * 0.45);
      vx = Math.sin(phi) * Math.cos(theta) * speed;
      vy = Math.sin(phi) * Math.sin(theta) * speed + cfg.velocity * 0.15;
      vz = Math.cos(phi) * speed;
    } else if (pattern === 'saturn') {
      // Saturn: 60% stars in equatorial ring, 40% in polar burst
      const isRing = (i / count) < 0.6;
      if (isRing) {
        const ringAngle = ((i / (count * 0.6)) * Math.PI * 2) + (Math.random() - 0.5) * 0.08;
        const speed = cfg.velocity * scale * (0.85 + Math.random() * 0.15);
        vx = Math.cos(ringAngle) * speed;
        vy = (Math.random() - 0.5) * speed * 0.06; // very flat
        vz = Math.sin(ringAngle) * speed;
      } else {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI * 0.35; // upward polar cone
        const speed = cfg.velocity * scale * (0.5 + Math.random() * 0.5) * 0.7;
        vx = Math.sin(phi) * Math.cos(theta) * speed * 0.3;
        vy = Math.cos(phi) * speed;
        vz = Math.sin(phi) * Math.sin(theta) * speed * 0.3;
      }
    } else if (pattern === 'dahlia') {
      // Dahlia: fewer, larger stars with HIGH velocity — short-lived, bright burst
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const speed = cfg.velocity * scale * (0.85 + Math.random() * 0.15);
      vx = Math.sin(phi) * Math.cos(theta) * speed;
      vy = Math.sin(phi) * Math.sin(theta) * speed + cfg.velocity * 0.12;
      vz = Math.cos(phi) * speed;
    } else if (pattern === 'coconut_tree') {
      // Coconut tree: upward-biased palm variant with fewer, heavier charcoal stars
      // Very tight upward cone (~20°), heavy gravity droop creates "trunk + fronds"
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI * 0.22; // tighter than palm
      const speed = cfg.velocity * scale * (0.7 + Math.random() * 0.3);
      vx = Math.sin(phi) * Math.cos(theta) * speed * 0.35;
      vy = Math.cos(phi) * speed + cfg.velocity * 0.3;
      vz = Math.sin(phi) * Math.sin(theta) * speed * 0.35;
    } else if (pattern === 'spider_web') {
      // Spider web: radial arms (8-12) with interconnecting "web" stars between arms
      const armCount = 10;
      const isArm = (i % 3) !== 2; // 2/3 arm stars, 1/3 web connectors
      if (isArm) {
        const arm = i % armCount;
        const armAngle = (arm / armCount) * Math.PI * 2;
        const jitter = (Math.random() - 0.5) * 0.04; // very tight arm
        const speed = cfg.velocity * scale * (0.7 + Math.random() * 0.3);
        vx = Math.cos(armAngle + jitter) * speed;
        vy = (Math.random() - 0.5) * speed * 0.08 + cfg.velocity * 0.06;
        vz = Math.sin(armAngle + jitter) * speed;
      } else {
        // Web connector: ring-like at varying radii
        const ringRadius = 0.3 + Math.random() * 0.7;
        const ringAngle = Math.random() * Math.PI * 2;
        const speed = cfg.velocity * scale * ringRadius;
        vx = Math.cos(ringAngle) * speed;
        vy = (Math.random() - 0.5) * speed * 0.1 + cfg.velocity * 0.04;
        vz = Math.sin(ringAngle) * speed;
      }
    } else {
      // Spherical burst (peony, etc.)
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
