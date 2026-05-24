/**
 * Lightweight PDF renderer for strategy artifacts.
 *
 * Uses pdf-lib (no headless browser, no server). Produces a single,
 * paginated A4 document for either a Demo Session report or a
 * Client Approval report.
 *
 * Pure on data — only side-effect is the final `download()` helper.
 */

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import type { StrategyReport } from './strategyReport';

const A4 = { w: 595.28, h: 841.89 };
const MARGIN = 48;
const LINE = 14;

interface DrawCtx {
  pdf: PDFDocument;
  page: PDFPage;
  y: number;
  font: PDFFont;
  bold: PDFFont;
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

function drawHeading(ctx: DrawCtx, text: string, size = 14): DrawCtx {
  ctx = ensureSpace(ctx, size + 8);
  ctx.page.drawText(text, {
    x: MARGIN, y: ctx.y - size,
    size, font: ctx.bold, color: rgb(0.04, 0.55, 0.7),
  });
  return { ...ctx, y: ctx.y - size - 6 };
}

function drawText(ctx: DrawCtx, text: string, size = 10, color = rgb(0.1, 0.1, 0.12)): DrawCtx {
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
  ctx.page.drawText(`${key}:`, { x: MARGIN, y: ctx.y - 10, size: 9, font: ctx.bold, color: rgb(0.4, 0.4, 0.45) });
  const valX = MARGIN + 110;
  const lines = wrap(value, ctx.font, 10, A4.w - MARGIN - valX);
  ctx.page.drawText(lines[0] ?? '', { x: valX, y: ctx.y - 10, size: 10, font: ctx.font, color: rgb(0.1, 0.1, 0.12) });
  ctx = { ...ctx, y: ctx.y - LINE };
  for (let i = 1; i < lines.length; i++) {
    ctx = ensureSpace(ctx, LINE);
    ctx.page.drawText(lines[i], { x: valX, y: ctx.y - 10, size: 10, font: ctx.font, color: rgb(0.1, 0.1, 0.12) });
    ctx = { ...ctx, y: ctx.y - LINE };
  }
  return ctx;
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

export async function renderStrategyReportPDF(report: StrategyReport): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([A4.w, A4.h]);

  let ctx: DrawCtx = { pdf, page, font, bold, y: A4.h - MARGIN };

  // Header
  ctx.page.drawText('FXKONTROL', { x: MARGIN, y: ctx.y - 16, size: 16, font: bold, color: rgb(0.04, 0.55, 0.7) });
  ctx.page.drawText(
    report.kind === 'demo-session' ? 'Strategy Report — Demo Session' : 'Client Approval Report',
    { x: MARGIN, y: ctx.y - 32, size: 11, font, color: rgb(0.3, 0.3, 0.35) },
  );
  ctx.page.drawText(`Generated ${new Date(report.generatedAt).toLocaleString()}`,
    { x: MARGIN, y: ctx.y - 46, size: 8, font, color: rgb(0.5, 0.5, 0.55) });
  ctx = { ...ctx, y: ctx.y - 60 };

  ctx = drawHeading(ctx, report.positioning, 13);
  ctx = drawText(ctx, report.coreMessages.join('  ·  '), 10, rgb(0.3, 0.3, 0.35));
  ctx = drawDivider(ctx);

  // Session block
  if (report.session) {
    ctx = drawHeading(ctx, 'Demo session');
    ctx = drawKV(ctx, 'Prospect', report.session.prospect_company);
    ctx = drawKV(ctx, 'Audience', report.session.prospect_audience);
    ctx = drawKV(ctx, 'Outcome', report.session.outcome);
    if (report.session.next_step) ctx = drawKV(ctx, 'Next step', report.session.next_step);
    if (report.session.objections) ctx = drawKV(ctx, 'Objections', report.session.objections);
    if (report.session.notes) ctx = drawKV(ctx, 'Notes', report.session.notes);
    ctx = drawDivider(ctx);
  }

  // Approval block
  if (report.approval) {
    ctx = drawHeading(ctx, 'Client approval');
    ctx = drawKV(ctx, 'Scope', report.approval.scope);
    ctx = drawKV(ctx, 'Preview version', report.approval.preview_version);
    ctx = drawKV(ctx, 'Status', report.approval.approved ? 'APPROVED' : 'Pending');
    if (report.approval.approver_email) ctx = drawKV(ctx, 'Approver', report.approval.approver_email);
    if (report.approval.approved_at) ctx = drawKV(ctx, 'Approved at', new Date(report.approval.approved_at).toLocaleString());
    if (report.approval.comments.length > 0) {
      ctx = ensureSpace(ctx, LINE);
      ctx.page.drawText('Comments:', { x: MARGIN, y: ctx.y - 10, size: 9, font: bold, color: rgb(0.4, 0.4, 0.45) });
      ctx = { ...ctx, y: ctx.y - LINE };
      for (const c of report.approval.comments) {
        ctx = drawText(ctx, `• ${c.author ?? 'Anon'} — ${c.text}`, 9, rgb(0.2, 0.2, 0.25));
      }
    }
    ctx = drawDivider(ctx);
  }

  // Assets
  if (report.assets.length > 0) {
    ctx = drawHeading(ctx, 'Assets shown');
    for (const a of report.assets) {
      ctx = drawText(ctx, `• ${a.title}  [${a.claimStatus}]`, 10, rgb(0.1, 0.1, 0.12));
      ctx = drawText(ctx, `  ${a.description}`, 9, rgb(0.4, 0.4, 0.45));
    }
    ctx = drawDivider(ctx);
  }

  // Disclaimers
  if (report.disclaimers.length > 0) {
    ctx = drawHeading(ctx, 'Disclaimers & claim policy');
    for (const d of report.disclaimers) {
      ctx = drawText(ctx, `• ${d}`, 9, rgb(0.45, 0.3, 0.05));
    }
    ctx = drawDivider(ctx);
  }

  // Footer
  ctx = ensureSpace(ctx, 30);
  ctx.page.drawText(
    'Claim policy: validated = source-backed · pilot = with disclaimer · marketing_hypothesis = narrative only',
    { x: MARGIN, y: MARGIN - 12, size: 7, font, color: rgb(0.5, 0.5, 0.55) },
  );

  return pdf.save();
}

export function downloadPdf(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
