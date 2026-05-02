/**
 * ─── showPlanPdf — Technical PDF for a ShowPlan ────────────────────
 *
 * Renderiza um PDF técnico A4 a partir de um ShowPlan canônico:
 *  • Cover (metadata, duração, módulos, totais).
 *  • BoM (Bill of Materials por SKU/calibre, peso estimado).
 *  • Pinout proposto (module → channel → posição → efeito, com min gap).
 *  • Sequenciamento (primeiras N linhas — referência rápida; CSV
 *    completo é exportado separadamente para evitar PDFs gigantes).
 *  • Disclaimers (claim policy: estimativas de peso = marketing_hypothesis,
 *    show real exige BoM contratual do operador).
 *
 * Reutiliza pdf-lib via padrão já consolidado em src/lib/pdfRenderer.ts.
 * Pure-on-data, exceto download(...) helper.
 */

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import type { ShowPlan } from '@/core/showplan/ShowPlan';
import {
  inspectShowPlan,
  type InspectShowPlanResult,
} from './inspectShowPlan';

const A4 = { w: 595.28, h: 841.89 };
const MARGIN = 42;
const LINE = 12;
const SEQUENCING_PREVIEW_ROWS = 40;

interface DrawCtx {
  pdf: PDFDocument;
  page: PDFPage;
  y: number;
  font: PDFFont;
  bold: PDFFont;
  mono: PDFFont;
}

function newPage(ctx: DrawCtx): DrawCtx {
  const page = ctx.pdf.addPage([A4.w, A4.h]);
  return { ...ctx, page, y: A4.h - MARGIN };
}

function ensureSpace(ctx: DrawCtx, needed: number): DrawCtx {
  if (ctx.y - needed < MARGIN) return newPage(ctx);
  return ctx;
}

function wrap(text: string, font: PDFFont, size: number, maxW: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(test, size) > maxW) {
      if (cur) lines.push(cur);
      cur = w;
    } else {
      cur = test;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function drawHeading(ctx: DrawCtx, text: string, size = 13): DrawCtx {
  ctx = ensureSpace(ctx, size + 8);
  ctx.page.drawText(text, {
    x: MARGIN, y: ctx.y - size,
    size, font: ctx.bold, color: rgb(0.04, 0.55, 0.7),
  });
  return { ...ctx, y: ctx.y - size - 6 };
}

function drawText(ctx: DrawCtx, text: string, size = 9, color = rgb(0.12, 0.12, 0.14)): DrawCtx {
  const maxW = A4.w - MARGIN * 2;
  const lines = wrap(text, ctx.font, size, maxW);
  for (const line of lines) {
    ctx = ensureSpace(ctx, LINE);
    ctx.page.drawText(line, { x: MARGIN, y: ctx.y - size, size, font: ctx.font, color });
    ctx = { ...ctx, y: ctx.y - LINE };
  }
  return ctx;
}

function drawKV(ctx: DrawCtx, key: string, value: string): DrawCtx {
  ctx = ensureSpace(ctx, LINE);
  ctx.page.drawText(`${key}:`, {
    x: MARGIN, y: ctx.y - 9, size: 8, font: ctx.bold, color: rgb(0.4, 0.4, 0.45),
  });
  ctx.page.drawText(value, {
    x: MARGIN + 110, y: ctx.y - 9, size: 9, font: ctx.font, color: rgb(0.1, 0.1, 0.12),
  });
  return { ...ctx, y: ctx.y - LINE };
}

function drawDivider(ctx: DrawCtx): DrawCtx {
  ctx = ensureSpace(ctx, 10);
  ctx.page.drawLine({
    start: { x: MARGIN, y: ctx.y - 4 },
    end: { x: A4.w - MARGIN, y: ctx.y - 4 },
    thickness: 0.5,
    color: rgb(0.85, 0.85, 0.88),
  });
  return { ...ctx, y: ctx.y - 12 };
}

function drawTableRow(
  ctx: DrawCtx,
  cols: { x: number; w: number; text: string; bold?: boolean }[],
  size = 8,
): DrawCtx {
  ctx = ensureSpace(ctx, LINE);
  for (const c of cols) {
    const f = c.bold ? ctx.bold : ctx.mono;
    const lines = wrap(c.text, f, size, c.w);
    ctx.page.drawText(lines[0] ?? '', {
      x: c.x, y: ctx.y - size, size, font: f, color: rgb(0.15, 0.15, 0.18),
    });
  }
  return { ...ctx, y: ctx.y - LINE };
}

export interface RenderShowPlanPdfOptions {
  /** Override the inspect result if you want to reuse a memoized one. */
  inspection?: InspectShowPlanResult;
  /** Cap sequencing preview rows (default 40). */
  sequencingPreviewRows?: number;
}

export async function renderShowPlanPdf(
  sp: ShowPlan,
  opts: RenderShowPlanPdfOptions = {},
): Promise<Uint8Array> {
  const inspection = opts.inspection ?? inspectShowPlan(sp);
  const previewRows = opts.sequencingPreviewRows ?? SEQUENCING_PREVIEW_ROWS;

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const mono = await pdf.embedFont(StandardFonts.Courier);
  const page = pdf.addPage([A4.w, A4.h]);
  let ctx: DrawCtx = { pdf, page, font, bold, mono, y: A4.h - MARGIN };

  // ── Cover ────────────────────────────────────────────────────────
  ctx.page.drawText('FXKONTROL', {
    x: MARGIN, y: ctx.y - 18, size: 18, font: bold, color: rgb(0.04, 0.55, 0.7),
  });
  ctx.page.drawText('Show Technical Report', {
    x: MARGIN, y: ctx.y - 36, size: 11, font, color: rgb(0.3, 0.3, 0.35),
  });
  ctx.page.drawText(`Generated ${new Date().toISOString()}`, {
    x: MARGIN, y: ctx.y - 50, size: 8, font, color: rgb(0.5, 0.5, 0.55),
  });
  ctx = { ...ctx, y: ctx.y - 64 };

  ctx = drawHeading(ctx, sp.metadata.name, 14);
  ctx = drawKV(ctx, 'Show ID', sp.metadata.id);
  ctx = drawKV(ctx, 'Venue', sp.metadata.venue || 'N/A');
  ctx = drawKV(ctx, 'Author', sp.metadata.author || 'N/A');
  ctx = drawKV(ctx, 'Duration', `${sp.metadata.duration.toFixed(1)} s`);
  ctx = drawKV(ctx, 'Modules', `${sp.hardwareConfig.modules.length}`);
  ctx = drawKV(ctx, 'Positions', `${sp.positions.length}`);
  ctx = drawKV(ctx, 'Total cues', `${inspection.bom.totalCues}`);
  ctx = drawKV(ctx, 'Total units', `${inspection.bom.totalUnits}`);
  ctx = drawKV(
    ctx,
    'Est. weight',
    `${(inspection.bom.totalEstimatedWeightG / 1000).toFixed(2)} kg (estimate)`,
  );
  ctx = drawKV(ctx, 'Max caliber', `${inspection.bom.maxCaliber} mm`);
  ctx = drawKV(
    ctx,
    'Min ch reuse',
    inspection.minChannelReuseS == null
      ? 'n/a (no channel reuse)'
      : `${inspection.minChannelReuseS.toFixed(3)} s`,
  );
  if (sp.metadata.notes) {
    ctx = drawDivider(ctx);
    ctx = drawText(ctx, sp.metadata.notes, 9, rgb(0.3, 0.3, 0.35));
  }
  ctx = drawDivider(ctx);

  // ── Safety constraints ───────────────────────────────────────────
  ctx = drawHeading(ctx, 'Safety constraints');
  ctx = drawKV(ctx, 'NFPA min distance', `${sp.safetyConstraints.nfpaMinDistance} m`);
  ctx = drawKV(ctx, 'Max wind speed', `${sp.safetyConstraints.maxWindSpeed} m/s`);
  ctx = drawKV(ctx, 'Max caliper', `${sp.safetyConstraints.maxCaliper} mm`);
  ctx = drawKV(
    ctx,
    'Continuity check',
    sp.safetyConstraints.requireContinuityCheck ? 'REQUIRED' : 'optional',
  );
  ctx = drawKV(
    ctx,
    'Dual key',
    sp.safetyConstraints.requireDualKey ? 'REQUIRED' : 'optional',
  );
  ctx = drawDivider(ctx);

  // ── BoM ──────────────────────────────────────────────────────────
  ctx = drawHeading(ctx, 'Bill of Materials');
  const bomCols = [
    { x: MARGIN,        w: 170, text: 'Effect',        bold: true },
    { x: MARGIN + 170,  w: 50,  text: 'Cal (mm)',      bold: true },
    { x: MARGIN + 220,  w: 40,  text: 'Qty',           bold: true },
    { x: MARGIN + 260,  w: 100, text: 'Sections',      bold: true },
    { x: MARGIN + 360,  w: 70,  text: 'Unit (g)',      bold: true },
    { x: MARGIN + 430,  w: 70,  text: 'Total (g)',     bold: true },
  ];
  ctx = drawTableRow(ctx, bomCols, 8);
  for (const r of inspection.bom.rows) {
    ctx = drawTableRow(ctx, [
      { x: MARGIN,       w: 170, text: r.effectId },
      { x: MARGIN + 170, w: 50,  text: `${r.caliber}` },
      { x: MARGIN + 220, w: 40,  text: `${r.count}` },
      { x: MARGIN + 260, w: 100, text: r.sections.join(', ') || '—' },
      { x: MARGIN + 360, w: 70,  text: `${r.estimatedUnitWeightG}` },
      { x: MARGIN + 430, w: 70,  text: `${r.estimatedTotalWeightG}` },
    ], 8);
  }
  ctx = drawDivider(ctx);

  // ── Pinout ───────────────────────────────────────────────────────
  ctx = drawHeading(ctx, 'Proposed Pinout (module → channel)');
  const pinCols = [
    { x: MARGIN,       w: 40,  text: 'Mod',     bold: true },
    { x: MARGIN + 40,  w: 30,  text: 'Ch',      bold: true },
    { x: MARGIN + 70,  w: 130, text: 'Position',bold: true },
    { x: MARGIN + 200, w: 130, text: 'Effect',  bold: true },
    { x: MARGIN + 330, w: 50,  text: 'Cal',     bold: true },
    { x: MARGIN + 380, w: 40,  text: 'Fires',   bold: true },
    { x: MARGIN + 420, w: 80,  text: 'Min gap (s)', bold: true },
  ];
  ctx = drawTableRow(ctx, pinCols, 8);
  for (const r of inspection.pinout) {
    ctx = drawTableRow(ctx, [
      { x: MARGIN,       w: 40,  text: `${r.module}` },
      { x: MARGIN + 40,  w: 30,  text: `${r.channel}` },
      { x: MARGIN + 70,  w: 130, text: r.positionName },
      { x: MARGIN + 200, w: 130, text: r.effectId },
      { x: MARGIN + 330, w: 50,  text: `${r.caliber}` },
      { x: MARGIN + 380, w: 40,  text: `${r.fireCount}` },
      { x: MARGIN + 420, w: 80,  text: r.minGapS == null ? '—' : r.minGapS.toFixed(3) },
    ], 8);
  }
  ctx = drawDivider(ctx);

  // ── Sequencing preview ───────────────────────────────────────────
  ctx = drawHeading(ctx, `Sequencing — first ${previewRows} cues`);
  const seqCols = [
    { x: MARGIN,       w: 30,  text: '#',        bold: true },
    { x: MARGIN + 30,  w: 60,  text: 'Time (s)', bold: true },
    { x: MARGIN + 90,  w: 40,  text: 'Mod',      bold: true },
    { x: MARGIN + 130, w: 40,  text: 'Ch',       bold: true },
    { x: MARGIN + 170, w: 130, text: 'Position', bold: true },
    { x: MARGIN + 300, w: 130, text: 'Effect',   bold: true },
    { x: MARGIN + 430, w: 50,  text: 'Cal',      bold: true },
  ];
  ctx = drawTableRow(ctx, seqCols, 8);
  for (const r of inspection.sequencing.slice(0, previewRows)) {
    ctx = drawTableRow(ctx, [
      { x: MARGIN,       w: 30,  text: `${r.index}` },
      { x: MARGIN + 30,  w: 60,  text: r.timeS.toFixed(3) },
      { x: MARGIN + 90,  w: 40,  text: `${r.module}` },
      { x: MARGIN + 130, w: 40,  text: `${r.channel}` },
      { x: MARGIN + 170, w: 130, text: r.positionId },
      { x: MARGIN + 300, w: 130, text: r.effectId },
      { x: MARGIN + 430, w: 50,  text: `${r.caliber}` },
    ], 8);
  }
  if (inspection.sequencing.length > previewRows) {
    ctx = drawText(
      ctx,
      `… ${inspection.sequencing.length - previewRows} more cues. ` +
      `Use sequencingToCsv() for the full list.`,
      8,
      rgb(0.45, 0.45, 0.5),
    );
  }
  ctx = drawDivider(ctx);

  // ── Disclaimers ──────────────────────────────────────────────────
  ctx = drawHeading(ctx, 'Disclaimers · claim policy');
  const disclaimers = [
    'Estimated weights and unit masses are coarse references for transport planning only ' +
      '(claim status: marketing_hypothesis). The contractual BoM provided by the licensed ' +
      'operator overrides this document for regulatory submissions.',
    'NFPA 1123 minimum distances and other safety constraints are operator responsibility. ' +
      'This report does not authorize firing — the canonical authorization flow remains ' +
      'CommandBus → SafetyStateMachine in real_operation work mode.',
    'Channel reuse gaps under 1.0s are flagged as cross-fire risk; verify physical interlock ' +
      'before arming.',
  ];
  for (const d of disclaimers) {
    ctx = drawText(ctx, `• ${d}`, 8, rgb(0.45, 0.3, 0.05));
  }

  // ── Footer ───────────────────────────────────────────────────────
  ctx.page.drawText(
    'Generated by FXKONTROL · simulation = execution = reality · v1',
    { x: MARGIN, y: MARGIN - 12, size: 7, font, color: rgb(0.5, 0.5, 0.55) },
  );

  return pdf.save();
}

export function downloadShowPlanPdf(bytes: Uint8Array, filename: string): void {
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
