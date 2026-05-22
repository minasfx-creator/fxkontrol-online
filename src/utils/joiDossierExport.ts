/**
 * joiDossierExport — Bundle full operational dossier as a single ZIP.
 *
 * Contents:
 *  - venue-plan.pdf          (georeferenced plan: launch points, NFPA rings, beats)
 *  - venue.kmz               (Google Earth / NOTAM-friendly overlay)
 *  - briefing.docx           (Joi-authored narrative, ABNT branded)
 *  - regulatory-checklist.md (Exército + DECEA + Bombeiros + Prefeitura + ANAC)
 *  - README.txt              (manifest + instructions)
 *  - DISCLAIMER.txt          (claim policy, marketing_hypothesis)
 *
 * SAFETY: This is a documentation artifact. Never arms, never fires.
 *         CommandBus / FieldBus / workMode are NOT touched.
 */
import JSZip from 'jszip';
import { Packer } from 'docx';
import type { VenueShowPreset } from '@/lib/showVenuePresets';
import { buildVenuePlanPdf } from './venuePlanPdf';
import { buildVenueKmz } from './venueKmlExport';
import { REGULATORY_CHECKLISTS, type AgencyType, getChecklistForAgency } from './regulatoryChecklist';

export interface JoiDossierOptions {
  /** Optional briefing markdown (Joi narrative). If omitted, a stub is generated. */
  briefingMarkdown?: string;
  /** Subset of agencies; defaults to all five. */
  agencies?: AgencyType[];
  /** Filename prefix; defaults to preset.id. */
  prefix?: string;
}

const DISCLAIMER = [
  'FXKONTROL — Operational Dossier',
  '',
  'CLAIM POLICY: marketing_hypothesis',
  '  Coordinates, headings, calibres and timings in this dossier are',
  '  indicative production references extracted from public layouts and',
  '  Joi-authored design simulations. They are NOT a substitute for:',
  '',
  '    - Current NOTAM / SARPAS authorisation',
  '    - AVCB / CLCB inspection',
  '    - Exército SFPC R-105 conformance',
  '    - ANAC RBAC-E #94 compliance',
  '    - On-site physical survey and NFPA 1123 distance verification',
  '',
  'FXKONTROL never arms or fires from documents. Real-operation',
  'transition (Phase 2) requires hardware-verified handshakes, the',
  'Production Safety Oath and operator hold-to-confirm.',
  '',
  'This artifact is a planning aid only.',
].join('\n');

function briefingStub(preset: VenueShowPreset): string {
  return [
    `# Briefing Operacional — ${preset.name}`,
    '',
    `**Evento:** ${preset.reference.event}${preset.reference.year ? ` (${preset.reference.year})` : ''}`,
    `**Local:** ${preset.reference.location}`,
    `**Escala:** ${preset.reference.scale}`,
    `**Duração:** ${Math.round(preset.durationSec / 60)} min (${preset.durationSec}s)`,
    '',
    '## Descrição',
    preset.description,
    '',
    '## Pontos de Disparo',
    ...preset.venue.launchPoints.map(p =>
      `- **${p.name}** (${p.role}) — ${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}` +
      (p.calibreMaxMm ? ` · calibre máx ${p.calibreMaxMm}mm` : '') +
      (p.heightHintAGL != null ? ` · ${p.heightHintAGL}m AGL` : ''),
    ),
    '',
    '## Beats Narrativos',
    '| t_start | t_end | mood | densidade |',
    '|---:|---:|:---|---:|',
    ...preset.narrativeBeats.map(b =>
      `| ${b.tStart}s | ${b.tEnd}s | ${b.mood} | ${(b.density * 100).toFixed(0)}% |`,
    ),
    '',
    '## Diretrizes Regulatórias',
    'Validar todos os itens dos checklists anexos antes da operação real.',
    '',
    '---',
    '*Documento gerado por Joi · FXKONTROL · claim: marketing_hypothesis*',
  ].join('\n');
}

function checklistToMarkdown(agencies: AgencyType[]): string {
  const lines: string[] = ['# Checklist Regulatório Consolidado', ''];
  for (const agency of agencies) {
    const c = getChecklistForAgency(agency);
    if (!c) continue;
    lines.push(`## ${c.icon} ${c.label}`);
    lines.push(`*${c.fullName}*`, '');
    lines.push('| Status | Item | Categoria | Descrição |');
    lines.push('|:---:|:---|:---|:---|');
    for (const item of c.items) {
      const status = item.required ? '☐ **OBRIG**' : '☐ opc';
      lines.push(`| ${status} | ${item.name} | ${item.category} | ${item.description} |`);
    }
    lines.push('');
  }
  lines.push('---', '*Marque (☑) cada item após validação documental.*');
  return lines.join('\n');
}

function buildReadme(preset: VenueShowPreset, agencies: AgencyType[]): string {
  return [
    `FXKONTROL — Dossiê Operacional`,
    `==============================`,
    ``,
    `Preset: ${preset.name} (${preset.id})`,
    `Gerado em: ${new Date().toISOString()}`,
    ``,
    `Conteúdo do pacote`,
    `------------------`,
    `  venue-plan.pdf          Planta georreferenciada A4 (pontos + NFPA + beats)`,
    `  venue.kmz               Overlay Google Earth / NOTAM`,
    `  briefing.docx           Briefing operacional ABNT (Joi narrative)`,
    `  regulatory-checklist.md Checklists (${agencies.join(', ')})`,
    `  DISCLAIMER.txt          Política de claims e responsabilidades`,
    ``,
    `Workflow sugerido`,
    `-----------------`,
    `  1. Revisar venue-plan.pdf e confirmar pontos no editor 3D.`,
    `  2. Submeter venue.kmz ao SARPAS / coordenação aérea.`,
    `  3. Preencher checklists e anexar PDFs assinados.`,
    `  4. Operação real exige Phase 2 transition no app web (Hold 1.2s).`,
    ``,
  ].join('\n');
}

/** Build the dossier ZIP blob. Pure (no DOM side-effects). */
export async function buildJoiDossier(
  preset: VenueShowPreset,
  options: JoiDossierOptions = {},
): Promise<{ blob: Blob; filename: string }> {
  const agencies: AgencyType[] =
    options.agencies && options.agencies.length > 0
      ? options.agencies
      : (['exercito', 'decea', 'bombeiros', 'prefeitura', 'anac'] as AgencyType[]);

  const zip = new JSZip();

  // 1) PDF
  const pdf = buildVenuePlanPdf(preset);
  const pdfBlob = pdf.output('blob');
  zip.file('venue-plan.pdf', pdfBlob);

  // 2) KMZ
  const kmzBlob = await buildVenueKmz(preset);
  zip.file('venue.kmz', kmzBlob);

  // 3) DOCX briefing — built via exportJoiDocx-style pipeline but in-memory
  const briefingMd = options.briefingMarkdown ?? briefingStub(preset);
  const briefingBlob = await buildBriefingDocx(briefingMd, preset.name);
  zip.file('briefing.docx', briefingBlob);

  // 4) Checklist
  zip.file('regulatory-checklist.md', checklistToMarkdown(agencies));

  // 5) README + DISCLAIMER
  zip.file('README.txt', buildReadme(preset, agencies));
  zip.file('DISCLAIMER.txt', DISCLAIMER);

  const blob = await zip.generateAsync({ type: 'blob' });
  const prefix = options.prefix ?? preset.id;
  const filename = `${prefix}-dossier-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.zip`;
  return { blob, filename };
}

/** Browser-only: triggers download. */
export async function downloadJoiDossier(
  preset: VenueShowPreset,
  options: JoiDossierOptions = {},
): Promise<{ filename: string; bytes: number }> {
  const { blob, filename } = await buildJoiDossier(preset, options);
  if (typeof document !== 'undefined') {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  return { filename, bytes: blob.size };
}

// ─────────────────────────────────────────────────────────────────────
// In-memory DOCX builder reusing the ABNT styling logic. Kept local to
// avoid coupling joiDocxExport's DOM download side-effects.
// ─────────────────────────────────────────────────────────────────────
async function buildBriefingDocx(markdown: string, title: string): Promise<Blob> {
  const docx = await import('docx');
  const {
    Document, Paragraph, TextRun, Header, Footer,
    AlignmentType, HeadingLevel, PageNumber, BorderStyle, LevelFormat,
  } = docx;
  type Para = InstanceType<typeof docx.Paragraph>;

  const MARGIN_L = 1701, MARGIN_T = 1701, MARGIN_R = 1134, MARGIN_B = 1134;

  const lines = markdown.split('\n');
  const children: Paragraph[] = [];
  for (const raw of lines) {
    const t = raw.trim();
    if (!t) { children.push(new Paragraph({ spacing: { after: 120 } })); continue; }
    const h = t.match(/^(#{1,3})\s+(.+)/);
    if (h) {
      const level = h[1].length;
      children.push(new Paragraph({
        heading: level === 1 ? HeadingLevel.HEADING_1 : level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3,
        children: [new TextRun({
          text: h[2].replace(/\*\*/g, ''),
          bold: true, font: 'Arial', color: '1A1A1A',
          size: level === 1 ? 28 : level === 2 ? 26 : 24,
        })],
        spacing: { before: 280, after: 140 },
      }));
      continue;
    }
    const b = t.match(/^[-*•]\s+(.+)/);
    if (b) {
      children.push(new Paragraph({
        numbering: { reference: 'bullets', level: 0 },
        children: [new TextRun({ text: b[1].replace(/\*\*/g, ''), font: 'Arial', size: 24, color: '1A1A1A' })],
        spacing: { after: 80, line: 360 },
      }));
      continue;
    }
    children.push(new Paragraph({
      children: [new TextRun({ text: t.replace(/\*\*/g, ''), font: 'Arial', size: 24, color: '1A1A1A' })],
      spacing: { after: 120, line: 360 },
    }));
  }

  const doc = new Document({
    numbering: {
      config: [{
        reference: 'bullets',
        levels: [{
          level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } },
        }],
      }],
    },
    styles: { default: { document: { run: { font: 'Arial', size: 24 } } } },
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: MARGIN_T, right: MARGIN_R, bottom: MARGIN_B, left: MARGIN_L },
        },
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            alignment: AlignmentType.LEFT,
            border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: '00B4D8', space: 4 } },
            spacing: { after: 200 },
            children: [
              new TextRun({ text: 'FX KONTROL', bold: true, font: 'Arial', size: 16, color: '00B4D8' }),
              new TextRun({ text: '  ·  ', font: 'Arial', size: 14, color: '888888' }),
              new TextRun({ text: title, font: 'Arial', size: 14, color: '1A1A1A', bold: true }),
            ],
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            border: { top: { style: BorderStyle.SINGLE, size: 1, color: '00B4D8', space: 4 } },
            children: [
              new TextRun({ text: 'FX KONTROL · Dossiê Operacional · Página ', font: 'Arial', size: 14, color: '888888' }),
              new TextRun({ children: [PageNumber.CURRENT], font: 'Arial', size: 14, color: '00B4D8' }),
            ],
          })],
        }),
      },
      children,
    }],
  });

  return Packer.toBlob(doc);
}
