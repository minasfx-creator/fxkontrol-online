/**
 * ─── Safety Gate ───────────────────────────────────────────────────
 * Single source of truth for "are blocking systems enforced?".
 *
 * Default: ALL OFF. New users get a frictionless experience.
 * Power users / live hardware operators can opt in via Settings.
 *
 * Layers:
 *   - lockoutGroups   : Lockout Groups (A–E) on Live Firing Panel
 *   - interlockChain  : LOCK → ARM → FIRE state machine
 *   - modeGuard       : OperationalModeGuard (preview/dry-run/export…)
 *   - uiLocks         : per-item .locked flags in editor stores
 *
 * Master switch overrides everything: if master is OFF, all layers are
 * treated as OFF regardless of individual settings.
 *
 * Persistence: localStorage key `fxk:safety-gate:v1`.
 * Lives outside React — pure observable singleton.
 */

export type SafetyLayer =
  | 'lockoutGroups'
  | 'interlockChain'
  | 'modeGuard'
  | 'uiLocks';

export interface SafetyGateConfig {
  masterEnabled: boolean;
  lockoutGroups: boolean;
  interlockChain: boolean;
  modeGuard: boolean;
  uiLocks: boolean;
}

const STORAGE_KEY = 'fxk:safety-gate:v1';

// Default = everyone is free. No friction for first-time users.
const DEFAULT_CONFIG: SafetyGateConfig = {
  masterEnabled: false,
  lockoutGroups: false,
  interlockChain: false,
  modeGuard: false,
  uiLocks: false,
};

function loadFromStorage(): SafetyGateConfig {
  if (typeof localStorage === 'undefined') return { ...DEFAULT_CONFIG };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_CONFIG };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

function persist(cfg: SafetyGateConfig): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  } catch {
    /* quota / private mode — silent fail */
  }
}

class SafetyGate {
  private _cfg: SafetyGateConfig = loadFromStorage();
  private _listeners = new Set<(cfg: SafetyGateConfig) => void>();

  /** Snapshot of current config (read-only). */
  get config(): Readonly<SafetyGateConfig> {
    return this._cfg;
  }

  /** True if a given safety layer should currently block actions. */
  isEnforced(layer: SafetyLayer): boolean {
    if (!this._cfg.masterEnabled) return false;
    return !!this._cfg[layer];
  }

  /** True if any layer would block (used for UI banners). */
  get anyEnforced(): boolean {
    if (!this._cfg.masterEnabled) return false;
    return (
      this._cfg.lockoutGroups ||
      this._cfg.interlockChain ||
      this._cfg.modeGuard ||
      this._cfg.uiLocks
    );
  }

  setMaster(on: boolean): void {
    this._cfg = { ...this._cfg, masterEnabled: on };
    persist(this._cfg);
    this._notify();
  }

  setLayer(layer: SafetyLayer, on: boolean): void {
    this._cfg = { ...this._cfg, [layer]: on };
    persist(this._cfg);
    this._notify();
  }

  /** Enable the full classic mission-critical experience. */
  enableAll(): void {
    this._cfg = {
      masterEnabled: true,
      lockoutGroups: true,
      interlockChain: true,
      modeGuard: true,
      uiLocks: true,
    };
    persist(this._cfg);
    this._notify();
  }

  /** Disable everything (back to free / beginner mode). */
  disableAll(): void {
    this._cfg = { ...DEFAULT_CONFIG };
    persist(this._cfg);
    this._notify();
  }

  subscribe(fn: (cfg: SafetyGateConfig) => void): () => void {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  private _notify(): void {
    for (const fn of this._listeners) fn(this._cfg);
  }
}

export const safetyGate = new SafetyGate();
