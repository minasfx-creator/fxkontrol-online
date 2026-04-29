/**
 * ─── Legacy → Consolidated Store Migration ────────────────────────
 * Currently a NO-OP. Per-domain stores in `src/store/` are the
 * canonical source for their respective domains; the surviving
 * macro-stores in `src/stores/` (hardwareSync, uiWorkspace) are
 * additive — they don't subsume legacy state.
 *
 * Kept as a stable hook in case a future refactor needs to copy
 * data across stores during boot. Idempotent.
 *
 * Do NOT log "Consolidating legacy stores" — it was misleading
 * (no copy ever happened).
 */
import { useUIWorkspaceStore } from './uiWorkspaceStore';

export interface MigrationResult {
  ran: boolean;
  reason?: string;
  copied?: Partial<Record<'mission' | 'hardware' | 'simulation' | 'ui', number>>;
}

export function migrateLegacyStores(): MigrationResult {
  const ui = useUIWorkspaceStore.getState();
  if (ui.featureFlags.consolidatedStores) {
    return { ran: false, reason: 'already-migrated' };
  }
  // Flip the flag so the (currently empty) migration path is marked done.
  ui.setFeatureFlag('consolidatedStores', true);
  return { ran: true, copied: { mission: 0, hardware: 0, simulation: 0, ui: 0 } };
}
