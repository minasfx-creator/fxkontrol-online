/**
 * FX KONTROL · Niagara-Style Modular Emitter System
 * Composable System → Emitter → Module architecture with event system.
 */

import * as THREE from 'three';

// ── Module Types ────────────────────────────────────────────────────

export type ModuleType = 'spawn' | 'init' | 'update' | 'render';
export type RenderMode = 'sprite' | 'ribbon' | 'mesh' | 'gpu-sprite';
export type EmitterEventType = 'burst-complete' | 'particle-death' | 'collision' | 'lifetime-end';

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

// Simple 3D curl noise approximation
function curlNoise3D(p: THREE.Vector3, scale: number): THREE.Vector3 {
  const e = 0.01;
  const px = p.x * scale, py = p.y * scale, pz = p.z * scale;
  // Pseudo-noise via sin combinations
  const n = (x: number, y: number, z: number) =>
    Math.sin(x * 1.27 + y * 3.41) * Math.cos(z * 2.63 + x * 0.97) * Math.sin(y * 1.89 + z * 2.17);

  const dndy = (n(px, py + e, pz) - n(px, py - e, pz)) / (2 * e);
  const dndz = (n(px, py, pz + e) - n(px, py, pz - e)) / (2 * e);
  const dndx = (n(px + e, py, pz) - n(px - e, py, pz)) / (2 * e);
  // Different noise for each component
  const n2 = (x: number, y: number, z: number) =>
    Math.cos(x * 2.31 + z * 1.73) * Math.sin(y * 1.47 + x * 3.11);
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
  };
}

export function createSystem(config: {
  id: string;
  name: string;
  emitters: NiagaraEmitter[];
  maxParticleBudget?: number;
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
  };
}

// ── Tick Pipeline ───────────────────────────────────────────────────

function spawnParticles(emitter: NiagaraEmitter, dt: number): NiagaraParticle[] {
  const spawn = emitter.spawnModule;
  if (!spawn.enabled) return [];
  const newParticles: NiagaraParticle[] = [];
  const init = emitter.initModule;

  // Rate-based spawning
  emitter.spawnAccumulator += spawn.rate * dt;
  const count = Math.floor(emitter.spawnAccumulator);
  emitter.spawnAccumulator -= count;

  // Burst spawning
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
    const p: NiagaraParticle = {
      position: new THREE.Vector3(),
      velocity: init.enabled ? randVec3(init.velocity.min, init.velocity.max) : new THREE.Vector3(),
      color: init.color.clone(),
      size: randRange(init.size[0], init.size[1]),
      rotation: randRange(init.rotation[0], init.rotation[1]),
      age: 0,
      lifetime: randRange(init.lifetime[0], init.lifetime[1]),
      alive: true,
    };
    newParticles.push(p);
    emitter.totalSpawned++;
  }
  return newParticles;
}

function updateParticles(emitter: NiagaraEmitter, dt: number, events: EmitterEvent[]) {
  const gravity = -9.81;

  for (let i = emitter.particles.length - 1; i >= 0; i--) {
    const p = emitter.particles[i];
    p.age += dt;

    if (p.age >= p.lifetime) {
      p.alive = false;
      events.push({
        type: 'particle-death',
        emitterId: emitter.id,
        position: p.position.clone(),
      });
      emitter.particles.splice(i, 1);
      continue;
    }

    const t = p.age / p.lifetime;

    for (const upd of emitter.updateModules) {
      if (!upd.enabled) continue;

      // Gravity
      p.velocity.y += gravity * upd.gravityScale * dt;

      // Drag
      p.velocity.multiplyScalar(1 - upd.drag * dt);

      // Curl noise
      if (upd.curlNoiseStrength > 0) {
        const curl = curlNoise3D(p.position, upd.curlNoiseScale);
        p.velocity.add(curl.multiplyScalar(upd.curlNoiseStrength * dt));
      }

      // Color over life
      if (upd.colorOverLife.length > 0) {
        p.color.copy(sampleColorGradient(upd.colorOverLife, t));
      }

      // Size over life
      if (upd.sizeOverLife.length > 0) {
        p.size *= sampleCurve(upd.sizeOverLife, t);
      }

      // Rotation
      p.rotation += upd.rotationRate * dt;
    }

    p.position.add(p.velocity.clone().multiplyScalar(dt));
  }
}

export function tickSystem(system: NiagaraSystem, dt: number): EmitterEvent[] {
  if (system.lodTier === 'culled') return [];

  const lodScale = system.lodTier === 'low' ? 0.25 : system.lodTier === 'medium' ? 0.5 : 1.0;
  const events: EmitterEvent[] = [];
  system.elapsedTime += dt;

  const totalParticles = getSystemParticleCount(system);

  for (const emitter of system.emitters) {
    if (!emitter.enabled) continue;
    emitter.elapsedTime += dt;

    // Spawn (respect budget)
    if (totalParticles < system.maxParticleBudget) {
      const newParticles = spawnParticles(emitter, dt * lodScale);
      emitter.particles.push(...newParticles);
    }

    // Update
    updateParticles(emitter, dt, events);
  }

  // Dispatch events
  for (const event of events) {
    for (const handler of system.eventHandlers) {
      handler(event);
    }
  }

  return events;
}

// ── Queries ─────────────────────────────────────────────────────────

export function getSystemParticleCount(system: NiagaraSystem): number {
  return system.emitters.reduce((sum, e) => sum + e.particles.length, 0);
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
    id: 'spark-burst',
    name: 'Spark Burst',
    maxParticles: 2048,
    spawn: { rate: 0, burstCount: 200, burstInterval: 0 },
    init: {
      lifetime: [0.5, 2.5],
      size: [1, 4],
      velocity: {
        min: new THREE.Vector3(-30, 10, -30),
        max: new THREE.Vector3(30, 60, 30),
      },
      color: new THREE.Color(1.2, 0.9, 0.3),
    },
    update: [{
      drag: 0.8,
      gravityScale: 1.0,
      curlNoiseStrength: 0,
      colorOverLife: [
        { t: 0, color: new THREE.Color(1.5, 1.2, 0.5) },
        { t: 0.3, color: new THREE.Color(1.2, 0.6, 0.1) },
        { t: 1, color: new THREE.Color(0.3, 0.05, 0.0) },
      ],
      sizeOverLife: [
        { t: 0, value: 1 },
        { t: 0.8, value: 0.6 },
        { t: 1, value: 0 },
      ],
    }],
    render: { mode: 'gpu-sprite', blendMode: 'additive', velocityStretch: true, stretchScale: 0.4 },
  });
}

export function createSmokePuffPreset(): NiagaraEmitter {
  return createEmitter({
    id: 'smoke-puff',
    name: 'Smoke Puff',
    maxParticles: 512,
    spawn: { rate: 30, burstCount: 0 },
    init: {
      lifetime: [3, 6],
      size: [10, 30],
      velocity: {
        min: new THREE.Vector3(-2, 2, -2),
        max: new THREE.Vector3(2, 6, 2),
      },
      color: new THREE.Color(0.5, 0.5, 0.55),
    },
    update: [{
      drag: 1.5,
      gravityScale: -0.1,
      curlNoiseStrength: 3,
      curlNoiseScale: 0.05,
      colorOverLife: [
        { t: 0, color: new THREE.Color(0.6, 0.6, 0.6) },
        { t: 1, color: new THREE.Color(0.3, 0.3, 0.3) },
      ],
      sizeOverLife: [
        { t: 0, value: 0.5 },
        { t: 0.3, value: 1 },
        { t: 1, value: 1.5 },
      ],
    }],
    render: { mode: 'sprite', blendMode: 'normal', softParticles: true, softRange: 1.0 },
  });
}
