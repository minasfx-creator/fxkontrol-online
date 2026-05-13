/**
 * ─── FireOneExporter — ShowPlan → .fir Script ──────────────────────
 * Generates FireOne-compatible .fir scripts from the canonical ShowPlan.
 * All data flows from showPlanManager.current — never from UI state.
 * Pre-export gate: runs VerificationEngine before generating.
 */

import { showPlanManager } from '@/core/showplan/ShowPlanManager';
import { verificationEngine } from '@/core/verification/VerificationEngine';
import { blackbox } from '@/core/reliability/blackBoxRecorder';

export interface FireOneExportResult {
  script: string;
  cueCount: number;
  errors: string[];
  verified: boolean;
}

export function generateFireOneScript(): FireOneExportResult {
  const sp = showPlanManager.current;
  const vResult = verificationEngine.run();
  const canExport = vResult.level === 'READY_FOR_EXPORT' || vResult.level === 'READY_FOR_FIELD';
  const errors: string[] = [];
  const lines: string[] = [];

  if (!canExport) {
    const blocking = vResult.issues.filter(i => !i.passed && i.severity === 'error');
    errors.push(...blocking.map(i => `[BLOCKED] ${i.label}: ${i.detail}`));
  }

  // ICET / FireOne firing script — canonical header
  // Format: CUE,TIMECODE,MODULO,CANAL,ABERTURA
  // TIMECODE = HH:MM:SS:FF (SMPTE 30 fps non-drop, frames 00-29)
  lines.push('CUE,TIMECODE,MODULO,CANAL,ABERTURA');

  const sorted = [...sp.pyroCues].sort((a, b) => a.time - b.time);

  sorted.forEach((cue, idx) => {
    if (cue.module < 0) errors.push(`Cue ${idx + 1}: invalid module ${cue.module}`);
    if (cue.channel < 0 || cue.channel > 31) errors.push(`Cue ${idx + 1}: channel ${cue.channel} out of range 0-31`);
    if (!Number.isFinite(cue.time) || cue.time < 0) errors.push(`Cue ${idx + 1}: invalid time ${cue.time}`);

    const tc = secondsToSmpte30(cue.time);
    const abertura = cue.fuseDelay > 0 ? Math.round(cue.fuseDelay).toString() : '';
    lines.push([
      idx + 1,
      tc,
      cue.module,
      cue.channel,
      abertura,
    ].join(','));
  });

  blackbox.record('state', `FireOneExporter: ${sorted.length} cues, ${errors.length} errors, verified=${canExport}`);

  return { script: lines.join('\n'), cueCount: sorted.length, errors, verified: canExport };
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
