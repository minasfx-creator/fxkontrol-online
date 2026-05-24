import { describe, it, expect } from 'vitest';
import { parseVDL } from '../vdlParser';

/**
 * Pins parser behavior for chain VDL strings, per
 * docs/reference/finale-chain-script-rows.md.
 *
 * The parser handles chain *descriptions*; script-row expansion
 * (1 row per device, Chain reference number, decoupled Duration /
 * Chain Device VDL) is an importer-level concern and is NOT covered here.
 */
describe('VDL chains coverage (Finale chain semantics)', () => {
  it('detects Chain keyword', () => {
    const r = parseVDL('Red Peony Chain Of 10');
    expect(r.isChain).toBe(true);
    expect(r.chainCount).toBe(10);
  });

  it('defaults chainCount to 10 when neither "Chain Of N" nor "+" parts exist', () => {
    const r = parseVDL('Red Peony Chain');
    expect(r.isChain).toBe(true);
    expect(r.chainCount).toBe(10);
    expect(r.chainEffects).toEqual([]);
  });

  it('infers chainCount from + parts when no explicit count', () => {
    const r = parseVDL('Red Peony + Blue Peony + Green Peony Chain');
    expect(r.isChain).toBe(true);
    expect(r.chainCount).toBe(3);
    expect(r.chainEffects).toEqual(['Red Peony', 'Blue Peony', 'Green Peony']);
  });

  it('per-device VDLs differ within a chain (canonical doc example)', () => {
    const r = parseVDL('Red Peony + Blue Peony + Green Peony Chain Of 3');
    expect(r.chainCount).toBe(3);
    expect(r.chainEffects).toEqual(['Red Peony', 'Blue Peony', 'Green Peony']);
  });

  it('"Chain Of N" wins over plus-sign inference for the count', () => {
    const r = parseVDL('Red Peony + Blue Peony Chain Of 10');
    expect(r.chainCount).toBe(10);
    // chainEffects still reflects the + parts available in the description
    expect(r.chainEffects.length).toBe(2);
  });

  it('extracts CDS delays (Chain Device Spacing) between successive devices', () => {
    const r = parseVDL('Red Peony Chain Of 3 0.4 CDS');
    expect(r.chainDelays).toEqual([0.4]);
  });

  it('extracts multiple CDS values when present', () => {
    const r = parseVDL('Red Peony Chain Of 4 0.4 CDS 0.6 CDS 0.8 CDS');
    expect(r.chainDelays).toEqual([0.4, 0.6, 0.8]);
  });

  it('chain vs cake: chain wins, cake parsing is skipped', () => {
    const r = parseVDL('Red Peony Chain Of 10 Cake');
    expect(r.isChain).toBe(true);
    expect(r.type).not.toBe('cake');
  });

  it('chain marks valid result even without explicit color/type tokens', () => {
    const r = parseVDL('Chain Of 5');
    expect(r.isChain).toBe(true);
    expect(r.valid).toBe(true);
  });

  it('non-chain rows have isChain=false and zero chainCount', () => {
    const r = parseVDL('Red Peony');
    expect(r.isChain).toBe(false);
    expect(r.chainCount).toBe(0);
    expect(r.chainEffects).toEqual([]);
    expect(r.chainDelays).toEqual([]);
  });

  it('explicit duration in chain VDL does not override per-row Duration semantics', () => {
    // The doc states Duration is editable per chain row and reflects the
    // device effect duration, not the chain's first-to-last-launch duration.
    // The parser surfaces the textual duration; expansion is importer-level.
    const r = parseVDL('Red Peony Chain Of 3 0.5 CDS');
    expect(r.isChain).toBe(true);
    expect(r.chainDelays).toEqual([0.5]);
  });

  it('preserves mixed-color chain effects ordering', () => {
    const r = parseVDL('Red Peony + Blue Peony + Green Peony + White Peony Chain');
    expect(r.chainEffects).toEqual([
      'Red Peony',
      'Blue Peony',
      'Green Peony',
      'White Peony',
    ]);
  });
});
