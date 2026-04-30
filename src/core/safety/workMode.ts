/**
 * ─── Work Mode (Design / Simulation / Real Operation) ──────────────
 * Canonical separation between creative work and physical hardware
 * operation. ALL safety/lockout systems must consult this singleton
 * before applying any blocking behavior.
 *
 * Rules:
 *   • design / simulation  → NO blocking. Free creation, edit, render,
 *     simulate, preview, export, AI, internal commands. Alerts and
 *     validations remain visible (informational), but never block.
 *   • real_operation       → ALL physical interlocks ENFORCED. Arm/Fire/
 *     Energize/Hardware-write paths require authorized operator and
 *     pass through SafetyValidator + lockout groups + interlock chain.
 *
 * Switching INTO real_operation must come from explicit human action
 * (Hold-to-Confirm) and authorized role. AI agents MUST NOT call
 * `set('real_operation')` — enforced by guardrails in joiCommandExecutor.
 */

export type WorkMode = 'design' | 'simulation' | 'real_operation';

const STORAGE_KEY = 'fxk:work-mode:v1';
const DEFAULT_MODE: WorkMode = 'design';

function load(): WorkMode {
  if (typeof localStorage === 'undefined') return DEFAULT_MODE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === 'design' || raw === 'simulation' || raw === 'real_operation') return raw;
  } catch { /* noop */ }
  return DEFAULT_MODE;
}

function persist(mode: WorkMode): void {
  if (typeof localStorage === 'undefined') return;
  try { localStorage.setItem(STORAGE_KEY, mode); } catch { /* noop */ }
}

class WorkModeController {
  private _mode: WorkMode = load();
  private _listeners = new Set<(mode: WorkMode) => void>();

  get(): WorkMode { return this._mode; }

  /** True only in `real_operation`. Use to gate physical-hardware paths. */
  isRealOperation(): boolean { return this._mode === 'real_operation'; }

  /** True for design or simulation — i.e. nothing physical may happen. */
  isCreative(): boolean { return this._mode !== 'real_operation'; }

  /**
   * Switch mode. Caller is responsible for human confirmation when
   * transitioning into `real_operation` (UI must Hold-to-Confirm and
   * verify operator role). This setter does not block — it just stores
   * and notifies. Audit logging happens at the call site.
   */
  set(mode: WorkMode): void {
    if (mode === this._mode) return;
    this._mode = mode;
    persist(mode);
    for (const fn of this._listeners) fn(mode);
  }

  subscribe(fn: (mode: WorkMode) => void): () => void {
    this._listeners.add(fn);
    return () => { this._listeners.delete(fn); };
  }
}

export const workMode = new WorkModeController();

/** React hook — re-renders when work mode changes. */
import { useEffect, useState } from 'react';
export function useWorkMode(): WorkMode {
  const [mode, setMode] = useState<WorkMode>(workMode.get());
  useEffect(() => workMode.subscribe(setMode), []);
  return mode;
}
