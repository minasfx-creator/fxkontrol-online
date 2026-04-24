/**
 * SwarmGPT Advanced — RGBA image silhouette → drone Vec3 points.
 * Pure: caller decodes the image (no DOM, no Canvas).
 * Maps image Y → world −Z, X → world X, Y fixed at center.y, scaled by max axis.
 */
import type { Vec3 } from '../../types';
import { reducePointCloud } from '../sampling/reducePointCloud';

export interface SilhouetteImage {
  width: number;
  height: number;
  data: Uint8ClampedArray; // RGBA, length = width*height*4
}

export interface SilhouetteToPointsOptions {
  scale: number;
  center: Vec3;
  alphaMin?: number;       // default 128
  luminanceMax?: number;   // default 255 (off)
  pixelStride?: number;    // default 4
  maxCandidates?: number;  // default 20000
}

export function silhouetteToPoints(
  image: SilhouetteImage,
  options: SilhouetteToPointsOptions,
): Vec3[] {
  if (!image || !image.data || image.width <= 0 || image.height <= 0) return [];

  const alphaMin = options.alphaMin ?? 128;
  const luminanceMax = options.luminanceMax ?? 255;
  const stride = Math.max(1, Math.floor(options.pixelStride ?? 4));
  const maxCandidates = Math.max(0, options.maxCandidates ?? 20000);

  const { width, height, data } = image;
  const candidates: Array<{ x: number; y: number }> = [];

  for (let y = 0; y < height; y += stride) {
    for (let x = 0; x < width; x += stride) {
      const i = (y * width + x) * 4;
      const a = data[i + 3];
      if (a < alphaMin) continue;
      if (luminanceMax < 255) {
        const lum = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
        if (lum > luminanceMax) continue;
      }
      candidates.push({ x, y });
    }
  }

  if (candidates.length === 0) return [];

  const maxAxis = Math.max(width, height);
  const cx = width / 2;
  const cy = height / 2;

  const points: Vec3[] = candidates.map((p) => ({
    x: options.center.x + ((p.x - cx) / maxAxis) * options.scale,
    y: options.center.y,
    z: options.center.z - ((p.y - cy) / maxAxis) * options.scale,
  }));

  return points.length > maxCandidates
    ? reducePointCloud(points, maxCandidates)
    : points;
}
