import type { Vec3 } from "../../types";
import { gaussianSplatsToPointCloud, type GaussianSplatPoint } from "../gaussian/gaussianToPointCloud";
import { silhouetteToPoints, type SilhouettePixel } from "../image/silhouetteToPoints";
import { realityScanMeshToPointCloud, type RealityScanMeshLike } from "../realityscan/realityScanAdapter";
import { weightedPoissonSample } from "../sampling/weightedPoissonSampling";
import { svgPointsToDronePoints, type SvgSamplePoint } from "../svg/svgPathToPoints";

export type AdvancedAssetInput =
  | { type: "svg"; points: SvgSamplePoint[] }
  | { type: "silhouette"; pixels: SilhouettePixel[] }
  | { type: "realityscan_mesh"; mesh: RealityScanMeshLike }
  | { type: "gaussian_splat"; splats: GaussianSplatPoint[] }
  | { type: "point_cloud"; points: Vec3[] };

export interface AdvancedFormationOptions {
  droneCount: number;
  minDistance: number;
  scale?: number;
  altitude?: number;
  center?: Vec3;
  maxSourcePoints?: number;
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
  return weightedPoissonSample(
    cloud.map((point) => ({ point, weight: 1 })),
    droneCount,
    minDistance,
  );
}

