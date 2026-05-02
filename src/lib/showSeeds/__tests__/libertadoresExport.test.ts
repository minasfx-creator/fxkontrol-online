/**
 * libertadoresExport — bundle FireOne + CSV + BoM + disclaimer.
 * Garante zero erro de canal, determinismo, claim policy explícito.
 */

import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { createLibertadoresShowPlan } from '../libertadores';
import {
  generateFireOneScriptFromPlan,
  buildLibertadoresExportBundle,
  buildLibertadoresExportZip,
  LIBERTADORES_EXPORT_FILES,
} from '../libertadoresExport';

describe('libertadoresExport · honest bundle', () => {
  const sp = createLibertadoresShowPlan();

  it('FireOne .fir: zero channel errors on golden seed (FXK16 0..15)', () => {
    const fir = generateFireOneScriptFromPlan(sp);
    expect(fir.errors).toEqual([]);
    expect(fir.cueCount).toBe(sp.pyroCues.length);
    expect(fir.filename).toBe(LIBERTADORES_EXPORT_FILES.FIREONE);
  });

  it('FireOne .fir: header carries metadata + claim policy line', () => {
    const fir = generateFireOneScriptFromPlan(sp);
    expect(fir.content).toContain('; FX KONTROL — FireOne Export Script');
    expect(fir.content).toContain(`; Show: ${sp.metadata.name}`);
    expect(fir.content).toContain('Claim policy:');
    expect(fir.content).toContain('marketing_hypothesis');
  });

  it('FireOne .fir: cues are time-sorted and CSV columns aligned', () => {
    const fir = generateFireOneScriptFromPlan(sp);
    const lines = fir.content.split('\n').filter((l) => l && !l.startsWith(';'));
    // first data column = module (number)
    let lastTime = -1;
    for (const line of lines) {
      const cols = line.split(',');
      const module = Number(cols[0]);
      const timeMs = Number(cols[2]);
      expect(Number.isFinite(module)).toBe(true);
      expect(timeMs).toBeGreaterThanOrEqual(lastTime);
      lastTime = timeMs;
    }
  });

  it('bundle: includes 4 artifacts with non-empty content', () => {
    const b = buildLibertadoresExportBundle(sp);
    expect(b.fir.content.length).toBeGreaterThan(0);
    expect(b.sequencingCsv.length).toBeGreaterThan(0);
    expect(b.bomJson.length).toBeGreaterThan(0);
    expect(b.disclaimer).toContain('Claim policy');
    expect(b.disclaimer).toContain('does not authorize firing'.toLowerCase());
    // BoM is parseable JSON
    const parsed = JSON.parse(b.bomJson);
    expect(parsed.showId).toBe(sp.metadata.id);
    expect(parsed.claim.fireOneAcceptance).toBe('marketing_hypothesis');
    expect(parsed.bom.totalCues).toBe(sp.pyroCues.length);
  });

  it('ZIP: contains exactly the 4 expected entries', async () => {
    const blob = await buildLibertadoresExportZip(sp);
    expect(blob.size).toBeGreaterThan(0);
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const names = Object.keys(zip.files).sort();
    expect(names).toEqual(
      [
        LIBERTADORES_EXPORT_FILES.BOM,
        LIBERTADORES_EXPORT_FILES.DISCLAIMER,
        LIBERTADORES_EXPORT_FILES.FIREONE,
        LIBERTADORES_EXPORT_FILES.SEQUENCING,
      ].sort(),
    );
  });

  it('determinism: two bundles produce equal .fir + CSV + BoM payloads', () => {
    const a = buildLibertadoresExportBundle(createLibertadoresShowPlan());
    const b = buildLibertadoresExportBundle(createLibertadoresShowPlan());
    expect(a.fir.content).toBe(b.fir.content);
    expect(a.sequencingCsv).toBe(b.sequencingCsv);
    // BoM JSON differs only by generatedAt; strip and compare
    const stripDate = (s: string) =>
      s.replace(/"generatedAt":\s*"[^"]+"/, '"generatedAt":"<>"');
    expect(stripDate(a.bomJson)).toBe(stripDate(b.bomJson));
  });
});
