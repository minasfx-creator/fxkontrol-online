/**
 * ─── PyroSimulationCore ─────────────────────────────────────────────
 * Central orchestrator for the energy-based pyro simulation.
 * 
 * Manages EnergyEvent lifecycle, delegates to subsystems:
 *   - BallisticSolver (physics)
 *   - CombustionModel (fuel/brightness)
 *   - ThermalColorModel (temperature→color)
 *   - WindFieldSystem (layered wind)
 *   - SmokeVolumeSystem (volumetric smoke)
 * 
 * Uses fixed timestep (60Hz) for deterministic simulation.
 */

import {
  createParticlePool,
  allocateParticle,
  compactPool,
  resetPool,
  type ParticlePool,
  type DecayCurveType,
} from './ParticleStateModel';
import { integrateParticles } from './BallisticSolver';
import { updateCombustion, applyFlicker, getBurnRate } from './CombustionModel';
import { fuelToTemperature } from './ThermalColorModel';
import { globalWindField, type WindFieldSystem } from './WindFieldSystem';
import { globalSmokeVolume, type SmokeVolumeSystem } from './SmokeVolumeSystem';
import { EFFECT_FAMILIES, type EffectFamilyProfile } from './CalibrationLayer';
import {
  generateDispersionTensor,
  applyDispersionTensor,
  applyVariance,
  applyAngularJitter,
  VARIANCE_PROFILES,
  DEFAULT_VARIANCE,
  _burstTensor,
} from './AsymmetricDispersion';
import { isEnabled } from '@/lib/featureFlags';
import { simRNG } from '@/core/reliability/seededRandom';

// ═══ Energy Event Types ═══

export type ReleaseCurveType = 'explosive' | 'gradual' | 'hybrid';
export type SpatialDistType = 'spherical' | 'hemispheric' | 'conical' | 'ring';

export interface EnergyEvent {
  id: number;
  x: number; y: number; z: number;
  energyTotal: number;
  releaseCurve: ReleaseCurveType;
  releaseDuration: number;
  spatialDistribution: SpatialDistType;
  decayConstant: number;
  ignitionJitter: number;
  turbulenceFactor: number;
  smokeYield: number;
  emberYield: number;
  flashPeak: number;
  familyName: string;
  elapsed: number;
  particlesSpawned: boolean;
  alive: boolean;
}

// ═══ Core Orchestrator ═══

const FIXED_DT = 1 / 60;
const MAX_PARTICLES = 100000;
const COMPACT_INTERVAL = 30; // compact every 30 frames

let _nextEventId = 0;

export class PyroSimulationCore {
  private pool: ParticlePool;
  private events: EnergyEvent[] = [];
  private windSystem: WindFieldSystem;
  private smokeSystem: SmokeVolumeSystem;
  private accumulator = 0;
  private frameCount = 0;
  private time = 0;

  constructor(
    windSystem?: WindFieldSystem,
    smokeSystem?: SmokeVolumeSystem,
    maxParticles: number = MAX_PARTICLES,
  ) {
    this.pool = createParticlePool(maxParticles);
    this.windSystem = windSystem ?? globalWindField;
    this.smokeSystem = smokeSystem ?? globalSmokeVolume;
  }

  /**
   * Create an energy event (shell burst).
   */
  createEvent(
    x: number, y: number, z: number,
    familyName: string = 'peony',
    overrides?: Partial<Omit<EnergyEvent, 'id' | 'x' | 'y' | 'z' | 'elapsed' | 'alive' | 'particlesSpawned'>>,
  ): EnergyEvent {
    const family = EFFECT_FAMILIES[familyName] ?? EFFECT_FAMILIES.peony;

    const event: EnergyEvent = {
      id: _nextEventId++,
      x, y, z,
      energyTotal: family.energyTotal,
      releaseCurve: family.releaseCurve,
      releaseDuration: family.releaseDuration,
      spatialDistribution: 'spherical',
      decayConstant: family.thermalDecayRate,
      ignitionJitter: 0.02,
      turbulenceFactor: family.turbulenceFactor,
      smokeYield: family.smokeYield,
      emberYield: family.emberPersistence,
      flashPeak: family.flashIntensity,
      familyName,
      elapsed: 0,
      particlesSpawned: false,
      alive: true,
      ...overrides,
    };

    this.events.push(event);
    return event;
  }

  /**
   * Main tick — accumulates dt, processes in fixed timesteps.
   */
  tick(dt: number): void {
    this.accumulator += dt;

    while (this.accumulator >= FIXED_DT) {
      this.fixedStep(FIXED_DT);
      this.accumulator -= FIXED_DT;
    }
  }

  private fixedStep(dt: number): void {
    this.time += dt;
    this.frameCount++;

    const useBallistics = isEnabled('advanced_ballistics');
    const useTurbulence = isEnabled('turbulence_field');

    // ── Process energy events ──
    for (let i = this.events.length - 1; i >= 0; i--) {
      const ev = this.events[i];
      if (!ev.alive) {
        this.events.splice(i, 1);
        continue;
      }

      ev.elapsed += dt;

      // Spawn particles on first tick
      if (!ev.particlesSpawned && ev.elapsed >= 0) {
        this.spawnBurstParticles(ev);
        ev.particlesSpawned = true;

        // Spawn smoke if enabled
        if (isEnabled('smoke_volume_system')) {
          this.smokeSystem.spawn(
            ev.x, ev.y, ev.z,
            ev.energyTotal,
            EFFECT_FAMILIES[ev.familyName]?.smokeTemperature ?? 1800,
            ev.smokeYield,
          );
        }
      }

      // Event expires when all its particles would be dead
      if (ev.elapsed > ev.releaseDuration + 10) {
        ev.alive = false;
      }
    }

    // ── Physics integration ──
    if (useBallistics) {
      integrateParticles(
        this.pool, dt,
        useTurbulence ? this.windSystem : null,
        useTurbulence,
        this.time,
      );
    }

    // ── Combustion update ──
    updateCombustion(this.pool, dt);
    applyFlicker(this.pool, this.time);

    // ── Smoke update ──
    if (isEnabled('smoke_volume_system')) {
      this.smokeSystem.update(
        dt,
        useTurbulence ? this.windSystem : null,
        this.time,
      );
    }

    // ── Periodic compaction ──
    if (this.frameCount % COMPACT_INTERVAL === 0) {
      compactPool(this.pool);
    }
  }

  /**
   * Spawn particles for a burst event using family profile.
   */
  private spawnBurstParticles(event: EnergyEvent): void {
    const family = EFFECT_FAMILIES[event.familyName] ?? EFFECT_FAMILIES.peony;
    const count = Math.min(family.starCount, MAX_PARTICLES - this.pool.activeCount);
    const vp = VARIANCE_PROFILES[event.familyName] ?? DEFAULT_VARIANCE;

    // ── Generate per-burst asymmetric dispersion tensor ──
    generateDispersionTensor(vp.asymmetry, _burstTensor);

    for (let s = 0; s < count; s++) {
      const idx = allocateParticle(this.pool);
      if (idx < 0) break;

      // ── Spherical distribution with gaussian angular jitter ──
      const theta0 = simRNG.next() * Math.PI * 2;
      const phi0 = Math.acos(1 - 2 * simRNG.next());
      const [thetaN, phiN] = applyAngularJitter(theta0, phi0, vp.angularJitter);

      const sinPhi = Math.sin(phiN);
      const cosPhi = Math.cos(phiN);
      const sinTheta = Math.sin(thetaN);
      const cosTheta = Math.cos(thetaN);

      // Raw direction
      let dirX = sinPhi * cosTheta;
      let dirY = sinPhi * sinTheta;
      let dirZ = cosPhi;

      // ── Apply asymmetric dispersion tensor ──
      const [dX, dY, dZ] = applyDispersionTensor(_burstTensor, dirX, dirY, dirZ);
      dirX = dX; dirY = dY; dirZ = dZ;

      // ── Per-particle velocity with gaussian variance ──
      const vMag = applyVariance(family.burstVelocity, vp.velocityVariance, 1.0);

      // Ignition jitter
      const jitterOffset = event.ignitionJitter * (simRNG.next() - 0.5);

      // ── Populate particle arrays ──
      this.pool.posX[idx] = event.x + dirX * 0.5;
      this.pool.posY[idx] = event.y + dirY * 0.5;
      this.pool.posZ[idx] = event.z + dirZ * 0.5;

      this.pool.velX[idx] = dirX * vMag;
      this.pool.velY[idx] = dirY * vMag;
      this.pool.velZ[idx] = dirZ * vMag;

      // ── Per-particle physical properties with gaussian variance ──
      this.pool.mass[idx] = applyVariance(family.particleMass, vp.massVariance, 0.0001);
      this.pool.dragCoefficient[idx] = applyVariance(family.dragCoefficient, vp.dragVariance, 0.001);
      this.pool.turbulenceFactor[idx] = applyVariance(family.turbulenceFactor, vp.turbulenceVariance, 0);

      this.pool.temperature[idx] = family.initialTemperature;
      this.pool.brightness[idx] = 1.0;

      // ── Fuel & combustion with gaussian variance ──
      this.pool.fuelMass[idx] = applyVariance(family.fuelMass, vp.fuelVariance, 0.0001);
      this.pool.fuelInitial[idx] = this.pool.fuelMass[idx];
      this.pool.burnRate[idx] = applyVariance(family.burnRate, vp.burnRateVariance, 0.00001);

      const starLife = this.pool.fuelMass[idx] / this.pool.burnRate[idx];
      this.pool.lifetime[idx] = starLife + family.emberPersistence;
      this.pool.age[idx] = jitterOffset;
      this.pool.decayCurve[idx] = family.decayCurve;

      this.pool.colorR[idx] = 1.0;
      this.pool.colorG[idx] = 0.8;
      this.pool.colorB[idx] = 0.3;
    }
  }

  // ═══ Accessors ═══

  getPool(): Readonly<ParticlePool> {
    return this.pool;
  }

  getActiveParticleCount(): number {
    return this.pool.activeCount;
  }

  getActiveEventCount(): number {
    return this.events.length;
  }

  getTime(): number {
    return this.time;
  }

  getWindSystem(): WindFieldSystem {
    return this.windSystem;
  }

  getSmokeSystem(): SmokeVolumeSystem {
    return this.smokeSystem;
  }

  /**
   * Reset everything.
   */
  reset(): void {
    resetPool(this.pool);
    this.events.length = 0;
    this.smokeSystem.clear();
    this.accumulator = 0;
    this.frameCount = 0;
    this.time = 0;
  }
}

/** Global simulation core instance */
export const pyroSimCore = new PyroSimulationCore();
