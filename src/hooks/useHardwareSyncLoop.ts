/**
 * ─── useHardwareSyncLoop ────────────────────────────────────────────
 * Boots the decoupled 44Hz hardware sync loop once for the app.
 * Mount in a high-level provider (App.tsx). The loop runs OFF the
 * React render path; this hook only manages lifecycle.
 *
 * Use `useHardwareUniverse(universeId)` for read access — it
 * subscribes via shallow equality so heavy panels (3D viewport,
 * timeline, fixture grids) do NOT re-render on unchanged ticks.
 */
import { useEffect } from 'react';
import { useStoreWithEqualityFn } from 'zustand/traditional';
import { shallow } from 'zustand/shallow';
import { hardwareSyncLoop } from '@/core/hardware/HardwareSyncLoop';
import { useHardwareSyncStore } from '@/stores/hardwareSyncStore';

export function useHardwareSyncLoop(hz = 44): void {
  useEffect(() => {
    hardwareSyncLoop.start(hz);
    return () => hardwareSyncLoop.stop();
  }, [hz]);
}

/** Subscribe to a single universe with shallow equality (per-channel). */
export function useHardwareUniverse(universe: number): number[] | undefined {
  return useStoreWithEqualityFn(
    useHardwareSyncStore,
    (s) => s.activeUniverses[universe],
    // Identity check is enough — the loop swaps the array ref only
    // when the universe actually changed (see HardwareSyncLoop).
    Object.is,
  );
}

/** Subscribe to bridge status map with shallow equality. */
export function useBridgeStatuses() {
  return useStoreWithEqualityFn(
    useHardwareSyncStore,
    (s) => s.bridgeStatus,
    shallow,
  );
}
