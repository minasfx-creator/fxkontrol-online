/**
 * joiPdfExport — Export Joi assistant messages as professional PDF documents
 */
import jsPDF from 'jspdf';

type DocType = 'orcamento' | 'declaracao' | 'contrato' | 'checklist' | 'licitacao' | 'geral';

function detectDocType(content: string): DocType {
  const lc = content.toLowerCase();
  if (lc.includes('orçamento') || lc.includes('valor total') || lc.includes('custo') || lc.includes('preço')) return 'orcamento';
  if (lc.includes('declaração') || lc.includes('ofício') || lc.includes('requerimento') || lc.includes('ilmo')) return 'declaracao';
  if (lc.includes('contrato') || lc.includes('cláusula') || lc.includes('contratante') || lc.includes('contratada')) return 'contrato';
  if (lc.includes('checklist') || lc.includes('☐') || lc.includes('[ ]') || lc.includes('[x]')) return 'checklist';
  if (lc.includes('licitação') || lc.includes('edital') || lc.includes('pregão') || lc.includes('habilitação')) return 'licitacao';
  return 'geral';
}

const DOC_LABELS: Record<DocType, string> = {
  orcamento: 'ORÇAMENTO',
  declaracao: 'DOCUMENTO OFICIAL',
  contrato: 'CONTRATO',
  checklist: 'CHECKLIST',
  licitacao: 'LICITAÇÃO',
  geral: 'DOCUMENTO',
};

// Platform colors in RGB
const CYAN = [0, 180, 216] as const;    // hsl(190 100% 42%)
const AMBER = [217, 164, 6] as const;   // hsl(44 95% 44%)
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
  const docType = detectDocType(markdownContent);
  const label = DOC_LABELS[docType];
  const now = new Date();
  const dateStr = now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginL = 20;
  const marginR = 20;
  const contentW = pageW - marginL - marginR;
  let y = 0;

  const addHeader = () => {
    // Top bar
    doc.setFillColor(DARK[0], DARK[1], DARK[2]);
    doc.rect(0, 0, pageW, 28, 'F');

    // Cyan accent line
    doc.setFillColor(CYAN[0], CYAN[1], CYAN[2]);
    doc.rect(0, 28, pageW, 1, 'F');

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(CYAN[0], CYAN[1], CYAN[2]);
    doc.text('FX KONTROL', marginL, 12);

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(AMBER[0], AMBER[1], AMBER[2]);
    doc.text('Minas Pirotécnica · Show Control Platform', marginL, 18);

    // Doc type badge
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(AMBER[0], AMBER[1], AMBER[2]);
    doc.text(label, pageW - marginR, 12, { align: 'right' });

    // Date
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(150, 150, 150);
    doc.text(`${dateStr} · ${timeStr}`, pageW - marginR, 18, { align: 'right' });

    y = 35;
  };

  const addFooter = (pageNum: number) => {
    doc.setFillColor(DARK[0], DARK[1], DARK[2]);
    doc.rect(0, pageH - 14, pageW, 14, 'F');

    // Cyan line above footer
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

  // Parse content into lines
  const cleanContent = stripMarkdown(markdownContent);
  const lines = cleanContent.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      y += 3;
      continue;
    }

    // Detect section headers (lines that were ## or ### in markdown — now just UPPERCASE or ending with :)
    const isHeader = /^[A-ZÁÉÍÓÚÂÊÔÃÕÇÜ\d\s.]{4,}$/.test(trimmed) || 
                     (trimmed.endsWith(':') && trimmed.length < 60 && !trimmed.startsWith('•'));

    if (isHeader) {
      checkPageBreak(12);
      y += 4;
      doc.setFillColor(CYAN[0], CYAN[1], CYAN[2]);
      doc.rect(marginL, y - 3, 2, 5, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(30, 30, 30);
      doc.text(trimmed, marginL + 5, y);
      y += 8;
      continue;
    }

    // Bullet points
    if (trimmed.startsWith('•')) {
      checkPageBreak(8);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(50, 50, 50);

      const bulletLines = doc.splitTextToSize(trimmed, contentW - 6);
      bulletLines.forEach((bl: string, idx: number) => {
        checkPageBreak(5);
        doc.text(bl, marginL + (idx === 0 ? 0 : 4), y);
        y += 4.5;
      });
      y += 1;
      continue;
    }

    // Table-like lines (contains |)
    if (trimmed.includes('|') && !trimmed.startsWith('---')) {
      checkPageBreak(7);
      const cells = trimmed.split('|').map(c => c.trim()).filter(Boolean);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(40, 40, 40);

      const cellW = contentW / Math.max(cells.length, 1);
      cells.forEach((cell, ci) => {
        doc.text(cell, marginL + ci * cellW, y, { maxWidth: cellW - 2 });
      });
      y += 5;
      continue;
    }

    // Separator lines
    if (/^[-=]{3,}$/.test(trimmed)) {
      checkPageBreak(4);
      doc.setDrawColor(200, 200, 200);
      doc.line(marginL, y, pageW - marginR, y);
      y += 4;
      continue;
    }

    // Regular text
    checkPageBreak(6);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(40, 40, 40);

    const wrapped = doc.splitTextToSize(trimmed, contentW);
    wrapped.forEach((wl: string) => {
      checkPageBreak(5);
      doc.text(wl, marginL, y);
      y += 4.5;
    });
    y += 1;
  }

  // Add footer to last page
  addFooter(doc.getNumberOfPages());

  // Download
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
