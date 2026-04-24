/**
 * VVIZ Importer — cue normalization in animation-frame batches.
 *
 * Yields between batches so the main thread keeps painting and the UI stays
 * responsive even for tens of thousands of cues.
 */
import type { VvizImportOptions, VvizPayload } from "./types";

function waitFrame(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => resolve());
    } else {
      setTimeout(resolve, 0);
    }
  });
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
  const normalizedCues: unknown[] = new Array(total);

  for (let i = 0; i < total; i += batchSize) {
    assertNotAborted(options.signal);

    const end = Math.min(i + batchSize, total);
    for (let j = i; j < end; j++) {
      normalizedCues[j] = normalizeCue(payload.cues[j]);
    }

    options.onProgress?.({
      phase: "normalizing",
      progress: 0.85 + Math.min(0.14, (end / total) * 0.14),
      message: `Normalizando cues ${end}/${total}`,
    });

    await waitFrame();
  }

  return { ...payload, cues: normalizedCues };
}
