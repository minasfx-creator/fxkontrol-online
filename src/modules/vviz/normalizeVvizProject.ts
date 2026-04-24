/**
 * VVIZ Importer — cue normalization in animation-frame batches.
 *
 * Hardening notes (review #4/#5):
 *  - Cooperative yielding: only yields to the next frame when the current batch
 *    actually exceeded a CPU budget (default 5ms). Small files normalize
 *    synchronously without paying frame-pacing latency. Large files still
 *    keep the UI responsive.
 *  - Array allocation is capped (`MAX_PREALLOC`) to prevent pathological
 *    OOM on hostile inputs that survived the upstream cue cap.
 */
import type { VvizImportOptions, VvizPayload } from "./types";

const MAX_PREALLOC = 50_000;
const FRAME_BUDGET_MS = 5;

function waitFrame(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => resolve());
    } else {
      setTimeout(resolve, 0);
    }
  });
}

function now(): number {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
}

function assertNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DOMException("VVIZ import aborted.", "AbortError");
  }
}

function normalizeCue(cue: unknown): unknown {
  if (!cue || typeof cue !== "object") return cue;
  const c = cue as Record<string, unknown>;
  return {
    ...c,
    startTime:
      typeof c.startTime === "number" ? Math.max(0, c.startTime) : c.startTime,
    duration:
      typeof c.duration === "number" ? Math.max(0, c.duration) : c.duration,
  };
}

export async function normalizeVvizProject(
  payload: VvizPayload,
  options: VvizImportOptions,
): Promise<VvizPayload> {
  if (!Array.isArray(payload.cues) || payload.cues.length === 0) {
    return payload;
  }

  const batchSize = Math.max(1, options.batchSize ?? 500);
  const total = payload.cues.length;
  const allocSize = Math.min(total, MAX_PREALLOC);
  const normalizedCues: unknown[] =
    total <= MAX_PREALLOC ? new Array(allocSize) : [];

  for (let i = 0; i < total; i += batchSize) {
    assertNotAborted(options.signal);

    const batchStart = now();
    const end = Math.min(i + batchSize, total);
    if (total <= MAX_PREALLOC) {
      for (let j = i; j < end; j++) {
        normalizedCues[j] = normalizeCue(payload.cues[j]);
      }
    } else {
      for (let j = i; j < end; j++) {
        normalizedCues.push(normalizeCue(payload.cues[j]));
      }
    }

    options.onProgress?.({
      phase: "normalizing",
      progress: 0.85 + Math.min(0.14, (end / total) * 0.14),
      message: `Normalizando cues ${end}/${total}`,
    });

    // Only yield when the batch actually consumed real CPU time. Avoids
    // adding ~16ms of frame latency per batch on small files.
    if (now() - batchStart > FRAME_BUDGET_MS && end < total) {
      await waitFrame();
    }
  }

  return { ...payload, cues: normalizedCues };
}
