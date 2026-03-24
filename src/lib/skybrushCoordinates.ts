/**
 * ─── Skybrush Coordinate Transform Engine ───────────────────────────
 * GPS ↔ Local coordinate conversions matching Skybrush Server conventions.
 * 
 * Coordinate systems supported:
 *   NEU (North-East-Up) — Skybrush default
 *   NED (North-East-Down) — MAVLink/ArduPilot convention
 *   ENU (East-North-Up) — ROS convention
 * 
 * Based on WGS84 ellipsoid with flat-earth approximation for local frames.
 * Matches Skybrush Studio's coordinate transformation pipeline.
 */

// ── WGS84 Constants ─────────────────────────────────────────────────

const WGS84_A = 6378137.0;           // semi-major axis (meters)
const WGS84_F = 1 / 298.257223563;   // flattening
const WGS84_B = WGS84_A * (1 - WGS84_F); // semi-minor axis
const WGS84_E2 = 2 * WGS84_F - WGS84_F * WGS84_F; // eccentricity squared

export type CoordinateSystem = 'neu' | 'ned' | 'enu';

export interface GeoOrigin {
  lat: number;      // degrees
  lon: number;      // degrees
  altMSL: number;   // meters above mean sea level
  heading: number;   // degrees, rotation of local X axis from North (CW)
  magneticDeclination: number; // degrees
}

export interface LocalPosition {
  x: number; // meters
  y: number;
  z: number;
}

export interface GeoPosition {
  lat: number;  // degrees
  lon: number;  // degrees
  alt: number;  // meters MSL
}

export const DEFAULT_ORIGIN: GeoOrigin = {
  lat: 0,
  lon: 0,
  altMSL: 0,
  heading: 0,
  magneticDeclination: 0,
};

// ── Core Functions ──────────────────────────────────────────────────

/**
 * Radius of curvature in the prime vertical (N)
 */
function primeVerticalRadius(latRad: number): number {
  const sinLat = Math.sin(latRad);
  return WGS84_A / Math.sqrt(1 - WGS84_E2 * sinLat * sinLat);
}

/**
 * Radius of curvature in the meridian (M)
 */
function meridianRadius(latRad: number): number {
  const sinLat = Math.sin(latRad);
  const denom = 1 - WGS84_E2 * sinLat * sinLat;
  return WGS84_A * (1 - WGS84_E2) / Math.pow(denom, 1.5);
}

/**
 * Meters per degree latitude at a given latitude
 */
export function metersPerDegreeLat(latDeg: number): number {
  const latRad = latDeg * Math.PI / 180;
  return meridianRadius(latRad) * Math.PI / 180;
}

/**
 * Meters per degree longitude at a given latitude
 */
export function metersPerDegreeLon(latDeg: number): number {
  const latRad = latDeg * Math.PI / 180;
  return primeVerticalRadius(latRad) * Math.cos(latRad) * Math.PI / 180;
}

// ── GPS ↔ Local Conversions ─────────────────────────────────────────

/**
 * Convert GPS position to local NEU coordinates relative to origin.
 * This is the flat-earth approximation used by Skybrush Studio.
 */
export function geoToLocal(
  geo: GeoPosition,
  origin: GeoOrigin,
  system: CoordinateSystem = 'neu',
): LocalPosition {
  const dLat = geo.lat - origin.lat;
  const dLon = geo.lon - origin.lon;
  const dAlt = geo.alt - origin.altMSL;

  const mPerLat = metersPerDegreeLat(origin.lat);
  const mPerLon = metersPerDegreeLon(origin.lat);

  // North and East in meters
  const north = dLat * mPerLat;
  const east = dLon * mPerLon;
  const up = dAlt;

  // Apply heading rotation
  const headingRad = origin.heading * Math.PI / 180;
  const cosH = Math.cos(headingRad);
  const sinH = Math.sin(headingRad);
  const rotN = north * cosH + east * sinH;
  const rotE = -north * sinH + east * cosH;

  switch (system) {
    case 'neu':
      return { x: rotN, y: rotE, z: up };
    case 'ned':
      return { x: rotN, y: rotE, z: -up };
    case 'enu':
      return { x: rotE, y: rotN, z: up };
    default:
      return { x: rotN, y: rotE, z: up };
  }
}

/**
 * Convert local coordinates back to GPS position.
 */
export function localToGeo(
  local: LocalPosition,
  origin: GeoOrigin,
  system: CoordinateSystem = 'neu',
): GeoPosition {
  let north: number, east: number, up: number;

  switch (system) {
    case 'neu':
      north = local.x; east = local.y; up = local.z;
      break;
    case 'ned':
      north = local.x; east = local.y; up = -local.z;
      break;
    case 'enu':
      east = local.x; north = local.y; up = local.z;
      break;
    default:
      north = local.x; east = local.y; up = local.z;
  }

  // Reverse heading rotation
  const headingRad = -origin.heading * Math.PI / 180;
  const cosH = Math.cos(headingRad);
  const sinH = Math.sin(headingRad);
  const unrotN = north * cosH + east * sinH;
  const unrotE = -north * sinH + east * cosH;

  const mPerLat = metersPerDegreeLat(origin.lat);
  const mPerLon = metersPerDegreeLon(origin.lat);

  return {
    lat: origin.lat + unrotN / mPerLat,
    lon: origin.lon + unrotE / mPerLon,
    alt: origin.altMSL + up,
  };
}

// ── Takeoff/Landing Grid Generator ──────────────────────────────────

export interface GridConfig {
  droneCount: number;
  spacing: number;         // meters between drones (default 2.5)
  pattern: 'square' | 'hex' | 'line' | 'circle';
  orientation: number;     // degrees, grid rotation
  centerOffset: { x: number; z: number }; // offset from origin
}

export const DEFAULT_GRID_CONFIG: GridConfig = {
  droneCount: 100,
  spacing: 2.5,
  pattern: 'square',
  orientation: 0,
  centerOffset: { x: 0, z: 0 },
};

export interface GridPosition {
  id: string;
  x: number;
  y: number; // always 0 for ground
  z: number;
  label: string;
  row: number;
  col: number;
}

/**
 * Generate takeoff/landing grid positions matching Skybrush Studio conventions.
 * Grid is centered at centerOffset with the given spacing and pattern.
 */
export function generateGrid(config: GridConfig = DEFAULT_GRID_CONFIG): GridPosition[] {
  const { droneCount, spacing, pattern, orientation, centerOffset } = config;
  const positions: GridPosition[] = [];
  const orientRad = orientation * Math.PI / 180;
  const cos = Math.cos(orientRad);
  const sin = Math.sin(orientRad);

  function rotateAndOffset(lx: number, lz: number): { x: number; z: number } {
    return {
      x: lx * cos - lz * sin + centerOffset.x,
      z: lx * sin + lz * cos + centerOffset.z,
    };
  }

  switch (pattern) {
    case 'square': {
      const cols = Math.ceil(Math.sqrt(droneCount));
      const rows = Math.ceil(droneCount / cols);
      const offsetX = -(cols - 1) * spacing * 0.5;
      const offsetZ = -(rows - 1) * spacing * 0.5;
      
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (positions.length >= droneCount) break;
          const lx = offsetX + c * spacing;
          const lz = offsetZ + r * spacing;
          const { x, z } = rotateAndOffset(lx, lz);
          positions.push({
            id: `pad-${positions.length + 1}`,
            x, y: 0, z,
            label: `${String.fromCharCode(65 + r)}${c + 1}`,
            row: r, col: c,
          });
        }
      }
      break;
    }

    case 'hex': {
      const cols = Math.ceil(Math.sqrt(droneCount * 1.15));
      const rows = Math.ceil(droneCount / cols);
      const rowSpacing = spacing * Math.sqrt(3) / 2;
      const offsetX = -(cols - 1) * spacing * 0.5;
      const offsetZ = -(rows - 1) * rowSpacing * 0.5;
      
      for (let r = 0; r < rows; r++) {
        const hexOffset = r % 2 === 1 ? spacing * 0.5 : 0;
        for (let c = 0; c < cols; c++) {
          if (positions.length >= droneCount) break;
          const lx = offsetX + c * spacing + hexOffset;
          const lz = offsetZ + r * rowSpacing;
          const { x, z } = rotateAndOffset(lx, lz);
          positions.push({
            id: `pad-${positions.length + 1}`,
            x, y: 0, z,
            label: `${String.fromCharCode(65 + r)}${c + 1}`,
            row: r, col: c,
          });
        }
      }
      break;
    }

    case 'line': {
      const offsetX = -(droneCount - 1) * spacing * 0.5;
      for (let i = 0; i < droneCount; i++) {
        const lx = offsetX + i * spacing;
        const { x, z } = rotateAndOffset(lx, 0);
        positions.push({
          id: `pad-${i + 1}`,
          x, y: 0, z,
          label: `${i + 1}`,
          row: 0, col: i,
        });
      }
      break;
    }

    case 'circle': {
      const radius = (droneCount * spacing) / (2 * Math.PI);
      for (let i = 0; i < droneCount; i++) {
        const angle = (i / droneCount) * Math.PI * 2;
        const lx = Math.cos(angle) * radius;
        const lz = Math.sin(angle) * radius;
        const { x, z } = rotateAndOffset(lx, lz);
        positions.push({
          id: `pad-${i + 1}`,
          x, y: 0, z,
          label: `${i + 1}`,
          row: 0, col: i,
        });
      }
      break;
    }
  }

  return positions;
}

/**
 * Calculate recommended spacing based on drone count and available area.
 * Based on Skybrush Studio's auto-spacing algorithm.
 */
export function recommendedSpacing(droneCount: number, areaSize?: number): number {
  // Minimum 1.5m for small drones, 2.5m for standard, 3.5m for large
  const baseSpacing = 2.5;
  if (!areaSize) return baseSpacing;
  
  const idealSpacing = Math.sqrt(areaSize / droneCount) * 0.8;
  return Math.max(baseSpacing, Math.min(idealSpacing, 5.0));
}

// ── Haversine Distance ──────────────────────────────────────────────

/**
 * Great-circle distance between two GPS positions.
 */
export function haversineDistance(a: GeoPosition, b: GeoPosition): number {
  const R = WGS84_A;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLon = (b.lon - a.lon) * Math.PI / 180;
  const lat1 = a.lat * Math.PI / 180;
  const lat2 = b.lat * Math.PI / 180;

  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Bearing from position A to B (degrees, 0=North CW).
 */
export function bearing(a: GeoPosition, b: GeoPosition): number {
  const lat1 = a.lat * Math.PI / 180;
  const lat2 = b.lat * Math.PI / 180;
  const dLon = (b.lon - a.lon) * Math.PI / 180;

  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
}
