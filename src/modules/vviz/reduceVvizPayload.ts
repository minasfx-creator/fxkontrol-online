/**
 * VVIZ Importer — payload reducer.
 *
 * Strips heavy/optional fields (previews, thumbnails, base64 blobs) and
 * deterministically downsamples large Vec3 point clouds and oversized arrays
 * BEFORE schema validation runs. This keeps memory bounded for huge files.
 */
import type { VvizImportOptions, VvizPayload } from "./types";

interface NormalizedReduceOptions {
  maxPointCloudPoints: number;
  maxTimelineCues: number;
}

function isVec3Like(value: unknown): value is { x: number; y: number; z: number } {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.x === "number" &&
    typeof v.y === "number" &&
    typeof v.z === "number"
  );
}

/** Deterministic uniform stride downsample. */
function reduceArray<T>(items: T[], maxItems: number): T[] {
  if (items.length <= maxItems) return items;
  const result: T[] = new Array(maxItems);
  for (let i = 0; i < maxItems; i++) {
    result[i] = items[Math.floor((i / maxItems) * items.length)];
  }
  return result;
}

const HEAVY_KEY_HINTS = ["preview", "thumbnail", "base64"] as const;

function isHeavyKey(key: string): boolean {
  const lower = key.toLowerCase();
  for (const hint of HEAVY_KEY_HINTS) {
    if (lower.includes(hint)) return true;
  }
  return false;
}

function reduceDeep(value: unknown, options: NormalizedReduceOptions): unknown {
  if (Array.isArray(value)) {
    if (value.length > 0 && value.every(isVec3Like)) {
      return reduceArray(value, options.maxPointCloudPoints);
    }
    if (value.length > options.maxTimelineCues) {
      return reduceArray(value, options.maxTimelineCues).map((item) =>
        reduceDeep(item, options),
      );
    }
    return value.map((item) => reduceDeep(item, options));
  }

  if (!value || typeof value !== "object") return value;

  const obj = value as Record<string, unknown>;
  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(obj)) {
    if (isHeavyKey(key)) continue;
    output[key] = reduceDeep(item, options);
  }
  return output;
}

export function reduceVvizPayload(
  payload: unknown,
  options: VvizImportOptions,
): VvizPayload {
  const normalized: NormalizedReduceOptions = {
    maxPointCloudPoints: options.maxPointCloudPoints ?? 20_000,
    maxTimelineCues: options.maxTimelineCues ?? 20_000,
  };
  return reduceDeep(payload, normalized) as VvizPayload;
}
