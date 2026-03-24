/**
 * FX KONTROL · Hardening Engine — Barrel Export
 * Runtime safety, GPU memory management, asset validation, observability.
 */

export {
  // Runtime Safety
  detectBestRenderAPI,
  getActiveRenderAPI,
  forceRenderAPI,
  unlockRenderAPI,
  reportCrash,
  getCrashRecord,
  isInCooldown,
  watchdogTick,
  getDegradationLevel,
  resetWatchdog,
  onDegradationChange,
  setFrameBudget,
  getFrameBudget,
  checkFrameBudget,
  scanSceneTransforms,
  type RenderAPI,
  type DegradationLevel,
  type FrameBudget,
  type FrameBudgetCheck,
  type TransformScanResult,
} from './runtimeSafety';

export {
  // GPU Memory
  setVRAMBudget,
  getVRAMBudget,
  textureCache,
  geometryCache,
  trackResource,
  untrackResource,
  disposeAllTracked,
  checkSceneHealth,
  deepDispose,
  type VRAMBudget,
  type SceneHealthReport,
} from './gpuMemoryManager';

export {
  // Asset Gate
  setAssetLimits,
  getAssetLimits,
  validateAssetFile,
  validateGLTFScene,
  analyzeSceneGraph,
  validateTextureFile,
  type AssetLimits,
  type AssetValidationResult,
  type GLTFSceneStats,
} from './assetGate';

export {
  // Observability
  pushFrameMetrics,
  recordContextLoss,
  getMetricsSnapshot,
  resetMetrics,
  startMetricsReporting,
  stopMetricsReporting,
  type MetricsSnapshot,
} from './observability';
