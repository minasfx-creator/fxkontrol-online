import { describe, it, expect } from 'vitest';
import { parseVDL } from '../vdlParser';

/**
 * Pins importer-facing invariants from
 * docs/reference/finale-chain-insertion.md.
 *
 * Script-row materialisation (1 row per device, Chain reference number,
 * decoupled Duration/Devices/Chain Device VDL/Prefire, Per-show effects
 * upsert by Part Number, missing-field derivation) is an importer-level
 * concern. This file pins the parser hints that an importer would consume,
 * and documents the "Devices column wins" rule.
 */
describe('Finale chain insertion (parser hints for importer)', () => {
  it('parser exposes chainCount as a hint, not authoritative row count', () => {
    // VDL says "Chain of 5", but the authoritative row count on insertion is
    // effect.Devices (importer-level). The parser only surfaces the VDL hint.
    const r = parseVDL('Red Peony Chain Of 5');
    expect(r.isChain).toBe(true);
    expect(r.chainCount).toBe(5);
    // Importer MUST override with effect.Devices and not trust this value.
  });

  it('Devices=1 with "Chain of 5" VDL still parses chain hint as 5', () => {
    // The parser cannot know about effect.Devices — that is importer state.
    // This test pins that the parser does NOT clamp chainCount.
    const r = parseVDL('Red Peony Chain Of 5');
    expect(r.chainCount).toBe(5);
  });

  it('non-chain VDL surfaces isChain=false (importer skips expansion)', () => {
    const r = parseVDL('Red Peony');
    expect(r.isChain).toBe(false);
  });

  it('chain hint survives even without explicit Chain Of N', () => {
    // Importer still expands per effect.Devices, but flag must be true so
    // the importer knows to look up Devices at all.
    const r = parseVDL('Red Peony Chain');
    expect(r.isChain).toBe(true);
  });

  it('per-device VDLs (chainEffects) are available for Chain Device VDL fill-in', () => {
    const r = parseVDL('Red Peony + Blue Peony + Green Peony Chain Of 3');
    expect(r.chainEffects).toEqual(['Red Peony', 'Blue Peony', 'Green Peony']);
  });
});
