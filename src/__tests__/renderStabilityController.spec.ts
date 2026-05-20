import { describe, it, expect, beforeEach } from 'vitest';
import { renderStabilityController } from '@/render_ultra/stability/renderStabilityController';
import { geometryBudget, GEOMETRY_LIMITS } from '@/render_ultra/stability/geometryBudget';
import { renderQuality, setRenderQuality } from '@/lib/featureFlags';

describe('renderStabilityController', () => {
  beforeEach(() => {
    setRenderQuality(null);
    renderStabilityController._reset();
  });

  it('starts in current quality tier with no samples', () => {
    const s = renderStabilityController.stats();
    expect(s.samples).toBe(0);
  });

  it('degrades cinema → balanced when p95 stays above DOWNGRADE_MS', () => {
    setRenderQuality('cinema');
    renderStabilityController._reset();
    // Feed > WINDOW samples all above DOWNGRADE_MS for DOWNGRADE_HOLD ticks.
    for (let i = 0; i < 60 + 60; i++) renderStabilityController._ingest(28);
    expect(renderQuality()).toBe('balanced');
  });

  it('does not degrade past eco', () => {
    setRenderQuality('eco');
    renderStabilityController._reset();
    for (let i = 0; i < 200; i++) renderStabilityController._ingest(50);
    expect(renderQuality()).toBe('eco');
  });

  it('upgrades eco → balanced after long headroom', () => {
    setRenderQuality('eco');
    renderStabilityController._reset();
    for (let i = 0; i < 60 + 300; i++) renderStabilityController._ingest(10);
    expect(renderQuality()).toBe('balanced');
  });
});

describe('geometryBudget', () => {
  beforeEach(() => geometryBudget.clear());

  it('reports zero when empty', () => {
    const r = geometryBudget.report();
    expect(r.entries).toBe(0);
    expect(r.totalTriangles).toBe(0);
  });

  it('flags overTriangles when single asset exceeds MAX_TRIANGLES_PER_ASSET', () => {
    geometryBudget.register({ id: 'big', triangles: GEOMETRY_LIMITS.MAX_TRIANGLES_PER_ASSET + 1, textureBytes: 0 });
    const r = geometryBudget.report();
    expect(r.overTriangles).toHaveLength(1);
  });

  it('flags overVram when sum exceeds MAX_VRAM_SCENE_MB', () => {
    const bytesPer = 50 * 1024 * 1024;
    for (let i = 0; i < 12; i++) {
      geometryBudget.register({ id: `t${i}`, triangles: 100, textureBytes: bytesPer });
    }
    expect(geometryBudget.report().overVram).toBe(true);
  });

  it('validateAsset returns reasons for oversized asset', () => {
    const v = geometryBudget.validateAsset({
      id: 'x',
      triangles: GEOMETRY_LIMITS.MAX_TRIANGLES_PER_ASSET * 2,
      textureBytes: 0,
    });
    expect(v.ok).toBe(false);
    expect(v.reasons[0]).toMatch(/triangles/);
  });
});
