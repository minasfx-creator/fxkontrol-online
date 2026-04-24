/**
 * VVIZ Importer — phased entry point.
 *
 * Pipeline:
 *   read → parse → reduce → validate → normalize → done
 *
 * Each phase reports progress and honors AbortSignal. The final payload is
 * returned to the caller, who is responsible for committing it to the store
 * exactly ONCE (do NOT call setState in a loop).
 */
import type { VvizImportOptions, VvizPayload } from "./types";
import { reduceVvizPayload } from "./reduceVvizPayload";
import { validateVvizPayload } from "./validateVvizPayload";
import { normalizeVvizProject } from "./normalizeVvizProject";

const DEFAULT_MAX_FILE_MB = 80;

function assertNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DOMException("VVIZ import aborted.", "AbortError");
  }
}

function getFileSizeMb(file: File): number {
  return file.size / 1024 / 1024;
}

export async function importVvizFile(
  file: File,
  options: VvizImportOptions = {},
): Promise<VvizPayload> {
  const maxFileMb = options.maxFileMb ?? DEFAULT_MAX_FILE_MB;
  const sizeMb = getFileSizeMb(file);

  if (sizeMb > maxFileMb) {
    throw new Error(
      `Arquivo .vviz muito grande (${sizeMb.toFixed(
        1,
      )}MB). Limite atual: ${maxFileMb}MB.`,
    );
  }

  assertNotAborted(options.signal);
  options.onProgress?.({
    phase: "reading",
    progress: 0.1,
    message: "Lendo arquivo .vviz...",
  });

  const text = await file.text();
  assertNotAborted(options.signal);

  options.onProgress?.({
    phase: "parsing",
    progress: 0.3,
    message: "Interpretando JSON...",
  });

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(
      "Arquivo .vviz inválido: não foi possível interpretar o JSON.",
    );
  }
  assertNotAborted(options.signal);

  options.onProgress?.({
    phase: "reducing",
    progress: 0.5,
    message: "Reduzindo dados pesados...",
  });
  const reduced = reduceVvizPayload(parsed, options);
  assertNotAborted(options.signal);

  options.onProgress?.({
    phase: "validating",
    progress: 0.7,
    message: "Validando estrutura...",
  });
  validateVvizPayload(reduced);
  assertNotAborted(options.signal);

  options.onProgress?.({
    phase: "normalizing",
    progress: 0.85,
    message: "Normalizando projeto...",
  });
  const normalized = await normalizeVvizProject(reduced, options);

  options.onProgress?.({
    phase: "done",
    progress: 1,
    message: "Importação concluída.",
  });

  return normalized;
}
