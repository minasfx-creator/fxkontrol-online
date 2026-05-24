/**
 * Inspector tests against the Libertadores golden seed.
 * Garante invariantes determinísticos do BoM, sequenciamento e pinout.
 */

import { describe, it, expect } from 'vitest';
import { createLibertadoresShowPlan } from '../libertadores';
import {
  inspectShowPlan,
  buildBillOfMaterials,
  buildSequencing,
  buildPinout,
  sequencingToCsv,
} from '../inspectShowPlan';

describe('inspectShowPlan · Libertadores golden seed', () => {
  const sp = createLibertadoresShowPlan();
  const result = inspectShowPlan(sp);

  it('BoM totals match cue count and group by SKU', () => {
    const bom = buildBillOfMaterials(sp);
    expect(bom.totalCues).toBe(sp.pyroCues.length);
    expect(bom.totalUnits).toBe(sp.pyroCues.length);
    expect(bom.rows.length).toBeGreaterThan(0);
    // No duplicate effect|caliber row
    const keys = bom.rows.map((r) => `${r.effectId}|${r.caliber}`);
    expect(new Set(keys).size).toBe(keys.length);
    // Sum across rows == totalUnits
    expect(bom.rows.reduce((s, r) => s + r.count, 0)).toBe(bom.totalUnits);
    // Max caliber matches show plan
    expect(bom.maxCaliber).toBe(75);
  });

  it('BoM weight estimates are positive and consistent', () => {
    const bom = buildBillOfMaterials(sp);
    for (const r of bom.rows) {
      expect(r.estimatedUnitWeightG).toBeGreaterThan(0);
      expect(r.estimatedTotalWeightG).toBe(r.estimatedUnitWeightG * r.count);
    }
    expect(bom.totalEstimatedWeightG).toBe(
      bom.rows.reduce((s, r) => s + r.estimatedTotalWeightG, 0),
    );
  });

  it('sequencing is monotonic and 1-indexed', () => {
    const seq = buildSequencing(sp);
    expect(seq.length).toBe(sp.pyroCues.length);
    expect(seq[0].index).toBe(1);
    expect(seq[seq.length - 1].index).toBe(seq.length);
    for (let i = 1; i < seq.length; i++) {
      expect(seq[i].timeS).toBeGreaterThanOrEqual(seq[i - 1].timeS);
    }
  });

  it('CSV roundtrip has header + N rows + trailing newline', () => {
    const seq = buildSequencing(sp);
    const csv = sequencingToCsv(seq);
    const lines = csv.split('\n');
    // header + N rows + trailing empty
    expect(lines.length).toBe(seq.length + 2);
    expect(lines[0].split(',')[0]).toBe('index');
    expect(lines[lines.length - 1]).toBe('');
  });

  it('pinout covers every (module,channel) actually used and respects 16ch FXK16', () => {
    const pinout = buildPinout(sp);
    // Each (module,channel) appears once
    const keys = pinout.map((p) => `${p.module}|${p.channel}`);
    expect(new Set(keys).size).toBe(keys.length);
    // Modules in [0..3], channels in [0..15] for 4×FXK16
    for (const p of pinout) {
      expect(p.module).toBeGreaterThanOrEqual(0);
      expect(p.module).toBeLessThan(4);
      expect(p.channel).toBeGreaterThanOrEqual(0);
      expect(p.channel).toBeLessThan(16);
      expect(p.fireCount).toBeGreaterThanOrEqual(1);
    }
  });

  it('channel-reuse interlock: minimum gap >= 1.0s (no cross-fire risk)', () => {
    expect(result.tightReuseChannels).toEqual([]);
    if (result.minChannelReuseS != null) {
      expect(result.minChannelReuseS).toBeGreaterThanOrEqual(1.0);
    }
  });

  it('determinism: two runs produce equal BoM/sequencing/pinout snapshots', () => {
    const a = inspectShowPlan(createLibertadoresShowPlan());
    const b = inspectShowPlan(createLibertadoresShowPlan());
    expect(JSON.stringify(a.bom)).toBe(JSON.stringify(b.bom));
    expect(JSON.stringify(a.sequencing)).toBe(JSON.stringify(b.sequencing));
    expect(JSON.stringify(a.pinout)).toBe(JSON.stringify(b.pinout));
    expect(a.minChannelReuseS).toBe(b.minChannelReuseS);
  });
});
