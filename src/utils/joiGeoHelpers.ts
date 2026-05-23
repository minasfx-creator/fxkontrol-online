/**
 * Joi Geo Helpers — pure math that turns geographic intent (lat/lng,
 * polygons, audience) into local-scene positions on the Google 3D Tiles
 * model. Design-only (no hardware, no safety state).
 */
import * as THREE from 'three';
import { geoToLocalSync } from '@/core/geo/useGeo';
import { audienceHeadingDeg, haversineMeters } from '@/core/geo/audienceAzimuth';
import { raycastTerrainLocal } from '@/core/geo/terrainQuery';
import type { Position, PositionGeo } from '@/types/projectTypes';

export interface GeoAnchor {
  lat: number;
  lng: number;
  alt: number;
}

export interface LatLng {
  lat: number;
  lng: number;
}

/** Resolve a Position's local x/z (and optional y) from its `geo` field. */
export function positionFromGeo(
  geo: PositionGeo,
  anchor: GeoAnchor,
): { x: number; y: number; z: number } {
  const local = geoToLocalSync(
    geo.lat,
    geo.lng,
    geo.altAGL ?? 0,
    anchor.lat,
    anchor.lng,
    anchor.alt,
  );
  return { x: local.x, y: local.y, z: local.z };
}

/**
 * Re-materialise an array of positions for a new geo anchor. Positions
 * without a `geo` field are returned unchanged.
 */
export function rematerialisePositions(
  positions: Position[],
  anchor: GeoAnchor,
): Position[] {
  return positions.map((p) => {
    if (!p.geo) return p;
    const { x, y, z } = positionFromGeo(p.geo, anchor);
    return { ...p, x, y: p.geo.altAGL !== undefined ? y : p.y, z };
  });
}

/**
 * Snap each position's Y to the underlying Google 3D Tiles terrain. Returns
 * a new array. Positions where the raycast misses are left unchanged.
 */
export function snapPositionsToTerrain(
  positions: Position[],
  scene: THREE.Scene,
  startHeight = 2000,
): Position[] {
  return positions.map((p) => {
    const y = raycastTerrainLocal(p.x, p.z, scene, startHeight);
    if (y === null) return p;
    return { ...p, y, snappedToTerrain: true };
  });
}

/**
 * Orient every position so it faces an audience anchor. Positions without
 * `geo` use the anchor delta in local space.
 */
export function orientPositionsToAudience(
  positions: Position[],
  audience: LatLng,
  anchor: GeoAnchor,
): Position[] {
  return positions.map((p) => {
    const fromLat = p.geo?.lat ?? anchor.lat;
    const fromLng = p.geo?.lng ?? anchor.lng;
    const heading = audienceHeadingDeg(fromLat, fromLng, audience.lat, audience.lng);
    return { ...p, heading, audienceFacing: true };
  });
}

/**
 * Distribute N positions equidistantly along a polyline / polygon edge.
 * `polygon` is a list of lat/lng; if `closed` we treat it as closed loop.
 */
export function distributeAlongPolygon(
  polygon: LatLng[],
  count: number,
  closed = false,
): LatLng[] {
  if (polygon.length < 2 || count < 1) return [];
  const segs: { a: LatLng; b: LatLng; len: number }[] = [];
  let total = 0;
  const n = closed ? polygon.length : polygon.length - 1;
  for (let i = 0; i < n; i++) {
    const a = polygon[i]!;
    const b = polygon[(i + 1) % polygon.length]!;
    const len = haversineMeters(a.lat, a.lng, b.lat, b.lng);
    segs.push({ a, b, len });
    total += len;
  }
  if (total === 0) return [];
  const step = total / (count - (closed ? 0 : 1) || 1);
  const out: LatLng[] = [];
  let acc = 0;
  let segIdx = 0;
  for (let i = 0; i < count; i++) {
    const target = step * i;
    while (segIdx < segs.length - 1 && acc + segs[segIdx]!.len < target) {
      acc += segs[segIdx]!.len;
      segIdx++;
    }
    const seg = segs[segIdx]!;
    const t = seg.len > 0 ? (target - acc) / seg.len : 0;
    out.push({
      lat: seg.a.lat + (seg.b.lat - seg.a.lat) * t,
      lng: seg.a.lng + (seg.b.lng - seg.a.lng) * t,
    });
  }
  return out;
}

/** Ray-casting point-in-polygon for lat/lng (planar approximation). */
export function pointInPolygon(p: LatLng, polygon: LatLng[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]!;
    const b = polygon[j]!;
    const intersect =
      a.lng > p.lng !== b.lng > p.lng &&
      p.lat < ((b.lat - a.lat) * (p.lng - a.lng)) / (b.lng - a.lng) + a.lat;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Drop positions whose geo falls outside the allowed polygon. */
export function clampToPolygon(positions: Position[], polygon: LatLng[]): Position[] {
  return positions.filter((p) =>
    p.geo ? pointInPolygon(p.geo, polygon) : true,
  );
}

/** Drop positions whose geo falls inside any of the given no-fly zones. */
export function enforceNoFlyZones(
  positions: Position[],
  zones: LatLng[][],
): Position[] {
  return positions.filter((p) =>
    p.geo ? !zones.some((z) => pointInPolygon(p.geo!, z)) : true,
  );
}

/** NFPA-style minimum spectator distance (meters) per shell caliber (mm). */
export function nfpaMinDistanceM(caliberMm: number): number {
  // NFPA 1123: 70 ft per inch of caliber, ~21.34 m / 25.4 mm = 0.84 m/mm.
  return Math.max(50, caliberMm * 0.84);
}
