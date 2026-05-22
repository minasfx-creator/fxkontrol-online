/**
 * joiDossierExport — bundles PDF+KMZ+DOCX+checklist into one ZIP.
 *
 * Validates pure builder (no DOM):
 *  - ZIP structure contains all canonical entries
 *  - Disclaimer carries the claim policy
 *  - Checklist honors agency subset
 *  - Briefing fallback stub references preset fields
 */
import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { buildJoiDossier } from '@/utils/joiDossierExport';
import { getVenuePreset, VENUE_SHOW_PRESETS } from '@/lib/showVenuePresets';

const preset = getVenuePreset(VENUE_SHOW_PRESETS[0].id)!;

describe('joiDossierExport', () => {
  it('produces a ZIP with all six canonical entries', async () => {
    const { blob, filename } = await buildJoiDossier(preset);
    expect(filename).toMatch(/\.zip$/);
    expect(blob.size).toBeGreaterThan(1000);

    const zip = await JSZip.loadAsync(await (blob as any).arrayBuffer ? blob.arrayBuffer() : new Response(blob).arrayBuffer());
    const names = Object.keys(zip.files).sort();
    expect(names).toEqual(expect.arrayContaining([
      'DISCLAIMER.txt',
      'README.txt',
      'briefing.docx',
      'regulatory-checklist.md',
      'venue-plan.pdf',
      'venue.kmz',
    ]));
  });

  it('DISCLAIMER carries marketing_hypothesis claim and never-arms-from-docs rule', async () => {
    const { blob } = await buildJoiDossier(preset);
    const zip = await JSZip.loadAsync(await (blob as any).arrayBuffer ? blob.arrayBuffer() : new Response(blob).arrayBuffer());
    const disc = await zip.file('DISCLAIMER.txt')!.async('string');
    expect(disc).toContain('marketing_hypothesis');
    expect(disc).toContain('never arms or fires from documents');
  });

  it('honors agency subset in checklist', async () => {
    const { blob } = await buildJoiDossier(preset, { agencies: ['decea', 'anac'] });
    const zip = await JSZip.loadAsync(await (blob as any).arrayBuffer ? blob.arrayBuffer() : new Response(blob).arrayBuffer());
    const md = await zip.file('regulatory-checklist.md')!.async('string');
    expect(md).toContain('DECEA');
    expect(md).toContain('ANAC');
    expect(md).not.toContain('Bombeiros');
    expect(md).not.toContain('Exército');
  });

  it('briefing stub references preset name and launch points', async () => {
    const { blob } = await buildJoiDossier(preset);
    const zip = await JSZip.loadAsync(await (blob as any).arrayBuffer ? blob.arrayBuffer() : new Response(blob).arrayBuffer());
    const docxBin = await zip.file('briefing.docx')!.async('uint8array');
    // .docx is a ZIP — peek document.xml for preset name
    const inner = await JSZip.loadAsync(docxBin);
    const xml = await inner.file('word/document.xml')!.async('string');
    expect(xml).toContain(preset.name);
    expect(xml).toContain(preset.venue.launchPoints[0].name);
  });

  it('respects custom briefingMarkdown when provided', async () => {
    const md = '# Custom Briefing\n\nJoi-authored content for the test suite.';
    const { blob } = await buildJoiDossier(preset, { briefingMarkdown: md });
    const zip = await JSZip.loadAsync(await (blob as any).arrayBuffer ? blob.arrayBuffer() : new Response(blob).arrayBuffer());
    const docxBin = await zip.file('briefing.docx')!.async('uint8array');
    const inner = await JSZip.loadAsync(docxBin);
    const xml = await inner.file('word/document.xml')!.async('string');
    expect(xml).toContain('Custom Briefing');
    expect(xml).toContain('Joi-authored content for the test suite.');
  });
});
