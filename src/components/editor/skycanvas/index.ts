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
export {
  Moon,
  AtmosphericParticles,
  StageGround,
} from './GroundSystem';
export {
  FireworkBurst,
  TimelineEffects,
  LiveSFXEffects,
  estimateFireworkStarCost,
} from './FireworkRenderer';
