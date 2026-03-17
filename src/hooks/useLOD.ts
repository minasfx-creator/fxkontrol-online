/**
 * FX KONTROL · LOD (Level of Detail) System
 * Distance-based quality scaling for the expanded 300km² world.
 * 
 * LOD Tiers:
 *   ULTRA  (0-1000m)   — full particles, full trails, max geometry
 *   HIGH   (1000-3000m) — 75% particles, shorter trails
 *   MEDIUM (3000-7500m) — 50% particles, minimal trails
 *   LOW    (7500m+)     — 25% particles, no trails, simplified geometry
 */

import { useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

export type LODTier = 'ultra' | 'high' | 'medium' | 'low';

export interface LODFactors {
  tier: LODTier;
  particleMultiplier: number;   // 0.25-1.0
  trailLength: number;          // 0-1.0
  geometryDetail: number;       // 0.25-1.0 (sphere segments multiplier)
  flashLayers: number;          // 1-4 flash layers to render
  updateFrequency: number;      // 1 = every frame, 2 = every other frame, etc.
}

const LOD_THRESHOLDS = {
  ultra: 1000,
  high: 3000,
  medium: 7500,
};

function getTier(distance: number): LODTier {
  if (distance < LOD_THRESHOLDS.ultra) return 'ultra';
  if (distance < LOD_THRESHOLDS.high) return 'high';
  if (distance < LOD_THRESHOLDS.medium) return 'medium';
  return 'low';
}

function getFactors(tier: LODTier): LODFactors {
  switch (tier) {
    case 'ultra':
      return { tier, particleMultiplier: 1.0, trailLength: 1.0, geometryDetail: 1.0, flashLayers: 4, updateFrequency: 1 };
    case 'high':
      return { tier, particleMultiplier: 0.75, trailLength: 0.7, geometryDetail: 0.75, flashLayers: 3, updateFrequency: 1 };
    case 'medium':
      return { tier, particleMultiplier: 0.5, trailLength: 0.3, geometryDetail: 0.5, flashLayers: 2, updateFrequency: 2 };
    case 'low':
      return { tier, particleMultiplier: 0.25, trailLength: 0.0, geometryDetail: 0.25, flashLayers: 1, updateFrequency: 3 };
  }
}

/**
 * Calculate LOD factors for a world-space position.
 * Uses camera distance to determine quality tier.
 */
export function useLOD(worldPosition: [number, number, number]): LODFactors {
  const { camera } = useThree();
  const posVec = useMemo(() => new THREE.Vector3(...worldPosition), [worldPosition[0], worldPosition[1], worldPosition[2]]);
  const distance = camera.position.distanceTo(posVec);
  const tier = getTier(distance);
  return getFactors(tier);
}

/**
 * Standalone LOD calculation (no hook — for use in useFrame loops).
 */
export function calculateLOD(cameraPosition: THREE.Vector3, targetPosition: THREE.Vector3): LODFactors {
  const distance = cameraPosition.distanceTo(targetPosition);
  return getFactors(getTier(distance));
}

/**
 * Global scene LOD based on camera height/distance from origin.
 * Useful for ground detail, atmospheric particles, etc.
 */
export function useSceneLOD(): LODFactors {
  const { camera } = useThree();
  const distance = camera.position.length(); // distance from world origin
  return getFactors(getTier(distance));
}
