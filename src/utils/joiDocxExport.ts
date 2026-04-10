/**
 * joiDocxExport — Export Joi assistant messages as branded DOCX
 * Uses joiDocumentParser to extract formal content only (no conversation)
 * Professional formatting: black headings, 11pt body, proper spacing
 */
import {
  Document, Packer, Paragraph, TextRun, Header, Footer,
  AlignmentType, HeadingLevel, PageNumber, BorderStyle,
  LevelFormat,
} from 'docx';
import { toast } from 'sonner';
import { extractDocumentBody, DOC_LABELS, getDocTypeFooterNote } from './joiDocumentParser';

function parseMarkdownToDocxChildren(markdown: string) {
  const lines = markdown.split('\n');
  const children: Paragraph[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      children.push(new Paragraph({ spacing: { after: 120 } }));
      continue;
    }

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
          size: level === 1 ? 32 : level === 2 ? 28 : 24,
        })],
        spacing: { before: 280, after: 140 },
      }));
      continue;
    }

    const bulletMatch = trimmed.match(/^[-*]\s+(.+)/);
    if (bulletMatch) {
      children.push(new Paragraph({
        numbering: { reference: 'bullets', level: 0 },
        children: parseInlineFormatting(bulletMatch[1]),
        spacing: { after: 80 },
      }));
      continue;
    }

    const numMatch = trimmed.match(/^\d+\.\s+(.+)/);
    if (numMatch) {
      children.push(new Paragraph({
        numbering: { reference: 'numbers', level: 0 },
        children: parseInlineFormatting(numMatch[1]),
        spacing: { after: 80 },
      }));
      continue;
    }

    if (/^---+$/.test(trimmed)) {
      children.push(new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC', space: 1 } },
        spacing: { before: 140, after: 140 },
      }));
      continue;
    }

    children.push(new Paragraph({
      children: parseInlineFormatting(trimmed),
      spacing: { after: 120 },
    }));
  }

  return children;
}

function parseInlineFormatting(text: string): TextRun[] {
  const runs: TextRun[] = [];
  const regex = /\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|([^*`]+)/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match[1]) {
      runs.push(new TextRun({ text: match[1], bold: true, font: 'Arial', size: 22, color: '1A1A1A' }));
    } else if (match[2]) {
      runs.push(new TextRun({ text: match[2], italics: true, font: 'Arial', size: 22, color: '1A1A1A' }));
    } else if (match[3]) {
      runs.push(new TextRun({ text: match[3], font: 'Courier New', size: 20, color: '444444' }));
    } else if (match[4]) {
      runs.push(new TextRun({ text: match[4], font: 'Arial', size: 22, color: '1A1A1A' }));
    }
  }

  return runs.length ? runs : [new TextRun({ text, font: 'Arial', size: 22, color: '1A1A1A' })];
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
        default: { document: { run: { font: 'Arial', size: 22 } } },
      },
      sections: [{
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 1440, right: 1418, bottom: 1440, left: 1418 }, // ~25mm
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

    const buffer = await Packer.toBuffer(doc);
    const blob = new Blob([new Uint8Array(buffer)], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
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
