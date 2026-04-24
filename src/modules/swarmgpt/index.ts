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
export * from "./core/audio/snapToBeat";
export * from "./core/validation/validateTrajectory";
export * from "./core/pipeline/planFormationFromAsset";
