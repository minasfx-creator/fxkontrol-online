/**
 * ─── Reopen Match Policy Store ─────────────────────────────────────
 * Operator-tunable strategy used to key persistent port-registry
 * entries (and therefore drive auto-reopen on the next session):
 *
 *  - 'vidpid'        → match by VID:PID only. Any unit of the same
 *                      adapter family is treated as the same device.
 *                      Best for fleet swaps where you replace a faulty
 *                      cable/dongle with an identical spare.
 *
 *  - 'vidpid+serial' → match by VID:PID + USB serial number when the
 *                      device exposes one (WebUSB only — Web Serial
 *                      never reveals the serial). Pins a specific
 *                      physical unit; safer when several adapters of
 *                      the same family are plugged simultaneously.
 *
 * Persisted in localStorage; pure helper `getReopenMatchPolicy()`
 * exposes the value for non-React modules (discoverers).
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ReopenMatchPolicy = 'vidpid' | 'vidpid+serial';

interface ReopenMatchState {
  policy: ReopenMatchPolicy;
  setPolicy: (p: ReopenMatchPolicy) => void;
}

export const useReopenMatchPolicy = create<ReopenMatchState>()(
  persist(
    (set) => ({
      policy: 'vidpid',
      setPolicy: (policy) => set({ policy }),
    }),
    { name: 'fxk:reopenMatchPolicy:v1' },
  ),
);

/** Non-React accessor — safe to call from discoverers / services. */
export function getReopenMatchPolicy(): ReopenMatchPolicy {
  try { return useReopenMatchPolicy.getState().policy; }
  catch { return 'vidpid'; }
}
