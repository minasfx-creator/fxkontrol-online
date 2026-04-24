/**
 * Last-run diagnostics store for `sampleFieldUltra`.
 *
 * Tiny pub/sub (no zustand dep) so the UI panel can show whether the most
 * recent sampling ran on GPU or CPU, the duration, and the candidate count.
 * Engine writes via `recordSampleRun`; UI subscribes via `useLastSampleRun`.
 */
import { useEffect, useState } from "react";
import type { GpuFieldEngineDiagnostics } from "./types";

export type SampleRunRecord = {
  mode: "gpu" | "cpu";
  fieldType: string;
  droneCount: number;
  diagnostics: GpuFieldEngineDiagnostics;
  /** Reason the GPU path was skipped, when mode === "cpu". */
  fallbackReason?: string;
  timestamp: number;
};

let _last: SampleRunRecord | null = null;
const _subs = new Set<(r: SampleRunRecord | null) => void>();

export function recordSampleRun(record: Omit<SampleRunRecord, "timestamp">): void {
  _last = { ...record, timestamp: Date.now() };
  for (const cb of _subs) cb(_last);
}

export function getLastSampleRun(): SampleRunRecord | null {
  return _last;
}

export function subscribeSampleRun(cb: (r: SampleRunRecord | null) => void): () => void {
  _subs.add(cb);
  return () => { _subs.delete(cb); };
}

export function clearSampleRun(): void {
  _last = null;
  for (const cb of _subs) cb(null);
}

/** React hook — re-renders when a new run is recorded. */
export function useLastSampleRun(): SampleRunRecord | null {
  const [run, setRun] = useState<SampleRunRecord | null>(getLastSampleRun);
  useEffect(() => subscribeSampleRun(setRun), []);
  return run;
}
