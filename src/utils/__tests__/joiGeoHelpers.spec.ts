import { describe, it, expect } from 'vitest';
import {
  distributeAlongPolygon,
  pointInPolygon,
  clampToPolygon,
  enforceNoFlyZones,
  nfpaMinDistanceM,
  rematerialisePositions,
} from '@/utils/joiGeoHelpers';
import type { Position } from '@/types/projectTypes';

describe('joiGeoHelpers', () => {
  it('distributes N points along a 2-vertex line', () => {
    const pts = distributeAlongPolygon(
      [{ lat: 0, lng: 0 }, { lat: 0, lng: 1 }],
      3,
    );
    expect(pts).toHaveLength(3);
    expect(pts[0]!.lng).toBeCloseTo(0, 5);
    expect(pts[2]!.lng).toBeCloseTo(1, 5);
  });

  it('point-in-polygon basic square', () => {
    const sq = [
      { lat: 0, lng: 0 },
      { lat: 0, lng: 1 },
      { lat: 1, lng: 1 },
      { lat: 1, lng: 0 },
    ];
    expect(pointInPolygon({ lat: 0.5, lng: 0.5 }, sq)).toBe(true);
    expect(pointInPolygon({ lat: 2, lng: 2 }, sq)).toBe(false);
  });

  it('clampToPolygon drops outside positions', () => {
    const sq = [
      { lat: 0, lng: 0 }, { lat: 0, lng: 1 },
      { lat: 1, lng: 1 }, { lat: 1, lng: 0 },
    ];
    const positions: Position[] = [
      { id: 'a', name: 'a', type: 'pyro', x: 0, y: 0, z: 0, heading: 0, pitch: 0, roll: 0, color: '#fff', geo: { lat: 0.5, lng: 0.5 } },
      { id: 'b', name: 'b', type: 'pyro', x: 0, y: 0, z: 0, heading: 0, pitch: 0, roll: 0, color: '#fff', geo: { lat: 5, lng: 5 } },
    ];
    expect(clampToPolygon(positions, sq)).toHaveLength(1);
  });

  it('enforceNoFlyZones drops inside positions', () => {
    const zone = [
      { lat: 0, lng: 0 }, { lat: 0, lng: 1 },
      { lat: 1, lng: 1 }, { lat: 1, lng: 0 },
    ];
    const positions: Position[] = [
      { id: 'a', name: 'a', type: 'pyro', x: 0, y: 0, z: 0, heading: 0, pitch: 0, roll: 0, color: '#fff', geo: { lat: 0.5, lng: 0.5 } },
      { id: 'b', name: 'b', type: 'pyro', x: 0, y: 0, z: 0, heading: 0, pitch: 0, roll: 0, color: '#fff', geo: { lat: 5, lng: 5 } },
    ];
    expect(enforceNoFlyZones(positions, [zone])).toHaveLength(1);
  });

  it('NFPA min distance scales with caliber', () => {
    expect(nfpaMinDistanceM(75)).toBeGreaterThan(50);
    expect(nfpaMinDistanceM(200)).toBeGreaterThan(nfpaMinDistanceM(75));
  });

  it('rematerialisePositions leaves non-geo positions untouched', () => {
    const positions: Position[] = [
      { id: 'a', name: 'a', type: 'pyro', x: 42, y: 0, z: 7, heading: 0, pitch: 0, roll: 0, color: '#fff' },
    ];
    const out = rematerialisePositions(positions, { lat: 0, lng: 0, alt: 0 });
    expect(out[0]!.x).toBe(42);
    expect(out[0]!.z).toBe(7);
  });

  it('rematerialisePositions recomputes geo positions', () => {
    const positions: Position[] = [
      { id: 'a', name: 'a', type: 'pyro', x: 0, y: 0, z: 0, heading: 0, pitch: 0, roll: 0, color: '#fff', geo: { lat: 0, lng: 0.001, altAGL: 0 } },
    ];
    const out = rematerialisePositions(positions, { lat: 0, lng: 0, alt: 0 });
    // ~111 m per degree of longitude at equator, so 0.001° ~ 111 m
    expect(out[0]!.x).toBeGreaterThan(100);
    expect(out[0]!.x).toBeLessThan(120);
  });
});
