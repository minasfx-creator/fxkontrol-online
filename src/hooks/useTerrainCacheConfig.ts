/**
 * useTerrainCacheConfig — Zustand store for runtime-tunable terrain cache
 * parameters. Exposes the previously hard-coded constants as sliders so an
 * operator can profile the cost vs sync trade-off live (e.g. open the
 * Terrain Cache Metrics panel and watch frame ms / drift events change).
 *
 * Defaults match the original constants in useTerrainHeightCache so behavior
 * is identical on first load.
 */
import { create } from 'zustand';

export interface TerrainCacheConfig {
  /** Re-validate already-resolved heights every N frames (~60fps → 30 = 0.5s) */
  revalidateInterval: number;
  /** Max already-resolved positions to re-check per validation tick */
  revalidateBatch: number;
  /** Max unresolved positions to sample per frame */
  unresolvedBatchPerFrame: number;
  /** Drift (meters) above which a cached height is replaced */
  heightDriftThreshold: number;
}

export interface TerrainCacheConfigStore extends TerrainCacheConfig {
  setRevalidateInterval: (n: number) => void;
  setRevalidateBatch: (n: number) => void;
  setUnresolvedBatchPerFrame: (n: number) => void;
  setHeightDriftThreshold: (n: number) => void;
  reset: () => void;
}

export const TERRAIN_CACHE_DEFAULTS: TerrainCacheConfig = {
  revalidateInterval: 30,
  revalidateBatch: 8,
  unresolvedBatchPerFrame: 16,
  heightDriftThreshold: 0.5,
};

export const useTerrainCacheConfig = create<TerrainCacheConfigStore>((set) => ({
  ...TERRAIN_CACHE_DEFAULTS,
  setRevalidateInterval: (n) => set({ revalidateInterval: Math.max(1, Math.round(n)) }),
  setRevalidateBatch: (n) => set({ revalidateBatch: Math.max(1, Math.round(n)) }),
  setUnresolvedBatchPerFrame: (n) => set({ unresolvedBatchPerFrame: Math.max(1, Math.round(n)) }),
  setHeightDriftThreshold: (n) => set({ heightDriftThreshold: Math.max(0.01, n) }),
  reset: () => set({ ...TERRAIN_CACHE_DEFAULTS }),
}));

/** Non-reactive snapshot for use in hot paths (useFrame). */
export function getTerrainCacheConfig(): TerrainCacheConfig {
  const s = useTerrainCacheConfig.getState();
  return {
    revalidateInterval: s.revalidateInterval,
    revalidateBatch: s.revalidateBatch,
    unresolvedBatchPerFrame: s.unresolvedBatchPerFrame,
    heightDriftThreshold: s.heightDriftThreshold,
  };
}
