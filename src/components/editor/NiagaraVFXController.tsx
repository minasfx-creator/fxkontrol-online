/**
 * NiagaraVFXController — Composable Niagara emitter system for SkyCanvas
 * 
 * Replaces monolithic SmokeController + SparkTrailController with composable
 * NiagaraSystem instances. Each burst event spawns a NiagaraSystem with
 * multiple emitters (sparks, smoke, embers, ribbons, heat haze).
 * 
 * Wired modules:
 *   - Soft particles (depth-fade) for smoke
 *   - Velocity stretching for sparks
 *   - Ribbon trails for comet/willow patterns
 *   - Flipbook animation for smoke puffs
 *   - Heat distortion for large caliber shells
 *   - Sub-emitter spawning (ember on spark death)
 *   - Thermal color chemistry for temperature-based evolution
 */

import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useProjectStore, EFFECT_LIBRARY } from '@/store/useProjectStore';
import { useSceneStore } from '@/store/useSceneStore';
import {
  createEmitter, createSystem, tickSystem, getSystemParticleCount,
  onEmitterEvent, warmupSystem, createEmitterFromTemplate,
  type NiagaraSystem, type NiagaraEmitter, type NiagaraParticle,
} from '@/render_ultra/fireworks/niagaraEmitterSystem';
import { createCollision, createWind, createPointAttractor, createVortex } from '@/render_ultra/fireworks/niagaraForceModules';
import { getBreakHeight, getBreakSpeed } from '@/lib/pyroPhysics';
import { thermalColor, getCompound, type ChemicalCompound } from '@/render_ultra/fireworks/particleChemistry';
import { clampNiagaraHDR, getNiagaraBudgets } from '@/lib/niagaraBlenderRules';
import { createSmokeSoftMaterial } from '@/render_ultra/fireworks/softParticleShader';
import { RibbonTrail } from '@/render_ultra/fireworks/ribbonTrailRenderer';
import { HeatHazeEmitter } from '@/render_ultra/fireworks/heatDistortion';
import { createFluidGrid, advectFluid, applyWindForce, type FluidGrid } from '@/render_ultra/fireworks/niagaraFluids';
import { InstancedParticleRenderer, createSparkInstancedRenderer, createSmokeInstancedRenderer } from '@/render_ultra/fireworks/instancedParticleRenderer';
import { GlobalIlluminationSystem } from '@/render_ultra/lighting/globalIllumination';
import { spawnScorchMark, spawnLightSplash, updateDecals } from '@/render_ultra/environment/groundDecals';

// ── Niagara Profile Type ─────────────────────────────────────────────

interface NiagaraProfile {
  starCount: number;
  lifetime: number;
  velocity: number;
  drag: number;
  gravityScale: number;
  sparkleRate: number;
  glowIntensity: number;
  fadeProfile: 'linear' | 'exponential' | 'ember';
}

// ── Color-over-life curves by fade profile ──────────────────────────

function buildColorOverLife(color: THREE.Color, fadeProfile: string, sparkleRate: number) {
  const base: Array<{ t: number; color: THREE.Color }> = [];

  switch (fadeProfile) {
    case 'ember':
      // Slow warm glow — stays bright longer, fades to deep orange
      base.push(
        { t: 0, color: new THREE.Color(1.5, 1.2, 0.5) },
        { t: 0.2, color: color.clone().multiplyScalar(1.1) },
        { t: 0.5, color: color.clone().multiplyScalar(0.8) },
        { t: 0.75, color: new THREE.Color(0.6, 0.2, 0.02) },
        { t: 1, color: new THREE.Color(0.1, 0.03, 0.0) },
      );
      break;
    case 'linear':
      // Even fade — uniform brightness decay
      base.push(
        { t: 0, color: new THREE.Color(1.5, 1.2, 0.5) },
        { t: 0.25, color: color.clone() },
        { t: 0.5, color: color.clone().multiplyScalar(0.6) },
        { t: 0.75, color: color.clone().multiplyScalar(0.3) },
        { t: 1, color: new THREE.Color(0.05, 0.02, 0.01) },
      );
      break;
    case 'exponential':
    default:
      // Fast initial burn, rapid decay
      base.push(
        { t: 0, color: new THREE.Color(1.5, 1.2, 0.5) },
        { t: 0.15, color: color.clone() },
        { t: 0.4, color: color.clone().multiplyScalar(0.5) },
        { t: 0.7, color: color.clone().multiplyScalar(0.15) },
        { t: 1, color: new THREE.Color(0.08, 0.02, 0.01) },
      );
      break;
  }

  return base;
}

// ── Pattern-specific spawn shape mapping ────────────────────────────

function getSpawnShapeForPattern(pattern: string, caliber: number) {
  switch (pattern) {
    case 'ring':
      return { type: 'torus' as const, radius: caliber * 3, innerRadius: 0.5, surfaceOnly: true };
    case 'mine':
      return { type: 'cone' as const, radius: caliber * 0.5, coneAngle: Math.PI / 12, height: caliber * 2, surfaceOnly: false };
    case 'fan':
      return { type: 'cone' as const, radius: caliber * 0.5, coneAngle: Math.PI / 4, height: caliber * 1.5, surfaceOnly: true };
    case 'palm':
    case 'coconut':
      return { type: 'cone' as const, radius: caliber * 0.5, coneAngle: Math.PI / 7, height: caliber * 2, surfaceOnly: true };
    default:
      return { type: 'sphere' as const, radius: caliber * 0.5, surfaceOnly: true };
  }
}

// ── Pattern-specific velocity bias ──────────────────────────────────

function applyPatternVelocityBias(
  velMin: THREE.Vector3, velMax: THREE.Vector3,
  pattern: string, breakSpd: number
) {
  switch (pattern) {
    case 'mine':
      // Upward only — no downward component
      velMin.set(-breakSpd * 0.3, breakSpd * 0.4, -breakSpd * 0.3);
      velMax.set(breakSpd * 0.3, breakSpd * 1.2, breakSpd * 0.3);
      break;
    case 'palm':
    case 'coconut':
      // Strong upward, wide horizontal, heavy droop from gravity
      velMin.set(-breakSpd * 0.7, breakSpd * 0.2, -breakSpd * 0.7);
      velMax.set(breakSpd * 0.7, breakSpd * 0.9, breakSpd * 0.7);
      break;
    case 'willow':
    case 'kamuro':
    case 'horsetail':
      // Downward-heavy bias, low velocity
      velMin.set(-breakSpd * 0.5, -breakSpd * 0.2, -breakSpd * 0.5);
      velMax.set(breakSpd * 0.5, breakSpd * 0.6, breakSpd * 0.5);
      break;
    case 'comet':
      // Single direction, high velocity
      velMin.set(-breakSpd * 0.05, breakSpd * 0.8, -breakSpd * 0.05);
      velMax.set(breakSpd * 0.05, breakSpd * 1.2, breakSpd * 0.05);
      break;
    case 'fan':
      // Wide horizontal spread, limited vertical
      velMin.set(-breakSpd * 0.8, breakSpd * 0.1, -breakSpd * 0.2);
      velMax.set(breakSpd * 0.8, breakSpd * 0.5, breakSpd * 0.2);
      break;
    default:
      // Standard spherical burst
      velMin.set(-breakSpd * 0.6, -breakSpd * 0.3, -breakSpd * 0.6);
      velMax.set(breakSpd * 0.6, breakSpd * 0.8, breakSpd * 0.6);
      break;
  }
}

// ── Emitter Templates ───────────────────────────────────────────────

function createSparkEmitterTemplate(
  caliber: number,
  color: THREE.Color,
  pattern?: string,
  niagaraProfile?: NiagaraProfile,
): NiagaraEmitter {
  const breakSpd = getBreakSpeed(caliber);
  const pat = pattern || '';

  // Apply niagaraProfile overrides or use defaults
  const sparkCount = niagaraProfile
    ? Math.min(500, niagaraProfile.starCount)
    : Math.min(100, Math.round(caliber * 12));

  const lifetime: [number, number] = niagaraProfile
    ? [niagaraProfile.lifetime * 0.4, niagaraProfile.lifetime]
    : [0.6, 1.8 * (caliber / 6)];

  const velocityScale = niagaraProfile ? niagaraProfile.velocity / 42 : 1;
  const drag = niagaraProfile ? (1 - niagaraProfile.drag) * 2 : 0.06;
  const gravityScale = niagaraProfile ? niagaraProfile.gravityScale : 1.0;
  const fadeProfile = niagaraProfile ? niagaraProfile.fadeProfile : 'exponential';
  const sparkleRate = niagaraProfile ? niagaraProfile.sparkleRate : 0;

  const velMin = new THREE.Vector3();
  const velMax = new THREE.Vector3();
  applyPatternVelocityBias(velMin, velMax, pat, breakSpd * velocityScale);

  const spawnShape = getSpawnShapeForPattern(pat, caliber);

  // Build color over life based on fade profile
  const colorOverLife = buildColorOverLife(color, fadeProfile, sparkleRate);

  // Size curve — strobe uses blink pattern
  const sizeOverLife = pat === 'strobe'
    ? [
        { t: 0, value: 1.2 },
        { t: 0.15, value: 0.1 },
        { t: 0.3, value: 1.0 },
        { t: 0.45, value: 0.1 },
        { t: 0.6, value: 0.8 },
        { t: 0.75, value: 0.1 },
        { t: 0.9, value: 0.5 },
        { t: 1, value: 0 },
      ]
    : [
        { t: 0, value: 1.2 },
        { t: 0.5, value: 0.8 },
        { t: 1, value: 0 },
      ];

  // Force modules per pattern
  const forceModules: any[] = [
    createCollision('ground', { planeY: 0, restitution: 0.2, friction: 0.6, maxBounces: 2 }),
  ];

  if (pat === 'willow' || pat === 'kamuro' || pat === 'horsetail') {
    forceModules.push(createPointAttractor('droop-attractor', {
      position: new THREE.Vector3(0, -50, 0),
      strength: pat === 'horsetail' ? 0.5 : 1.5,
      radius: 200,
    }));
  }

  if (pat === 'tourbillion') {
    forceModules.push(createVortex('spin-vortex', {
      axis: new THREE.Vector3(0, 1, 0),
      strength: 15,
      radius: caliber * 5,
    }));
  }

  // Sub-emitters: crossette gets 4-way split on death
  const subEmitters: any[] = [];

  if (pat === 'crossette') {
    subEmitters.push({
      triggerEvent: 'particle-death',
      emitterTemplate: createEmitter({
        id: `sub-crossette-${Date.now()}`,
        name: 'Crossette Split',
        maxParticles: 16,
        spawn: { rate: 0, burstCount: 4, burstInterval: 0, burstDelay: 0 },
        init: {
          lifetime: [0.6, 1.2],
          size: [0.3, 0.6],
          velocity: {
            min: new THREE.Vector3(-breakSpd * 0.4, -breakSpd * 0.4, -breakSpd * 0.4),
            max: new THREE.Vector3(breakSpd * 0.4, breakSpd * 0.4, breakSpd * 0.4),
          },
          color: color.clone(),
        },
        update: [{
          drag: 0.08, gravityScale: 1.0,
          curlNoiseStrength: 0, curlNoiseScale: 0,
          colorOverLife: buildColorOverLife(color, 'linear', 0),
          sizeOverLife: [{ t: 0, value: 1 }, { t: 1, value: 0 }],
          rotationRate: 0,
        }],
        render: { mode: 'gpu-sprite', blendMode: 'additive', velocityStretch: true, stretchScale: 0.3 },
      }),
      maxInstances: 16,
      inheritVelocity: 0.3,
    });
  } else {
    // Default: small ember sub-emitter on death
    subEmitters.push({
      triggerEvent: 'particle-death',
      emitterTemplate: createEmitter({
        id: `sub-ember-${Date.now()}`,
        name: 'Sub Ember',
        maxParticles: 4,
        spawn: { rate: 0, burstCount: 2, burstInterval: 0, burstDelay: 0 },
        init: {
          lifetime: [0.5, 1.2],
          size: [0.08, 0.15],
          velocity: { min: new THREE.Vector3(-1, -0.5, -1), max: new THREE.Vector3(1, 0.5, 1) },
          color: new THREE.Color(1, 0.3, 0.02),
        },
        update: [{ drag: 1.2, gravityScale: 0.8, curlNoiseStrength: 0, curlNoiseScale: 0, colorOverLife: [], sizeOverLife: [], rotationRate: 0 }],
        render: { mode: 'gpu-sprite', blendMode: 'additive' },
      }),
      maxInstances: 8,
      inheritVelocity: 0.15,
    });
  }

  const emitter = createEmitter({
    id: `spark-burst-${Date.now()}-${Math.random()}`,
    name: 'Burst Sparks',
    maxParticles: sparkCount,
    spawn: { rate: 0, burstCount: sparkCount, burstInterval: 0, burstDelay: 0 },
    init: {
      lifetime,
      size: [0.3, 0.8],
      velocity: { min: velMin, max: velMax },
      color: color.clone(),
      spawnShape,
    },
    update: [{
      drag,
      gravityScale,
      curlNoiseStrength: 0,
      curlNoiseScale: 0,
      colorOverLife,
      sizeOverLife,
      rotationRate: 0,
    }],
    render: {
      mode: 'gpu-sprite',
      blendMode: 'additive',
      velocityStretch: true,
      stretchScale: pat === 'comet' ? 0.8 : 0.4,
    },
    forceModules,
    subEmitters,
  });

  return emitter;
}

function createSmokeEmitterTemplate(caliber: number): NiagaraEmitter {
  const smokeCount = Math.min(50, Math.round(10 + caliber * 4));

  return createEmitter({
    id: `smoke-burst-${Date.now()}-${Math.random()}`,
    name: 'Burst Smoke',
    maxParticles: smokeCount * 3,
    spawn: { rate: smokeCount * 0.5, burstCount: smokeCount, burstInterval: 0, burstDelay: 0 },
    init: {
      lifetime: [3, 7],
      size: [caliber * 2, caliber * 5],
      velocity: {
        min: new THREE.Vector3(-3, 1, -3),
        max: new THREE.Vector3(3, 5, 3),
      },
      color: new THREE.Color(0.15, 0.14, 0.12),
      spawnShape: { type: 'sphere', radius: caliber * 2, surfaceOnly: false },
    },
    update: [{
      drag: 1.5,
      gravityScale: -0.08,
      curlNoiseStrength: 4,
      curlNoiseScale: 0.04,
      colorOverLife: [
        { t: 0, color: new THREE.Color(0.3, 0.28, 0.25) },
        { t: 0.3, color: new THREE.Color(0.2, 0.19, 0.18) },
        { t: 1, color: new THREE.Color(0.1, 0.1, 0.1) },
      ],
      sizeOverLife: [
        { t: 0, value: 0.4 },
        { t: 0.2, value: 0.8 },
        { t: 0.5, value: 1.0 },
        { t: 1, value: 1.5 },
      ],
      rotationRate: 0.3,
    }],
    render: {
      mode: 'sprite',
      blendMode: 'normal',
      softParticles: true,
      softRange: 1.5,
    },
  });
}

function createEmberEmitterTemplate(caliber: number, color: THREE.Color): NiagaraEmitter {
  const emberCount = Math.min(30, Math.round(caliber * 4));

  return createEmitter({
    id: `ember-${Date.now()}-${Math.random()}`,
    name: 'Embers',
    maxParticles: emberCount,
    spawn: { rate: 0, burstCount: emberCount, burstInterval: 0, burstDelay: 0.1 },
    init: {
      lifetime: [2, 5],
      size: [0.15, 0.4],
      velocity: {
        min: new THREE.Vector3(-5, -2, -5),
        max: new THREE.Vector3(5, 3, 5),
      },
      color: new THREE.Color(1, 0.4, 0.05),
      spawnShape: { type: 'sphere', radius: caliber * 3, surfaceOnly: false },
    },
    update: [{
      drag: 0.8,
      gravityScale: 0.6,
      curlNoiseStrength: 2,
      curlNoiseScale: 0.08,
      colorOverLife: [
        { t: 0, color: new THREE.Color(1.2, 0.6, 0.1) },
        { t: 0.5, color: new THREE.Color(0.8, 0.2, 0.02) },
        { t: 1, color: new THREE.Color(0.1, 0.02, 0.0) },
      ],
      sizeOverLife: [
        { t: 0, value: 1 },
        { t: 0.8, value: 0.5 },
        { t: 1, value: 0 },
      ],
      rotationRate: 2,
    }],
    render: {
      mode: 'gpu-sprite',
      blendMode: 'additive',
    },
    forceModules: [
      createCollision('ground', { planeY: 0, restitution: 0.15, friction: 0.8, maxBounces: 1 }),
    ],
  });
}

// ── Stylized Fire Presets — NS_Stylized_Fire UE5 reference ──────────

type StylizedFirePreset = 'stylized-fire-01' | 'stylized-fire-02' | 'stylized-fire-radial-01' | 'stylized-fire-radial-02' | 'stylized-fire-large-01' | 'stylized-fire-01-ethereal' | 'stylized-fire-02-ethereal' | 'stylized-fire-radial-01-ethereal' | 'stylized-fire-radial-02-ethereal';
type StylizedFireMode = 'infinite' | 'once';

interface StylizedFireConfig {
  preset: StylizedFirePreset;
  mode: StylizedFireMode;
  position: THREE.Vector3;
  scale?: number;
  color?: THREE.Color;
}

const STYLIZED_FIRE_PROFILES: Record<StylizedFirePreset, {
  particleCount: number;
  lifetime: [number, number];
  velocity: { min: THREE.Vector3; max: THREE.Vector3 };
  size: [number, number];
  spawnRadius: number;
  gravityScale: number;
  drag: number;
}> = {
  'stylized-fire-01': {
    particleCount: 60,
    lifetime: [0.4, 1.2],
    velocity: { min: new THREE.Vector3(-0.8, 2, -0.8), max: new THREE.Vector3(0.8, 6, 0.8) },
    size: [0.3, 0.8],
    spawnRadius: 0.5,
    gravityScale: -0.3,
    drag: 0.5,
  },
  'stylized-fire-02': {
    particleCount: 80,
    lifetime: [0.3, 1.0],
    velocity: { min: new THREE.Vector3(-1.2, 1.5, -1.2), max: new THREE.Vector3(1.2, 5, 1.2) },
    size: [0.4, 1.0],
    spawnRadius: 0.8,
    gravityScale: -0.25,
    drag: 0.6,
  },
  'stylized-fire-radial-01': {
    particleCount: 120,
    lifetime: [0.2, 0.8],
    velocity: { min: new THREE.Vector3(-4, 0.5, -4), max: new THREE.Vector3(4, 5, 4) },
    size: [0.5, 1.5],
    spawnRadius: 0.3,
    gravityScale: -0.1,
    drag: 0.8,
  },
  'stylized-fire-radial-02': {
    particleCount: 150,
    lifetime: [0.15, 0.6],
    velocity: { min: new THREE.Vector3(-6, 1, -6), max: new THREE.Vector3(6, 8, 6) },
    size: [0.6, 2.0],
    spawnRadius: 0.2,
    gravityScale: -0.05,
    drag: 1.0,
  },
  'stylized-fire-large-01': {
    particleCount: 100,
    lifetime: [0.5, 1.8],
    velocity: { min: new THREE.Vector3(-1.5, 3, -1.5), max: new THREE.Vector3(1.5, 10, 1.5) },
    size: [0.8, 2.5],
    spawnRadius: 1.2,
    gravityScale: -0.4,
    drag: 0.4,
  },
  // ── Ethereal Variants — cold cyan/purple supernatural fire ──
  'stylized-fire-01-ethereal': {
    particleCount: 60,
    lifetime: [0.5, 1.5],
    velocity: { min: new THREE.Vector3(-0.8, 2, -0.8), max: new THREE.Vector3(0.8, 6, 0.8) },
    size: [0.3, 0.8],
    spawnRadius: 0.5,
    gravityScale: -0.45,
    drag: 0.4,
  },
  'stylized-fire-02-ethereal': {
    particleCount: 80,
    lifetime: [0.4, 1.2],
    velocity: { min: new THREE.Vector3(-1.2, 1.5, -1.2), max: new THREE.Vector3(1.2, 5, 1.2) },
    size: [0.4, 1.0],
    spawnRadius: 0.8,
    gravityScale: -0.35,
    drag: 0.5,
  },
  'stylized-fire-radial-01-ethereal': {
    particleCount: 120,
    lifetime: [0.25, 1.0],
    velocity: { min: new THREE.Vector3(-4, 0.5, -4), max: new THREE.Vector3(4, 5, 4) },
    size: [0.5, 1.5],
    spawnRadius: 0.3,
    gravityScale: -0.15,
    drag: 0.7,
  },
  'stylized-fire-radial-02-ethereal': {
    particleCount: 150,
    lifetime: [0.2, 0.75],
    velocity: { min: new THREE.Vector3(-6, 1, -6), max: new THREE.Vector3(6, 8, 6) },
    size: [0.6, 2.0],
    spawnRadius: 0.2,
    gravityScale: -0.08,
    drag: 0.9,
  },
};

function createStylizedFireEmitter(config: StylizedFireConfig): NiagaraEmitter {
  const profile = STYLIZED_FIRE_PROFILES[config.preset];
  const scale = config.scale ?? 1;
  const isEthereal = config.preset.includes('ethereal');
  const baseColor = config.color ?? (isEthereal ? new THREE.Color(0.1, 0.8, 1.0) : new THREE.Color(1, 0.5, 0.05));

  const fireColorOverLife = isEthereal ? [
    { t: 0, color: new THREE.Color(1.5, 1.5, 2.0) },
    { t: 0.15, color: new THREE.Color(0.2, 1.2, 1.8) },
    { t: 0.35, color: new THREE.Color(0.4, 0.3, 1.5) },
    { t: 0.55, color: new THREE.Color(0.3, 0.05, 0.8) },
    { t: 0.75, color: new THREE.Color(0.1, 0.02, 0.3) },
    { t: 1, color: new THREE.Color(0.02, 0.01, 0.05) },
  ] : [
    { t: 0, color: new THREE.Color(1.5, 1.3, 0.3) },
    { t: 0.15, color: baseColor.clone().multiplyScalar(1.8) },
    { t: 0.35, color: baseColor.clone() },
    { t: 0.55, color: new THREE.Color(0.9, 0.2, 0.02) },
    { t: 0.75, color: new THREE.Color(0.3, 0.05, 0.01) },
    { t: 1, color: new THREE.Color(0.05, 0.01, 0.0) },
  ];

  return createEmitter({
    id: `stylized-fire-${config.preset}-${Date.now()}-${Math.random()}`,
    name: `Stylized Fire ${config.preset}`,
    maxParticles: Math.round(profile.particleCount * scale),
    spawn: config.mode === 'infinite'
      ? { rate: profile.particleCount * 2, burstCount: 0, burstInterval: 0, burstDelay: 0 }
      : { rate: 0, burstCount: profile.particleCount, burstInterval: 0, burstDelay: 0 },
    init: {
      lifetime: profile.lifetime,
      size: [profile.size[0] * scale, profile.size[1] * scale],
      velocity: {
        min: profile.velocity.min.clone().multiplyScalar(scale),
        max: profile.velocity.max.clone().multiplyScalar(scale),
      },
      color: baseColor,
      spawnShape: { type: 'sphere', radius: profile.spawnRadius * scale, surfaceOnly: false },
    },
    update: [{
      drag: profile.drag,
      gravityScale: profile.gravityScale,
      curlNoiseStrength: (isEthereal ? 4.5 : 3) * scale,
      curlNoiseScale: isEthereal ? 0.08 : 0.1,
      colorOverLife: fireColorOverLife,
      sizeOverLife: [
        { t: 0, value: 0.3 },
        { t: 0.15, value: 1.0 },
        { t: 0.5, value: 0.7 },
        { t: 0.8, value: 0.3 },
        { t: 1, value: 0 },
      ],
      rotationRate: 1.5,
    }],
    render: {
      mode: 'gpu-sprite',
      blendMode: 'additive',
      softParticles: true,
      softRange: 0.5,
    },
  });
}

// Expose for stage flame jets
export { createStylizedFireEmitter, STYLIZED_FIRE_PROFILES };
export type { StylizedFireConfig, StylizedFirePreset, StylizedFireMode };

// ── Active VFX System Pool ──────────────────────────────────────────

interface ActiveVFXSystem {
  system: NiagaraSystem;
  birthTime: number;
  maxAge: number;
  position: THREE.Vector3;
  ribbonTrail?: RibbonTrail;
  pattern?: string;
}

// ── GPU Instanced Renderer (replaces manual Points + buffer writes) ──

function collectParticlesFromSystems(
  systems: ActiveVFXSystem[],
  filterAdditive: boolean,
  hdrScale: number,
): Array<{ position: THREE.Vector3; velocity: THREE.Vector3; color: THREE.Color; size: number; opacity: number }> {
  const result: Array<{ position: THREE.Vector3; velocity: THREE.Vector3; color: THREE.Color; size: number; opacity: number }> = [];

  for (const { system, position: sysPos } of systems) {
    const allEmitters = [...system.emitters, ...system._activeSubEmitters];
    for (const emitter of allEmitters) {
      if (!emitter.enabled) continue;
      const isNormal = emitter.renderModule.blendMode === 'normal';
      if (filterAdditive && isNormal) continue;
      if (!filterAdditive && !isNormal) continue;

      for (const p of emitter.particles) {
        if (!p.alive || result.length >= 4096) continue;
        const t = p.age / p.lifetime;
        const thermalT = filterAdditive ? (1 - t) : 1;
        const opacity = filterAdditive ? Math.max(0, 1 - t) : Math.max(0, (1 - t) * 0.35);

        const [r, g, b] = filterAdditive
          ? clampNiagaraHDR(p.color.r * hdrScale * thermalT, p.color.g * hdrScale * thermalT, p.color.b * hdrScale * thermalT)
          : [p.color.r, p.color.g, p.color.b];

        result.push({
          position: new THREE.Vector3(p.position.x + sysPos.x, p.position.y + sysPos.y, p.position.z + sysPos.z),
          velocity: p.velocity.clone(),
          color: new THREE.Color(r, g, b),
          size: p.size,
          opacity,
        });
      }
    }
  }

  return result;
}

// ── Main Component ──────────────────────────────────────────────────

const NiagaraVFXController = React.forwardRef<THREE.Group, {}>(
  function NiagaraVFXController(_props, _ref) {
    const { scene, camera, size } = useThree();
    const activeSystems = useRef<ActiveVFXSystem[]>([]);
    const lastBurstIds = useRef<Set<string>>(new Set());
    const fluidGridRef = useRef<FluidGrid>(createFluidGrid(64, 64));
    const { hdrMultiplier, effectBrightness } = useSceneStore(st => st.settings);
    const environment = useSceneStore(st => st.environment);

    // ── GPU Instanced Renderers (replaces manual Points + buffer writes) ──
    const sparkRenderer = useMemo(() => createSparkInstancedRenderer(4096), []);
    const smokeRenderer = useMemo(() => createSmokeInstancedRenderer(2048), []);

    // Heat haze emitter for large caliber bursts (≥6")
    const heatHazeRef = useRef<HeatHazeEmitter | null>(null);

    // Ribbon trails pool for comet/willow patterns
    const ribbonTrailsRef = useRef<RibbonTrail[]>([]);

    // Expose fluid grid globally for effects to read
    useEffect(() => {
      (window as any).__niagaraFluidGrid = fluidGridRef.current;
      return () => { delete (window as any).__niagaraFluidGrid; };
    }, []);

    useEffect(() => {
      // Add instanced meshes to scene
      sparkRenderer.mesh.renderOrder = 50;
      smokeRenderer.mesh.renderOrder = 10;
      scene.add(sparkRenderer.mesh);
      scene.add(smokeRenderer.mesh);

      // Heat haze emitter
      const haze = new HeatHazeEmitter(32);
      scene.add(haze.mesh);
      heatHazeRef.current = haze;

      return () => {
        scene.remove(sparkRenderer.mesh);
        scene.remove(smokeRenderer.mesh);
        scene.remove(haze.mesh);
        sparkRenderer.dispose();
        smokeRenderer.dispose();
        haze.dispose();
        // Dispose ribbon trails
        ribbonTrailsRef.current.forEach(rt => {
          scene.remove(rt.mesh);
          rt.dispose();
        });
      };
    }, [scene]);

    // Wind force module (shared, updated each frame)
    const windModuleRef = useRef(createWind('env-wind', {
      direction: new THREE.Vector3(1, 0, 0),
      strength: 0,
      turbulence: 0.2,
      turbulenceScale: 0.05,
    }));

    useFrame((state, delta) => {
      const dt = Math.min(delta, 0.05);
      const systems = activeSystems.current;
      const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
      const budgets = getNiagaraBudgets(isMobile);

      // ── Advect fluid grid ──
      const grid = fluidGridRef.current;
      const { wind } = useProjectStore.getState();
      if (wind.enabled) {
        const rad = (wind.direction * Math.PI) / 180;
        applyWindForce(grid, Math.sin(rad) * wind.speed * 0.1, Math.cos(rad) * wind.speed * 0.1, dt);
      }
      advectFluid(grid, dt);

      // ── Update wind module from project state ──
      if (wind.enabled) {
        const windRad = (wind.direction * Math.PI) / 180;
        windModuleRef.current.direction.set(Math.sin(windRad), 0, Math.cos(windRad));
        windModuleRef.current.strength = wind.speed * 0.5;
        windModuleRef.current.enabled = true;
      } else {
        windModuleRef.current.enabled = false;
      }

      // ── Detect new bursts from timeline ──
      const { timelineItems, currentTime } = useProjectStore.getState();
      const newBurstIds = new Set<string>();

      // Access HDR lighting rig for burst lights (exposed by SceneLighting)
      const hdrRig = (window as any).__hdrLightingRig as ReturnType<typeof import('@/render_ultra/lighting/hdrLighting').createHDRLightingRig> | undefined;

      // Access cloud/fog systems for explosion flash
      const cloudSystem = (window as any).__volumetricCloudSystem as { flashExplosion: (color: THREE.Color, intensity: number, position?: THREE.Vector3) => void } | undefined;
      const fogSystem = (window as any).__volumetricFogSystem as { flashExplosion: (position: THREE.Vector3, color: THREE.Color, intensity: number) => void } | undefined;

      for (const item of timelineItems) {
        const elapsed = currentTime - item.startTime;
        if (elapsed >= 0 && elapsed < 0.06) {
          const effect = EFFECT_LIBRARY.find(e => e.id === item.effectId);
          if (!effect || effect.type !== 'firework') continue;

          const burstKey = `${item.id}-${Math.floor(currentTime * 20)}`;
          newBurstIds.add(burstKey);

          if (!lastBurstIds.current.has(burstKey) && systems.length < budgets.maxConcurrentBursts * 2) {
            const caliber = effect.caliber || 4;
            const breakH = getBreakHeight(caliber);
            const burstPos = new THREE.Vector3(
              item.position.x,
              item.position.y + breakH,
              item.position.z
            );
            const burstColor = new THREE.Color(effect.color);
            const pattern = (effect as any).burstPattern || (effect as any).pattern || '';
            const niagaraProfile = (effect as any).niagaraProfile as NiagaraProfile | undefined;

            // Create composable NiagaraSystem with multiple emitters — driven by VDL niagaraProfile
            const sparkEmitter = createSparkEmitterTemplate(caliber, burstColor, pattern, niagaraProfile);
            const smokeEmitter = environment.disableSmoke ? null : createSmokeEmitterTemplate(caliber);
            const emberEmitter = createEmberEmitterTemplate(caliber, burstColor);

            // Add wind to all emitters
            const windMod = windModuleRef.current;
            sparkEmitter.forceModules.push(windMod);
            emberEmitter.forceModules.push(windMod);
            if (smokeEmitter) smokeEmitter.forceModules.push(windMod);

            const emitters = [sparkEmitter, emberEmitter];
            if (smokeEmitter) emitters.push(smokeEmitter);

            const sys = createSystem({
              id: `burst-vfx-${burstKey}`,
              name: `Burst VFX ${caliber}"`,
              emitters,
              maxParticleBudget: isMobile ? 256 : 1024,
              scalabilityGroup: isMobile ? 'mobile' : 'high',
            });

            const entry: ActiveVFXSystem = {
              system: sys,
              birthTime: performance.now(),
              maxAge: 8 + caliber * 0.5,
              position: burstPos,
              pattern,
            };

            // Ribbon trail for comet/willow patterns
            if (pattern === 'comet' || pattern === 'willow') {
              const ribbon = new RibbonTrail({
                maxPoints: 48,
                lifetime: 2.5,
                baseWidth: caliber * 0.6,
                blendMode: 'additive',
                widthCurve: [
                  { t: 0, value: 1 },
                  { t: 0.5, value: 0.6 },
                  { t: 1, value: 0 },
                ],
              });
              scene.add(ribbon.mesh);
              ribbonTrailsRef.current.push(ribbon);
              entry.ribbonTrail = ribbon;
            }

            // Heat haze for large caliber (≥6")
            if (caliber >= 6 && heatHazeRef.current) {
              heatHazeRef.current.emit(burstPos, Math.round(caliber * 1.5), caliber * 3, 2.5);
            }

            // ── Wire burst light to HDR rig ──
            if (hdrRig) {
              hdrRig.spawnBurstLight(burstPos, burstColor, caliber * 2.5, 1.0 + caliber * 0.15);
            }

            // ── Wire cloud/fog explosion flash ──
            if (cloudSystem) {
              cloudSystem.flashExplosion(burstColor, caliber * 0.3, burstPos);
            }
            if (fogSystem) {
              fogSystem.flashExplosion(burstPos, burstColor, caliber * 0.3);
            }

            // ── Wire GI probes — explosion bounce light ──
            const giSystem = (window as any).__giSystem as GlobalIlluminationSystem | undefined;
            if (giSystem) {
              giSystem.addExplosionProbe(burstPos, burstColor, caliber * 1.5);
            }

            // ── Wire ground decals — scorch marks + light splash ──
            const groundImpactPos = new THREE.Vector3(burstPos.x, 0, burstPos.z);
            spawnScorchMark(groundImpactPos, caliber * 2);
            spawnLightSplash(groundImpactPos, caliber * 3, burstColor, 3);

            systems.push(entry);
          }
        }
      }

      lastBurstIds.current = newBurstIds;

      // ── Tick all active systems ──
      for (let i = systems.length - 1; i >= 0; i--) {
        const entry = systems[i];
        tickSystem(entry.system, dt);

        // Update ribbon trail — feed positions from lead spark particles
        if (entry.ribbonTrail) {
          const sparkEmitter = entry.system.emitters.find(e => e.name === 'Burst Sparks');
          if (sparkEmitter) {
            const leadParticle = sparkEmitter.particles.find(p => p.alive);
            if (leadParticle) {
              const worldPos = leadParticle.position.clone().add(entry.position);
              const t = leadParticle.age / leadParticle.lifetime;
              entry.ribbonTrail.addPoint(
                worldPos,
                leadParticle.color.clone(),
                1 - t,
                entry.ribbonTrail['config'].baseWidth * (1 - t * 0.5)
              );
            }
          }
          const camPos = camera instanceof THREE.PerspectiveCamera ? camera.position : undefined;
          entry.ribbonTrail.update(dt, camPos);
        }

        // Remove expired systems
        const age = (performance.now() - entry.birthTime) / 1000;
        const particleCount = getSystemParticleCount(entry.system);
        if (age > entry.maxAge || (age > 1 && particleCount === 0)) {
          // Clean up ribbon trail
          if (entry.ribbonTrail) {
            scene.remove(entry.ribbonTrail.mesh);
            entry.ribbonTrail.dispose();
            const rtIdx = ribbonTrailsRef.current.indexOf(entry.ribbonTrail);
            if (rtIdx >= 0) ribbonTrailsRef.current.splice(rtIdx, 1);
          }
          systems.splice(i, 1);
        }
      }

      // ── Update heat haze ──
      if (heatHazeRef.current) {
        heatHazeRef.current.setResolution(size.width, size.height);
        heatHazeRef.current.update(dt);
      }

      // ── Update burst lights (HDR rig decay) ──
      if (hdrRig) {
        hdrRig.updateBurstLights(dt);
      }

      // ── Update ground decals ──
      updateDecals(dt);

      // ── Write to GPU Instanced Renderers ──
      const hdrScale = THREE.MathUtils.clamp(
        (hdrMultiplier / 3.5) * THREE.MathUtils.clamp(effectBrightness, 0.6, 1.8),
        0.6, 2.0
      );

      const sparkParticles = collectParticlesFromSystems(systems, true, hdrScale);
      sparkRenderer.writeParticles(sparkParticles, camera);
      sparkRenderer.update(state.clock.getElapsedTime());

      const smokeParticles = collectParticlesFromSystems(systems, false, 1.0);
      smokeRenderer.writeParticles(smokeParticles, camera);
      smokeRenderer.update(state.clock.getElapsedTime());
    });

    return null;
  }
);

export default NiagaraVFXController;
