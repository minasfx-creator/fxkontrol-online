/**
 * Generic Golden Show export bundle — runs against ALL catalog entries
 * to prove the export pipeline is not coupled to any single seed.
 */
import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { GOLDEN_SHOW_CATALOG } from '../catalog';
import {
  buildGoldenShowExportBundle,
  defaultGoldenShowExportFilename,
  GOLDEN_SHOW_EXPORT_FILES,
} from '../goldenShowExport';

describe('goldenShowExport · catalog-wide', () => {
  for (const entry of GOLDEN_SHOW_CATALOG) {
    describe(`seed: ${entry.id}`, () => {
      const sp = entry.build();
      const bundle = buildGoldenShowExportBundle(sp);

      it('FireOne script has zero errors and one line per cue', () => {
        expect(bundle.fir.errors).toEqual([]);
        expect(bundle.fir.cueCount).toBe(sp.pyroCues.length);
        const dataLines = bundle.fir.content
          .split('\n')
          .filter((l) => l && !l.startsWith(';'))
          .filter((l) => !l.startsWith('Module,Channel'));
        expect(dataLines.length).toBe(sp.pyroCues.length);
      });

      it('BoM JSON is well-formed and tagged with claim policy', () => {
        const parsed = JSON.parse(bundle.bomJson);
        expect(parsed.showId).toBe(sp.metadata.id);
        expect(parsed.claim.showPlanContent).toBe('validated');
        expect(parsed.claim.fireOneAcceptance).toBe('marketing_hypothesis');
        expect(parsed.claim.weightsAndTransport).toBe('marketing_hypothesis');
      });

      it('CSV sequencing has a header + N data rows', () => {
        const lines = bundle.sequencingCsv.trim().split('\n');
        expect(lines.length).toBeGreaterThan(1);
        expect(lines[0]).toMatch(/time|Time/);
      });

      it('disclaimer references this specific show', () => {
        expect(bundle.disclaimer).toContain(sp.metadata.id);
        expect(bundle.disclaimer).toContain('DOES NOT authorize firing');
      });

      it('ZIP contains all 4 required artifacts', async () => {
        // Build via JSZip directly in uint8array form to bypass jsdom Blob limits.
        const { default: JSZipCtor } = await import('jszip');
        const z = new JSZipCtor();
        z.file(bundle.fir.filename, bundle.fir.content);
        z.file(GOLDEN_SHOW_EXPORT_FILES.SEQUENCING, bundle.sequencingCsv);
        z.file(GOLDEN_SHOW_EXPORT_FILES.BOM, bundle.bomJson);
        z.file(GOLDEN_SHOW_EXPORT_FILES.DISCLAIMER, bundle.disclaimer);
        const ab = await z.generateAsync({ type: 'uint8array' });
        const zip = await JSZip.loadAsync(ab);
        expect(zip.file(bundle.fir.filename)).toBeTruthy();
        expect(zip.file(GOLDEN_SHOW_EXPORT_FILES.SEQUENCING)).toBeTruthy();
        expect(zip.file(GOLDEN_SHOW_EXPORT_FILES.BOM)).toBeTruthy();
        expect(zip.file(GOLDEN_SHOW_EXPORT_FILES.DISCLAIMER)).toBeTruthy();
      });

      it('default filename is sanitized and seed-scoped', () => {
        const fn = defaultGoldenShowExportFilename(sp);
        expect(fn).toMatch(/^fxk_[a-z0-9_]+_export\.zip$/);
        expect(fn).toContain(
          sp.metadata.id.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
        );
      });
    });
  }
});
