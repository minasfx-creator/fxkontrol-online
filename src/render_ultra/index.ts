/**
 * FX KONTROL · Ultra-Realistic Render Engine
 * Cinematic VFX-grade rendering pipeline.
 * 
 * Architecture:
 * - fireworks/   Chemical color, GPU spark trails, burst patterns, volumetric smoke,
 *                Niagara emitter system, soft particles, ribbons, flipbooks, heat distortion
 * - drones/      PBR materials, HDR LED lights, propeller motion blur
 * - environment/  Volumetric fog, atmosphere scattering, terrain PBR, reflections
 * - lighting/     HDR lighting rig, dynamic global illumination
 * - postprocessing/ Lens flares, adaptive exposure
 */

// Fireworks
export { getCompound, getAllCompounds, thermalColor, getVelineCompositeColor, checkDangerousCombination, getBPBurnRateModifier } from './fireworks/particleChemistry';
export type { ChemicalCompound, DangerousCombination, BPGrade } from './fireworks/particleChemistry';
export { createSparkTrailSystem, updateSparkTrail, writeSparkTrailsToBuffers } from './fireworks/sparkTrailsGPU';
export type { SparkState } from './fireworks/sparkTrailsGPU';
export { generateBurst, getBurstConfig, getAllPatterns } from './fireworks/burstSimulation';
export type { BurstPattern } from './fireworks/burstSimulation';
export { SmokeSystem } from './fireworks/smokeSimulation';

// Niagara Emitter System
export {
  createEmitter, createSystem, tickSystem, getSystemParticleCount, onEmitterEvent,
  defaultSpawnConfig, defaultInitConfig, defaultUpdateConfig, defaultRenderConfig,
  createSparkBurstPreset, createSmokePuffPreset,
} from './fireworks/niagaraEmitterSystem';
export type {
  NiagaraModule, NiagaraEmitter, NiagaraSystem, NiagaraParticle,
  SpawnConfig, InitConfig, UpdateConfig, RenderConfig,
  EmitterEvent, EmitterEventType, EmitterEventHandler,
} from './fireworks/niagaraEmitterSystem';

// Soft Particles & Velocity Stretch
export { createSoftParticleMaterial, createSmokeSoftMaterial, updateSoftParticleUniforms } from './fireworks/softParticleShader';
export type { SoftParticleMaterialOptions } from './fireworks/softParticleShader';

// Ribbon Trail Renderer
export { RibbonTrail, createRibbonMaterial } from './fireworks/ribbonTrailRenderer';
export type { RibbonPoint, RibbonConfig, RibbonUVMode } from './fireworks/ribbonTrailRenderer';

// Flipbook Animator
export {
  getFlipbookUV, getFlipbookUVLerp, createFlipbookMaterial, updateFlipbookMaterial,
  FLIPBOOK_PRESETS, FLIPBOOK_FRAGMENT_SINGLE, FLIPBOOK_FRAGMENT_LERP,
} from './fireworks/flipbookAnimator';
export type { FlipbookConfig, FlipbookUVRect } from './fireworks/flipbookAnimator';

// Heat Distortion
export { HeatHazeEmitter, createDistortionMaterial, createShockwaveMaterial } from './fireworks/heatDistortion';
export type { HeatHazeParticle } from './fireworks/heatDistortion';

// Drones
export { createDroneLightRig, createLEDHaloMaterial } from './drones/droneLights';
export { createQuadRotorBlur, createRotorDisc } from './drones/propellerMotionBlur';
export { createDroneMaterials, applyEnvMap } from './drones/droneMaterials';
export type { DroneMaterialSet } from './drones/droneMaterials';

// Environment
export { createVolumetricFogPlane } from './environment/volumetricFog';
export { createAtmosphereSphere } from './environment/atmosphereScattering';
export { createTerrainPlane, createTerrainMaterial, getTerrainPresets } from './environment/terrainPBR';
export { createReflectionPlane } from './environment/reflections';

// Lighting
export { createHDRLightingRig } from './lighting/hdrLighting';
export { GlobalIlluminationSystem } from './lighting/globalIllumination';

// Post-processing
export { createLensFlareSprite, flashLensFlare, decayLensFlare } from './postprocessing/lensFlare';
export { createExposureController, updateExposure, flashEvent } from './postprocessing/exposure';
