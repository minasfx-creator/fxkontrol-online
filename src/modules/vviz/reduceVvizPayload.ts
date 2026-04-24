/**
 * VVIZ Importer — payload reducer.
 *
 * Strips heavy/optional fields (previews, thumbnails, base64 blobs) and
 * deterministically downsamples large Vec3 point clouds and oversized arrays
 * BEFORE schema validation runs. This keeps memory bounded for huge files.
 *
 * Hardening notes (review #2/#3/#6):
 *  - `isVec3Like` is STRICT: exactly the keys {x,y,z}. This prevents keyframes
 *    like {x,y,z,t} from being misidentified as point clouds (which would
 *    drop the `t` field on stride-downsample).
 *  - Generic large-array downsampling is gated by an allowlist of parent keys
 *    (cues/events/keyframes/...) AND requires the items to be objects. This
 *    avoids corrupting flat numeric buffers (vertices/indices/colors) of
 *    embedded meshes.
 *  - `isHeavyKey` matches whole-token / suffix / explicit substrings, not
 *    arbitrary substrings. Preserves flags like `previewMode`,
 *    `livePreviewEnabled`.
 */
import type { VvizImportOptions, VvizPayload } from "./types";

interface NormalizedReduceOptions {
  maxPointCloudPoints: number;
  maxTimelineCues: number;
}

/** Strict Vec3 detector — exactly {x,y,z}, no extra keys. */
function isVec3Like(value: unknown): value is { x: number; y: number; z: number } {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (
    typeof v.x !== "number" ||
    typeof v.y !== "number" ||
    typeof v.z !== "number"
  ) {
    return false;
  }
  // Strict: extra keys (e.g. `t`, `time`, `color`) disqualify — those are
  // keyframes/colored points, not raw point-cloud vertices.
  return Object.keys(v).length === 3;
}

/** Deterministic uniform stride downsample. */
function reduceArray<T>(items: T[], maxItems: number): T[] {
  if (items.length <= maxItems) return items;
  const cap = Math.max(1, maxItems);
  const result: T[] = new Array(cap);
  for (let i = 0; i < cap; i++) {
    result[i] = items[Math.floor((i / cap) * items.length)];
  }
  return result;
}

/**
 * Heavy-key detector. Matches:
 *  - exact: thumbnail
 *  - suffix: *preview, *Preview (e.g. iconPreview)
 *  - explicit token: anything containing "base64"
 * Does NOT match `previewMode` / `livePreviewEnabled` etc.
 */
function isHeavyKey(key: string): boolean {
  const lower = key.toLowerCase();
  if (lower === "thumbnail" || lower === "thumbnails") return true;
  if (lower === "preview" || lower.endsWith("preview")) return true;
  if (lower.includes("base64")) return true;
  return false;
}

/** Parent keys whose array children are safe to length-downsample as cue lists. */
const CUE_LIST_PARENT_KEYS = new Set<string>([
  "cues",
  "events",
  "keyframes",
  "frames",
  "tracks",
  "actions",
  "commands",
]);

function reduceDeep(
  value: unknown,
  options: NormalizedReduceOptions,
  parentKey: string | null,
): unknown {
  if (Array.isArray(value)) {
    // Strict point-cloud (Vec3) downsampling is always safe — items are
    // canonically {x,y,z} only.
    if (value.length > 0 && value.every(isVec3Like)) {
      return reduceArray(value, options.maxPointCloudPoints);
    }

    // Generic length-downsampling is restricted to cue-like arrays of objects
    // under known parent keys. Never touches numeric buffers like
    // vertices/indices/colors of embedded meshes.
    const isCueListContext =
      parentKey !== null && CUE_LIST_PARENT_KEYS.has(parentKey);
    const allObjects =
      value.length > 0 &&
      value.every((item) => item !== null && typeof item === "object");

    if (
      isCueListContext &&
      allObjects &&
      value.length > options.maxTimelineCues
    ) {
      return reduceArray(value, options.maxTimelineCues).map((item) =>
        reduceDeep(item, options, null),
      );
    }

    return value.map((item) => reduceDeep(item, options, null));
  }

  if (!value || typeof value !== "object") return value;

  const obj = value as Record<string, unknown>;
  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(obj)) {
    if (isHeavyKey(key)) continue;
    output[key] = reduceDeep(item, options, key);
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
  return reduceDeep(payload, normalized, null) as VvizPayload;
}
