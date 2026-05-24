/**
 * FX KONTROL · Burst Pattern Simulation
 * Realistic firework burst patterns — peony, chrysanthemum, willow, palm, ring, heart.
 *
 * v2: Atlas integration.
 *   generateBurstFromAtlas() uses VelocityCone from effectFrameAtlas for
 *   physically accurate per-stage velocity sampling.
 *   generateBurst() retained for backward compatibility with existing renderer calls.
 */

import * as THREE from 'three';
import {
  getAtlasEntry,
  getScaledStages,
  sampleVelocityCone,
  PTYPE,
  scaleCount,
  type EffectStage,
} from './effectFrameAtlas';

export type BurstPattern =
  | 'peony' | 'chrysanthemum' | 'willow' | 'palm' | 'ring' | 'heart'
  | 'crossette' | 'kamuro' | 'brocade' | 'dragon_egg' | 'multi_break'
  | 'time_rain' | 'falling_leaves' | 'glitter' | 'horsetail' | 'brocade_crown'
  | 'saturn' | 'dahlia' | 'coconut_tree' | 'spider_web'
  | 'mine' | 'comet' | 'waterfall' | 'gerb' | 'candle' | 'strobe';

interface BurstConfig {
  starCount: number;
  velocity: number;
  spread: number;         // angular spread factor
  tailFactor: number;     // how much stars trail
  gravityMult: number;    // gravity influence
  symmetry: number;       // radial symmetry count
}

// Star counts calibrated to Finale 3D reference at 3" (75mm) baseline
// gravityMult and tailFactor now SYNC with effectFrameAtlas for consistency.
const BURST_CONFIGS: Record<BurstPattern, BurstConfig> = {
  peony:         { starCount: 280, velocity: 26, spread: 1.0, tailFactor: 0.05, gravityMult: 1.0, symmetry: 0 },  // Grizzly: clean expanding sphere, no tail
  chrysanthemum: { starCount: 200, velocity: 30, spread: 1.0, tailFactor: 1.6, gravityMult: 1.0, symmetry: 0 },   // Grizzly: tailed sphere
  willow:        { starCount: 180, velocity: 18, spread: 0.8, tailFactor: 2.8, gravityMult: 2.2, symmetry: 0 },   // Heavy charcoal, drift down
  palm:          { starCount: 60,  velocity: 24, spread: 0.6, tailFactor: 1.2, gravityMult: 1.6, symmetry: 6 },
  ring:          { starCount: 80,  velocity: 28, spread: 0.1, tailFactor: 0.5, gravityMult: 0.6, symmetry: 0 },
  heart:         { starCount: 100, velocity: 26, spread: 0.0, tailFactor: 0.4, gravityMult: 0.7, symmetry: 0 },
  crossette:     { starCount: 40,  velocity: 32, spread: 0.9, tailFactor: 0.6, gravityMult: 1.0, symmetry: 4 },   // Grizzly: 4-5 stars split
  kamuro:        { starCount: 300, velocity: 18, spread: 1.0, tailFactor: 2.6, gravityMult: 1.5, symmetry: 0 },   // Gold persistent to ground
  brocade:       { starCount: 250, velocity: 23, spread: 1.0, tailFactor: 2.2, gravityMult: 1.3, symmetry: 0 },   // Grizzly: woven gold
  dragon_egg:    { starCount: 40,  velocity: 15, spread: 0.6, tailFactor: 0.3, gravityMult: 1.8, symmetry: 0 },
  multi_break:   { starCount: 120, velocity: 26, spread: 1.0, tailFactor: 0.5, gravityMult: 1.0, symmetry: 0 },
  time_rain:     { starCount: 100, velocity: 22, spread: 0.9, tailFactor: 0.2, gravityMult: 0.3, symmetry: 0 },
  falling_leaves:{ starCount: 80,  velocity: 24, spread: 1.0, tailFactor: 0.8, gravityMult: 1.6, symmetry: 0 },
  glitter:       { starCount: 200, velocity: 26, spread: 1.0, tailFactor: 0.8, gravityMult: 1.0, symmetry: 0 },   // Grizzly: strobing glitter
  horsetail:     { starCount: 160, velocity: 14, spread: 0.7, tailFactor: 2.5, gravityMult: 2.4, symmetry: 0 },   // Heavy cascade
  brocade_crown: { starCount: 220, velocity: 24, spread: 1.0, tailFactor: 1.6, gravityMult: 1.2, symmetry: 0 },
  saturn:        { starCount: 140, velocity: 28, spread: 1.0, tailFactor: 0.5, gravityMult: 0.8, symmetry: 0 },
  dahlia:        { starCount: 60,  velocity: 42, spread: 0.9, tailFactor: 0.2, gravityMult: 1.1, symmetry: 0 },
  coconut_tree:  { starCount: 40,  velocity: 22, spread: 0.5, tailFactor: 1.8, gravityMult: 1.5, symmetry: 5 },
  spider_web:    { starCount: 120, velocity: 32, spread: 1.0, tailFactor: 1.4, gravityMult: 0.6, symmetry: 0 },
  // Ground / device effects (no overhead burst)
  mine:          { starCount: 160, velocity: 24, spread: 0.9, tailFactor: 0.8, gravityMult: 1.0, symmetry: 0 },
  comet:         { starCount: 1,   velocity: 32, spread: 0.1, tailFactor: 3.0, gravityMult: 0.6, symmetry: 0 },
  waterfall:     { starCount: 400, velocity: 5,  spread: 0.2, tailFactor: 1.5, gravityMult: 1.2, symmetry: 0 },
  gerb:          { starCount: 250, velocity: 6,  spread: 0.1, tailFactor: 1.0, gravityMult: 0.8, symmetry: 0 },
  candle:        { starCount: 1,   velocity: 16, spread: 0.1, tailFactor: 1.0, gravityMult: 0.6, symmetry: 0 },
  strobe:        { starCount: 140, velocity: 18, spread: 1.0, tailFactor: 0.1, gravityMult: 0.1, symmetry: 0 },
};

// Aerodynamic-drag-like attenuation factor — breaks perfect CGI sphere.
// Higher initial velocity loses slightly more, mimicking quadratic-ish drag at spawn.
function applyAeroJitter(v: number): number {
  // ±2.5% random per-component + small attenuation prop. to |v|/30
  const jitter = 1 + (Math.random() - 0.5) * 0.05;
  const atten = 1 - 0.018 * Math.min(1, Math.abs(v) / 30);
  return v * jitter * atten;
}

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
      // Palm: 6 symmetric fronds with upward bias and ±6° jitter
      const FROND_COUNT = cfg.symmetry || 6;
      const frondIdx = i % FROND_COUNT;
      const frondCenter = (frondIdx / FROND_COUNT) * Math.PI * 2;
      const frondJitter = (Math.random() - 0.5) * 2 * (6 * Math.PI / 180);
      const palmAngle = frondCenter + frondJitter;
      const phi = Math.random() * Math.PI * 0.35;
      const speed = cfg.velocity * scale * (0.6 + Math.random() * 0.4);
      vx = Math.sin(phi) * Math.cos(palmAngle) * speed * 0.48;
      vy = Math.cos(phi) * speed + cfg.velocity * 0.2;
      vz = Math.sin(phi) * Math.sin(palmAngle) * speed * 0.48;
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
    } else if (pattern === 'peony') {
      // Peony: 12 azimuthal petal clusters with ±8° jitter
      const PETAL_COUNT = 12;
      const petalIndex = i % PETAL_COUNT;
      const petalCenter = (petalIndex / PETAL_COUNT) * Math.PI * 2;
      const jitterAz = (Math.random() - 0.5) * 2 * (8 * Math.PI / 180); // ±8°
      const theta = petalCenter + jitterAz;
      // Elevation: upper hemisphere bias (phi 0.3π–0.8π)
      const phi = Math.PI * (0.3 + Math.random() * 0.5);
      const speed = cfg.velocity * scale * (0.85 + Math.random() * 0.15) * cfg.spread;
      vx = Math.sin(phi) * Math.cos(theta) * speed;
      vy = Math.sin(phi) * Math.sin(theta) * speed + cfg.velocity * 0.15;
      vz = Math.cos(phi) * speed;
    } else {
      // Generic spherical burst fallback
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const speed = cfg.velocity * scale * (0.5 + Math.random() * 0.5) * cfg.spread;
      vx = Math.sin(phi) * Math.cos(theta) * speed;
      vy = Math.sin(phi) * Math.sin(theta) * speed + cfg.velocity * 0.15;
      vz = Math.cos(phi) * speed;
    }

    // Aerodynamic asymmetry — Weingart §III: stars are not perfect spheres.
    // Skip for tightly-symmetric patterns (ring/heart) to preserve geometric intent.
    if (pattern !== 'ring' && pattern !== 'heart' && pattern !== 'spider_web') {
      vx = applyAeroJitter(vx);
      vy = applyAeroJitter(vy);
      vz = applyAeroJitter(vz);
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

// ─────────────────────────────────────────────────────────────────────────────
// Atlas-driven burst generator (v2)
//
// Uses effectFrameAtlas VelocityCone for physically accurate velocity sampling.
// Returns per-particle arrays with stage metadata attached so the GPU compute
// emitter can apply the correct initial temperature, size, gravity and type.
// ─────────────────────────────────────────────────────────────────────────────

export interface AtlasBurstParticle {
  px: number; py: number; pz: number;
  vx: number; vy: number; vz: number;
  tempK: number;
  size: number;
  life: number;         // particle lifetime in seconds
  gravityScale: number;
  dragScale: number;
  particleType: number; // PTYPE constant
  stageIdx: number;     // which atlas stage spawned this particle
}

/**
 * Generate the initial particle burst from the atlas for a given pattern/caliber.
 * Only stages with emissionRate > 0 AND tStart == 0 are used for the
 * instantaneous burst flash. Continuous stages (tStart > 0) are handled
 * by the frame-tick emitter in FireworkRenderer.
 */
export function generateBurstFromAtlas(
  origin: THREE.Vector3,
  pattern: BurstPattern,
  caliberMm: number,
): AtlasBurstParticle[] {
  const entry = getAtlasEntry(pattern);
  const scaledStages = getScaledStages(pattern, caliberMm);

  // Burst flash: only instantaneous stages (tStart <= 0.04)
  const burstStages = scaledStages.filter(s => s.tStart <= 0.04 && s.emissionRate > 0);

  // Total particles = sum of (emissionRate * stage_duration * baseLifetime * caliber_scale)
  const lifetime = entry.baseLifetimeS;
  const particles: AtlasBurstParticle[] = [];

  for (let si = 0; si < burstStages.length; si++) {
    const stage = burstStages[si];
    const stageDuration = (stage.tEnd - stage.tStart) * lifetime;
    const count = scaleCount(Math.round(stage.emissionRate * stageDuration), caliberMm);

    for (let i = 0; i < count; i++) {
      const [vx, vy, vz] = sampleVelocityCone(stage.vel, Math.random);

      // Interpolate temp and size across particle lifetime within stage
      const tRng = Math.random();
      const tempK = stage.tempKStart + (stage.tempKEnd - stage.tempKStart) * tRng;
      const size  = stage.sizeStart  + (stage.sizeEnd  - stage.sizeStart)  * tRng;

      // Particle lifetime = fraction of effect lifetime within this stage
      const particleLife = stageDuration * (0.7 + Math.random() * 0.6);

      particles.push({
        px: origin.x + (Math.random() - 0.5) * 0.3,
        py: origin.y + Math.random() * 0.15,
        pz: origin.z + (Math.random() - 0.5) * 0.3,
        vx, vy, vz,
        tempK, size, life: particleLife,
        gravityScale: stage.gravityScale,
        dragScale: stage.dragScale,
        particleType: stage.particleType,
        stageIdx: si,
      });
    }
  }

  return particles;
}

/**
 * Get the stages that run CONTINUOUSLY during the effect (tStart > 0.04).
 * The renderer ticks these each frame and emits at emissionRate particles/second.
 */
export function getAtlasContinuousStages(
  pattern: BurstPattern,
  caliberMm: number,
): EffectStage[] {
  const scaledStages = getScaledStages(pattern, caliberMm);
  return scaledStages.filter(s => s.tStart > 0.04 && s.emissionRate > 0);
}
