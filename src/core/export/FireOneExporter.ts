/**
 * ─── FireOneExporter — ShowPlan → .fir Script ──────────────────────
 * Generates FireOne-compatible .fir scripts from the canonical ShowPlan.
 * All data flows from showPlanManager.current — never from UI state.
 */

import { showPlanManager } from '@/core/showplan/ShowPlanManager';
import { blackbox } from '@/core/reliability/blackBoxRecorder';

export interface FireOneExportResult {
  script: string;
  cueCount: number;
  errors: string[];
}

export function generateFireOneScript(): FireOneExportResult {
  const sp = showPlanManager.current;
  const errors: string[] = [];
  const lines: string[] = [];

  lines.push('; FX KONTROL — FireOne Export Script');
  lines.push(`; Show: ${sp.metadata.name}`);
  lines.push(`; Venue: ${sp.metadata.venue || 'N/A'}`);
  lines.push(`; Duration: ${sp.metadata.duration.toFixed(1)}s`);
  lines.push(`; Generated: ${new Date().toISOString()}`);
  lines.push(`; Cues: ${sp.pyroCues.length}`);
  lines.push(';');
  lines.push('; Module,Channel,Time(ms),FuseDelay(ms),Effect,Caliber(mm),Elevation,Position,Section');

  const sorted = [...sp.pyroCues].sort((a, b) => a.time - b.time);

  sorted.forEach((cue, idx) => {
    if (cue.module < 0) errors.push(`Cue ${idx + 1}: invalid module ${cue.module}`);
    if (cue.channel < 0 || cue.channel > 31) errors.push(`Cue ${idx + 1}: channel ${cue.channel} out of range 0-31`);

    const pos = sp.positions.find(p => p.id === cue.positionId);
    const timeMs = Math.round(cue.time * 1000);
    lines.push([
      cue.module,
      cue.channel,
      timeMs,
      Math.round(cue.fuseDelay),
      cue.effectId,
      cue.caliber,
      cue.elevation.toFixed(1),
      pos?.name ?? cue.positionId,
      cue.section ?? '',
    ].join(','));
  });

  blackbox.record('state', `FireOneExporter: ${sorted.length} cues, ${errors.length} errors`);

  return { script: lines.join('\n'), cueCount: sorted.length, errors };
}

export function downloadFireOneScript(filename = 'fxk_show.fir'): void {
  const result = generateFireOneScript();
  const blob = new Blob([result.script], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
