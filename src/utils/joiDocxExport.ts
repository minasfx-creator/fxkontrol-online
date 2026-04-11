/**
 * joiDocxExport — Export Joi assistant messages as branded DOCX
 * ABNT NBR 14724: 3cm left/top, 2cm right/bottom, 12pt Arial, 1.5 line spacing
 */
import {
  Document, Packer, Paragraph, TextRun, Header, Footer,
  AlignmentType, HeadingLevel, PageNumber, BorderStyle,
  LevelFormat, Table, TableRow, TableCell, WidthType, ShadingType,
} from 'docx';
import { toast } from 'sonner';
import { extractDocumentBody, DOC_LABELS, getDocTypeFooterNote } from './joiDocumentParser';

// ABNT margins in DXA (1 inch = 1440 DXA, 1cm ≈ 567 DXA)
const MARGIN_L = 1701; // 3cm
const MARGIN_T = 1701; // 3cm
const MARGIN_R = 1134; // 2cm
const MARGIN_B = 1134; // 2cm
const CONTENT_W = 11906 - MARGIN_L - MARGIN_R; // A4 width minus margins

function parseInlineFormatting(text: string): TextRun[] {
  const runs: TextRun[] = [];
  const regex = /\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|([^*`]+)/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match[1]) {
      runs.push(new TextRun({ text: match[1], bold: true, font: 'Arial', size: 24, color: '1A1A1A' }));
    } else if (match[2]) {
      runs.push(new TextRun({ text: match[2], italics: true, font: 'Arial', size: 24, color: '1A1A1A' }));
    } else if (match[3]) {
      runs.push(new TextRun({ text: match[3], font: 'Courier New', size: 22, color: '444444' }));
    } else if (match[4]) {
      runs.push(new TextRun({ text: match[4], font: 'Arial', size: 24, color: '1A1A1A' }));
    }
  }

  return runs.length ? runs : [new TextRun({ text, font: 'Arial', size: 24, color: '1A1A1A' })];
}

interface TableBlock {
  headers: string[];
  rows: string[][];
}

function parseMarkdownTable(lines: string[]): TableBlock {
  const headers = lines[0].split('|').map(c => c.trim()).filter(Boolean);
  const rows: string[][] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split('|').map(c => c.trim()).filter(Boolean);
    if (cells.length > 0) rows.push(cells);
  }
  return { headers, rows };
}

function buildDocxTable(table: TableBlock): Table {
  const colCount = Math.max(table.headers.length, 1);
  const colW = Math.floor(CONTENT_W / colCount);
  const cellBorder = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' };
  const borders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };

  const headerRow = new TableRow({
    children: table.headers.map(h =>
      new TableCell({
        borders,
        width: { size: colW, type: WidthType.DXA },
        shading: { fill: '12141C', type: ShadingType.CLEAR },
        margins: { top: 60, bottom: 60, left: 80, right: 80 },
        children: [new Paragraph({
          children: [new TextRun({ text: h.replace(/\*\*/g, ''), bold: true, font: 'Arial', size: 20, color: 'FFFFFF' })],
        })],
      })
    ),
  });

  const dataRows = table.rows.map((row, ri) =>
    new TableRow({
      children: Array.from({ length: colCount }, (_, ci) =>
        new TableCell({
          borders,
          width: { size: colW, type: WidthType.DXA },
          shading: ri % 2 === 0 ? { fill: 'F5F5F5', type: ShadingType.CLEAR } : undefined,
          margins: { top: 40, bottom: 40, left: 80, right: 80 },
          children: [new Paragraph({
            children: parseInlineFormatting(row[ci] || ''),
          })],
        })
      ),
    })
  );

  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: Array(colCount).fill(colW),
    rows: [headerRow, ...dataRows],
  });
}

function parseMarkdownToDocxChildren(markdown: string) {
  const lines = markdown.split('\n');
  const children: (Paragraph | Table)[] = [];
  const separatorRe = /^\|?\s*[-:]+(\s*\|\s*[-:]+)+\s*\|?\s*$/;
  let i = 0;

  while (i < lines.length) {
    const trimmed = lines[i].trim();

    if (!trimmed) {
      children.push(new Paragraph({ spacing: { after: 120 } }));
      i++;
      continue;
    }

    // Table block detection
    if (trimmed.startsWith('|') && trimmed.includes('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        const tl = lines[i].trim();
        if (!separatorRe.test(tl)) tableLines.push(tl);
        i++;
      }
      if (tableLines.length > 0) {
        children.push(new Paragraph({ spacing: { before: 120 } }));
        children.push(buildDocxTable(parseMarkdownTable(tableLines)));
        children.push(new Paragraph({ spacing: { after: 120 } }));
      }
      continue;
    }

    // Headings
    const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2].replace(/\*\*/g, '');
      children.push(new Paragraph({
        heading: level === 1 ? HeadingLevel.HEADING_1 : level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3,
        children: [new TextRun({
          text,
          bold: true,
          font: 'Arial',
          color: '1A1A1A',
          size: level === 1 ? 28 : level === 2 ? 26 : 24,
        })],
        spacing: { before: 280, after: 140 },
      }));
      i++;
      continue;
    }

    // Bullets
    const bulletMatch = trimmed.match(/^[-*•]\s+(.+)/);
    if (bulletMatch) {
      children.push(new Paragraph({
        numbering: { reference: 'bullets', level: 0 },
        children: parseInlineFormatting(bulletMatch[1]),
        spacing: { after: 80, line: 360 },
      }));
      i++;
      continue;
    }

    // Numbered list
    const numMatch = trimmed.match(/^\d+\.\s+(.+)/);
    if (numMatch) {
      children.push(new Paragraph({
        numbering: { reference: 'numbers', level: 0 },
        children: parseInlineFormatting(numMatch[1]),
        spacing: { after: 80, line: 360 },
      }));
      i++;
      continue;
    }

    // Horizontal rule
    if (/^---+$/.test(trimmed)) {
      children.push(new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC', space: 1 } },
        spacing: { before: 140, after: 140 },
      }));
      i++;
      continue;
    }

    // Regular paragraph - ABNT 12pt, 1.5 spacing
    children.push(new Paragraph({
      children: parseInlineFormatting(trimmed),
      spacing: { after: 120, line: 360 },
    }));
    i++;
  }

  return children;
}

export async function exportJoiDocx(markdown: string) {
  try {
    const { body, docType } = extractDocumentBody(markdown);
    const label = DOC_LABELS[docType];
    const footerNote = getDocTypeFooterNote(docType);
    const now = new Date();
    const dateStr = now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const fileDate = now.toISOString().slice(0, 10).replace(/-/g, '');

    const sectionChildren = parseMarkdownToDocxChildren(body);

    if (footerNote) {
      sectionChildren.push(new Paragraph({
        border: { top: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC', space: 4 } },
        spacing: { before: 300, after: 60 },
        children: [new TextRun({ text: footerNote, italics: true, font: 'Arial', size: 18, color: '888888' })],
      }));
    }

    const doc = new Document({
      numbering: {
        config: [
          {
            reference: 'bullets',
            levels: [{
              level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 720, hanging: 360 } } },
            }],
          },
          {
            reference: 'numbers',
            levels: [{
              level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 720, hanging: 360 } } },
            }],
          },
        ],
      },
      styles: {
        default: { document: { run: { font: 'Arial', size: 24 } } },
      },
      sections: [{
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: MARGIN_T, right: MARGIN_R, bottom: MARGIN_B, left: MARGIN_L },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.LEFT,
                border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: '00B4D8', space: 4 } },
                spacing: { after: 200 },
                children: [
                  new TextRun({ text: 'FX KONTROL', bold: true, font: 'Arial', size: 16, color: '00B4D8' }),
                  new TextRun({ text: '  ·  ', font: 'Arial', size: 14, color: '888888' }),
                  new TextRun({ text: label, font: 'Arial', size: 14, color: '1A1A1A', bold: true }),
                  new TextRun({ text: `  ·  ${dateStr}`, font: 'Arial', size: 14, color: '888888' }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                border: { top: { style: BorderStyle.SINGLE, size: 1, color: '00B4D8', space: 4 } },
                children: [
                  new TextRun({ text: 'FX KONTROL · Minas Pirotécnica · Página ', font: 'Arial', size: 14, color: '888888' }),
                  new TextRun({ children: [PageNumber.CURRENT], font: 'Arial', size: 14, color: '00B4D8' }),
                ],
              }),
            ],
          }),
        },
        children: sectionChildren,
      }],
    });

    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `JOI_${docType.toUpperCase()}_${fileDate}.docx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success('📄 DOCX exportado com sucesso!');
  } catch (err) {
    console.error('DOCX export error:', err);
    toast.error('Erro ao exportar DOCX. Tente novamente.');
  }
}
