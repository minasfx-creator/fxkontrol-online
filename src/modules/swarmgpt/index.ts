export * from "./types";
export * from "./utils/geometry";
export * from "./advanced";
// `./core` re-exports legacy `DroneFormation` / `ValidationReport` shapes that
// collide with `./types`. Re-export everything else explicitly to avoid TS2308.
export {
  type PointCloud,
  type TransitionCostMatrix,
  type BeatGrid,
} from "./core/types";
