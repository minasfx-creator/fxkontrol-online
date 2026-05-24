/**
 * ─── goldenShowExport — Honest export bundle (generic) ───────────────
 *
 * Generaliza o exportador de `libertadoresExport.ts` para qualquer seed
 * do `GOLDEN_SHOW_CATALOG`. Bundle ZIP padrão entrega um **dossier
 * técnico completo** ao operador:
 *
 *   fxk_show.fir            — FireOne script (claim: marketing_hypothesis)
 *   fxk_sequencing.csv      — sequenciamento integral (claim: validated)
 *   fxk_bom.json            — BoM + pinout (peso: marketing_hypothesis)
 *   fxk_technical.pdf       — A4 dossier (cover + BoM + pinout + preview)
 *   _FXK_DISCLAIMER.txt     — claim policy explícito
 *
 * `libertadoresExport.ts` segue como camada de compatibilidade.
 *
 * Claim policy idêntico em todos os artefatos:
 *   ShowPlan content = validated · BoM weights / FireOne acceptance =
 *   marketing_hypothesis · não autoriza disparo (CommandBus + SSM em
 *   real_operation prevalece).
 */

import JSZip from 'jszip';
import type { ShowPlan } from '@/core/showplan/ShowPlan';
import {
  buildLibertadoresExportBundle,
  generateFireOneScriptFromPlan,
  type LibertadoresExportBundle,
  LIBERTADORES_EXPORT_FILES,
} from './libertadoresExport';
import { renderShowPlanPdf } from './showPlanPdf';

const PDF_FILENAME = 'fxk_technical.pdf';

export type GoldenShowExportBundle = LibertadoresExportBundle;

export const GOLDEN_SHOW_EXPORT_FILES = {
  ...LIBERTADORES_EXPORT_FILES,
  PDF: PDF_FILENAME,
} as const;

/** Pure bundle — alias of the proven Libertadores builder. */
export function buildGoldenShowExportBundle(sp: ShowPlan): GoldenShowExportBundle {
  return buildLibertadoresExportBundle(sp);
}

export interface BuildZipOptions {
  /** When true (default) embeds fxk_technical.pdf in the bundle. */
  includePdf?: boolean;
}

async function assembleZip(
  sp: ShowPlan,
  opts: BuildZipOptions,
): Promise<JSZip> {
  const includePdf = opts.includePdf !== false;
  const bundle = buildGoldenShowExportBundle(sp);
  const zip = new JSZip();
  zip.file(bundle.fir.filename, bundle.fir.content);
  zip.file(GOLDEN_SHOW_EXPORT_FILES.SEQUENCING, bundle.sequencingCsv);
  zip.file(GOLDEN_SHOW_EXPORT_FILES.BOM, bundle.bomJson);
  zip.file(GOLDEN_SHOW_EXPORT_FILES.DISCLAIMER, bundle.disclaimer);
  if (includePdf) {
    const pdfBytes = await renderShowPlanPdf(sp, { inspection: bundle.inspection });
    zip.file(GOLDEN_SHOW_EXPORT_FILES.PDF, pdfBytes);
  }
  return zip;
}

/**
 * Async ZIP build for any golden seed (Blob — browser download path).
 * `Generated:` timestamps in .fir/disclaimer/PDF are intentional for
 * forensic chain.
 */
export async function buildGoldenShowExportZip(
  sp: ShowPlan,
  opts: BuildZipOptions = {},
): Promise<Blob> {
  const zip = await assembleZip(sp, opts);
  return zip.generateAsync({ type: 'blob' });
}

/** Same bundle as Uint8Array — for tests / Node / non-DOM contexts. */
export async function buildGoldenShowExportZipBytes(
  sp: ShowPlan,
  opts: BuildZipOptions = {},
): Promise<Uint8Array> {
  const zip = await assembleZip(sp, opts);
  return zip.generateAsync({ type: 'uint8array' });
}

/** Filename convention: fxk_<sanitized-show-id>_export.zip */
export function defaultGoldenShowExportFilename(sp: ShowPlan): string {
  const safeId = (sp.metadata.id || 'show')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return `fxk_${safeId}_export.zip`;
}

export async function downloadGoldenShowExportZip(
  sp: ShowPlan,
  filename: string = defaultGoldenShowExportFilename(sp),
  opts: BuildZipOptions = {},
): Promise<void> {
  const blob = await buildGoldenShowExportZip(sp, opts);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Re-export for direct callers that only need the .fir generator.
export { generateFireOneScriptFromPlan };
