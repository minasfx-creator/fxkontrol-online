/**
 * ─── Legacy → Consolidated Store Migration ────────────────────────
 * One-shot migration helper. Runs on bootstrap, gated by the
 * `consolidatedStores` feature flag in uiWorkspaceStore.
 *
 * Idempotent: once the flag flips to true, subsequent boots no-op.
 *
 * Migration is intentionally additive — legacy stores are NOT cleared
 * here. Removing them is a separate cleanup pass after consumers have
 * been ported and we've validated no regressions in production.
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

  if (typeof console !== 'undefined') {
    console.info(
      '%c[Stores] Consolidating legacy stores → 4 macro stores',
      'color:#22d3ee;font-weight:bold',
    );
  }

  // ── Future migration calls go here ───────────────────────────────
  // Example shape (intentionally commented — flip on per-domain as
  // legacy slices are absorbed):
  //
  //   import { useTimelineStore } from '@/store/useTimelineStore';
  //   useMissionStore.setState({
  //     timeline: useTimelineStore.getState().items,
  //   });

  const copied: NonNullable<MigrationResult['copied']> = {
    mission: 0, hardware: 0, simulation: 0, ui: 0,
  };

  ui.setFeatureFlag('consolidatedStores', true);

  if (typeof console !== 'undefined') {
    console.info(
      '%c[Stores] Migration complete',
      'color:#34d399;font-weight:bold',
      copied,
    );
  }

  return { ran: true, copied };
}
