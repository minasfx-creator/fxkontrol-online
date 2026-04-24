export * from "./svg/svgPathToPoints";
export * from "./image/silhouetteToPoints";
export * from "./gaussian/gaussianToPointCloud";
export * from "./realityscan/realityScanAdapter";
export * from "./assets/createFormationFromAdvancedAsset";
export * from "./sampling/weightedPoissonSampling";
export * from "./motion/hungarianLite";
export * from "./motion/optimizeDroneTransition";
export * from "./scoring/scoreFormationFidelity";

// Pipeline-facing helpers re-exported under a stable surface.
export { snapToBeat, buildBeatGrid } from "./beatSync";
export {
  generateOptimizedFormation,
  optimizeTransition,
  optimizeTransitionWithReport,
} from "./generateOptimizedFormation";
