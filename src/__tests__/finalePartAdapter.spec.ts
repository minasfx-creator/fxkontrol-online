import { describe, it, expect } from 'vitest';
import {
  finalePartToEffect,
  parseCaliberInches,
  pickRgbFromHints,
  pickPattern,
} from '@/data/effectsLibraries/adapter';

describe('finalePartAdapter', () => {
  it('parses caliber in inches, mm, and bare number', () => {
    expect(parseCaliberInches('3"')).toBe(3);
    expect(parseCaliberInches('1.2"')).toBeCloseTo(1.2);
    expect(parseCaliberInches('30mm')).toBeCloseTo(30 / 25.4, 3);
    expect(parseCaliberInches('4')).toBe(4);
    expect(parseCaliberInches(undefined)).toBeUndefined();
  });

  it('picks RGB from PT and EN color hints', () => {
    expect(pickRgbFromHints('Crackling Red Tip')).toEqual([255, 10, 10]);
    expect(pickRgbFromHints('Mine Vermelho')).toEqual([255, 10, 10]);
    expect(pickRgbFromHints('Gold willow no trail')).toEqual([255, 200, 40]);
    expect(pickRgbFromHints('Verde brilhante')).toEqual([30, 255, 60]);
  });

  it('picks visual pattern from text', () => {
    expect(pickPattern('Chrysanthemum 5"')).toBe('chrysanthemum');
    expect(pickPattern('5 Shot Cake (a) Strobing')).toBe('strobe');
    expect(pickPattern('Heart shell red')).toBe('heart');
    expect(pickPattern('boring')).toBeUndefined();
  });

  it('produces an Effect with VDL renderHex color', () => {
    const eff = finalePartToEffect(
      { partNumber: 'X1', description: 'Red mine to white strobe', size: '30mm', duration: 3.3, height: 25 },
      { librarySlug: 'magic' },
    );
    expect(eff.id).toBe('magic:X1');
    expect(eff.color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(eff.caliber).toBeCloseTo(30 / 25.4, 3);
    expect(eff.duration).toBe(3.3);
    expect(eff.heightMeters).toBe(25);
    // Color sniff: "Red" wins → red-ish renderHex
    expect(eff.color.toLowerCase()).not.toBe('#000000');
  });
});
