import { describe, it, expect } from 'vitest';
import {
  azimuthDeg,
  audienceHeadingDeg,
  haversineMeters,
} from '@/core/geo/audienceAzimuth';

describe('audienceAzimuth', () => {
  it('azimuth north is ~0°', () => {
    const az = azimuthDeg(0, 0, 1, 0);
    expect(az).toBeCloseTo(0, 1);
  });

  it('azimuth east is ~90°', () => {
    const az = azimuthDeg(0, 0, 0, 1);
    expect(az).toBeCloseTo(90, 1);
  });

  it('haversine ~111km per degree of latitude at equator', () => {
    const d = haversineMeters(0, 0, 1, 0);
    expect(d).toBeGreaterThan(110_000);
    expect(d).toBeLessThan(112_000);
  });

  it('audienceHeading faces audience (opposite of bearing-from-audience)', () => {
    // Position west of audience -> audience is east (az=90°)
    // heading convention: 90 - 90 + 180 = 180
    const h = audienceHeadingDeg(0, 0, 0, 1);
    expect(h).toBeCloseTo(180, 1);
  });
});
