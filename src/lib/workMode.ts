/**
 * workMode — minimal canonical work-mode store.
 *
 * Project memory references a "WorkMode 3-Mode" canonical store that does
 * not yet exist as a single module. This file is a *thin* implementation
 * for UI gating only — it never mutates SafetyStateMachine or FieldBus.
 *
 * Surfaces:
 *   - `getWorkMode()` / `setWorkMode()` for synchronous reads/writes
 *   - `subscribeWorkMode(cb)` for reactive UIs
 *   - `useWorkMode()` React hook (re-renders on change)
 *
 * Default: `'simulation'` — safe everywhere, no physical interlocks.
 *   - `design`        — pure authoring; no hardware required.
 *   - `simulation`    — VDL/render/export advisory; no fire path.
 *   - `real_operation`— physical interlocks ON; gated upstream by
 *                       `requestRealOperation()` (Phase 2).
 */

import { useEffect, useState } from 'react';

export type WorkMode = 'design' | 'simulation' | 'real_operation';

let _mode: WorkMode = 'simulation';
const _subs = new Set<(m: WorkMode) => void>();

export function getWorkMode(): WorkMode {
  return _mode;
}

/**
 * Sets the work mode. NOTE: this is a *display* setter — promotion to
 * `real_operation` MUST go through `requestRealOperation()` (Phase 2 gate).
 * Callers that bypass that gate are auditable.
 */
export function setWorkMode(next: WorkMode): void {
  if (_mode === next) return;
  _mode = next;
  for (const cb of _subs) cb(_mode);
}

export function subscribeWorkMode(cb: (m: WorkMode) => void): () => void {
  _subs.add(cb);
  return () => _subs.delete(cb);
}

export function useWorkMode(): WorkMode {
  const [m, setM] = useState<WorkMode>(_mode);
  useEffect(() => subscribeWorkMode(setM), []);
  return m;
}

/** True when physical interlocks must be enforced. */
export function isRealOperation(mode: WorkMode = _mode): boolean {
  return mode === 'real_operation';
}
