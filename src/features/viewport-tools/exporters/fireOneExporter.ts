/**
 * FireOne FDB Exporter (CSV format compatible with FireOne import)
 * ────────────────────────────────────────────────────────────
 * Produces an industry-aligned cue list suitable for FireOne FX-PYRO
 * controllers. FireOne accepts a comma-separated cue table with the
 * canonical columns: Time, Cue#, Module, Pin, Description, VDL, Effect.
 *
 * - Only TimelineItems carrying `rack` + `tube` are emitted.
 * - Time uses HH:MM:SS.mmm (FireOne timecode standard).
 * - VDL falls back to the effect's library `vdl` field when no override.
 * - The exporter NEVER mutates ShowPlan — pure read-only.
 */

import { useProjectStore } from '@/store/useProjectStore';
import { EFFECT_LIBRARY } from '@/data/effectLibrary';
import type { TimelineItem } from '@/types/projectTypes';

export interface FireOneExportResult {
  filename: string;
  csv: string;
  rowCount: number;
  skipped: number;
}

function fmtTime(seconds: number): string {
  const ms = Math.round(seconds * 1000);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const mm = ms % 1000;
  return (
    `${String(h).padStart(2, '0')}:` +
    `${String(m).padStart(2, '0')}:` +
    `${String(s).padStart(2, '0')}.` +
    `${String(mm).padStart(3, '0')}`
  );
}

function csvEscape(v: string | number | undefined | null): string {
  if (v === undefined || v === null) return '';
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function effectMeta(effectId: string) {
  return EFFECT_LIBRARY.find((e) => e.id === effectId);
}

export function exportFireOneFDB(): FireOneExportResult {
  const items = useProjectStore.getState().timelineItems;

  const rows: string[] = [
    ['Time', 'Cue', 'Module', 'Pin', 'Description', 'VDL', 'Effect', 'Position'].join(','),
  ];

  let skipped = 0;
  let cueNum = 1;
  const sorted = [...items].sort((a, b) => a.startTime - b.startTime);

  for (const it of sorted) {
    if (it.rack === undefined || it.tube === undefined) {
      skipped++;
      continue;
    }
    const eff = effectMeta(it.effectId);
    const vdl = it.colorOverride ?? eff?.vdl ?? '';
    rows.push(
      [
        csvEscape(fmtTime(it.startTime)),
        csvEscape(cueNum++),
        csvEscape(it.rack),
        csvEscape(it.tube),
        csvEscape(it.notes ?? ''),
        csvEscape(vdl),
        csvEscape(eff?.name ?? it.effectId),
        csvEscape(it.positionName ?? it.positionId ?? ''),
      ].join(','),
    );
  }

  return {
    filename: `fireone_show_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`,
    csv: rows.join('\n'),
    rowCount: rows.length - 1,
    skipped,
  };
}

export function downloadFireOneFDB(result: FireOneExportResult): void {
  const blob = new Blob([result.csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = result.filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Helper: count exportable rows without serialising. Used by UI badges. */
export function countFireOneExportable(items: TimelineItem[]): number {
  return items.reduce(
    (n, it) => (it.rack !== undefined && it.tube !== undefined ? n + 1 : n),
    0,
  );
}
