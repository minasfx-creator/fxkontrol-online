/**
 * FX KONTROL · LOD (Level of Detail) System v2 — Adaptive + Distance
 * 
 * Distance-based quality scaling PLUS FPS-driven automatic tier adjustment.
 * UE5-inspired: if frame rate drops below threshold, quality auto-reduces.
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

// ═══════════════════════════════════════════════════════════════════════
// Adaptive LOD v2 — FPS-driven automatic quality scaling
// UE5 "Scalability" inspired: real-time perf feedback loop
// ═══════════════════════════════════════════════════════════════════════

const TIER_ORDER: LODTier[] = ['ultra', 'high', 'medium', 'low'];

// Module-level adaptive state (shared across all consumers)
let _adaptiveTierOffset = 0; // 0 = no adjustment, +1 = drop one tier, etc.
let _fpsHistory: number[] = [];
let _lastAdaptiveCheck = 0;
let _adaptiveAutoTier: LODTier = 'high';

// Thresholds
const FPS_DROP_THRESHOLD = 35;
const FPS_DROP_DURATION = 400;  // ms below threshold to trigger drop
const FPS_RAISE_THRESHOLD = 50;
const FPS_RAISE_DURATION = 2000; // ms above threshold to raise quality

let _belowSince = 0;
let _aboveSince = 0;

/**
 * Update the adaptive LOD system. Call once per frame from a central controller.
 * Returns the current adaptive tier name for debug overlay.
 */
export function updateAdaptiveLOD(fps: number): LODTier {
  const now = performance.now();
  _fpsHistory.push(fps);
  if (_fpsHistory.length > 30) _fpsHistory.shift();

  // Only check every 100ms
  if (now - _lastAdaptiveCheck < 100) return _adaptiveAutoTier;
  _lastAdaptiveCheck = now;

  const avgFps = _fpsHistory.reduce((a, b) => a + b, 0) / _fpsHistory.length;

  if (avgFps < FPS_DROP_THRESHOLD) {
    if (_belowSince === 0) _belowSince = now;
    _aboveSince = 0;

    if (now - _belowSince > FPS_DROP_DURATION) {
      // Drop quality
      const currentIdx = TIER_ORDER.indexOf(_adaptiveAutoTier);
      if (currentIdx < TIER_ORDER.length - 1) {
        _adaptiveTierOffset++;
        _adaptiveAutoTier = TIER_ORDER[Math.min(currentIdx + 1, TIER_ORDER.length - 1)];
        _belowSince = 0;
        _fpsHistory = [];
        console.log(`[AdaptiveLOD] FPS ${avgFps.toFixed(0)} → dropping to ${_adaptiveAutoTier.toUpperCase()}`);
      }
    }
  } else if (avgFps > FPS_RAISE_THRESHOLD) {
    if (_aboveSince === 0) _aboveSince = now;
    _belowSince = 0;

    if (now - _aboveSince > FPS_RAISE_DURATION) {
      // Raise quality
      const currentIdx = TIER_ORDER.indexOf(_adaptiveAutoTier);
      if (currentIdx > 0) {
        _adaptiveTierOffset = Math.max(0, _adaptiveTierOffset - 1);
        _adaptiveAutoTier = TIER_ORDER[Math.max(currentIdx - 1, 0)];
        _aboveSince = 0;
        _fpsHistory = [];
        console.log(`[AdaptiveLOD] FPS ${avgFps.toFixed(0)} → raising to ${_adaptiveAutoTier.toUpperCase()}`);
      }
    }
  } else {
    _belowSince = 0;
    _aboveSince = 0;
  }

  return _adaptiveAutoTier;
}

/**
 * Get adaptive LOD factors combining distance + FPS feedback.
 * The adaptive system can downgrade the distance-based tier if FPS is low.
 */
export function getAdaptiveLOD(distanceTier: LODTier): LODFactors {
  const distIdx = TIER_ORDER.indexOf(distanceTier);
  const effectiveIdx = Math.min(distIdx + _adaptiveTierOffset, TIER_ORDER.length - 1);
  return getFactors(TIER_ORDER[effectiveIdx]);
}

/**
 * Get current adaptive tier for debug display.
 */
export function getAdaptiveTier(): LODTier {
  return _adaptiveAutoTier;
}

/**
 * Reset adaptive state (e.g., on scene change).
 */
export function resetAdaptiveLOD() {
  _adaptiveTierOffset = 0;
  _fpsHistory = [];
  _adaptiveAutoTier = 'high';
  _belowSince = 0;
  _aboveSince = 0;
}
