/**
 * ─── Legacy → Consolidated Store Migration ────────────────────────
 * Explicit no-op. Per-domain stores in `src/store/` are canonical.
 * Kept as a stable export so call sites (main.tsx) don't break, and
 * so a future cross-store data move has a single, idempotent hook.
 */
let migrated = false;

export function migrateLegacyStores(): void {
  if (migrated) return;
  migrated = true;
  if (import.meta.env.DEV) {
    console.info(
      '[stores] No legacy store migration is currently required. Canonical stores remain in src/store/.',
    );
  }
}
