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
    expect(b.disclaimer).toContain('DOES NOT authorize firing');
    // BoM is parseable JSON
    const parsed = JSON.parse(b.bomJson);
    expect(parsed.showId).toBe(sp.metadata.id);
    expect(parsed.claim.fireOneAcceptance).toBe('marketing_hypothesis');
    expect(parsed.bom.totalCues).toBe(sp.pyroCues.length);
  });

  it('ZIP: contains exactly the 4 expected entries', async () => {
    const zip = new JSZip();
    const b = buildLibertadoresExportBundle(sp);
    zip.file(LIBERTADORES_EXPORT_FILES.FIREONE, b.fir.content);
    zip.file(LIBERTADORES_EXPORT_FILES.SEQUENCING, b.sequencingCsv);
    zip.file(LIBERTADORES_EXPORT_FILES.BOM, b.bomJson);
    zip.file(LIBERTADORES_EXPORT_FILES.DISCLAIMER, b.disclaimer);
    // Use nodebuffer in jsdom (Blob.arrayBuffer is missing in some jsdom builds).
    const buf = await zip.generateAsync({ type: 'nodebuffer' });
    expect(buf.length).toBeGreaterThan(0);
    const reloaded = await JSZip.loadAsync(buf);
    const names = Object.keys(reloaded.files).sort();
    expect(names).toEqual(
      [
        LIBERTADORES_EXPORT_FILES.BOM,
        LIBERTADORES_EXPORT_FILES.DISCLAIMER,
        LIBERTADORES_EXPORT_FILES.FIREONE,
        LIBERTADORES_EXPORT_FILES.SEQUENCING,
      ].sort(),
    );
    // Round-trip: each entry has the same payload as the bundle.
    expect(await reloaded.file(LIBERTADORES_EXPORT_FILES.FIREONE)!.async('string')).toBe(b.fir.content);
    expect(await reloaded.file(LIBERTADORES_EXPORT_FILES.SEQUENCING)!.async('string')).toBe(b.sequencingCsv);
  });

  // Strip the only non-deterministic field (`Generated:` ISO timestamp).
  const stripGenerated = (s: string) =>
    s
      .replace(/; Generated: [^\n]+/g, '; Generated: <stripped>')
      .replace(/Generated: [^\n]+/g, 'Generated: <stripped>')
      .replace(/"generatedAt":\s*"[^"]+"/g, '"generatedAt":"<stripped>"');

  it('determinism: stripping timestamp, two bundles produce identical payloads', () => {
    const a = buildLibertadoresExportBundle(createLibertadoresShowPlan());
    const b = buildLibertadoresExportBundle(createLibertadoresShowPlan());
    expect(stripGenerated(a.fir.content)).toBe(stripGenerated(b.fir.content));
    expect(a.sequencingCsv).toBe(b.sequencingCsv);
    expect(stripGenerated(a.bomJson)).toBe(stripGenerated(b.bomJson));
    expect(stripGenerated(a.disclaimer)).toBe(stripGenerated(b.disclaimer));
  });
});
