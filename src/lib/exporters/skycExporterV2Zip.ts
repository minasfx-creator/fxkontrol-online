/**
 * skycExporterV2Zip — Honest ZIP wrapper around skycExporterV2.
 *
 * CLAIM POLICY: marketing_hypothesis
 * ----------------------------------
 * The .skyc JSON mirrors Skybrush conventions but the resulting ZIP has
 * NOT been validated against the real Skybrush Studio importer. Every
 * artifact ships with `_FXK_DISCLAIMER.txt` and `validation.json.claim`
 * is set to `marketing_hypothesis` so reviewers can't mistake this for
 * a certified deliverable.
 *
 * Coexists with the v1 honest stub (`src/lib/skybrushExport.ts`).
 * Choose v2 when you need a richer payload (trajectories + lights +
 * cues + meta); v1 when you just need the conversation-starter ZIP.
 */
import JSZip from 'jszip';
import { exportSkyc, exportShowCSV, type SkycExportOptions, type SkycFile } from './skycExporterV2';

const DISCLAIMER = `FX KONTROL · Skybrush .skyc Export (v2 preview)

Claim policy: marketing_hypothesis
----------------------------------
The format inside this archive mirrors Skybrush conventions but has
NOT been validated against the real Skybrush Studio importer or the
Drotek toolchain. Treat every artifact as a sales / design preview.

DO NOT submit this archive to a live Skybrush server expecting a
real flight. Use it for demo, investor and design conversations only.

For certified flight planning, use the official Skybrush exporter on
a project that has been validated against your fleet's firmware.
`;

export interface SkycV2BuildOptions extends SkycExportOptions {
  /** Filename (without extension). Default: derived from projectName. */
  filename?: string;
}

export interface SkycV2BuildResult {
  blob: Blob;
  filename: string;
  skyc: SkycFile;
  bytes: number;
}

/**
 * Build a Skybrush-style ZIP. Pure (no DOM); caller decides how to
 * surface the Blob (download, upload, attach to email, etc.).
 */
export async function buildSkycV2Zip(opts: SkycV2BuildOptions): Promise<SkycV2BuildResult> {
  const skyc = exportSkyc(opts);

  // Tag claim explicitly inside the validation payload (read by audit /
  // ClaimBadge consumers). Keep the original validation untouched if
  // already present.
  const validation = {
    ...(skyc.validation ?? {}),
    claim: 'marketing_hypothesis' as const,
    note: 'Format mirrors Skybrush conventions; not validated against real importer.',
    generatedAt: new Date().toISOString(),
  };

  const zip = new JSZip();
  zip.file('show.json', JSON.stringify({ ...skyc, validation }, null, 2));
  zip.file('cues.json', JSON.stringify(skyc.cues, null, 2));
  zip.file('validation.json', JSON.stringify(validation, null, 2));
  zip.file('show.csv', exportShowCSV(skyc));
  zip.file('_FXK_DISCLAIMER.txt', DISCLAIMER);

  // Per-drone trajectory + light folders (parallels the real .skyc layout).
  const traj = zip.folder('trajectories');
  const lights = zip.folder('lights');
  if (traj && lights) {
    for (const d of skyc.drones) {
      traj.file(`${d.id}.json`, JSON.stringify(d.trajectory, null, 2));
      lights.file(`${d.id}.json`, JSON.stringify(d.lightProgram, null, 2));
    }
  }

  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  const safeName = (opts.filename ?? opts.projectName).replace(/[^a-zA-Z0-9_-]+/g, '_') || 'fxk_show';
  return { blob, filename: `${safeName}.skyc.zip`, skyc, bytes: blob.size };
}

/** DOM helper — triggers a download for the built archive. */
export async function downloadSkycV2Zip(opts: SkycV2BuildOptions): Promise<SkycV2BuildResult> {
  const result = await buildSkycV2Zip(opts);
  const url = URL.createObjectURL(result.blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = result.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }
  return result;
}
