import { describe, it, expect } from 'vitest';
import { resolveEffectColor, resolveEffectColorHex } from '../colorResolver';

describe('colorResolver', () => {
  it('parses hex and quantises to a VDL palette entry', () => {
    const r = resolveEffectColor('#ff0000');
    expect(r.source).toBe('hex');
    expect(r.vdl.toLowerCase()).toMatch(/red/);
    expect(r.hex).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('resolves PT-BR aliases to the same VDL entry as the EN name', () => {
    const en = resolveEffectColor('red');
    const pt = resolveEffectColor('vermelho');
    expect(en.vdl).toBe(pt.vdl);
    expect(en.hex).toBe(pt.hex);
  });

  it('handles compound names by taking the first known token', () => {
    const r = resolveEffectColor('Verde Cintilante');
    expect(r.source).toBe('name');
    expect(r.vdl.toLowerCase()).toMatch(/green/);
  });

  it('falls back to cream for unknown input', () => {
    const r = resolveEffectColor('zzzz-not-a-color');
    expect(r.source).toBe('fallback');
    expect(r.hex).toBe('#fff2c4');
  });

  it('is idempotent — re-resolving its own hex yields the same hex', () => {
    const a = resolveEffectColorHex('blue');
    const b = resolveEffectColorHex(a);
    expect(b).toBe(a);
  });

  it('handles short hex (#abc)', () => {
    const r = resolveEffectColor('#f00');
    expect(r.source).toBe('hex');
    expect(r.vdl.toLowerCase()).toMatch(/red/);
  });

  it('returns fallback for null/undefined/empty', () => {
    expect(resolveEffectColor(null).source).toBe('fallback');
    expect(resolveEffectColor(undefined).source).toBe('fallback');
    expect(resolveEffectColor('').source).toBe('fallback');
  });
});
