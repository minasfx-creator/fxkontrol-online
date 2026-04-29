/**
 * ─── Safety Gate ───────────────────────────────────────────────────
 * Single source of truth for "are blocking systems enforced?".
 *
 * Modes:
 *   - STRICT (flag `safety_gate_strict` = true, default in prod):
 *       All 4 layers FORCED ON at boot. setMaster(false) and
 *       setLayer(_, false) become NO-OPs. Only file/flag flip can
 *       disable. This is the production posture.
 *   - PERMISSIVE (flag = false): user-controlled per layer via
 *       localStorage `fxk:safety-gate:v1`.
 *
 * Layers:
 *   - lockoutGroups   : Lockout Groups (A–E) on Live Firing Panel
 *   - interlockChain  : LOCK → ARM → FIRE state machine
 *   - modeGuard       : OperationalModeGuard (preview/dry-run/export…)
 *   - uiLocks         : per-item .locked flags in editor stores
 */

import { isEnabled } from '@/lib/featureFlags';

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

const PERMISSIVE_DEFAULT: SafetyGateConfig = {
  masterEnabled: false,
  lockoutGroups: false,
  interlockChain: false,
  modeGuard: false,
  uiLocks: false,
};

const STRICT_FORCED: SafetyGateConfig = Object.freeze({
  masterEnabled: true,
  lockoutGroups: true,
  interlockChain: true,
  modeGuard: true,
  uiLocks: true,
});

function isStrict(): boolean {
  try { return isEnabled('safety_gate_strict'); } catch { return false; }
}

function loadFromStorage(): SafetyGateConfig {
  if (typeof localStorage === 'undefined') return { ...PERMISSIVE_DEFAULT };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...PERMISSIVE_DEFAULT };
    return { ...PERMISSIVE_DEFAULT, ...JSON.parse(raw) };
  } catch {
    return { ...PERMISSIVE_DEFAULT };
  }
}

function persist(cfg: SafetyGateConfig): void {
  if (typeof localStorage === 'undefined') return;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg)); } catch { /* noop */ }
}

class SafetyGate {
  private _cfg: SafetyGateConfig = isStrict() ? { ...STRICT_FORCED } : loadFromStorage();
  private _listeners = new Set<(cfg: SafetyGateConfig) => void>();

  get config(): Readonly<SafetyGateConfig> {
    return isStrict() ? STRICT_FORCED : this._cfg;
  }

  /** STRICT mode bypass — true if `safety_gate_strict` flag is on. */
  get isStrict(): boolean { return isStrict(); }

  isEnforced(layer: SafetyLayer): boolean {
    if (isStrict()) return true;
    if (!this._cfg.masterEnabled) return false;
    return !!this._cfg[layer];
  }

  get anyEnforced(): boolean {
    if (isStrict()) return true;
    if (!this._cfg.masterEnabled) return false;
    return this._cfg.lockoutGroups || this._cfg.interlockChain ||
           this._cfg.modeGuard || this._cfg.uiLocks;
  }

  setMaster(on: boolean): void {
    if (isStrict() && !on) {
      console.info('[SafetyGate] STRICT mode — setMaster(false) blocked.');
      return;
    }
    this._cfg = { ...this._cfg, masterEnabled: on };
    persist(this._cfg);
    this._notify();
  }

  setLayer(layer: SafetyLayer, on: boolean): void {
    if (isStrict() && !on) {
      console.info(`[SafetyGate] STRICT mode — setLayer(${layer}, false) blocked.`);
      return;
    }
    this._cfg = { ...this._cfg, [layer]: on };
    persist(this._cfg);
    this._notify();
  }

  enableAll(): void {
    this._cfg = { ...STRICT_FORCED };
    persist(this._cfg);
    this._notify();
  }

  disableAll(): void {
    if (isStrict()) {
      console.info('[SafetyGate] STRICT mode — disableAll() blocked.');
      return;
    }
    this._cfg = { ...PERMISSIVE_DEFAULT };
    persist(this._cfg);
    this._notify();
  }

  subscribe(fn: (cfg: SafetyGateConfig) => void): () => void {
    this._listeners.add(fn);
    return () => { this._listeners.delete(fn); };
  }

  private _notify(): void {
    const snap = this.config;
    for (const fn of this._listeners) fn(snap);
  }
}

export const safetyGate = new SafetyGate();

if (typeof console !== 'undefined' && isStrict()) {
  console.info(
    '%c[FXK] Safety Gate STRICT — all 4 blocking layers ENFORCED.',
    'color: #10b981; font-weight: bold;',
  );
}
