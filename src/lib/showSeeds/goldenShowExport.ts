/**
 * ─── goldenShowExport — Honest export bundle (generic) ───────────────
 *
 * Generaliza o exportador de `libertadoresExport.ts` para qualquer seed
 * do `GOLDEN_SHOW_CATALOG`. Nada mudou na lógica — apenas nomes neutros
 * e filename derivado do `metadata.id`.
 *
 * `libertadoresExport.ts` continua existindo como camada de
 * compatibilidade (re-export) para callers e testes existentes.
 *
 * Claim policy idêntico: ShowPlan content = validated · BoM weights e
 * FireOne acceptance = marketing_hypothesis.
 */

import JSZip from 'jszip';
import type { ShowPlan } from '@/core/showplan/ShowPlan';
import {
  buildLibertadoresExportBundle,
  generateFireOneScriptFromPlan,
  type LibertadoresExportBundle,
  LIBERTADORES_EXPORT_FILES,
} from './libertadoresExport';

export type GoldenShowExportBundle = LibertadoresExportBundle;

export const GOLDEN_SHOW_EXPORT_FILES = LIBERTADORES_EXPORT_FILES;

/** Pure bundle — alias of the proven Libertadores builder. */
export function buildGoldenShowExportBundle(sp: ShowPlan): GoldenShowExportBundle {
  return buildLibertadoresExportBundle(sp);
}

/**
 * Async ZIP build for any golden seed. File contents are deterministic
 * except for the `Generated:` timestamps inside .fir and disclaimer
 * (which is intentional — operator forensic chain).
 */
export async function buildGoldenShowExportZip(sp: ShowPlan): Promise<Blob> {
  const bundle = buildGoldenShowExportBundle(sp);
  const zip = new JSZip();
  zip.file(bundle.fir.filename, bundle.fir.content);
  zip.file(GOLDEN_SHOW_EXPORT_FILES.SEQUENCING, bundle.sequencingCsv);
  zip.file(GOLDEN_SHOW_EXPORT_FILES.BOM, bundle.bomJson);
  zip.file(GOLDEN_SHOW_EXPORT_FILES.DISCLAIMER, bundle.disclaimer);
  return zip.generateAsync({ type: 'blob' });
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
): Promise<void> {
  const blob = await buildGoldenShowExportZip(sp);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Re-export for direct callers that only need the .fir generator.
export { generateFireOneScriptFromPlan };
