import { describe, it, expect } from 'vitest';
import { computeTiePointQuality, type TiePoint, type CameraView } from './tiePointQuality';
import { computeMeshQuality } from './meshQuality';
import { bakeVertexColors, bakeQualityTexture, qualityHistogram } from './bake';

describe('computeTiePointQuality', () => {
  it('returns zeros for empty input', () => {
    const r = computeTiePointQuality([], []);
    expect(r.scores.length).toBe(0);
    expect(r.mean).toBe(0);
  });

  it('rewards more observers and wider baseline', () => {
    const cameras: CameraView[] = [
      { position: { x: 5, y: 0, z: 0 } },
      { position: { x: -5, y: 0, z: 0 } },
      { position: { x: 0, y: 5, z: 0 } },
      { position: { x: 0, y: -5, z: 0 } },
    ];
    const points: TiePoint[] = [
      { position: { x: 0, y: 0, z: 0 }, observedBy: [0] },                  // single
      { position: { x: 0, y: 0, z: 0 }, observedBy: [0, 1, 2, 3] },         // wide
    ];
    const r = computeTiePointQuality(points, cameras, { saturationCount: 4 });
    expect(r.scores[1]).toBeGreaterThan(r.scores[0]);
  });

  it('clamps distance', () => {
    const cameras: CameraView[] = [{ position: { x: 1000, y: 0, z: 0 } }];
    const points: TiePoint[] = [{ position: { x: 0, y: 0, z: 0 }, observedBy: [0] }];
    const r = computeTiePointQuality(points, cameras, { maxDistance: 10 });
    expect(r.scores[0]).toBe(0);
  });
});

describe('computeMeshQuality', () => {
  it('returns zeros for empty mesh', () => {
    const r = computeMeshQuality([], [], []);
    expect(r.triangleScores.length).toBe(0);
    expect(r.vertexScores.length).toBe(0);
  });

  it('produces higher scores for triangles facing more cameras', () => {
    // Single triangle in XY plane, normal +Z.
    const verts = [
      { x: -1, y: -1, z: 0 },
      { x: 1, y: -1, z: 0 },
      { x: 0, y: 1, z: 0 },
    ];
    const idx = [0, 1, 2];
    const fewCams: CameraView[] = [{ position: { x: 0, y: 0, z: 5 } }];
    const manyCams: CameraView[] = [
      { position: { x: 0, y: 0, z: 5 } },
      { position: { x: 1, y: 0, z: 5 } },
      { position: { x: -1, y: 0, z: 5 } },
      { position: { x: 0, y: 1, z: 5 } },
    ];
    const a = computeMeshQuality(verts, idx, fewCams, { saturationCount: 4 });
    const b = computeMeshQuality(verts, idx, manyCams, { saturationCount: 4 });
    expect(b.triangleScores[0]).toBeGreaterThan(a.triangleScores[0]);
  });
});

describe('bake helpers', () => {
  it('bakes vertex colors length-aligned', () => {
    const v = new Float32Array([0, 0.5, 1]);
    const out = bakeVertexColors(v);
    expect(out.length).toBe(9);
    expect([out[0], out[1], out[2]]).toEqual([1, 0, 0]);
    expect([out[6], out[7], out[8]]).toEqual([0, 1, 0]);
  });

  it('bakes a square power-of-two texture', () => {
    const tri = new Float32Array(10);
    const tex = bakeQualityTexture(tri);
    expect(tex.width).toBe(tex.height);
    expect(tex.width).toBeGreaterThanOrEqual(4);
    expect(tex.pixels.length).toBe(tex.width * tex.height * 4);
  });

  it('returns normalized histogram bins', () => {
    const scores = new Float32Array([0, 0, 0.99, 0.5]);
    const bins = qualityHistogram(scores, 4);
    expect(bins.length).toBe(4);
    expect(Math.max(...bins)).toBe(1);
  });
});
