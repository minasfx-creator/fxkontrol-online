/**
 * VVIZ Importer — light structural validation.
 *
 * Intentionally NOT a deep Zod parse: it only enforces the minimum shape needed
 * to safely hand the payload to downstream normalizers. Deep validation should
 * happen later, on already-reduced data.
 */
import type { VvizPayload } from "./types";

const MAX_CUES = 50_000;

const PROJECT_KEYS = ["project", "timeline", "cues", "assets", "metadata"] as const;

export function validateVvizPayload(payload: VvizPayload): void {
  if (!payload || typeof payload !== "object") {
    throw new Error("Arquivo .vviz inválido: payload ausente.");
  }

  const hasProjectShape = PROJECT_KEYS.some((key) => key in payload);
  if (!hasProjectShape) {
    throw new Error(
      "Arquivo .vviz inválido: estrutura de projeto não encontrada.",
    );
  }

  if (Array.isArray(payload.cues) && payload.cues.length > MAX_CUES) {
    throw new Error(
      `Arquivo .vviz contém cues demais (${payload.cues.length}). Limite: ${MAX_CUES}.`,
    );
  }
}
