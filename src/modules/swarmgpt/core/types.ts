import type { Vec3 } from "../types";

export interface PointCloud {
  points: Vec3[];
  source: "svg" | "silhouette" | "realityscan_mesh" | "gaussian_splat" | "point_cloud";
}

export interface DroneFormation {
  points: Vec3[];
  name?: string;
}

export interface TransitionCostMatrix {
  fromCount: number;
  toCount: number;
  maxDistance: number;
  avgDistance: number;
}

export interface BeatGrid {
  bpm: number;
  offsets: number[];
}

export interface ValidationReport {
  valid: boolean;
  violations: string[];
  maxSpeed: number;
  maxDistance: number;
}

