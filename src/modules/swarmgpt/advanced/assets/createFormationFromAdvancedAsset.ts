/**
 * SwarmGPT Advanced — Unified asset → formation builder.
 * Dispatches by asset type, pre-reduces the candidate cloud, then samples
 * via Poisson (default) or FPS to produce exactly `droneCount` points
 * ready to drop into a `DroneFormation.points` slot.
 *
 * Pure, deterministic, no side effects. Callers compose timing/id/shape.
 */
import type { Vec3 } from '../../types';
import { svgPointsToDronePoints, type SvgSamplePoint } from '../svg/svgPathToPoints';
import {
  silhouetteToPoints,
  type SilhouetteImage,
} from '../image/silhouetteToPoints';
import {
  realityScanMeshToPointCloud,
  type RealityScanMeshLike,
} from '../realityscan/realityScanAdapter';
import {
  gaussianSplatsToPointCloud,
  type GaussianSplatPoint,
} from '../gaussian/gaussianToPointCloud';
import { reducePointCloud } from '../sampling/reducePointCloud';
import { weightedPoissonSample } from '../sampling/weightedPoissonSampling';
import { farthestPointSample } from '../sampling/farthestPointSampling';
import {
  scoreFormationFidelity,
  type FormationFidelityScore,
} from '../scoring/scoreFormationFidelity';

export type AdvancedAsset =
  | { type: 'svg'; points: SvgSamplePoint[] }
  | { type: 'image_silhouette'; image: SilhouetteImage }
  | { type: 'point_cloud'; points: Vec3[] }
  | { type: 'realityscan_mesh'; mesh: RealityScanMeshLike }
  | { type: 'gaussian_splat'; splats: GaussianSplatPoint[] };

export interface CreateFormationOptions {
  droneCount: number;
  minDistance: number;
  center: Vec3;
  scale: number;
  samplingStrategy?: 'poisson' | 'fps'; // default 'poisson'
  maxCandidates?: number;                // default 15000
  silhouetteAlphaMin?: number;
  silhouettePixelStride?: number;
}

export interface AdvancedFormationResult {
  points: Vec3[];                  // length === droneCount
  fidelity: FormationFidelityScore;
  candidateCount: number;
  strategy: 'poisson' | 'fps';
  sourceType: AdvancedAsset['type'];
}

function extractCandidates(
  asset: AdvancedAsset,
  options: CreateFormationOptions,
): Vec3[] {
  switch (asset.type) {
    case 'svg':
      return svgPointsToDronePoints(asset.points, {
        scale: options.scale,
        center: options.center,
      });
    case 'image_silhouette':
      return silhouetteToPoints(asset.image, {
        scale: options.scale,
        center: options.center,
        alphaMin: options.silhouetteAlphaMin,
        pixelStride: options.silhouettePixelStride,
        maxCandidates: options.maxCandidates,
      });
    case 'point_cloud':
      return asset.points ? asset.points.slice() : [];
    case 'realityscan_mesh':
      return realityScanMeshToPointCloud(asset.mesh, {
        maxVertices: options.maxCandidates,
      });
    case 'gaussian_splat':
      return gaussianSplatsToPointCloud(asset.splats, {
        maxPoints: options.maxCandidates,
      });
  }
}

export function createFormationFromAdvancedAsset(
  asset: AdvancedAsset,
  options: CreateFormationOptions,
): AdvancedFormationResult {
  const strategy: 'poisson' | 'fps' = options.samplingStrategy ?? 'poisson';
  const maxCandidates = Math.max(1, options.maxCandidates ?? 15000);

  const rawCandidates = extractCandidates(asset, options);
  const reduced =
    rawCandidates.length > maxCandidates
      ? reducePointCloud(rawCandidates, maxCandidates)
      : rawCandidates;

  let sampled: Vec3[];
  if (strategy === 'fps') {
    sampled = farthestPointSample(reduced, options.droneCount);
  } else {
    sampled = weightedPoissonSample(
      reduced.map((point) => ({ point })),
      options.droneCount,
      options.minDistance,
    );
    // Guarantee exact droneCount with cyclic padding (matches poissonSample contract).
    if (sampled.length < options.droneCount && reduced.length > 0) {
      let i = 0;
      while (sampled.length < options.droneCount) {
        sampled.push(reduced[i % reduced.length]);
        i++;
      }
    }
  }

  const fidelity = scoreFormationFidelity(reduced, sampled);

  return {
    points: sampled,
    fidelity,
    candidateCount: reduced.length,
    strategy,
    sourceType: asset.type,
  };
}
