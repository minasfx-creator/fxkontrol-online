/**
 * VDL Chains — parser coverage spec.
 *
 * Reference: docs/reference/vdl-chains.md (and Finale VDL Documentation,
 * "Creating a chain with one or more effects", 2023-09-12).
 *
 * This spec locks the chain-related fields already exposed by
 * src/lib/vdlParser.ts (isChain, chainCount, chainEffects, chainDelays).
 * No new code is shipped this round — these tests pin the behavior so
 * future refactors of vdlParser don't silently break chain semantics.
 */
import { describe, it, expect } from 'vitest';
import { parseVDL } from '../vdlParser';

describe('VDL Chains — basic detection', () => {
  it('"Chain" keyword alone marks isChain=true', () => {
    const r = parseVDL('3" Salute Chain');
    expect(r.isChain).toBe(true);
  });

  it('"Chain Of N" sets explicit chainCount', () => {
    const r = parseVDL('3" Salute Chain Of 10');
    expect(r.isChain).toBe(true);
    expect(r.chainCount).toBe(10);
  });

  it('"Chain N" (no Of) also sets chainCount', () => {
    const r = parseVDL('3" Salute Chain 7');
    expect(r.chainCount).toBe(7);
  });

  it('defaults chainCount to 10 when neither "Chain Of N" nor + present', () => {
    const r = parseVDL('3" Salute Chain');
    expect(r.chainCount).toBe(10);
  });
});

describe('VDL Chains — multi-effect (plus signs)', () => {
  const MULTI = '3" 8s Red Peony + Blue Peony + Gold Willow + Blue Peony + Red Peony Chain Of 5';

  it('honors explicit Chain Of N over plus-sign inference', () => {
    const r = parseVDL(MULTI);
    expect(r.chainCount).toBe(5);
    expect(r.chainEffects.length).toBe(5);
  });

  it('infers chainCount from plus-sign count when Chain has no number', () => {
    const r = parseVDL('3" 8s Red Peony + Blue Peony + Gold Willow + Blue Peony + Red Peony Chain');
    expect(r.chainCount).toBe(5);
  });

  it('strips the trailing "Chain ..." tail from the last chain effect', () => {
    const r = parseVDL(MULTI);
    // last sub-effect should NOT contain the word "Chain"
    const last = r.chainEffects[r.chainEffects.length - 1] || '';
    expect(/\bchain\b/i.test(last)).toBe(false);
  });
});

describe('VDL Chains — CDS per-gap delays', () => {
  const CDS_CHAIN =
    '100m 27s Chain Of 4 Gold Willow + 4 CDS Green Ghost Shell + 2 CDS Silver Kamuro + 3 CDS Pink Crossette';

  it('collects every CDS value in source order', () => {
    const r = parseVDL(CDS_CHAIN);
    expect(r.chainDelays).toEqual([4, 2, 3]);
  });

  it('CDS count matches shells-1 for fully-specified chains', () => {
    const r = parseVDL(CDS_CHAIN);
    expect(r.chainDelays.length).toBe(r.chainCount - 1);
  });

  it('chains without CDS terms emit empty chainDelays', () => {
    const r = parseVDL('3" 8s Chain Of 3 Red Peony + Blue Peony + Gold Peony');
    expect(r.chainDelays).toEqual([]);
    expect(r.chainCount).toBe(3);
  });
});

describe('VDL Chains — explicit non-chain inputs are NOT chains', () => {
  it('Finale alone is not a chain keyword', () => {
    const r = parseVDL('3" Salute Finale Of 10');
    expect(r.isChain).toBe(false);
  });

  it('String alone is not a chain keyword', () => {
    const r = parseVDL('3" Salute String Of 10');
    expect(r.isChain).toBe(false);
  });
});
