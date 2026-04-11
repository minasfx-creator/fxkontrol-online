/**
 * joiPdfExport — Export Joi assistant messages as professional PDF documents
 * ABNT NBR 14724 formatting: 3cm left/top, 2cm right/bottom, 12pt Arial, 1.5 line spacing
 */
import jsPDF from 'jspdf';
import { extractDocumentBody, DOC_LABELS, getDocTypeFooterNote, type DocType } from './joiDocumentParser';

// Platform colors in RGB
const CYAN = [0, 180, 216] as const;
const AMBER = [217, 164, 6] as const;
const DARK = [18, 20, 28] as const;

// ABNT margins (mm)
const MARGIN_L = 30; // 3cm left
const MARGIN_T = 30; // 3cm top
const MARGIN_R = 20; // 2cm right
const MARGIN_B = 20; // 2cm bottom

// Inline formatting segment
interface TextSegment {
  text: string;
  bold: boolean;
  italic: boolean;
  code: boolean;
}

/** Parse inline markdown (**bold**, *italic*, `code`) into segments */
function parseInlineSegments(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  const regex = /\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|([^*`]+)/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match[1]) segments.push({ text: match[1], bold: true, italic: false, code: false });
    else if (match[2]) segments.push({ text: match[2], bold: false, italic: true, code: false });
    else if (match[3]) segments.push({ text: match[3], bold: false, italic: false, code: true });
    else if (match[4]) segments.push({ text: match[4], bold: false, italic: false, code: false });
  }
  return segments.length ? segments : [{ text, bold: false, italic: false, code: false }];
}

/** Render inline-formatted text at position, returns total width used */
function renderFormattedText(doc: jsPDF, segments: TextSegment[], x: number, y: number, fontSize: number): void {
  let cx = x;
  for (const seg of segments) {
    if (seg.code) {
      doc.setFont('courier', 'normal');
      doc.setFontSize(fontSize - 1);
    } else {
      const style = seg.bold && seg.italic ? 'bolditalic' : seg.bold ? 'bold' : seg.italic ? 'italic' : 'normal';
      doc.setFont('helvetica', style);
      doc.setFontSize(fontSize);
    }
    doc.text(seg.text, cx, y);
    cx += doc.getTextWidth(seg.text);
  }
  // Reset
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(fontSize);
}

/** Render a line with inline formatting, wrapping if needed. Returns new Y.
 *  Uses yRef object for by-reference Y tracking across page breaks. */
function renderWrappedFormattedLine(
  doc: jsPDF, text: string, x: number, yRef: { value: number },
  maxWidth: number, lineH: number, fontSize: number,
  checkBreak: (needed: number) => void
): void {
  const segments = parseInlineSegments(text);
  // Check if all segments fit on one line
  let totalW = 0;
  for (const seg of segments) {
    if (seg.code) { doc.setFont('courier', 'normal'); doc.setFontSize(fontSize - 1); }
    else {
      const style = seg.bold ? 'bold' : seg.italic ? 'italic' : 'normal';
      doc.setFont('helvetica', style);
      doc.setFontSize(fontSize);
    }
    totalW += doc.getTextWidth(seg.text);
  }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(fontSize);

  if (totalW <= maxWidth) {
    checkBreak(lineH);
    renderFormattedText(doc, segments, x, yRef.value, fontSize);
    yRef.value += lineH;
    return;
  }

  // Fallback: strip formatting and use splitTextToSize for wrapping
  const plain = text.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1').replace(/`(.+?)`/g, '$1');
  const wrapped = doc.splitTextToSize(plain, maxWidth);
  for (const wl of wrapped) {
    checkBreak(lineH);
    doc.text(wl, x, yRef.value);
    yRef.value += lineH;
  }
}

function stripInlineMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1');
}

interface TableBlock {
  headers: string[];
  rows: string[][];
}

function parseTableBlock(lines: string[]): TableBlock {
  const headers = lines[0].split('|').map(c => c.trim()).filter(Boolean);
  const rows: string[][] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split('|').map(c => c.trim()).filter(Boolean);
    if (cells.length > 0) rows.push(cells);
  }
  return { headers, rows };
}

export async function exportJoiPdf(markdownContent: string): Promise<void> {
  try {
    const { body, docType, parsedLines } = extractDocumentBody(markdownContent);
    const label = DOC_LABELS[docType];
    const footerNote = getDocTypeFooterNote(docType);
    const now = new Date();
    const dateStr = now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const contentW = pageW - MARGIN_L - MARGIN_R;
    let y = 0;
    let pageNum = 1;

    const addHeader = () => {
      // Dark header bar
      doc.setFillColor(DARK[0], DARK[1], DARK[2]);
      doc.rect(0, 0, pageW, 24, 'F');
      doc.setFillColor(CYAN[0], CYAN[1], CYAN[2]);
      doc.rect(0, 24, pageW, 0.8, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(CYAN[0], CYAN[1], CYAN[2]);
      doc.text('FX KONTROL', MARGIN_L, 10);

      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(AMBER[0], AMBER[1], AMBER[2]);
      doc.text('Minas Pirotécnica · Show Control Platform', MARGIN_L, 16);

      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(AMBER[0], AMBER[1], AMBER[2]);
      doc.text(label, pageW - MARGIN_R, 10, { align: 'right' });

      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(150, 150, 150);
      doc.text(`${dateStr} · ${timeStr}`, pageW - MARGIN_R, 16, { align: 'right' });

      y = MARGIN_T + 4;
    };

    const addFooter = () => {
      doc.setFillColor(DARK[0], DARK[1], DARK[2]);
      doc.rect(0, pageH - 12, pageW, 12, 'F');
      doc.setFillColor(CYAN[0], CYAN[1], CYAN[2]);
      doc.rect(0, pageH - 12, pageW, 0.4, 'F');

      doc.setFontSize(6);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(CYAN[0], CYAN[1], CYAN[2]);
      doc.text('Gerado por JOI · Secretária Executiva AI · FX KONTROL', MARGIN_L, pageH - 4);
      doc.setTextColor(150, 150, 150);
      doc.text(`Página ${pageNum}`, pageW - MARGIN_R, pageH - 4, { align: 'right' });
    };

    const maxY = pageH - MARGIN_B - 12;

    const checkPageBreak = (needed: number) => {
      if (y + needed > maxY) {
        addFooter();
        doc.addPage();
        pageNum++;
        addHeader();
      }
    };

    addHeader();

    // Process lines
    const lines = body.split('\n');
    let i = 0;

    while (i < lines.length) {
      const raw = lines[i];
      const trimmed = raw.trim();

      // Empty line
      if (!trimmed) { y += 4; i++; continue; }

      // Detect table block
      if (trimmed.startsWith('|') && trimmed.includes('|')) {
        const tableLines: string[] = [];
        while (i < lines.length && lines[i].trim().startsWith('|')) {
          const tl = lines[i].trim();
          if (!/^\|?\s*[-:]+(\s*\|\s*[-:]+)+\s*\|?\s*$/.test(tl)) {
            tableLines.push(tl);
          }
          i++;
        }
        if (tableLines.length > 0) {
          renderTable(doc, parseTableBlock(tableLines), y, contentW, MARGIN_L, maxY, () => {
            addFooter();
            doc.addPage();
            pageNum++;
            addHeader();
          }, (newY: number) => { y = newY; });
        }
        continue;
      }

      // Heading detection
      const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)/);
      const headingText = headingMatch ? headingMatch[2].replace(/\*\*/g, '') : null;
      const headingLevel = headingMatch ? headingMatch[1].length : 0;

      const isUpperHeader = !headingMatch && (
        /^[A-ZÁÉÍÓÚÂÊÔÃÕÇÜ\d\s.]{4,}$/.test(trimmed) ||
        (trimmed.endsWith(':') && trimmed.length < 60 && !trimmed.startsWith('•'))
      );

      if (headingText || isUpperHeader) {
        checkPageBreak(14);
        y += 5;
        const text = headingText || stripInlineMarkdown(trimmed);
        const fontSize = headingLevel <= 1 ? 14 : headingLevel === 2 ? 13 : 12;

        // Cyan accent bar
        doc.setFillColor(CYAN[0], CYAN[1], CYAN[2]);
        doc.rect(MARGIN_L, y - 3.5, 2, 6, 'F');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(fontSize);
        doc.setTextColor(26, 26, 26);
        doc.text(text, MARGIN_L + 5, y);
        y += 9;
        i++;
        continue;
      }

      // Bullet points
      if (/^[-*•]\s+/.test(trimmed)) {
        const bulletText = trimmed.replace(/^[-*•]\s+/, '');
        checkPageBreak(10);
        doc.setFontSize(12);
        doc.setTextColor(26, 26, 26);
        const yRef = { value: y };
        renderWrappedFormattedLine(doc, '• ' + bulletText, MARGIN_L, yRef, contentW - 8, 7, 12, checkPageBreak);
        y = yRef.value + 2;
        i++;
        continue;
      }

      // Numbered list
      if (/^\d+\.\s+/.test(trimmed)) {
        checkPageBreak(10);
        doc.setFontSize(12);
        doc.setTextColor(26, 26, 26);
        const yRef = { value: y };
        renderWrappedFormattedLine(doc, trimmed, MARGIN_L, yRef, contentW - 8, 7, 12, checkPageBreak);
        y = yRef.value + 2;
        i++;
        continue;
      }

      // Horizontal rule
      if (/^[-=]{3,}$/.test(trimmed)) {
        checkPageBreak(5);
        doc.setDrawColor(200, 200, 200);
        doc.line(MARGIN_L, y, pageW - MARGIN_R, y);
        y += 5;
        i++;
        continue;
      }

      // Regular paragraph with inline formatting
      checkPageBreak(8);
      doc.setTextColor(26, 26, 26);
      const yRef = { value: y };
      renderWrappedFormattedLine(doc, trimmed, MARGIN_L, yRef, contentW, 7, 12, checkPageBreak);
      y = yRef.value + 2;
      i++;
    }

    // Footer note
    if (footerNote) {
      checkPageBreak(18);
      y += 7;
      doc.setDrawColor(CYAN[0], CYAN[1], CYAN[2]);
      doc.line(MARGIN_L, y, pageW - MARGIN_R, y);
      y += 6;
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      const noteLines = doc.splitTextToSize(footerNote, contentW);
      noteLines.forEach((nl: string) => {
        doc.text(nl, MARGIN_L, y);
        y += 4;
      });
    }

    addFooter();

    const typeSlug = docType.toUpperCase();
    const dateSlug = now.toISOString().slice(0, 10).replace(/-/g, '');
    const filename = `JOI_${typeSlug}_${dateSlug}.pdf`;
    doc.save(filename);

    const { toast } = await import('sonner');
    toast.success(`📄 ${filename} exportado com sucesso!`);
  } catch (err) {
    console.error('PDF export error:', err);
    const { toast } = await import('sonner');
    toast.error('Erro ao exportar PDF. Tente novamente.');
  }
}

/** Render a formatted table with dynamic row heights, borders, and zebra striping */
function renderTable(
  doc: jsPDF,
  table: TableBlock,
  startY: number,
  contentW: number,
  marginL: number,
  maxY: number,
  newPage: () => void,
  setY: (y: number) => void,
) {
  let y = startY;
  const colCount = Math.max(table.headers.length, 1);
  const colW = contentW / colCount;
  const cellPadX = 3;
  const cellPadY = 2.5;
  const fontSize = 10;

  const ensureSpace = (needed: number) => {
    if (y + needed > maxY) {
      newPage();
      y = 38;
    }
  };

  /** Calculate dynamic row height based on longest cell text */
  const calcRowHeight = (cells: string[]): number => {
    let maxLines = 1;
    doc.setFontSize(fontSize);
    for (let ci = 0; ci < cells.length && ci < colCount; ci++) {
      const cellText = stripInlineMarkdown(cells[ci] || '');
      const wrapped = doc.splitTextToSize(cellText, colW - cellPadX * 2);
      maxLines = Math.max(maxLines, wrapped.length);
    }
    return maxLines * 4.5 + cellPadY * 2;
  };

  // Header row
  const headerH = calcRowHeight(table.headers);
  ensureSpace(headerH);

  // Top border of entire table
  doc.setDrawColor(200, 200, 200);
  doc.line(marginL, y, marginL + contentW, y);

  doc.setFillColor(DARK[0], DARK[1], DARK[2]);
  doc.rect(marginL, y, contentW, headerH, 'F');

  // Vertical borders for header
  doc.setDrawColor(60, 60, 60);
  for (let ci = 1; ci < colCount; ci++) {
    doc.line(marginL + ci * colW, y, marginL + ci * colW, y + headerH);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(fontSize);
  doc.setTextColor(255, 255, 255);
  table.headers.forEach((header, ci) => {
    const cellText = stripInlineMarkdown(header);
    const wrapped = doc.splitTextToSize(cellText, colW - cellPadX * 2);
    wrapped.forEach((line: string, li: number) => {
      doc.text(line, marginL + ci * colW + cellPadX, y + cellPadY + 3.5 + li * 4.5);
    });
  });
  y += headerH;

  // Data rows with zebra and dynamic heights
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(fontSize);
  table.rows.forEach((row, ri) => {
    const rowH = calcRowHeight(row);
    ensureSpace(rowH);

    // Zebra background
    if (ri % 2 === 0) {
      doc.setFillColor(245, 245, 245);
      doc.rect(marginL, y, contentW, rowH, 'F');
    }

    // Bottom border
    doc.setDrawColor(220, 220, 220);
    doc.line(marginL, y + rowH, marginL + contentW, y + rowH);

    // Vertical borders
    for (let ci = 1; ci < colCount; ci++) {
      doc.line(marginL + ci * colW, y, marginL + ci * colW, y + rowH);
    }

    // Outer borders
    doc.setDrawColor(200, 200, 200);
    doc.line(marginL, y, marginL, y + rowH); // left
    doc.line(marginL + contentW, y, marginL + contentW, y + rowH); // right

    doc.setTextColor(26, 26, 26);
    row.forEach((cell, ci) => {
      if (ci < colCount) {
        const cellText = stripInlineMarkdown(cell);
        const wrapped = doc.splitTextToSize(cellText, colW - cellPadX * 2);
        wrapped.forEach((line: string, li: number) => {
          doc.text(line, marginL + ci * colW + cellPadX, y + cellPadY + 3.5 + li * 4.5);
        });
      }
    });
    y += rowH;
  });

  y += 4;
  setY(y);
}
