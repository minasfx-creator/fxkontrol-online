/**
 * ─── Operational Mode Guard ────────────────────────────────────────
 * Enforces 6 operational modes. Maps each mode to allowed operations.
 * Provides assertAllowed() that throws if operation is prohibited.
 * Consumed by ExportCoordinator and any future command path.
 */

import type { AllowedOperation, OperationalMode } from './types';
import { safetyGate } from '@/core/safety/safetyGate';
import { workMode } from '@/core/safety/workMode';

const MODE_PERMISSIONS: Record<OperationalMode, AllowedOperation[]> = {
  'preview':         ['simulate', 'preview', 'validate', 'diagnostics'],
  'diagnostics':     ['validate', 'diagnostics'],
  'dry-run':         ['simulate', 'preview', 'validate', 'diagnostics'],
  'live-read-only':  ['preview', 'validate', 'diagnostics', 'sync_read_only'],
  'read-only-sync':  ['simulate', 'preview', 'validate', 'export', 'diagnostics', 'sync_read_only'],
  'export':          ['simulate', 'preview', 'validate', 'export', 'diagnostics'],
  'blocked':         ['validate', 'diagnostics'],
};

class OperationalModeGuard {
  private _mode: OperationalMode = 'preview';
  private _listeners = new Set<(mode: OperationalMode) => void>();

  get mode(): OperationalMode { return this._mode; }

  setMode(mode: OperationalMode): void {
    if (mode === this._mode) return;
    this._mode = mode;
    for (const fn of this._listeners) fn(mode);
  }

  /** Check if operation is allowed under current mode */
  check(operation: AllowedOperation): { allowed: boolean; reason: string } {
    // Work-mode gate: in design/simulation, every operation is permitted.
    // Only physical paths in real_operation may consult this guard.
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { workMode } = require('@/core/safety/workMode') as typeof import('@/core/safety/workMode');
      if (!workMode.isRealOperation()) {
        return { allowed: true, reason: `Operation '${operation}' allowed (design/simulation mode)` };
      }
    } catch { /* fall through */ }

    // Gate bypass — when mode guard is disabled by user preference,
    // every operation is allowed regardless of operational mode.
    if (!safetyGate.isEnforced('modeGuard')) {
      return {
        allowed: true,
        reason: `Operation '${operation}' allowed (mode guard disabled by user)`,
      };
    }
    const allowed = MODE_PERMISSIONS[this._mode]?.includes(operation) ?? false;
    return {
      allowed,
      reason: allowed
        ? `Operation '${operation}' permitted in mode '${this._mode}'`
        : `Operation '${operation}' BLOCKED in mode '${this._mode}'`,
    };
  }

  /** Throws if operation not allowed */
  assertAllowed(operation: AllowedOperation): void {
    const { allowed, reason } = this.check(operation);
    if (!allowed) throw new Error(`[ModeGuard] ${reason}`);
  }

  getAllowedOperations(): AllowedOperation[] {
    return [...(MODE_PERMISSIONS[this._mode] ?? [])];
  }

  onChange(fn: (mode: OperationalMode) => void): () => void {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }
}

export const operationalModeGuard = new OperationalModeGuard();
