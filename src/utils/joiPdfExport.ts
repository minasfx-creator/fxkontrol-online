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

    const maxY = pageH - MARGIN_B - 12; // leave room for footer

    const checkPageBreak = (needed: number) => {
      if (y + needed > maxY) {
        addFooter();
        doc.addPage();
        pageNum++;
        addHeader();
      }
    };

    addHeader();

    // Process lines - collect table blocks
    const lines = body.split('\n');
    let i = 0;

    while (i < lines.length) {
      const raw = lines[i];
      const trimmed = raw.trim();

      // Empty line
      if (!trimmed) { y += 4; i++; continue; }

      // Detect table block (consecutive lines starting with |)
      if (trimmed.startsWith('|') && trimmed.includes('|')) {
        const tableLines: string[] = [];
        while (i < lines.length && lines[i].trim().startsWith('|')) {
          const tl = lines[i].trim();
          // Skip separator lines
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

      // Heading detection (markdown ## or UPPERCASE)
      const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)/);
      const headingText = headingMatch ? stripInlineMarkdown(headingMatch[2]) : null;
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
        const bulletText = stripInlineMarkdown(trimmed.replace(/^[-*•]\s+/, ''));
        checkPageBreak(10);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(12);
        doc.setTextColor(26, 26, 26);
        const bulletLines = doc.splitTextToSize('• ' + bulletText, contentW - 8);
        bulletLines.forEach((bl: string, idx: number) => {
          checkPageBreak(7);
          doc.text(bl, MARGIN_L + (idx === 0 ? 0 : 5), y);
          y += 7; // 1.5 line spacing for 12pt
        });
        y += 2;
        i++;
        continue;
      }

      // Numbered list
      if (/^\d+\.\s+/.test(trimmed)) {
        checkPageBreak(10);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(12);
        doc.setTextColor(26, 26, 26);
        const numText = stripInlineMarkdown(trimmed);
        const numLines = doc.splitTextToSize(numText, contentW - 8);
        numLines.forEach((nl: string, idx: number) => {
          checkPageBreak(7);
          doc.text(nl, MARGIN_L + (idx === 0 ? 0 : 5), y);
          y += 7;
        });
        y += 2;
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

      // Regular paragraph - ABNT 12pt, 1.5 spacing (~7mm)
      checkPageBreak(8);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(12);
      doc.setTextColor(26, 26, 26);
      const cleanText = stripInlineMarkdown(trimmed);
      const wrapped = doc.splitTextToSize(cleanText, contentW);
      wrapped.forEach((wl: string) => {
        checkPageBreak(7);
        doc.text(wl, MARGIN_L, y);
        y += 7; // 1.5 line spacing
      });
      y += 2;
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

/** Render a formatted table with headers, borders, and zebra striping */
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
  const cellPadX = 2;
  const cellPadY = 2;
  const rowH = 8;

  const ensureSpace = (needed: number) => {
    if (y + needed > maxY) {
      newPage();
      y = 38; // after header
    }
  };

  // Header row
  ensureSpace(rowH);
  doc.setFillColor(DARK[0], DARK[1], DARK[2]);
  doc.rect(marginL, y - 4, contentW, rowH, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  table.headers.forEach((header, ci) => {
    doc.text(stripInlineMarkdown(header), marginL + ci * colW + cellPadX, y, { maxWidth: colW - cellPadX * 2 });
  });
  y += rowH;

  // Data rows with zebra
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  table.rows.forEach((row, ri) => {
    ensureSpace(rowH);
    // Zebra background
    if (ri % 2 === 0) {
      doc.setFillColor(245, 245, 245);
      doc.rect(marginL, y - 4, contentW, rowH, 'F');
    }
    // Bottom border
    doc.setDrawColor(220, 220, 220);
    doc.line(marginL, y + rowH - 4, marginL + contentW, y + rowH - 4);

    doc.setTextColor(26, 26, 26);
    row.forEach((cell, ci) => {
      if (ci < colCount) {
        doc.text(stripInlineMarkdown(cell), marginL + ci * colW + cellPadX, y, { maxWidth: colW - cellPadX * 2 });
      }
    });
    y += rowH;
  });

  y += 4;
  setY(y);
}
