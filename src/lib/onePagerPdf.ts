/**
 * FXKONTROL One-Pager PDF
 * ------------------------------------------------------------------
 * Standalone US-facing one-pager. Quiet Technical Luxury palette
 * (#121214 / #00FFFF / #FF7700) — used ONLY for external marketing
 * artifacts, NOT for the operational chrome (which stays Vantablack
 * + cyan-dessat per design memory).
 */

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { CLAIMS } from './claims';

const A4 = { w: 595.28, h: 841.89 };
const M = 40;

// Brief palette (external marketing only).
const BG = rgb(0.071, 0.071, 0.078); // #121214
const FG = rgb(0.95, 0.95, 0.97);
const CYAN = rgb(0, 1, 1); // #00FFFF
const ORANGE = rgb(1, 0.467, 0); // #FF7700
const MUTED = rgb(0.6, 0.6, 0.65);

export interface OnePagerSegment {
  id: 'agencies' | 'producers' | 'enterprise';
  label: string;
  headline: string;
  bullets: string[];
}

export const SEGMENTS: OnePagerSegment[] = [
  {
    id: 'agencies',
    label: 'Marketing Agencies',
    headline: 'Sell the spectacle before it exists.',
    bullets: [
      'SkyCanvas previs + AR overlay for client pitches.',
      'Approval flow: timestamped comments, version history.',
      'Branded export package: deck, video, scope PDF.',
    ],
  },
  {
    id: 'producers',
    label: 'Drone & Pyro Producers',
    headline: 'One timeline. Drones, pyro, DMX, audit.',
    bullets: [
      'Unified command surface · Skybrush export · DMX/Art-Net.',
      'FXK16 ARM/FIRE/E-STOP via gateway · Black box journal.',
      'Go-Live Center: GO/NO-GO with evidence + signoffs.',
    ],
  },
  {
    id: 'enterprise',
    label: 'Enterprise LiveOps',
    headline: 'Safety-first OS for massive spectacles.',
    bullets: [
      'Multi-transport reach: USB, BLE, Art-Net, 433 MHz, Starlink.',
      'Audit & rollback evidence for AHJ / insurance review.',
      'Multi-user roles, claim policy, signed firmware path.',
    ],
  },
];

export async function renderOnePagerPDF(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const mono = await pdf.embedFont(StandardFonts.Courier);
  const page = pdf.addPage([A4.w, A4.h]);

  // Background
  page.drawRectangle({ x: 0, y: 0, width: A4.w, height: A4.h, color: BG });

  // Header band
  page.drawRectangle({ x: 0, y: A4.h - 70, width: A4.w, height: 70, color: rgb(0.04, 0.04, 0.05) });
  page.drawText('FXKONTROL', {
    x: M, y: A4.h - 40, size: 22, font: bold, color: CYAN,
  });
  page.drawText('THE OPERATING SYSTEM FOR MASSIVE SPECTACLES', {
    x: M, y: A4.h - 56, size: 8, font: mono, color: MUTED,
  });
  page.drawText('US · 2026', {
    x: A4.w - M - 60, y: A4.h - 40, size: 9, font: mono, color: ORANGE,
  });

  let y = A4.h - 100;

  // Three messages
  page.drawText('Three messages. One surface.', {
    x: M, y, size: 14, font: bold, color: FG,
  });
  y -= 22;

  const msgs = [
    { t: 'End the broken stage', d: 'Replace fragmented drone, pyro, DMX, approval and reporting tools with one command surface.' },
    { t: 'Sell before deployment', d: 'SkyCanvas, Unreal/Pixel Streaming, AR Overlay and reports before hardware mobilization.' },
    { t: 'Safety-first spectacle OS', d: 'Simulation, evidence, readiness, rollback and audit as sales proof — not afterthoughts.' },
  ];
  const colW = (A4.w - M * 2 - 16) / 3;
  for (let i = 0; i < msgs.length; i++) {
    const x = M + (colW + 8) * i;
    page.drawRectangle({ x, y: y - 70, width: colW, height: 70, color: rgb(0.1, 0.1, 0.12), borderColor: CYAN, borderWidth: 0.5 });
    page.drawText(msgs[i].t, { x: x + 8, y: y - 14, size: 9, font: bold, color: CYAN });
    drawWrapped(page, msgs[i].d, x + 8, y - 28, colW - 16, font, 8, FG, 11);
  }
  y -= 86;

  // Segment cards
  page.drawText('Segments', { x: M, y, size: 12, font: bold, color: ORANGE });
  y -= 18;

  for (const seg of SEGMENTS) {
    page.drawRectangle({ x: M, y: y - 78, width: A4.w - M * 2, height: 78, color: rgb(0.085, 0.085, 0.095), borderColor: rgb(0.2, 0.2, 0.22), borderWidth: 0.5 });
    page.drawText(seg.label.toUpperCase(), { x: M + 12, y: y - 16, size: 9, font: mono, color: ORANGE });
    page.drawText(seg.headline, { x: M + 12, y: y - 32, size: 11, font: bold, color: FG });
    let by = y - 48;
    for (const b of seg.bullets) {
      page.drawText('•', { x: M + 12, y: by, size: 9, font, color: CYAN });
      drawWrapped(page, b, M + 24, by + 2, A4.w - M * 2 - 36, font, 8.5, FG, 10);
      by -= 12;
    }
    y -= 86;
  }

  // Claim policy footer
  y -= 4;
  page.drawText('CLAIM POLICY', { x: M, y, size: 8, font: mono, color: MUTED });
  y -= 12;
  const validated = CLAIMS.filter(c => c.status === 'validated').length;
  const pilot = CLAIMS.filter(c => c.status === 'pilot').length;
  const hyp = CLAIMS.filter(c => c.status === 'marketing_hypothesis').length;
  page.drawText(
    `${validated} validated · ${pilot} pilot · ${hyp} marketing_hypothesis. NFPA / FAA / latency / cost / range claims require US review.`,
    { x: M, y, size: 7.5, font, color: MUTED },
  );
  y -= 14;
  page.drawText('Request demo: fxkontrol.online/comercial#demo-form', {
    x: M, y, size: 8, font: bold, color: CYAN,
  });

  return pdf.save();
}

function drawWrapped(
  page: ReturnType<PDFDocument['addPage']>,
  text: string,
  x: number,
  y: number,
  maxW: number,
  font: import('pdf-lib').PDFFont,
  size: number,
  color: ReturnType<typeof rgb>,
  lineH: number,
) {
  const words = text.split(/\s+/);
  let line = '';
  let cy = y;
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(test, size) > maxW) {
      page.drawText(line, { x, y: cy, size, font, color });
      line = w;
      cy -= lineH;
    } else {
      line = test;
    }
  }
  if (line) page.drawText(line, { x, y: cy, size, font, color });
}

export function downloadOnePager(bytes: Uint8Array, filename = 'fxkontrol-onepager-us.pdf') {
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
