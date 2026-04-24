import type { Vec3 } from "../../types";
import { gaussianSplatsToPointCloud, type GaussianSplatPoint } from "../gaussian/gaussianToPointCloud";
import { silhouetteToPoints, type SilhouettePixel } from "../image/silhouetteToPoints";
import { realityScanMeshToPointCloud, type RealityScanMeshLike } from "../realityscan/realityScanAdapter";
import { weightedPoissonSample } from "../sampling/weightedPoissonSampling";
import { poissonThenFps } from "../sampling/poissonThenFps";
import { svgPointsToDronePoints, type SvgSamplePoint } from "../svg/svgPathToPoints";
import { isEnabled } from "@/lib/featureFlags";

export type AdvancedAssetInput =
  | { type: "svg"; points: SvgSamplePoint[] }
  | { type: "silhouette"; pixels: SilhouettePixel[] }
  | { type: "realityscan_mesh"; mesh: RealityScanMeshLike }
  | { type: "gaussian_splat"; splats: GaussianSplatPoint[] }
  | { type: "point_cloud"; points: Vec3[] };

/**
 * Reduction strategy from the source candidate cloud → final drone count.
 *  - 'weighted' (default): legacy WeightedPoisson — may return fewer than
 *    droneCount when minDistance crowds the candidates.
 *  - 'poisson+fps': hierarchical Poisson disk → Farthest Point Sampling.
 *    Guarantees an output of *exactly* droneCount points (when the candidate
 *    cloud has at least that many distinct positions). Requires the
 *    `swarmgpt_fps_sampling` flag; falls back to 'weighted' otherwise.
 */
export type AdvancedSamplingStrategy = "weighted" | "poisson+fps";

export interface AdvancedFormationOptions {
  droneCount: number;
  minDistance: number;
  scale?: number;
  altitude?: number;
  center?: Vec3;
  maxSourcePoints?: number;
  samplingStrategy?: AdvancedSamplingStrategy;
  /** Oversampling multiplier for the intermediate Poisson set in 'poisson+fps'. Default 4. */
  fpsOversample?: number;
}

export function createFormationFromAdvancedAsset(
  asset: AdvancedAssetInput,
  options: AdvancedFormationOptions,
): Vec3[] {
  const droneCount = Math.max(1, Math.floor(options.droneCount));
  const minDistance = Math.max(0, options.minDistance);
  const center = options.center ?? { x: 0, y: options.altitude ?? 30, z: 0 };
  const scale = options.scale ?? 50;
  const maxSourcePoints = Math.max(droneCount, Math.floor(options.maxSourcePoints ?? 20000));
  const requestedStrategy: AdvancedSamplingStrategy = options.samplingStrategy ?? "weighted";
  const effectiveStrategy: AdvancedSamplingStrategy =
    requestedStrategy === "poisson+fps" && !isEnabled("swarmgpt_fps_sampling")
      ? "weighted"
      : requestedStrategy;

  let cloud: Vec3[] = [];
  switch (asset.type) {
    case "svg":
      cloud = svgPointsToDronePoints(asset.points, { scale, center });
      break;
    case "silhouette":
      cloud = silhouetteToPoints(asset.pixels, { center, scale });
      break;
    case "realityscan_mesh":
      cloud = realityScanMeshToPointCloud(asset.mesh, { maxVertices: maxSourcePoints });
      break;
    case "gaussian_splat":
      cloud = gaussianSplatsToPointCloud(asset.splats, { maxPoints: maxSourcePoints });
      break;
    case "point_cloud":
      cloud = Array.isArray(asset.points) ? asset.points.slice(0, maxSourcePoints) : [];
      break;
  }

  if (cloud.length === 0) return [];

  if (effectiveStrategy === "poisson+fps") {
    return poissonThenFps(cloud, {
      droneCount,
      minDistance,
      oversample: options.fpsOversample,
    });
  }

  return weightedPoissonSample(
    cloud.map((point) => ({ point, weight: 1 })),
    droneCount,
    minDistance,
  );
}
