/**
 * SkyCanvas sub-modules barrel export.
 */
export { WeatherEffects } from './WeatherSystem';
export {
  SkyAtmosphereV2Layer,
  VolumetricCloudLayer,
  WaterLayer,
  GroundDecalManager,
  TimeOfDayController,
  SceneFog,
  SceneStars,
  SceneStarsWired,
  EnvironmentV2Switcher,
} from './SkyEnvironment';
export {
  getActiveBurstCount,
  getActiveBurstScan,
  runActiveBurstScan,
  hexToCompound,
  getEffectById,
  getWindForce,
  getAdaptiveExposure,
  setAdaptiveExposureValue,
  getSkyScatterUniforms,
  setSkyScatterUniforms,
  CAMERA_PRESETS,
  WebGLErrorBoundary,
  GRAVITY,
  _posQuat, _effQuat, _pitchQuat, _posEuler, _effEuler, _launchDir, _pitchAxis,
} from './sharedState';
export type { ActiveBurstScanResult } from './sharedState';

// ═══ GroundSystem — terrain, moon, atmosphere ═══
export { Moon, AtmosphericParticles, StageGround } from './GroundSystem';

// ═══ FireworkRenderer — burst particles, timeline effects, live SFX ═══
export { FireworkBurst, TimelineEffects, LiveSFXEffects, estimateFireworkStarCost } from './FireworkRenderer';

// ═══ ExplosionGlowSystem — dynamic terrain/water illumination ═══
export { ExplosionGlowSystem } from './ExplosionGlowSystem';

// ═══ LightingSystem — exposure, GI, lens flares, reflections, debug ═══
export {
  AdaptiveExposureController,
  ContactShadowsLayer,
  DebugFeed,
  GlobalIlluminationController,
  LensFlareController,
  GroundReflections,
} from './LightingSystem';
