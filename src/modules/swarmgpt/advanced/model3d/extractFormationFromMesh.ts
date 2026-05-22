/**
 * SwarmGPT Advanced — End-to-end 3D model → drone formation.
 *   normalizeMeshToBounds → (hollow ? sampleTrianglesByArea : raw vertices)
 *   → cap by stride → weightedPoissonSample → poissonSample fallback (pad)
 *   → scoreFormationFidelity → ModelExtractionReport
 */
import type { Vec3 } from '../../types';
import { realityScanMeshToPointCloud } from '../realityscan/realityScanAdapter';
import { weightedPoissonSample, type WeightedPoint } from '../sampling/weightedPoissonSampling';
import { poissonSample } from '../poissonSampling';
import { poissonThenFps } from '../sampling/poissonThenFps';
import { scoreFormationFidelity } from '../scoring/scoreFormationFidelity';
import { normalizeMeshToBounds } from './normalizeMesh';
import { sampleTrianglesByArea } from './sampleSurfaceArea';
import { isEnabled } from '@/lib/featureFlags';
import type { ExtractFromMeshOptions, MeshLike, ModelExtractionReport, SamplingStrategy } from './types';

const DEFAULT_MAX_CANDIDATES = 20000;

export function extractFormationFromMesh(
  mesh: MeshLike,
  options: ExtractFromMeshOptions,
): ModelExtractionReport {
  const {
    droneCount,
    minDistance,
    scale,
    center,
    yUp = true,
    hollow = true,
    maxCandidates = DEFAULT_MAX_CANDIDATES,
    samplingStrategy = 'weighted',
  } = options;
  const effectiveStrategy: SamplingStrategy =
    samplingStrategy === 'poisson+fps' && !isEnabled('swarmgpt_fps_sampling')
      ? 'weighted'
      : samplingStrategy;

  const empty: ModelExtractionReport = {
    points: [],
    candidateCount: 0,
    fidelity: { score: 0, coverage: 0, distribution: 0, pointCount: 0 },
    boundingBox: { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } },
  };
  if (!mesh || !mesh.vertices || mesh.vertices.length === 0 || droneCount <= 0) {
    return empty;
  }

  // 1) Normalize to target bounds (recenter + uniform scale + axis swap).
  const normalized = normalizeMeshToBounds(mesh.vertices, { scale, center, yUp });

  // 2) Generate candidate cloud (weighted by triangle area when possible).
  let weighted: WeightedPoint[];
  if (hollow && mesh.indices && mesh.indices.length >= 3) {
    const desired = Math.min(maxCandidates, Math.max(droneCount * 8, 1024));
    weighted = sampleTrianglesByArea(normalized.vertices, mesh.indices, desired);
  } else {
    // Use raw vertex cloud — stride-cap via existing reality scan adapter.
    const capped = realityScanMeshToPointCloud(
      { vertices: normalized.vertices },
      { maxVertices: maxCandidates },
    );
    weighted = capped.map((point) => ({ point, weight: 1 }));
  }

  if (weighted.length === 0) {
    return { ...empty, boundingBox: normalized.boundingBox };
  }

  // 3) Reduction strategy.
  const candidatePoints = weighted.map((w) => w.point);
  let selected: Vec3[];
  if (effectiveStrategy === 'poisson+fps') {
    selected = poissonThenFps(candidatePoints, { droneCount, minDistance });
  } else if (effectiveStrategy === 'poisson') {
    selected = poissonSample(candidatePoints, droneCount, minDistance);
  } else {
    selected = weightedPoissonSample(weighted, droneCount, minDistance);
  }

  // 4) Pad if undersampled — guarantees count via Nível 1 fallback.
  if (selected.length < droneCount) {
    const padded = poissonSample(
      weighted.map((w) => w.point),
      droneCount,
      minDistance,
    );
    // Prefer weighted picks first, then fill from padded set without duplicating refs.
    const seen = new Set(selected);
    for (const p of padded) {
      if (selected.length >= droneCount) break;
      if (!seen.has(p)) {
        selected.push(p);
        seen.add(p);
      }
    }
    if (selected.length < droneCount) selected = padded;
  }

  const fidelity = scoreFormationFidelity(weighted.map((w) => w.point), selected);

  return {
    points: selected,
    candidateCount: weighted.length,
    fidelity,
    boundingBox: normalized.boundingBox,
  };
}
