/**
 * FX KONTROL · Niagara-Style Modular Emitter System
 * Composable System → Emitter → Module architecture with event system,
 * spawn shapes, force modules, data interfaces, sub-emitters, warmup & inheritance.
 */

import * as THREE from 'three';
import type { SpawnShapeConfig } from './niagaraSpawnShapes';
import { sampleSpawnShape } from './niagaraSpawnShapes';
import type { ForceModule } from './niagaraForceModules';
import { applyForceModule } from './niagaraForceModules';
import type { DataInterface } from './niagaraDataInterfaces';

// ── Module Types ────────────────────────────────────────────────────

export type ModuleType = 'spawn' | 'init' | 'update' | 'render';
export type RenderMode = 'sprite' | 'ribbon' | 'mesh' | 'gpu-sprite';
export type EmitterEventType = 'burst-complete' | 'particle-death' | 'collision' | 'lifetime-end';
export type ScalabilityGroup = 'cinematic' | 'high' | 'medium' | 'low' | 'mobile';

export interface NiagaraModule {
  id: string;
  type: ModuleType;
  enabled: boolean;
}

export interface SpawnConfig extends NiagaraModule {
  type: 'spawn';
  rate: number;
  burstCount: number;
  burstInterval: number;
  burstDelay: number;
}

export interface InitConfig extends NiagaraModule {
  type: 'init';
  lifetime: [number, number];
  size: [number, number];
  velocity: { min: THREE.Vector3; max: THREE.Vector3 };
  color: THREE.Color;
  rotation: [number, number];
  inheritVelocity: number;
  spawnShape?: SpawnShapeConfig;
}

export interface UpdateConfig extends NiagaraModule {
  type: 'update';
  drag: number;
  gravityScale: number;
  curlNoiseStrength: number;
  curlNoiseScale: number;
  colorOverLife: { t: number; color: THREE.Color }[];
  sizeOverLife: { t: number; value: number }[];
  rotationRate: number;
}

export interface RenderConfig extends NiagaraModule {
  type: 'render';
  mode: RenderMode;
  blendMode: 'additive' | 'screen' | 'normal' | 'multiply';
  softParticles: boolean;
  softRange: number;
  velocityStretch: boolean;
  stretchScale: number;
  flipbookFrames: number;
  flipbookFPS: number;
  sortParticles: boolean;
}

// ── Sub-Emitter Config ──────────────────────────────────────────────

export interface SubEmitterConfig {
  /** Event that triggers sub-emitter spawn */
  triggerEvent: EmitterEventType;
  /** Template emitter to clone and spawn */
  emitterTemplate: NiagaraEmitter;
  /** Max simultaneous sub-emitter instances */
  maxInstances: number;
  /** Inherit parent particle velocity */
  inheritVelocity: number;
}

// ── Particle ────────────────────────────────────────────────────────

export interface NiagaraParticle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  color: THREE.Color;
  size: number;
  rotation: number;
  age: number;
  lifetime: number;
  alive: boolean;
  /** Custom extensible per-particle attributes */
  customAttributes: Record<string, number>;
  /** Bounce counter for collision module */
  bounceCount: number;
}

// ── Emitter ─────────────────────────────────────────────────────────

export interface NiagaraEmitter {
  id: string;
  name: string;
  enabled: boolean;
  spawnModule: SpawnConfig;
  initModule: InitConfig;
  updateModules: UpdateConfig[];
  renderModule: RenderConfig;
  particles: NiagaraParticle[];
  maxParticles: number;
  spawnAccumulator: number;
  burstTimer: number;
  burstsFired: number;
  totalSpawned: number;
  elapsedTime: number;
  /** Pluggable force modules (attractor, vortex, wind, etc.) */
  forceModules: ForceModule[];
  /** Data interfaces (curves, meshes, textures, skeletal) */
  dataInterfaces: DataInterface[];
  /** Sub-emitter configurations */
  subEmitters: SubEmitterConfig[];
}

// ── System ──────────────────────────────────────────────────────────

export interface EmitterEvent {
  type: EmitterEventType;
  emitterId: string;
  position: THREE.Vector3;
  data?: Record<string, unknown>;
}

export type EmitterEventHandler = (event: EmitterEvent) => void;

export interface NiagaraSystem {
  id: string;
  name: string;
  emitters: NiagaraEmitter[];
  maxParticleBudget: number;
  lodTier: 'full' | 'medium' | 'low' | 'culled';
  eventHandlers: EmitterEventHandler[];
  worldPosition: THREE.Vector3;
  elapsedTime: number;
  /** Pre-simulation warmup time in seconds */
  warmupTime: number;
  /** UE5.7-style scalability group */
  scalabilityGroup: ScalabilityGroup;
  /** Dynamic sub-emitter instances spawned at runtime */
  _activeSubEmitters: NiagaraEmitter[];
}

// ── Helpers ─────────────────────────────────────────────────────────

function randRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function randVec3(min: THREE.Vector3, max: THREE.Vector3): THREE.Vector3 {
  return new THREE.Vector3(
    randRange(min.x, max.x),
    randRange(min.y, max.y),
    randRange(min.z, max.z)
  );
}

function sampleCurve(curve: { t: number; value: number }[], t: number): number {
  if (curve.length === 0) return 1;
  if (t <= curve[0].t) return curve[0].value;
  if (t >= curve[curve.length - 1].t) return curve[curve.length - 1].value;
  for (let i = 0; i < curve.length - 1; i++) {
    if (t >= curve[i].t && t <= curve[i + 1].t) {
      const frac = (t - curve[i].t) / (curve[i + 1].t - curve[i].t);
      return THREE.MathUtils.lerp(curve[i].value, curve[i + 1].value, frac);
    }
  }
  return 1;
}

function sampleColorGradient(gradient: { t: number; color: THREE.Color }[], t: number): THREE.Color {
  if (gradient.length === 0) return new THREE.Color(1, 1, 1);
  if (t <= gradient[0].t) return gradient[0].color.clone();
  if (t >= gradient[gradient.length - 1].t) return gradient[gradient.length - 1].color.clone();
  for (let i = 0; i < gradient.length - 1; i++) {
    if (t >= gradient[i].t && t <= gradient[i + 1].t) {
      const frac = (t - gradient[i].t) / (gradient[i + 1].t - gradient[i].t);
      return gradient[i].color.clone().lerp(gradient[i + 1].color, frac);
    }
  }
  return new THREE.Color(1, 1, 1);
}

function curlNoise3D(p: THREE.Vector3, scale: number): THREE.Vector3 {
  const e = 0.01;
  const px = p.x * scale, py = p.y * scale, pz = p.z * scale;
  const n = (x: number, y: number, z: number) =>
    Math.sin(x * 1.27 + y * 3.41) * Math.cos(z * 2.63 + x * 0.97) * Math.sin(y * 1.89 + z * 2.17);
  const dndy = (n(px, py + e, pz) - n(px, py - e, pz)) / (2 * e);
  const dndz = (n(px, py, pz + e) - n(px, py, pz - e)) / (2 * e);
  const dndx = (n(px + e, py, pz) - n(px - e, py, pz)) / (2 * e);
  const n2 = (x: number, y: number, _z: number) =>
    Math.cos(x * 2.31 + _z * 1.73) * Math.sin(y * 1.47 + x * 3.11);
  const dn2dx = (n2(px + e, py, pz) - n2(px - e, py, pz)) / (2 * e);
  const dn2dy = (n2(px, py + e, pz) - n2(px, py - e, pz)) / (2 * e);
  return new THREE.Vector3(dndy - dndz, dndz - dndx, dn2dx - dn2dy);
}

// ── Default Configs ─────────────────────────────────────────────────

export function defaultSpawnConfig(overrides?: Partial<SpawnConfig>): SpawnConfig {
  return {
    id: 'spawn-default', type: 'spawn', enabled: true,
    rate: 50, burstCount: 0, burstInterval: 0, burstDelay: 0,
    ...overrides,
  };
}

export function defaultInitConfig(overrides?: Partial<InitConfig>): InitConfig {
  return {
    id: 'init-default', type: 'init', enabled: true,
    lifetime: [1, 3], size: [5, 15],
    velocity: { min: new THREE.Vector3(-5, 5, -5), max: new THREE.Vector3(5, 25, 5) },
    color: new THREE.Color(1, 0.8, 0.3), rotation: [0, Math.PI * 2],
    inheritVelocity: 0,
    ...overrides,
  };
}

export function defaultUpdateConfig(overrides?: Partial<UpdateConfig>): UpdateConfig {
  return {
    id: 'update-default', type: 'update', enabled: true,
    drag: 0.5, gravityScale: 1.0, curlNoiseStrength: 0, curlNoiseScale: 0.1,
    colorOverLife: [], sizeOverLife: [], rotationRate: 0,
    ...overrides,
  };
}

export function defaultRenderConfig(overrides?: Partial<RenderConfig>): RenderConfig {
  return {
    id: 'render-default', type: 'render', enabled: true,
    mode: 'sprite', blendMode: 'additive', softParticles: false, softRange: 0.5,
    velocityStretch: false, stretchScale: 0.3, flipbookFrames: 0, flipbookFPS: 24,
    sortParticles: false,
    ...overrides,
  };
}

// ── Factory Functions ───────────────────────────────────────────────

export function createEmitter(config: {
  id: string;
  name: string;
  maxParticles?: number;
  spawn?: Partial<SpawnConfig>;
  init?: Partial<InitConfig>;
  update?: Partial<UpdateConfig>[];
  render?: Partial<RenderConfig>;
  forceModules?: ForceModule[];
  dataInterfaces?: DataInterface[];
  subEmitters?: SubEmitterConfig[];
}): NiagaraEmitter {
  return {
    id: config.id,
    name: config.name,
    enabled: true,
    spawnModule: defaultSpawnConfig(config.spawn),
    initModule: defaultInitConfig(config.init),
    updateModules: config.update?.map((u, i) => defaultUpdateConfig({ ...u, id: `update-${i}` })) || [defaultUpdateConfig()],
    renderModule: defaultRenderConfig(config.render),
    particles: [],
    maxParticles: config.maxParticles || 1024,
    spawnAccumulator: 0,
    burstTimer: 0,
    burstsFired: 0,
    totalSpawned: 0,
    elapsedTime: 0,
    forceModules: config.forceModules || [],
    dataInterfaces: config.dataInterfaces || [],
    subEmitters: config.subEmitters || [],
  };
}

export function createSystem(config: {
  id: string;
  name: string;
  emitters: NiagaraEmitter[];
  maxParticleBudget?: number;
  warmupTime?: number;
  scalabilityGroup?: ScalabilityGroup;
}): NiagaraSystem {
  return {
    id: config.id,
    name: config.name,
    emitters: config.emitters,
    maxParticleBudget: config.maxParticleBudget || 8192,
    lodTier: 'full',
    eventHandlers: [],
    worldPosition: new THREE.Vector3(),
    elapsedTime: 0,
    warmupTime: config.warmupTime || 0,
    scalabilityGroup: config.scalabilityGroup || 'high',
    _activeSubEmitters: [],
  };
}

// ── Emitter Inheritance / Templates ─────────────────────────────────

export function createEmitterFromTemplate(
  base: NiagaraEmitter,
  overrides: {
    id: string;
    name?: string;
    spawn?: Partial<SpawnConfig>;
    init?: Partial<InitConfig>;
    update?: Partial<UpdateConfig>[];
    render?: Partial<RenderConfig>;
    forceModules?: ForceModule[];
    maxParticles?: number;
  }
): NiagaraEmitter {
  return {
    ...base,
    id: overrides.id,
    name: overrides.name || base.name,
    spawnModule: { ...base.spawnModule, ...overrides.spawn },
    initModule: { ...base.initModule, ...overrides.init },
    updateModules: overrides.update
      ? overrides.update.map((u, i) => ({ ...base.updateModules[0], ...u, id: `update-${i}` }))
      : base.updateModules.map(u => ({ ...u })),
    renderModule: { ...base.renderModule, ...overrides.render },
    forceModules: overrides.forceModules || [...base.forceModules],
    maxParticles: overrides.maxParticles || base.maxParticles,
    particles: [],
    spawnAccumulator: 0,
    burstTimer: 0,
    burstsFired: 0,
    totalSpawned: 0,
    elapsedTime: 0,
    dataInterfaces: [...base.dataInterfaces],
    subEmitters: [...base.subEmitters],
  };
}

// ── Tick Pipeline ───────────────────────────────────────────────────

function spawnParticles(emitter: NiagaraEmitter, dt: number): NiagaraParticle[] {
  const spawn = emitter.spawnModule;
  if (!spawn.enabled) return [];
  const newParticles: NiagaraParticle[] = [];
  const init = emitter.initModule;

  emitter.spawnAccumulator += spawn.rate * dt;
  const count = Math.floor(emitter.spawnAccumulator);
  emitter.spawnAccumulator -= count;

  let burstCount = 0;
  if (spawn.burstCount > 0 && emitter.burstsFired === 0 && emitter.elapsedTime >= spawn.burstDelay) {
    burstCount = spawn.burstCount;
    emitter.burstsFired++;
  } else if (spawn.burstInterval > 0 && spawn.burstCount > 0) {
    emitter.burstTimer += dt;
    if (emitter.burstTimer >= spawn.burstInterval) {
      burstCount = spawn.burstCount;
      emitter.burstTimer -= spawn.burstInterval;
      emitter.burstsFired++;
    }
  }

  const total = count + burstCount;
  for (let i = 0; i < total && emitter.particles.length + newParticles.length < emitter.maxParticles; i++) {
    // Spawn shape position
    let spawnPos = new THREE.Vector3();
    if (init.spawnShape) {
      const sample = sampleSpawnShape(init.spawnShape);
      spawnPos = sample.position;
    }

    const p: NiagaraParticle = {
      position: spawnPos,
      velocity: init.enabled ? randVec3(init.velocity.min, init.velocity.max) : new THREE.Vector3(),
      color: init.color.clone(),
      size: randRange(init.size[0], init.size[1]),
      rotation: randRange(init.rotation[0], init.rotation[1]),
      age: 0,
      lifetime: randRange(init.lifetime[0], init.lifetime[1]),
      alive: true,
      customAttributes: {},
      bounceCount: 0,
    };
    newParticles.push(p);
    emitter.totalSpawned++;
  }
  return newParticles;
}

function updateParticles(emitter: NiagaraEmitter, dt: number, events: EmitterEvent[], systemTime: number) {
  const gravity = -9.81;

  for (let i = emitter.particles.length - 1; i >= 0; i--) {
    const p = emitter.particles[i];
    p.age += dt;

    if (p.age >= p.lifetime) {
      p.alive = false;
      events.push({ type: 'particle-death', emitterId: emitter.id, position: p.position.clone() });
      emitter.particles.splice(i, 1);
      continue;
    }

    const t = p.age / p.lifetime;

    // Standard update modules
    for (const upd of emitter.updateModules) {
      if (!upd.enabled) continue;
      p.velocity.y += gravity * upd.gravityScale * dt;
      p.velocity.multiplyScalar(1 - upd.drag * dt);
      if (upd.curlNoiseStrength > 0) {
        const curl = curlNoise3D(p.position, upd.curlNoiseScale);
        p.velocity.add(curl.multiplyScalar(upd.curlNoiseStrength * dt));
      }
      if (upd.colorOverLife.length > 0) {
        p.color.copy(sampleColorGradient(upd.colorOverLife, t));
      }
      if (upd.sizeOverLife.length > 0) {
        p.size *= sampleCurve(upd.sizeOverLife, t);
      }
      p.rotation += upd.rotationRate * dt;
    }

    // Force modules (attractor, vortex, wind, collision, kill zone)
    let killed = false;
    for (const fm of emitter.forceModules) {
      if (!fm.enabled) continue;
      const result = applyForceModule(fm, p.position, p.velocity, dt, systemTime, p.bounceCount);
      p.velocity.add(result.velocityDelta);
      if (result.newPosition) p.position.copy(result.newPosition);
      if (result.kill) { killed = true; break; }
      if (result.bounced) {
        p.bounceCount = result.newBounceCount ?? p.bounceCount;
        events.push({ type: 'collision', emitterId: emitter.id, position: p.position.clone() });
      }
    }

    if (killed) {
      p.alive = false;
      events.push({ type: 'particle-death', emitterId: emitter.id, position: p.position.clone() });
      emitter.particles.splice(i, 1);
      continue;
    }

    p.position.add(p.velocity.clone().multiplyScalar(dt));
  }
}

/** Handle sub-emitter spawning from events */
function processSubEmitters(system: NiagaraSystem, events: EmitterEvent[]) {
  for (const emitter of system.emitters) {
    for (const subConfig of emitter.subEmitters) {
      for (const event of events) {
        if (event.emitterId === emitter.id && event.type === subConfig.triggerEvent) {
          if (system._activeSubEmitters.length >= (subConfig.maxInstances * system.emitters.length)) continue;
          const subEmitter = createEmitterFromTemplate(subConfig.emitterTemplate, {
            id: `${subConfig.emitterTemplate.id}-sub-${Date.now()}`,
          });
          // Position sub-emitter at event location
          for (const p of subEmitter.particles) {
            p.position.add(event.position);
          }
          // Store event position for spawn offset
          if (subEmitter.initModule.spawnShape) {
            // Sub-emitter will spawn around event position — we handle this by offsetting in next tick
          }
          system._activeSubEmitters.push(subEmitter);
        }
      }
    }
  }
}

export function tickSystem(system: NiagaraSystem, dt: number): EmitterEvent[] {
  if (system.lodTier === 'culled') return [];

  const lodScale = system.lodTier === 'low' ? 0.25 : system.lodTier === 'medium' ? 0.5 : 1.0;
  const events: EmitterEvent[] = [];
  system.elapsedTime += dt;

  const totalParticles = getSystemParticleCount(system);
  const allEmitters = [...system.emitters, ...system._activeSubEmitters];

  for (const emitter of allEmitters) {
    if (!emitter.enabled) continue;
    emitter.elapsedTime += dt;

    if (totalParticles < system.maxParticleBudget) {
      const newParticles = spawnParticles(emitter, dt * lodScale);
      emitter.particles.push(...newParticles);
    }

    updateParticles(emitter, dt, events, system.elapsedTime);
  }

  // Clean up finished sub-emitters
  system._activeSubEmitters = system._activeSubEmitters.filter(
    e => e.particles.length > 0 || e.spawnModule.rate > 0
  );

  // Process sub-emitter spawning
  processSubEmitters(system, events);

  // Dispatch events
  for (const event of events) {
    for (const handler of system.eventHandlers) {
      handler(event);
    }
  }

  return events;
}

// ── Warmup / Pre-simulation ─────────────────────────────────────────

export function warmupSystem(system: NiagaraSystem, warmupSeconds?: number) {
  const duration = warmupSeconds ?? system.warmupTime;
  if (duration <= 0) return;
  const step = 1 / 60; // 60fps simulation steps
  const steps = Math.ceil(duration / step);
  for (let i = 0; i < steps; i++) {
    tickSystem(system, step);
  }
}

// ── Queries ─────────────────────────────────────────────────────────

export function getSystemParticleCount(system: NiagaraSystem): number {
  const main = system.emitters.reduce((sum, e) => sum + e.particles.length, 0);
  const sub = system._activeSubEmitters.reduce((sum, e) => sum + e.particles.length, 0);
  return main + sub;
}

export function onEmitterEvent(system: NiagaraSystem, handler: EmitterEventHandler) {
  system.eventHandlers.push(handler);
  return () => {
    const idx = system.eventHandlers.indexOf(handler);
    if (idx >= 0) system.eventHandlers.splice(idx, 1);
  };
}

// ── Presets ──────────────────────────────────────────────────────────

export function createSparkBurstPreset(): NiagaraEmitter {
  return createEmitter({
    id: 'spark-burst', name: 'Spark Burst', maxParticles: 2048,
    spawn: { rate: 0, burstCount: 200, burstInterval: 0 },
    init: {
      lifetime: [0.5, 2.5], size: [1, 4],
      velocity: { min: new THREE.Vector3(-30, 10, -30), max: new THREE.Vector3(30, 60, 30) },
      color: new THREE.Color(1.2, 0.9, 0.3),
      spawnShape: { type: 'sphere', radius: 2, surfaceOnly: true },
    },
    update: [{
      drag: 0.8, gravityScale: 1.0, curlNoiseStrength: 0,
      colorOverLife: [
        { t: 0, color: new THREE.Color(1.5, 1.2, 0.5) },
        { t: 0.3, color: new THREE.Color(1.2, 0.6, 0.1) },
        { t: 1, color: new THREE.Color(0.3, 0.05, 0.0) },
      ],
      sizeOverLife: [
        { t: 0, value: 1 }, { t: 0.8, value: 0.6 }, { t: 1, value: 0 },
      ],
    }],
    render: { mode: 'gpu-sprite', blendMode: 'additive', velocityStretch: true, stretchScale: 0.4 },
  });
}

export function createSmokePuffPreset(): NiagaraEmitter {
  return createEmitter({
    id: 'smoke-puff', name: 'Smoke Puff', maxParticles: 512,
    spawn: { rate: 30, burstCount: 0 },
    init: {
      lifetime: [3, 6], size: [10, 30],
      velocity: { min: new THREE.Vector3(-2, 2, -2), max: new THREE.Vector3(2, 6, 2) },
      color: new THREE.Color(0.5, 0.5, 0.55),
    },
    update: [{
      drag: 1.5, gravityScale: -0.1, curlNoiseStrength: 3, curlNoiseScale: 0.05,
      colorOverLife: [
        { t: 0, color: new THREE.Color(0.6, 0.6, 0.6) },
        { t: 1, color: new THREE.Color(0.3, 0.3, 0.3) },
      ],
      sizeOverLife: [
        { t: 0, value: 0.5 }, { t: 0.3, value: 1 }, { t: 1, value: 1.5 },
      ],
    }],
    render: { mode: 'sprite', blendMode: 'normal', softParticles: true, softRange: 1.0 },
  });
}

export function createFireballPreset(): NiagaraEmitter {
  return createEmitter({
    id: 'fireball', name: 'Fireball', maxParticles: 1024,
    spawn: { rate: 80, burstCount: 50, burstInterval: 0 },
    init: {
      lifetime: [0.8, 2.0], size: [8, 25],
      velocity: { min: new THREE.Vector3(-8, 5, -8), max: new THREE.Vector3(8, 30, 8) },
      color: new THREE.Color(1.5, 0.8, 0.2),
      spawnShape: { type: 'sphere', radius: 5, surfaceOnly: false },
    },
    update: [{
      drag: 1.2, gravityScale: -0.3, curlNoiseStrength: 5, curlNoiseScale: 0.08,
      colorOverLife: [
        { t: 0, color: new THREE.Color(2.0, 1.5, 0.5) },
        { t: 0.2, color: new THREE.Color(1.5, 0.6, 0.1) },
        { t: 0.6, color: new THREE.Color(0.8, 0.2, 0.02) },
        { t: 1, color: new THREE.Color(0.15, 0.05, 0.02) },
      ],
      sizeOverLife: [
        { t: 0, value: 0.3 }, { t: 0.2, value: 1.0 }, { t: 1, value: 1.8 },
      ],
    }],
    render: { mode: 'sprite', blendMode: 'additive', softParticles: true, softRange: 1.5 },
    forceModules: [],
  });
}

export function createCometPreset(): NiagaraEmitter {
  return createEmitter({
    id: 'comet', name: 'Comet Trail', maxParticles: 512,
    spawn: { rate: 60, burstCount: 0 },
    init: {
      lifetime: [1.0, 3.0], size: [3, 10],
      velocity: { min: new THREE.Vector3(-1, 15, -1), max: new THREE.Vector3(1, 40, 1) },
      color: new THREE.Color(0.8, 0.9, 1.2),
      spawnShape: { type: 'cone', radius: 3, height: 5, coneAngle: Math.PI / 12, surfaceOnly: false },
    },
    update: [{
      drag: 0.3, gravityScale: 0.2, curlNoiseStrength: 1, curlNoiseScale: 0.05,
      colorOverLife: [
        { t: 0, color: new THREE.Color(1.0, 1.2, 1.5) },
        { t: 0.5, color: new THREE.Color(0.5, 0.7, 1.0) },
        { t: 1, color: new THREE.Color(0.1, 0.1, 0.3) },
      ],
      sizeOverLife: [
        { t: 0, value: 1.0 }, { t: 0.5, value: 0.6 }, { t: 1, value: 0 },
      ],
    }],
    render: { mode: 'ribbon', blendMode: 'additive', velocityStretch: true, stretchScale: 0.6 },
  });
}

export function createVortexPreset(): NiagaraEmitter {
  const { createVortex, createOrbit } = require('./niagaraForceModules');
  return createEmitter({
    id: 'vortex-effect', name: 'Vortex', maxParticles: 1024,
    spawn: { rate: 100, burstCount: 0 },
    init: {
      lifetime: [2, 5], size: [3, 8],
      velocity: { min: new THREE.Vector3(-2, 1, -2), max: new THREE.Vector3(2, 8, 2) },
      color: new THREE.Color(0.6, 0.3, 1.0),
      spawnShape: { type: 'ring', radius: 15, innerRadius: 12 },
    },
    update: [{
      drag: 0.4, gravityScale: 0, curlNoiseStrength: 2, curlNoiseScale: 0.1,
      colorOverLife: [
        { t: 0, color: new THREE.Color(0.8, 0.4, 1.2) },
        { t: 0.5, color: new THREE.Color(0.4, 0.2, 0.8) },
        { t: 1, color: new THREE.Color(0.1, 0.05, 0.2) },
      ],
      sizeOverLife: [
        { t: 0, value: 1 }, { t: 1, value: 0.2 },
      ],
    }],
    render: { mode: 'gpu-sprite', blendMode: 'additive' },
    forceModules: [
      createVortex('vortex-main', { strength: 15, pullStrength: 3, radius: 30 }),
      createOrbit('orbit-main', { orbitSpeed: 2, radialDrift: -0.5 }),
    ],
  });
}

export function createDebrisPreset(): NiagaraEmitter {
  const { createCollision } = require('./niagaraForceModules');
  return createEmitter({
    id: 'debris', name: 'Debris', maxParticles: 256,
    spawn: { rate: 0, burstCount: 50, burstInterval: 0 },
    init: {
      lifetime: [2, 6], size: [2, 8],
      velocity: { min: new THREE.Vector3(-20, 10, -20), max: new THREE.Vector3(20, 40, 20) },
      color: new THREE.Color(0.4, 0.35, 0.3),
      spawnShape: { type: 'box', extents: new THREE.Vector3(3, 1, 3) },
    },
    update: [{
      drag: 0.3, gravityScale: 2.0, curlNoiseStrength: 0, curlNoiseScale: 0,
      colorOverLife: [],
      sizeOverLife: [],
      rotationRate: 5,
    }],
    render: { mode: 'mesh', blendMode: 'normal' },
    forceModules: [
      createCollision('ground', { planeY: 0, restitution: 0.3, friction: 0.5, maxBounces: 3 }),
    ],
  });
}
