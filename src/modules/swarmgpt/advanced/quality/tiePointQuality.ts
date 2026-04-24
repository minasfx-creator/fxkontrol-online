/**
 * SwarmGPT Advanced — Tie-Point Quality.
 *
 * Mirrors RealityScan 2.0 "Tie Point Quality": for each sparse-cloud point,
 * compute a normalized coverage score in [0..1] from the set of cameras that
 * observed it. Higher = more cameras, broader baseline angles, closer range.
 *
 * Pure module — no THREE, no DOM. Inputs are plain numeric structures.
 */
import type { Vec3 } from '../../types';
import { clamp01 } from './qualityColorRamp';

export interface CameraView {
  /** Camera world position. */
  position: Vec3;
  /** Optional unit forward vector. When omitted we treat the camera as omni. */
  forward?: Vec3;
}

export interface TiePoint {
  position: Vec3;
  /** Indices into the cameras array that observed this point. */
  observedBy: number[];
}

export interface TiePointQualityOptions {
  /** Cameras at or beyond this distance contribute nothing. Default 200. */
  maxDistance?: number;
  /** Score saturates at this many observers. Default 8. */
  saturationCount?: number;
  /**
   * Weight of baseline-angle diversity vs raw observer count. 0 = count only,
   * 1 = angle diversity only. Default 0.5.
   */
  angleWeight?: number;
}

export interface TiePointQualityResult {
  /** Per-point normalized score [0..1], aligned to the input array. */
  scores: Float32Array;
  /** Aggregate stats for histogram / debug. */
  min: number;
  max: number;
  mean: number;
}

function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function length(v: Vec3): number {
  return Math.hypot(v.x, v.y, v.z);
}

function normalize(v: Vec3): Vec3 {
  const l = length(v) || 1;
  return { x: v.x / l, y: v.y / l, z: v.z / l };
}

function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

/**
 * Maximum pairwise angle (radians) between rays from `point` to each camera.
 * Approximates the parallax — wider = better depth conditioning.
 */
function maxBaselineAngle(point: Vec3, cameras: Vec3[]): number {
  if (cameras.length < 2) return 0;
  const rays = cameras.map((c) => normalize(sub(c, point)));
  let maxAngle = 0;
  for (let i = 0; i < rays.length; i++) {
    for (let j = i + 1; j < rays.length; j++) {
      const cosA = Math.max(-1, Math.min(1, dot(rays[i], rays[j])));
      const angle = Math.acos(cosA);
      if (angle > maxAngle) maxAngle = angle;
    }
  }
  return maxAngle;
}

export function computeTiePointQuality(
  points: TiePoint[],
  cameras: CameraView[],
  options: TiePointQualityOptions = {},
): TiePointQualityResult {
  const maxDistance = Math.max(1e-6, options.maxDistance ?? 200);
  const saturationCount = Math.max(1, options.saturationCount ?? 8);
  const angleWeight = clamp01(options.angleWeight ?? 0.5);

  const scores = new Float32Array(points.length);
  if (points.length === 0) {
    return { scores, min: 0, max: 0, mean: 0 };
  }

  let min = Infinity;
  let max = -Infinity;
  let sum = 0;

  for (let i = 0; i < points.length; i++) {
    const tp = points[i];
    const obsCams: Vec3[] = [];
    let inRange = 0;
    for (const camIdx of tp.observedBy) {
      const cam = cameras[camIdx];
      if (!cam) continue;
      const d = length(sub(cam.position, tp.position));
      if (d <= maxDistance) {
        inRange++;
        obsCams.push(cam.position);
      }
    }

    const countScore = clamp01(inRange / saturationCount);
    const angleScore = clamp01(maxBaselineAngle(tp.position, obsCams) / Math.PI);
    const score = clamp01((1 - angleWeight) * countScore + angleWeight * angleScore);

    scores[i] = score;
    if (score < min) min = score;
    if (score > max) max = score;
    sum += score;
  }

  return {
    scores,
    min: Number.isFinite(min) ? min : 0,
    max: Number.isFinite(max) ? max : 0,
    mean: sum / points.length,
  };
}
