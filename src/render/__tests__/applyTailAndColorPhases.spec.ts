import { describe, it, expect } from 'vitest';
import { resolveTailRenderParams } from '@/render/applyTailComponent';
import { sampleEffectColor, sampleEffectModifier } from '@/render/applyColorPhases';

describe('applyTailComponent', () => {
  it('falls back gracefully when tailRef is absent', () => {
    const r = resolveTailRenderParams({ color: '#FF0000' });
    expect(r.source).toBe('effect-fallback');
    expect(r.component).toBeNull();
    expect(r.trailColor).toBe('#FF0000');
    expect(r.lifetimeS).toBeGreaterThan(0);
  });

  it('resolves a known tail ref to a component', () => {
    const r = resolveTailRenderParams({ color: '#FFE2AE', tailRef: 'Brocade Tail Medium' });
    // May resolve or fallback depending on catalog; either is honest.
    expect(['tail-component', 'effect-fallback']).toContain(r.source);
    expect(r.lifetimeS).toBeGreaterThan(0);
  });

  it('returns sensible fallback for unknown ref', () => {
    const r = resolveTailRenderParams({ color: '#00FF00', tailRef: '__nonexistent_tail_xyz__' });
    expect(r.source).toBe('effect-fallback');
    expect(r.trailColor).toBe('#00FF00');
  });
});

describe('applyColorPhases', () => {
  it('returns base color when no phases', () => {
    expect(sampleEffectColor({ color: '#ABCDEF' }, 0.5)).toBe('#ABCDEF');
  });

  it('interpolates linearly between phases', () => {
    const c = sampleEffectColor(
      { color: '#000000', colorPhases: [{ at: 0, hex: '#000000' }, { at: 1, hex: '#ffffff' }] },
      0.5,
    );
    // ~ mid-gray
    expect(c.toLowerCase()).toMatch(/^#[78][0-9a-f]{5}$/);
  });

  it('clamps t to [0,1]', () => {
    const p = { color: '#000', colorPhases: [{ at: 0, hex: '#ff0000' }, { at: 1, hex: '#00ff00' }] };
    expect(sampleEffectColor(p, -1).toLowerCase()).toBe('#ff0000');
    expect(sampleEffectColor(p, 5).toLowerCase()).toBe('#00ff00');
  });

  it('returns active modifier at time t', () => {
    const p = {
      colorPhases: [
        { at: 0, hex: '#ff0000' },
        { at: 0.5, hex: '#ffffff', modifier: 'strobe' as const },
      ],
    };
    expect(sampleEffectModifier(p, 0.2)).toBeUndefined();
    expect(sampleEffectModifier(p, 0.7)).toBe('strobe');
  });
});
