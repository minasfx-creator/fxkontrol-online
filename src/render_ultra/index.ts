/**
 * FX KONTROL · Ultra-Realistic Render Engine
 * Cinematic VFX-grade rendering pipeline.
 * 
 * Architecture:
 * - fireworks/   Chemical color, GPU spark trails, burst patterns, volumetric smoke
 * - drones/      PBR materials, HDR LED lights, propeller motion blur
 * - environment/  Volumetric fog, atmosphere scattering, terrain PBR, reflections
 * - lighting/     HDR lighting rig, dynamic global illumination
 * - postprocessing/ Lens flares, adaptive exposure
 */

// Fireworks
export { getCompound, getAllCompounds, thermalColor } from './fireworks/particleChemistry';
export type { ChemicalCompound } from './fireworks/particleChemistry';
export { createSparkTrailSystem, updateSparkTrail, writeSparkTrailsToBuffers } from './fireworks/sparkTrailsGPU';
export { generateBurst, getBurstConfig, getAllPatterns } from './fireworks/burstSimulation';
export type { BurstPattern } from './fireworks/burstSimulation';
export { SmokeSystem } from './fireworks/smokeSimulation';

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
