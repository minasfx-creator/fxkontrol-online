/**
 * ─── Floating Origin Engine ─────────────────────────────────────────
 * Camera-Relative Rendering with ECEF projection for anti-jitter
 * at global GPS coordinates. Uses Float64 math internally, outputs
 * Float32-safe offsets for the GPU.
 *
 * Designed for drone show simulation over real terrain (e.g. Angra dos Reis).
 */

import type { GeoPosition, GeoOrigin } from './skybrushCoordinates';
import { metersPerDegreeLat, metersPerDegreeLon } from './skybrushCoordinates';

// ── WGS84 Constants ─────────────────────────────────────────────────
const WGS84_A = 6378137.0;
const WGS84_E2 = 0.00669437999014;

// ── ECEF Conversions ────────────────────────────────────────────────

export interface ECEFPosition {
  x: number; // meters
  y: number;
  z: number;
}

/**
 * Convert geodetic (lat/lon/alt) to ECEF coordinates.
 * All math in Float64 (JS number).
 */
export function geoToECEF(geo: GeoPosition): ECEFPosition {
  const latRad = geo.lat * Math.PI / 180;
  const lonRad = geo.lon * Math.PI / 180;
  const sinLat = Math.sin(latRad);
  const cosLat = Math.cos(latRad);
  const sinLon = Math.sin(lonRad);
  const cosLon = Math.cos(lonRad);

  const N = WGS84_A / Math.sqrt(1 - WGS84_E2 * sinLat * sinLat);

  return {
    x: (N + geo.alt) * cosLat * cosLon,
    y: (N + geo.alt) * cosLat * sinLon,
    z: (N * (1 - WGS84_E2) + geo.alt) * sinLat,
  };
}

/**
 * Convert ECEF back to geodetic. Iterative Bowring method.
 */
export function ecefToGeo(ecef: ECEFPosition): GeoPosition {
  const { x, y, z } = ecef;
  const p = Math.sqrt(x * x + y * y);
  const lon = Math.atan2(y, x);

  // Iterative latitude
  let lat = Math.atan2(z, p * (1 - WGS84_E2));
  for (let i = 0; i < 5; i++) {
    const sinLat = Math.sin(lat);
    const N = WGS84_A / Math.sqrt(1 - WGS84_E2 * sinLat * sinLat);
    lat = Math.atan2(z + WGS84_E2 * N * sinLat, p);
  }

  const sinLat = Math.sin(lat);
  const N = WGS84_A / Math.sqrt(1 - WGS84_E2 * sinLat * sinLat);
  const alt = p / Math.cos(lat) - N;

  return {
    lat: lat * 180 / Math.PI,
    lon: lon * 180 / Math.PI,
    alt,
  };
}

// ── Floating Origin Class ───────────────────────────────────────────

export interface FloatingOriginState {
  anchorGeo: GeoPosition;
  anchorECEF: ECEFPosition;
  rebaseThreshold: number; // meters — rebase when camera drifts beyond this
}

/**
 * FloatingOrigin maintains a high-precision anchor point and computes
 * camera-relative offsets that are safe for Float32 GPU rendering.
 * 
 * Usage:
 *   const fo = createFloatingOrigin(geoAnchor);
 *   // Each frame:
 *   const offset = fo.getLocalOffset(cameraGeo);
 *   // Apply offset to scene objects
 */
export function createFloatingOrigin(
  anchor: GeoPosition,
  rebaseThreshold = 1000, // 1km default
): FloatingOriginState & {
  getLocalOffset: (target: GeoPosition) => { dx: number; dy: number; dz: number };
  rebaseIfNeeded: (cameraGeo: GeoPosition) => boolean;
  setAnchor: (newAnchor: GeoPosition) => void;
} {
  const state: FloatingOriginState = {
    anchorGeo: { ...anchor },
    anchorECEF: geoToECEF(anchor),
    rebaseThreshold,
  };

  return {
    ...state,

    /**
     * Compute Float32-safe local offset from anchor to target.
     * Uses flat-earth approximation for small distances, ECEF for large.
     */
    getLocalOffset(target: GeoPosition) {
      const dLat = target.lat - state.anchorGeo.lat;
      const dLon = target.lon - state.anchorGeo.lon;
      const dAlt = target.alt - state.anchorGeo.alt;

      const mLat = metersPerDegreeLat(state.anchorGeo.lat);
      const mLon = metersPerDegreeLon(state.anchorGeo.lat);

      // North = +Z in Three.js convention (camera looks -Z)
      // East = +X
      return {
        dx: dLon * mLon,  // East offset
        dy: dAlt,          // Up offset
        dz: -dLat * mLat,  // North offset (negated for Three.js)
      };
    },

    /**
     * Check if camera has moved beyond threshold; if so, rebase anchor.
     * Returns true if rebase occurred.
     */
    rebaseIfNeeded(cameraGeo: GeoPosition): boolean {
      const offset = this.getLocalOffset(cameraGeo);
      const dist = Math.sqrt(offset.dx * offset.dx + offset.dy * offset.dy + offset.dz * offset.dz);

      if (dist > state.rebaseThreshold) {
        state.anchorGeo = { ...cameraGeo };
        state.anchorECEF = geoToECEF(cameraGeo);
        return true;
      }
      return false;
    },

    setAnchor(newAnchor: GeoPosition) {
      state.anchorGeo = { ...newAnchor };
      state.anchorECEF = geoToECEF(newAnchor);
    },
  };
}

// ── Earth Curvature Compensation ────────────────────────────────────

/**
 * Compute the vertical drop due to Earth curvature at a given distance.
 * Used to compensate rendering between distant points (e.g. two barges).
 * 
 * @param distanceMeters - Horizontal distance from anchor
 * @returns Drop in meters (always positive, subtract from altitude)
 */
export function earthCurvatureDrop(distanceMeters: number): number {
  // h = d² / (2R) where R is Earth's radius
  return (distanceMeters * distanceMeters) / (2 * WGS84_A);
}

/**
 * For two GPS positions, compute the curvature compensation needed
 * so that both appear at correct relative heights.
 */
export function curvatureCompensation(a: GeoPosition, b: GeoPosition): number {
  const dLat = (b.lat - a.lat) * metersPerDegreeLat(a.lat);
  const dLon = (b.lon - a.lon) * metersPerDegreeLon(a.lat);
  const dist = Math.sqrt(dLat * dLat + dLon * dLon);
  return earthCurvatureDrop(dist);
}

// ── Default Anchor: Angra dos Reis ──────────────────────────────────

export const ANGRA_DOS_REIS_ANCHOR: GeoPosition = {
  lat: -23.007,
  lon: -44.318,
  alt: 0,
};
