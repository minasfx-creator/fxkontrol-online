/**
 * FX KONTROL · Secondary Effects Engine
 *
 * Processes two types of sub-particle emission driven by the effectFrameAtlas:
 *
 * 1. CONTINUOUS STAGES — ongoing emitters (trails, smoke, glitter, etc.) that
 *    run from tStart→tEnd of the parent effect and emit at emissionRate p/s.
 *
 * 2. SECONDARY EFFECTS — one-shot sub-bursts that fire when a parent particle
 *    reaches tNorm == tTrigger (crossette break, dragon egg hatch, etc.).
 *
 * Both paths feed particles into GPUComputeParticleSystem.emit().
 */

import type { GPUComputeParticleSystem } from './gpuComputeParticles';
import {
  getAtlasEntry,
  getScaledStages,
  getScaledSecondaryEffects,
  sampleVelocityCone,
  scaleCount,
  type SecondaryEffect,
  type EffectStage,
} from './effectFrameAtlas';
import type { BurstPattern } from './burstSimulation';

// ─────────────────────────────────────────────────────────────────────────────
// Continuous stage handle — tracks an active emitter over time
// ─────────────────────────────────────────────────────────────────────────────

export interface ContinuousEmitterHandle {
  patternId: BurstPattern;
  caliberMm: number;
  /** World-space origin of the burst */
  originX: number; originY: number; originZ: number;
  /** Age of the parent burst in seconds (incremented each tick) */
  age: number;
  /** Total lifetime of the parent burst in seconds */
  lifetime: number;
  /** Scaled stages from atlas */
  stages: EffectStage[];
  /** Per-stage fractional emission accumulator (avoids floor rounding loss) */
  stageAccumulators: Float32Array;
  active: boolean;
}

/** Create a new continuous emitter handle for a burst event */
export function createContinuousEmitter(
  patternId: BurstPattern,
  caliberMm: number,
  originX: number, originY: number, originZ: number,
): ContinuousEmitterHandle {
  const entry = getAtlasEntry(patternId);
  const stages = getScaledStages(patternId, caliberMm);
  // Only continuous stages (tStart > 0.04, emissionRate > 0)
  const continuous = stages.filter(s => s.tStart > 0.04 && s.emissionRate > 0);

  return {
    patternId, caliberMm, originX, originY, originZ,
    age: 0,
    lifetime: entry.baseLifetimeS,
    stages: continuous,
    stageAccumulators: new Float32Array(continuous.length),
    active: true,
  };
}

/**
 * Tick all continuous emitters for one frame.
 * Emits particles into the GPU system based on elapsed time and emissionRate.
 *
 * @param handles   — array of active emitters (in place — sets .active=false when done)
 * @param gpu       — GPU particle system to emit into
 * @param dt        — delta time seconds
 */
export function tickContinuousEmitters(
  handles: ContinuousEmitterHandle[],
  gpu: GPUComputeParticleSystem,
  dt: number,
): void {
  for (let h = handles.length - 1; h >= 0; h--) {
    const em = handles[h];
    if (!em.active) { handles.splice(h, 1); continue; }

    em.age += dt;
    const tNorm = em.age / em.lifetime;

    if (tNorm >= 1.0) { em.active = false; continue; }

    for (let si = 0; si < em.stages.length; si++) {
      const stage = em.stages[si];
      if (tNorm < stage.tStart || tNorm > stage.tEnd) continue;

      // Fractional particle accumulation
      em.stageAccumulators[si] += stage.emissionRate * dt;
      const count = Math.floor(em.stageAccumulators[si]);
      if (count <= 0) continue;
      em.stageAccumulators[si] -= count;

      // Stage progress within its own window (0→1)
      const stageNorm = Math.max(0, Math.min(1,
        (tNorm - stage.tStart) / (stage.tEnd - stage.tStart)
      ));
      const tempK  = stage.tempKStart + (stage.tempKEnd - stage.tempKStart) * stageNorm;
      const size   = stage.sizeStart  + (stage.sizeEnd  - stage.sizeStart)  * stageNorm;
      const stageLifetime = (stage.tEnd - stage.tStart) * em.lifetime;

      // Slight origin drift toward center of expanding shell
      const spreadR = 0.5 * (em.age / em.lifetime) * 2;

      gpu.emit(count, {
        posX: em.originX + (Math.random() - 0.5) * spreadR,
        posY: em.originY + (Math.random() - 0.5) * spreadR * 0.5,
        posZ: em.originZ + (Math.random() - 0.5) * spreadR,
        velX: 0, velY: 0, velZ: 0,   // overridden below
        velSpread: 0,
        temperature: tempK, tempVariance: tempK * 0.08,
        size, sizeVariance: size * 0.2,
        maxLife: stageLifetime * (0.5 + Math.random() * 0.7),
        maxLifeVariance: stageLifetime * 0.3,
        colorR: 1, colorG: 0.8, colorB: 0.4,  // placeholder — overridden by blackbody
        brightness: 0.85,
        type: stage.particleType,
      });

      // Patch velocity via direct SoA write for the last `count` particles
      // (emit() appends to end, so index range is [activeCount-count, activeCount))
      const base = gpu.activeCount - count;
      const [vx, vy, vz] = sampleVelocityCone(stage.vel, Math.random);
      for (let i = base; i < base + count; i++) {
        if (i < 0 || i >= gpu.config.maxParticles) break;
        // Add per-particle jitter on top of stage cone mean
        gpu.cpuData.velX[i] = vx + (Math.random() - 0.5) * 1.5;
        gpu.cpuData.velY[i] = vy + (Math.random() - 0.5) * 1.5;
        gpu.cpuData.velZ[i] = vz + (Math.random() - 0.5) * 1.5;
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Secondary Effects — branching sub-bursts
// ─────────────────────────────────────────────────────────────────────────────

export interface SecondaryBurstRequest {
  effect: SecondaryEffect;
  /** World-space position of the PARENT particle that triggers this */
  parentX: number; parentY: number; parentZ: number;
  /** Current velocity of the parent particle (inherited as bias) */
  parentVX: number; parentVY: number; parentVZ: number;
  /** True if this request has been processed */
  fired: boolean;
}

/**
 * Build a list of pending secondary burst requests for a given effect pattern.
 * This is called at burst creation time and the requests are stored per-shell.
 * Each frame, processSecondaryBursts() checks which requests have matured.
 */
export function buildSecondaryRequests(
  patternId: BurstPattern,
  caliberMm: number,
): Array<{
  tTrigger: number;
  effect: SecondaryEffect;
}> {
  const secondaries = getScaledSecondaryEffects(patternId, caliberMm);
  return secondaries.map(ef => ({
    tTrigger: ef.tTrigger,
    effect: ef,
  }));
}

/**
 * Process secondary burst requests for all tracked particles in the GPU system.
 * Called once per frame after the main physics tick.
 *
 * For each pending request, samples the GPU particle data to find parent particles
 * near the trigger tNorm, and emits secondary particles at their positions.
 *
 * Note: This operates on CPU-side data (after async GPU readback), so it runs
 * with a 1-frame delay on WebGPU path. Acceptable for secondary visual effects.
 */
export function processSecondaryBursts(
  gpu: GPUComputeParticleSystem,
  requests: Array<{
    tTrigger: number;
    effect: SecondaryEffect;
    fired: boolean;
    caliberMm: number;
    burstAge: number;   // current age of parent burst (seconds)
    burstLifetime: number;
  }>,
): void {
  const d = gpu.cpuData;
  const n = gpu.activeCount;

  for (const req of requests) {
    if (req.fired) continue;

    const triggerAge = req.tTrigger * req.burstLifetime;
    if (req.burstAge < triggerAge) continue;

    req.fired = true;
    const ef = req.effect;

    // Sample matching parent particles (type = STAR, age ~= triggerAge)
    let emitted = 0;
    for (let i = 0; i < n; i++) {
      if (d.particleType[i] !== 0 && d.particleType[i] !== 6) continue; // STAR or PISTIL only
      const age = d.age[i];
      const life = Math.max(d.life[i], 0.001);
      const tNorm = age / life;

      // Check if this parent is near the trigger time (±10% window)
      if (Math.abs(tNorm - req.tTrigger) > 0.10) continue;

      // Only parentFraction of eligible particles trigger
      if (Math.random() > ef.parentFraction) continue;

      const count = ef.countPerParent;
      if (gpu.activeCount + count >= gpu.config.maxParticles) break;

      // Emit secondary particles at parent position
      for (let j = 0; j < count; j++) {
        const [svx, svy, svz] = sampleVelocityCone(ef.vel, Math.random);
        // Inherit parent velocity as directional bias
        const pvx = d.velX[i] * 0.25;
        const pvy = d.velY[i] * 0.25;
        const pvz = d.velZ[i] * 0.25;

        const idx = gpu.activeCount;
        gpu.activeCount = idx + 1;

        d.posX[idx] = d.posX[i] + (Math.random() - 0.5) * 0.15;
        d.posY[idx] = d.posY[i] + (Math.random() - 0.5) * 0.15;
        d.posZ[idx] = d.posZ[i] + (Math.random() - 0.5) * 0.15;
        d.age[idx]  = 0;

        d.velX[idx] = svx + pvx;
        d.velY[idx] = svy + pvy;
        d.velZ[idx] = svz + pvz;
        d.life[idx] = ef.lifetime * (0.6 + Math.random() * 0.8);

        d.colorR[idx] = 1; d.colorG[idx] = 0.8; d.colorB[idx] = 0.4;
        d.brightness[idx] = 1.0;

        d.temperature[idx] = ef.tempK * (0.9 + Math.random() * 0.2);
        d.size[idx]        = ef.size  * (0.8 + Math.random() * 0.4);
        d.smoke[idx]       = 0;
        d.particleType[idx] = ef.particleType;
      }
      emitted += count;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Concussion shockwave ring (smoke_ring type)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Emit a concussion shockwave ring at burst position.
 * Creates a flat disc of smoke_ring particles that expand radially
 * and fade quickly — simulates the pressure wave flash.
 */
export function emitConcussionRing(
  gpu: GPUComputeParticleSystem,
  x: number, y: number, z: number,
  caliberMm: number,
): void {
  const ringCount = Math.round(scaleCount(48, caliberMm));
  const speed = scaleCount(12, caliberMm) / 10; // rough m/s from caliber
  const SMOKE_RING = 7;

  for (let i = 0; i < ringCount; i++) {
    if (gpu.activeCount >= gpu.config.maxParticles) break;
    const angle = (i / ringCount) * Math.PI * 2;
    const jitter = (Math.random() - 0.5) * 0.15;
    const r = speed * (0.85 + Math.random() * 0.3);
    const idx = gpu.activeCount++;

    const d = gpu.cpuData;
    d.posX[idx] = x + (Math.random() - 0.5) * 0.5;
    d.posY[idx] = y + (Math.random() - 0.5) * 0.3;
    d.posZ[idx] = z + (Math.random() - 0.5) * 0.5;
    d.age[idx]  = 0;

    d.velX[idx] = Math.cos(angle + jitter) * r;
    d.velY[idx] = (Math.random() - 0.5) * r * 0.08; // flat ring
    d.velZ[idx] = Math.sin(angle + jitter) * r;
    d.life[idx] = 0.4 + Math.random() * 0.3;

    d.colorR[idx] = 0.9; d.colorG[idx] = 0.85; d.colorB[idx] = 0.7;
    d.brightness[idx] = 0.6;
    d.temperature[idx] = 1200;
    d.size[idx]  = 2.0 + Math.random() * 2.0;
    d.smoke[idx] = 0.8;
    d.particleType[idx] = SMOKE_RING;
  }
}
