/**
 * ─── ArtNetPatchExporter — ShowPlan → Art-Net Patch CSV ─────────────
 * Exports DMX cue data from ShowPlan as a patch list CSV.
 */

import { showPlanManager } from '@/core/showplan/ShowPlanManager';
import { blackbox } from '@/core/reliability/blackBoxRecorder';

export interface ArtNetPatchResult {
  csv: string;
  cueCount: number;
}

export function generateArtNetPatchCSV(): ArtNetPatchResult {
  const sp = showPlanManager.current;
  const header = 'Universe,Channel,Value,Time,Duration,Curve,FixtureID\n';
  const rows = sp.dmxCues.map(c =>
    `${c.universe},${c.channel},${c.value},${c.time.toFixed(3)},${c.duration.toFixed(3)},${c.curve},${c.fixtureId ?? ''}`
  ).join('\n');

  blackbox.record('export', `ArtNetPatchExporter: ${sp.dmxCues.length} cues`);
  return { csv: header + rows, cueCount: sp.dmxCues.length };
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
