export * from "./types";
export * from "./utils/geometry";
export * from "./advanced";
// `./core` re-exports legacy `DroneFormation` / `ValidationReport` shapes that
// collide with `./types`. Re-export the non-conflicting surface explicitly.
export {
  type PointCloud,
  type TransitionCostMatrix,
  type BeatGrid,
} from "./core/types";
// `core/audio/snapToBeat` is intentionally not re-exported — it duplicates
// `advanced/beatSync.snapToBeat`. Import it directly from its module if needed.
export * from "./core/validation/validateTrajectory";
export * from "./core/pipeline/planFormationFromAsset";
export * from "./physics";
export * from "./fields";
export * from "./gpu";
export * from "./marketplace";
