/**
 * ─── PyroSim — Cinema-Grade Pyro Simulation Engine ──────────────────
 * Barrel export for all simulation modules.
 */

// Core orchestrator
export { PyroSimulationCore, pyroSimCore } from './PyroSimulationCore';
export type { EnergyEvent, ReleaseCurveType, SpatialDistType } from './PyroSimulationCore';

// Physics
export { integrateParticles } from './BallisticSolver';

// Particle pool (SoA)
export { createParticlePool, allocateParticle, compactPool, resetPool } from './ParticleStateModel';
export type { ParticlePool, DecayCurveType } from './ParticleStateModel';

// Combustion
export { updateCombustion, applyFlicker, getBurnRate, BURN_RATE_TABLE } from './CombustionModel';

// Thermal color
export {
  blackbodyToRGB, fuelToTemperature, blendThermalChemical, temperatureToBrightness,
  stefanBoltzmannEmission, energyDrivenTemperature, dissipateTemperature,
  computeParticleThermalState, THERMAL_CONDUCTIVITY,
} from './ThermalColorModel';

// Wind
export { WindFieldSystem, globalWindField } from './WindFieldSystem';
export type { WindLayer, WindFieldConfig } from './WindFieldSystem';

// Smoke
export { SmokeVolumeSystem, globalSmokeVolume } from './SmokeVolumeSystem';
export type { SmokePuff } from './SmokeVolumeSystem';

// Render pipeline
export { PyroRenderPipeline, globalRenderPipeline } from './PyroRenderPipeline';
export type { RenderLayerId, RenderLayerConfig, CameraResponseConfig, PyroRenderConfig } from './PyroRenderPipeline';

// LOD
export { computeImportance, estimateScreenCoverage, shouldCull, distributeBudget, getBudget, getParticleMultiplier } from './PyroLODManager';
export type { BurstImportance, LODBudget, QualityPreset } from './PyroLODManager';

// Calibration
export { EFFECT_FAMILIES, computeValidationMetrics, getFamily, listFamilies } from './CalibrationLayer';
export type { EffectFamilyProfile, ValidationMetrics } from './CalibrationLayer';
