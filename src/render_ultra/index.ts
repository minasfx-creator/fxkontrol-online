/**
 * FX KONTROL · Ultra-Realistic Render Engine
 * Cinematic VFX-grade rendering pipeline.
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
  createSparkBurstPreset, createSmokePuffPreset, createFireballPreset, createCometPreset,
  createVortexPreset, createDebrisPreset, createEmitterFromTemplate, warmupSystem,
} from './fireworks/niagaraEmitterSystem';
export type {
  NiagaraModule, NiagaraEmitter, NiagaraSystem, NiagaraParticle,
  SpawnConfig, InitConfig, UpdateConfig, RenderConfig,
  EmitterEvent, EmitterEventType, EmitterEventHandler,
  SubEmitterConfig, ScalabilityGroup,
} from './fireworks/niagaraEmitterSystem';

// Niagara Spawn Shapes
export { sampleSpawnShape, defaultSpawnShapeConfig } from './fireworks/niagaraSpawnShapes';
export type { SpawnShapeType, SpawnShapeConfig, SpawnSample } from './fireworks/niagaraSpawnShapes';

// Niagara Data Interfaces
export {
  createCurveDataInterface, sampleFloatCurve, sampleColorCurve,
  createMeshDataInterface, sampleMesh,
  createTextureDataInterface, sampleTexture,
  createSkeletalDataInterface, updateSkeletalBones, getBoneTransform, sampleRandomBonePosition, bonesFromSkeleton,
} from './fireworks/niagaraDataInterfaces';
export type {
  DataInterface, DataInterfaceType, CurveDataInterface, CurveKeyframe, ColorCurveKeyframe,
  MeshDataInterface, MeshSampleResult, TextureDataInterface,
  SkeletalDataInterface, BoneTransform,
} from './fireworks/niagaraDataInterfaces';

// Niagara Force Modules
export {
  createPointAttractor, applyPointAttractor,
  createVortex, applyVortex,
  createOrbit, applyOrbit,
  createWind, applyWind,
  createKillZone, applyKillZone,
  createCollision, applyCollision,
  applyForceModule,
} from './fireworks/niagaraForceModules';
export type {
  ForceModule, ForceModuleType, ForceResult,
  PointAttractorModule, VortexModule, OrbitModule, WindModule,
  KillZoneModule, KillZoneShape, KillZoneMode, CollisionModule,
} from './fireworks/niagaraForceModules';

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

// Environment v2 — UE5.7 Virtual Worlds
export { createVolumetricCloudLayer, CLOUD_PRESETS } from './environment/volumetricClouds';
export type { CloudConfig } from './environment/volumetricClouds';
export { createSkyAtmosphereV2, SKY_PRESETS } from './environment/skyAtmosphereV2';
export type { SkyAtmosphereConfig } from './environment/skyAtmosphereV2';
export { createWaterSystem, WATER_PRESETS } from './environment/waterRendering';
export type { WaterConfig } from './environment/waterRendering';
export { evaluateTimeOfDay, getShowTimeHour, TOD_PRESETS } from './environment/timeOfDay';
export type { TimeOfDayState } from './environment/timeOfDay';
export { createDecalSystem, spawnScorchMark, spawnLightSplash, updateDecals, clearDecals, getActiveDecalCount } from './environment/groundDecals';
export type { DecalInstance, DecalType } from './environment/groundDecals';

// Lighting
export { createHDRLightingRig } from './lighting/hdrLighting';
export { GlobalIlluminationSystem } from './lighting/globalIllumination';

// Post-processing
export { createLensFlareSprite, flashLensFlare, decayLensFlare } from './postprocessing/lensFlare';
export { createExposureController, updateExposure, flashEvent, getAverageLuminance, resetLuminanceAccum } from './postprocessing/exposure';
export type { ExposureState } from './postprocessing/exposure';

// Niagara Fluids
export { createFluidGrid, advectFluid, injectDensity, injectVelocity, injectTemperature, readDensityAt, applyWindForce, clearFluidGrid } from './fireworks/niagaraFluids';
export type { FluidGrid, FluidConfig } from './fireworks/niagaraFluids';

// GPU Instanced Particle Rendering
export { InstancedParticleRenderer, createSparkInstancedRenderer, createSmokeInstancedRenderer } from './fireworks/instancedParticleRenderer';
export type { InstancedParticleConfig } from './fireworks/instancedParticleRenderer';

// Water v2
export type { WaterConfig } from './environment/waterRendering';

// Fog v2
export type { FogConfig } from './environment/volumetricFog';

// Lighting v2
export type { HDRLightingConfig, BurstLightConfig } from './lighting/hdrLighting';
