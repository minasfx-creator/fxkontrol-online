/**
 * Showven PCX Exporter (FX Commander cue-list format)
 * ────────────────────────────────────────────────────────────
 * Produces a CSV compatible with Showven FX Commander Pro (manualGroup
 * mapping, 128 cues max). Channels come from `universe`/`section` when
 * present; otherwise they are inferred from `rack`/`tube` (rack as group,
 * tube as channel within the group).
 *
 * Columns (per Showven import spec):
 *   Group, Channel, Time, Effect, Color, Notes, Hazard
 *
 * Constraints enforced:
 *   - Max 128 cues — extra cues cause a `truncated` flag in the result.
 *   - Group is 1..16 (FX Commander manualGroup range).
 *   - Channel is 1..8 within each group.
 */

import { useProjectStore } from '@/store/useProjectStore';
import { EFFECT_LIBRARY } from '@/data/effectLibrary';

export interface ShowvenExportResult {
  filename: string;
  csv: string;
  rowCount: number;
  truncated: boolean;
  warnings: string[];
}

const MAX_CUES = 128;
const MAX_GROUP = 16;
const MAX_CH = 8;

function csvEscape(v: string | number | undefined | null): string {
  if (v === undefined || v === null) return '';
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function fmtTime(seconds: number): string {
  // Showven FX Commander uses MM:SS.mmm (no hours field)
  const ms = Math.round(seconds * 1000);
  const m = Math.floor(ms / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const mm = ms % 1000;
  return (
    `${String(m).padStart(2, '0')}:` +
    `${String(s).padStart(2, '0')}.` +
    `${String(mm).padStart(3, '0')}`
  );
}

export function exportShowvenPCX(): ShowvenExportResult {
  const items = useProjectStore.getState().timelineItems;
  const sorted = [...items].sort((a, b) => a.startTime - b.startTime);

  const warnings: string[] = [];
  const rows: string[] = [
    ['Group', 'Channel', 'Time', 'Effect', 'Color', 'Notes', 'Hazard'].join(','),
  ];

  let written = 0;
  for (const it of sorted) {
    if (written >= MAX_CUES) break;

    const eff = EFFECT_LIBRARY.find((e) => e.id === it.effectId);
    const color = it.colorOverride ?? eff?.color ?? '';

    // Derive group/channel
    let group = typeof it.rack === 'number' ? it.rack : 1;
    let channel = typeof it.tube === 'number' ? it.tube : 1;

    if (group < 1 || group > MAX_GROUP) {
      warnings.push(`Cue@${fmtTime(it.startTime)}: group ${group} clamped to 1..${MAX_GROUP}.`);
      group = Math.max(1, Math.min(MAX_GROUP, group));
    }
    if (channel < 1 || channel > MAX_CH) {
      warnings.push(`Cue@${fmtTime(it.startTime)}: channel ${channel} clamped to 1..${MAX_CH}.`);
      channel = Math.max(1, Math.min(MAX_CH, channel));
    }

    rows.push(
      [
        csvEscape(group),
        csvEscape(channel),
        csvEscape(fmtTime(it.startTime)),
        csvEscape(eff?.name ?? it.effectId),
        csvEscape(color),
        csvEscape(it.notes ?? ''),
        csvEscape(it.hazard ?? ''),
      ].join(','),
    );
    written++;
  }

  const truncated = sorted.length > MAX_CUES;
  if (truncated) {
    warnings.unshift(
      `Show contains ${sorted.length} cues — Showven FX Commander Pro hard limit is ${MAX_CUES}.`,
    );
  }

  return {
    filename: `showven_fx_commander_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`,
    csv: rows.join('\n'),
    rowCount: written,
    truncated,
    warnings,
  };
}

export function downloadShowvenPCX(result: ShowvenExportResult): void {
  const blob = new Blob([result.csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = result.filename;
  a.click();
  URL.revokeObjectURL(url);
}
