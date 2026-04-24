/**
 * VVIZ Importer — public types.
 *
 * Treat .vviz as a heavy asset: streaming-friendly options, progress reporting
 * and abort support so the UI never freezes on large files.
 */

export type VvizImportPhase =
  | "reading"
  | "parsing"
  | "reducing"
  | "validating"
  | "normalizing"
  | "done";

export interface VvizImportProgress {
  phase: VvizImportPhase;
  /** 0..1 monotonically increasing across phases. */
  progress: number;
  message?: string;
}

export interface VvizImportOptions {
  /** Max points per detected Vec3 array. Defaults to 20_000. */
  maxPointCloudPoints?: number;
  /** Max items per generic large array (timeline cues etc). Defaults to 20_000. */
  maxTimelineCues?: number;
  /** Batch size for cue normalization. Defaults to 500. */
  batchSize?: number;
  /** Hard cap for the input file size in MB. Defaults to 80. */
  maxFileMb?: number;
  /** AbortSignal to cancel long imports. */
  signal?: AbortSignal;
  /** Progress callback invoked at every phase boundary. */
  onProgress?: (progress: VvizImportProgress) => void;
}

export interface VvizPayload {
  version?: string;
  project?: unknown;
  timeline?: unknown;
  cues?: unknown[];
  assets?: unknown[];
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}
