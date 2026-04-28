/**
 * ─── Safety Gate — QUARANTINED FOR TESTING ─────────────────────────
 *
 * ⚠️  ALL BLOCKING LAYERS ARE PERMANENTLY DISABLED  ⚠️
 *
 * This module has been quarantined for the testing phase.
 * Original implementation preserved at:
 *     src/_quarantine/safety/safetyGate.original.ts
 *
 * BEHAVIOR:
 *   - `isEnforced(layer)` ALWAYS returns false
 *   - `anyEnforced` ALWAYS returns false
 *   - `enableAll()` / `setMaster()` / `setLayer()` are NO-OPS
 *   - Original config schema and listener API preserved (zero refactor)
 *
 * TO RE-ACTIVATE FOR PRODUCTION DEPLOY:
 *   1. `cp src/_quarantine/safety/safetyGate.original.ts src/core/safety/safetyGate.ts`
 *   2. Re-enable the Settings → Segurança tab in `src/pages/Settings.tsx`
 *   3. Run full safety regression suite (E-STOP <50ms, interlock chain)
 *
 * Why a shim instead of deletion?
 *   • Preserves all import sites (~16 files reference safetyGate)
 *   • Listener API used by reactive UIs stays intact (no React errors)
 *   • Zero-friction reversal when ready to ship
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

const QUARANTINED_CONFIG: SafetyGateConfig = Object.freeze({
  masterEnabled: false,
  lockoutGroups: false,
  interlockChain: false,
  modeGuard: false,
  uiLocks: false,
});

class SafetyGate {
  private _listeners = new Set<(cfg: SafetyGateConfig) => void>();

  get config(): Readonly<SafetyGateConfig> {
    return QUARANTINED_CONFIG;
  }

  /** Always false — quarantined. */
  isEnforced(_layer: SafetyLayer): boolean {
    return false;
  }

  /** Always false — quarantined. */
  get anyEnforced(): boolean {
    return false;
  }

  /** No-op — re-activation must be done via file restore. */
  setMaster(_on: boolean): void {
    if (typeof console !== 'undefined') {
      console.info('[SafetyGate] QUARANTINED — setMaster() ignored. Restore from src/_quarantine/safety/.');
    }
  }

  /** No-op — re-activation must be done via file restore. */
  setLayer(_layer: SafetyLayer, _on: boolean): void {
    if (typeof console !== 'undefined') {
      console.info('[SafetyGate] QUARANTINED — setLayer() ignored. Restore from src/_quarantine/safety/.');
    }
  }

  /** No-op — quarantined. */
  enableAll(): void {
    if (typeof console !== 'undefined') {
      console.warn('[SafetyGate] QUARANTINED — enableAll() blocked. To re-enable safety blocking, restore from src/_quarantine/safety/safetyGate.original.ts');
    }
  }

  /** Already disabled. */
  disableAll(): void {
    /* no-op — already permanently disabled */
  }

  subscribe(fn: (cfg: SafetyGateConfig) => void): () => void {
    this._listeners.add(fn);
    return () => { this._listeners.delete(fn); };
  }
}

export const safetyGate = new SafetyGate();

if (typeof console !== 'undefined') {
  console.info(
    '%c[FXK] Safety blocking layers QUARANTINED for testing. Restore from src/_quarantine/safety/ before production.',
    'color: #f59e0b; font-weight: bold;',
  );
}
