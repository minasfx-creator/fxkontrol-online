/**
 * ─── ArtNetPatchExporter — ShowPlan → Art-Net Patch CSV ─────────────
 * Exports DMX cue data from ShowPlan as a patch list CSV.
 * Pre-export gate: runs VerificationEngine.
 */

import { showPlanManager } from '@/core/showplan/ShowPlanManager';
import { verificationEngine } from '@/core/verification/VerificationEngine';
import { blackbox } from '@/core/reliability/blackBoxRecorder';

export interface ArtNetPatchResult {
  csv: string;
  cueCount: number;
  verified: boolean;
  errors: string[];
}

export function generateArtNetPatchCSV(): ArtNetPatchResult {
  const sp = showPlanManager.current;
  const vResult = verificationEngine.run();
  const canExport = vResult.level === 'READY_FOR_EXPORT' || vResult.level === 'READY_FOR_FIELD';
  const errors: string[] = [];

  if (!canExport) {
    errors.push(...vResult.issues.filter(i => !i.passed && i.severity === 'error').map(i => `[BLOCKED] ${i.label}: ${i.detail}`));
  }

  const header = 'Universe,Channel,Value,Time,Duration,Curve,FixtureID\n';
  const rows = sp.dmxCues.map(c =>
    `${c.universe},${c.channel},${c.value},${c.time.toFixed(3)},${c.duration.toFixed(3)},${c.curve},${c.fixtureId ?? ''}`
  ).join('\n');

  blackbox.record('state', `ArtNetPatchExporter: ${sp.dmxCues.length} cues, verified=${canExport}`);
  return { csv: header + rows, cueCount: sp.dmxCues.length, verified: canExport, errors };
}

export function downloadArtNetPatch(filename = 'fxk_artnet_patch.csv'): void {
  const result = generateArtNetPatchCSV();
  const blob = new Blob([result.csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
