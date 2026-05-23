/**
 * UI Lock Helper — single source of truth for editor item lock checks.
 * When the SafetyGate's `uiLocks` layer is OFF (default), nothing is
 * treated as locked, even if its `.locked` flag is true. This keeps the
 * lock icon visible (informational) but removes the friction.
 */

import { safetyGate } from '@/core/safety/safetyGate';
import { workMode } from '@/core/safety/workMode';

export function isItemLocked(item: { locked?: boolean } | null | undefined): boolean {
  if (!item) return false;
  // Advisory in design/simulation; enforced only in real_operation.
  if (!workMode.isRealOperation()) return false;
  if (!safetyGate.isEnforced('uiLocks')) return false;
  return !!item.locked;
}

/** React hook variant — re-renders when gate config changes. */
import { useEffect, useState } from 'react';

export function useItemLocked(item: { locked?: boolean } | null | undefined): boolean {
  const [, force] = useState(0);
  useEffect(() => {
    const u1 = safetyGate.subscribe(() => force((n) => n + 1));
    const u2 = workMode.subscribe(() => force((n) => n + 1));
    return () => { u1(); u2(); };
  }, []);
  return isItemLocked(item);
}
