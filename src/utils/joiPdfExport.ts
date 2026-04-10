/**
 * joiPdfExport — Export Joi assistant messages as professional PDF documents
 * Uses joiDocumentParser to extract formal content only (no conversation)
 * ISO standard formatting: 25mm margins, 11pt body, proper line height
 */
import jsPDF from 'jspdf';
import { extractDocumentBody, DOC_LABELS, getDocTypeFooterNote, type DocType } from './joiDocumentParser';

// Platform colors in RGB
const CYAN = [0, 180, 216] as const;
const AMBER = [217, 164, 6] as const;
const DARK = [18, 20, 28] as const;

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[-*]\s+/gm, '• ')
    .replace(/^\d+\.\s+/gm, (m) => m)
    .replace(/\[(.+?)\]\(.+?\)/g, '$1');
}

export async function exportJoiPdf(markdownContent: string): Promise<void> {
  try {
    const { body, docType } = extractDocumentBody(markdownContent);
    const label = DOC_LABELS[docType];
    const footerNote = getDocTypeFooterNote(docType);
    const now = new Date();
    const dateStr = now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const marginL = 25; // ISO standard
    const marginR = 25;
    const contentW = pageW - marginL - marginR;
    let y = 0;

    const addHeader = () => {
      doc.setFillColor(DARK[0], DARK[1], DARK[2]);
      doc.rect(0, 0, pageW, 28, 'F');
      doc.setFillColor(CYAN[0], CYAN[1], CYAN[2]);
      doc.rect(0, 28, pageW, 1, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(CYAN[0], CYAN[1], CYAN[2]);
      doc.text('FX KONTROL', marginL, 12);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(AMBER[0], AMBER[1], AMBER[2]);
      doc.text('Minas Pirotécnica · Show Control Platform', marginL, 18);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(AMBER[0], AMBER[1], AMBER[2]);
      doc.text(label, pageW - marginR, 12, { align: 'right' });
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(150, 150, 150);
      doc.text(`${dateStr} · ${timeStr}`, pageW - marginR, 18, { align: 'right' });
      y = 36;
    };

    const addFooter = (pageNum: number) => {
      doc.setFillColor(DARK[0], DARK[1], DARK[2]);
      doc.rect(0, pageH - 14, pageW, 14, 'F');
      doc.setFillColor(CYAN[0], CYAN[1], CYAN[2]);
      doc.rect(0, pageH - 14, pageW, 0.5, 'F');
      doc.setFontSize(6);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(CYAN[0], CYAN[1], CYAN[2]);
      doc.text('Gerado por JOI · Secretária Executiva AI · FX KONTROL', marginL, pageH - 5);
      doc.setTextColor(150, 150, 150);
      doc.text(`Página ${pageNum}`, pageW - marginR, pageH - 5, { align: 'right' });
    };

    const checkPageBreak = (needed: number) => {
      if (y + needed > pageH - 20) {
        addFooter(doc.getNumberOfPages());
        doc.addPage();
        addHeader();
      }
    };

    addHeader();

    const cleanContent = stripMarkdown(body);
    const lines = cleanContent.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) { y += 4; continue; }

      const isHeader = /^[A-ZÁÉÍÓÚÂÊÔÃÕÇÜ\d\s.]{4,}$/.test(trimmed) ||
        (trimmed.endsWith(':') && trimmed.length < 60 && !trimmed.startsWith('•'));

      if (isHeader) {
        checkPageBreak(14);
        y += 5;
        doc.setFillColor(CYAN[0], CYAN[1], CYAN[2]);
        doc.rect(marginL, y - 3.5, 2, 6, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.setTextColor(26, 26, 26);
        doc.text(trimmed, marginL + 6, y);
        y += 9;
        continue;
      }

      if (trimmed.startsWith('•')) {
        checkPageBreak(10);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
        doc.setTextColor(26, 26, 26);
        const bulletLines = doc.splitTextToSize(trimmed, contentW - 8);
        bulletLines.forEach((bl: string, idx: number) => {
          checkPageBreak(6);
          doc.text(bl, marginL + (idx === 0 ? 0 : 5), y);
          y += 5.5;
        });
        y += 1.5;
        continue;
      }

      if (trimmed.includes('|') && !trimmed.startsWith('---')) {
        checkPageBreak(8);
        const cells = trimmed.split('|').map(c => c.trim()).filter(Boolean);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(26, 26, 26);
        const cellW = contentW / Math.max(cells.length, 1);
        cells.forEach((cell, ci) => {
          doc.text(cell, marginL + ci * cellW, y, { maxWidth: cellW - 3 });
        });
        y += 6;
        continue;
      }

      if (/^[-=]{3,}$/.test(trimmed)) {
        checkPageBreak(5);
        doc.setDrawColor(200, 200, 200);
        doc.line(marginL, y, pageW - marginR, y);
        y += 5;
        continue;
      }

      checkPageBreak(7);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(26, 26, 26);
      const wrapped = doc.splitTextToSize(trimmed, contentW);
      wrapped.forEach((wl: string) => {
        checkPageBreak(6);
        doc.text(wl, marginL, y);
        y += 5.5;
      });
      y += 1.5;
    }

    if (footerNote) {
      checkPageBreak(18);
      y += 7;
      doc.setDrawColor(CYAN[0], CYAN[1], CYAN[2]);
      doc.line(marginL, y, pageW - marginR, y);
      y += 6;
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      const noteLines = doc.splitTextToSize(footerNote, contentW);
      noteLines.forEach((nl: string) => {
        doc.text(nl, marginL, y);
        y += 4;
      });
    }

    addFooter(doc.getNumberOfPages());

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
