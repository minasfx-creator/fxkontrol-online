/**
 * ─── Label / Sticker Generator ───────────────────────────────────────
 * Generates printable labels for racks, tubes, and firing positions.
 * Compatible with standard Avery label sheets.
 */

import { type TimelineItem, type Position, EFFECT_LIBRARY } from '@/store/useProjectStore';

export interface LabelConfig {
  labelsPerRow: number;
  labelsPerColumn: number;
  labelWidth: number;      // mm
  labelHeight: number;     // mm
  pageWidth: number;       // mm
  pageHeight: number;      // mm
  marginTop: number;
  marginLeft: number;
  gapX: number;
  gapY: number;
  fontSize: number;        // pt
  showBarcode: boolean;
  showPosition: boolean;
  showCaliber: boolean;
  showTime: boolean;
}

export const LABEL_PRESETS: Record<string, LabelConfig> = {
  'avery-5160': {
    labelsPerRow: 3, labelsPerColumn: 10,
    labelWidth: 66.7, labelHeight: 25.4,
    pageWidth: 215.9, pageHeight: 279.4,
    marginTop: 12.7, marginLeft: 4.8, gapX: 3.2, gapY: 0,
    fontSize: 8, showBarcode: false, showPosition: true, showCaliber: true, showTime: true,
  },
  'avery-5163': {
    labelsPerRow: 2, labelsPerColumn: 5,
    labelWidth: 101.6, labelHeight: 50.8,
    pageWidth: 215.9, pageHeight: 279.4,
    marginTop: 12.7, marginLeft: 4.8, gapX: 6.4, gapY: 0,
    fontSize: 10, showBarcode: true, showPosition: true, showCaliber: true, showTime: true,
  },
  'custom-tube': {
    labelsPerRow: 4, labelsPerColumn: 12,
    labelWidth: 48, labelHeight: 20,
    pageWidth: 210, pageHeight: 297,
    marginTop: 10, marginLeft: 9, gapX: 2, gapY: 2,
    fontSize: 7, showBarcode: false, showPosition: true, showCaliber: true, showTime: true,
  },
};

export interface LabelData {
  cue: number;
  module: number;
  pin: number;
  effectName: string;
  caliber: string;
  position: string;
  time: string;
  color: string;
}

function extractCaliber(name: string): string {
  const match = name.match(/(\d+)"/);
  return match ? `${match[1]}"` : '';
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.round((sec % 1) * 10);
  return `${m}:${String(s).padStart(2, '0')}.${ms}`;
}

export function generateLabels(
  items: TimelineItem[],
  positions: Position[],
): LabelData[] {
  const pyro = items
    .filter(i => { const e = EFFECT_LIBRARY.find(e => e.id === i.effectId); return e?.type === 'firework'; })
    .sort((a, b) => a.startTime - b.startTime);

  return pyro.map((item, idx) => {
    const effect = EFFECT_LIBRARY.find(e => e.id === item.effectId)!;
    const pyroPos = positions.filter(p => p.type === 'pyro');
    let posName = '';
    if (pyroPos.length > 0) {
      let minDist = Infinity;
      for (const p of pyroPos) {
        const d = Math.hypot(p.x - item.position.x, p.z - item.position.z);
        if (d < minDist) { minDist = d; posName = p.name; }
      }
    }

    return {
      cue: idx + 1,
      module: Math.floor(idx / 100) + 1,
      pin: (idx % 20) + 1,
      effectName: effect.name,
      caliber: extractCaliber(effect.name),
      position: posName || item.positionName || 'N/A',
      time: formatTime(item.startTime),
      color: effect.color,
    };
  });
}

/** Generate HTML for printable label sheet */
export function generateLabelHTML(labels: LabelData[], config: LabelConfig): string {
  const labelsPeRPage = config.labelsPerRow * config.labelsPerColumn;
  const pages: string[] = [];

  for (let p = 0; p < Math.ceil(labels.length / labelsPeRPage); p++) {
    const pageLabels = labels.slice(p * labelsPeRPage, (p + 1) * labelsPeRPage);
    const rows: string[] = [];

    for (let r = 0; r < config.labelsPerColumn; r++) {
      const rowLabels = pageLabels.slice(r * config.labelsPerRow, (r + 1) * config.labelsPerRow);
      const cells = rowLabels.map(l => `
        <td style="width:${config.labelWidth}mm;height:${config.labelHeight}mm;border:1px dashed #ccc;padding:2mm;font-size:${config.fontSize}pt;font-family:monospace;vertical-align:top;overflow:hidden;">
          <div style="display:flex;justify-content:space-between;font-weight:bold;">
            <span>CUE ${l.cue}</span>
            <span style="color:${l.color};">●</span>
          </div>
          <div style="font-size:${config.fontSize - 1}pt;margin-top:1mm;">${l.effectName}</div>
          ${config.showCaliber && l.caliber ? `<div style="font-size:${config.fontSize - 2}pt;color:#666;">Cal: ${l.caliber}</div>` : ''}
          ${config.showPosition ? `<div style="font-size:${config.fontSize - 2}pt;color:#666;">Pos: ${l.position}</div>` : ''}
          ${config.showTime ? `<div style="font-size:${config.fontSize - 2}pt;color:#666;">T: ${l.time} | M${l.module}P${l.pin}</div>` : ''}
        </td>
      `).join('');
      rows.push(`<tr>${cells}</tr>`);
    }

    pages.push(`
      <div style="width:${config.pageWidth}mm;height:${config.pageHeight}mm;padding:${config.marginTop}mm ${config.marginLeft}mm;page-break-after:always;">
        <table style="border-collapse:collapse;"><tbody>${rows.join('')}</tbody></table>
      </div>
    `);
  }

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Firing Labels</title>
    <style>@media print { body { margin: 0; } @page { size: ${config.pageWidth}mm ${config.pageHeight}mm; margin: 0; } }</style>
  </head><body>${pages.join('')}</body></html>`;
}
