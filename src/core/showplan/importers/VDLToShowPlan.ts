/**
 * ─── VDLToShowPlan — VDL Script → ShowPlan ─────────────────────────
 * Parses a multi-line VDL script and merges PyroCues / DMXCues /
 * ShowPositions into the canonical ShowPlan.
 *
 * Accepted formats per line (auto-detected):
 *   1) `time, vdl`                                       — single shot at origin
 *   2) `time, posName, vdl`                              — named position
 *   3) `time, posName, vdl, x, y, z`                     — explicit XYZ
 *   4) `time, posName, vdl, x, y, z, universe, ch, val`  — pyro + DMX
 *
 * Lines starting with `#` or `//` are ignored. Empty lines are skipped.
 * Time accepts `12.5` (seconds) or `MM:SS.ms`.
 */

import { showPlanManager } from '@/core/showplan/ShowPlanManager';
import type { PyroCue, DMXCue, ShowPosition, ShowPlan } from '@/core/showplan/ShowPlan';
import { parseVDL } from '@/lib/vdlParser';
import { blackbox } from '@/core/reliability/blackBoxRecorder';

export interface VDLImportResult {
  pyroCues: PyroCue[];
  dmxCues: DMXCue[];
  positions: ShowPosition[];
  errors: string[];
  warnings: string[];
  totalLines: number;
}

function parseTime(raw: string): number {
  const t = raw.trim();
  if (t.includes(':')) {
    const parts = t.split(':').map(Number);
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}

function splitCsvLine(line: string): string[] {
  // Simple split — VDL itself rarely contains commas; quotes preserved
  const out: string[] = [];
  let cur = '';
  let inQ = false;
  for (const ch of line) {
    if (ch === '"') { inQ = !inQ; continue; }
    if (ch === ',' && !inQ) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  out.push(cur);
  return out.map(s => s.trim());
}

export function parseVDLScript(text: string): VDLImportResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const pyroCues: PyroCue[] = [];
  const dmxCues: DMXCue[] = [];
  const positionMap = new Map<string, ShowPosition>();

  const lines = text.split(/\r?\n/);
  let cueIdx = 0;
  let totalLines = 0;

  lines.forEach((rawLine, lineNum) => {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || line.startsWith('//')) return;
    totalLines++;

    const parts = splitCsvLine(line);
    if (parts.length < 2) {
      errors.push(`L${lineNum + 1}: not enough columns (need at least time, vdl)`);
      return;
    }

    const time = parseTime(parts[0]);
    if (!Number.isFinite(time) || time < 0) {
      errors.push(`L${lineNum + 1}: invalid time "${parts[0]}"`);
      return;
    }

    let posName: string;
    let vdlText: string;
    let x = 0, y = 0, z = 0;
    let universe: number | undefined;
    let dmxCh: number | undefined;
    let dmxVal: number | undefined;

    if (parts.length === 2) {
      posName = 'origin';
      vdlText = parts[1];
    } else if (parts.length === 3) {
      posName = parts[1];
      vdlText = parts[2];
    } else {
      posName = parts[1];
      vdlText = parts[2];
      x = Number(parts[3] ?? 0) || 0;
      y = Number(parts[4] ?? 0) || 0;
      z = Number(parts[5] ?? 0) || 0;
      if (parts.length >= 9) {
        universe = Number(parts[6]);
        dmxCh = Number(parts[7]);
        dmxVal = Number(parts[8]);
      }
    }

    const vdl = parseVDL(vdlText);
    if (!vdl.valid) {
      warnings.push(`L${lineNum + 1}: VDL not fully parsed — "${vdlText}"`);
    }

    // Reuse or create position
    let pos = positionMap.get(posName);
    if (!pos) {
      pos = {
        id: `vdl-pos-${posName}-${positionMap.size}`,
        name: posName,
        type: 'pyro',
        x, y, z,
        heading: 0,
        pitch: 90,
      };
      positionMap.set(posName, pos);
    }

    const module = Math.floor(cueIdx / 32);
    const channel = cueIdx % 32;

    pyroCues.push({
      id: `vdl-cue-${cueIdx}`,
      time,
      positionId: pos.id,
      module,
      channel,
      effectId: vdl.typeName || vdlText.slice(0, 32),
      fuseDelay: vdl.fuseDelay > 0 ? vdl.fuseDelay : 0,
      caliber: vdl.caliberMM || 75,
      elevation: 90 + (vdl.angleOffset || 0),
      heading: 0,
      position: { x: pos.x, y: pos.y, z: pos.z },
    });

    if (universe != null && dmxCh != null) {
      dmxCues.push({
        id: `vdl-dmx-${cueIdx}`,
        time,
        universe,
        channel: dmxCh,
        value: dmxVal ?? 255,
        duration: 1,
        curve: 'linear',
      });
    }

    cueIdx++;
  });

  return {
    pyroCues,
    dmxCues,
    positions: Array.from(positionMap.values()),
    errors,
    warnings,
    totalLines,
  };
}

export interface VDLApplyOptions {
  /** If true, replaces existing pyro cues/positions; otherwise merges. */
  replace?: boolean;
  /** Show name to set on metadata (only used if currently default). */
  showName?: string;
}

export function applyVDLImportToShowPlan(
  result: VDLImportResult,
  opts: VDLApplyOptions = {},
): void {
  const sp: ShowPlan = JSON.parse(JSON.stringify(showPlanManager.current));

  if (opts.replace) {
    sp.pyroCues = result.pyroCues;
    sp.dmxCues = result.dmxCues;
    sp.positions = result.positions;
  } else {
    sp.pyroCues = [...sp.pyroCues, ...result.pyroCues];
    sp.dmxCues = [...sp.dmxCues, ...result.dmxCues];
    const existing = new Set(sp.positions.map(p => p.id));
    sp.positions = [...sp.positions, ...result.positions.filter(p => !existing.has(p.id))];
  }

  const allTimes = [...sp.pyroCues.map(c => c.time), ...sp.dmxCues.map(c => c.time), 0];
  sp.metadata = {
    ...sp.metadata,
    name: (sp.metadata.name === 'Untitled Show' && opts.showName) ? opts.showName : sp.metadata.name,
    duration: Math.max(sp.metadata.duration, ...allTimes),
    updatedAt: Date.now(),
  };

  showPlanManager.load(sp);

  blackbox.record(
    'state',
    `VDLToShowPlan: imported ${result.pyroCues.length} pyro, ${result.dmxCues.length} dmx, ${result.positions.length} pos (${result.errors.length}E ${result.warnings.length}W)`,
  );
}
