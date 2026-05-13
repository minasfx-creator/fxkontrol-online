import { describe, it, expect } from 'vitest';
import {
  resolveMinePresetId,
  resolveMinePresetProps,
  resolveCakeShotPresetId,
  resolveCakeShotPresetProps,
} from '@/data/finalePresets';

describe('Mine/Cake renderer wiring (rev9) — preset → renderer props', () => {
  it('resolves canonical Mine preset color + strobe for spray modulation', () => {
    const id = resolveMinePresetId('Single Shot Mine — Gold Glitter');
    expect(id).toBe('single-mine-gold-glitter');
    const p = resolveMinePresetProps(id!);
    expect(p).toBeDefined();
    expect(p!.color.toLowerCase()).toMatch(/^#[0-9a-f]{6}$/);
    expect(p!.strobeHz).toBeGreaterThan(0); // tail strobe drives MineEffect
  });

  it('resolves canonical Cake-shot preset inner color', () => {
    const id = resolveCakeShotPresetId('Cake Silver Titanium');
    expect(id).toBe('cake-shell-silver-titanium');
    const p = resolveCakeShotPresetProps(id!);
    expect(p).toBeDefined();
    expect(p!.innerColor.toLowerCase()).toMatch(/^#[0-9a-f]{6}$/);
    expect(['shell', 'mine']).toContain(p!.wrappedKind);
  });

  it('returns undefined for ambiguous mine names (no silent default)', () => {
    expect(resolveMinePresetId('silver crackling')).toBeUndefined();
    expect(resolveMinePresetId('')).toBeUndefined();
    expect(resolveMinePresetId(null)).toBeUndefined();
  });
});
