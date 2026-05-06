import { describe, expect, it } from 'vitest';
import {
  resolveAxesMode,
  transformDelta,
  transformHeadingDegrees,
  transformPoint,
} from '@/modules/vviz/vvizCoordinateTransform';

describe('vvizCoordinateTransform — Finale 3D ENU → Three.js', () => {
  it('resolves coordinate frame keywords', () => {
    expect(resolveAxesMode(undefined)).toBe('enu_to_three');
    expect(resolveAxesMode('vviz')).toBe('enu_to_three');
    expect(resolveAxesMode('Finale3D')).toBe('enu_to_three');
    expect(resolveAxesMode('threejs')).toBe('pass');
    expect(resolveAxesMode('legacy')).toBe('legacy_zflip');
  });

  it('maps ENU axes correctly: East→X, Up→Y, North→-Z', () => {
    // 10m East
    expect(transformPoint(10, 0, 0, 'enu_to_three')).toEqual({ x: 10, y: 0, z: 0 });
    // 10m North → should land on -Z
    expect(transformPoint(0, 10, 0, 'enu_to_three')).toEqual({ x: 0, y: 0, z: -10 });
    // 10m Up → should land on +Y
    expect(transformPoint(0, 0, 10, 'enu_to_three')).toEqual({ x: 0, y: 10, z: 0 });
  });

  it('legacy mode only flips Z (backward compat)', () => {
    expect(transformPoint(1, 2, 3, 'legacy_zflip')).toEqual({ x: 1, y: 2, z: -3 });
  });

  it('pass-through mode preserves input', () => {
    expect(transformPoint(1, 2, 3, 'pass')).toEqual({ x: 1, y: 2, z: 3 });
  });

  it('delta uses the same linear map as point', () => {
    const p = transformPoint(2, -5, 7, 'enu_to_three');
    const d = transformDelta(2, -5, 7, 'enu_to_three');
    expect(d).toEqual(p);
  });

  it('heading: Finale CW-from-North → Three CCW-from-North', () => {
    // 0° = North in both frames
    expect(transformHeadingDegrees(0, 'enu_to_three')).toBe(0);
    // 90° CW (East) becomes -90° CCW
    expect(transformHeadingDegrees(90, 'enu_to_three')).toBe(-90);
    // 180° (South) is the same in either rotation sense
    expect(transformHeadingDegrees(180, 'enu_to_three')).toBe(180);
    // 270° CW (West) → +90° CCW (normalised)
    expect(transformHeadingDegrees(270, 'enu_to_three')).toBe(90);
  });

  it('heading: pass-through and legacy preserve identity for pass', () => {
    expect(transformHeadingDegrees(45, 'pass')).toBe(45);
  });

  it('heading: invalid values normalise to 0', () => {
    expect(transformHeadingDegrees(NaN, 'enu_to_three')).toBe(0);
  });

  it('heading: round-trip through enu_to_three twice returns original (mod 360)', () => {
    for (const h of [0, 30, 90, 137, 180, 200, 350]) {
      const once = transformHeadingDegrees(h, 'enu_to_three');
      const twice = transformHeadingDegrees(-once, 'enu_to_three'); // simulate inverse
      // twice should equal h normalised
      const norm = ((h + 540) % 360) - 180;
      expect(twice).toBeCloseTo(norm <= -180 ? norm + 360 : norm, 6);
    }
  });

  it('home position with heading 90° CW East lands on +X axis with -90° heading', () => {
    // VVIZ: drone at (homeX=0, homeY=0, homeZ=2m up), heading 90° (facing East)
    const p = transformPoint(0, 0, 2, 'enu_to_three');
    const h = transformHeadingDegrees(90, 'enu_to_three');
    expect(p).toEqual({ x: 0, y: 2, z: 0 });
    expect(h).toBe(-90);
  });
});
