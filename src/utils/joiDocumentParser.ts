/**
 * joiDocumentParser — Intelligent extraction of formal document body
 * from Joi assistant conversation markdown.
 * Strips greetings, farewells, conversational context, KMZ blocks,
 * JOI_CMD blocks, attached document blocks, decorative emojis, etc.
 * Returns clean formal content ready for PDF/DOCX export.
 */

export type DocType = 'orcamento' | 'declaracao' | 'contrato' | 'checklist' | 'licitacao' | 'geral';

export function detectDocType(content: string): DocType {
  const lc = content.toLowerCase();
  if (lc.includes('orçamento') || lc.includes('valor total') || lc.includes('custo unitário') || lc.includes('preço total')) return 'orcamento';
  if (lc.includes('declaração') || lc.includes('ofício') || lc.includes('requerimento') || lc.includes('ilmo')) return 'declaracao';
  if (lc.includes('contrato') || lc.includes('cláusula') || lc.includes('contratante') || lc.includes('contratada')) return 'contrato';
  if (lc.includes('checklist') || lc.includes('☐') || lc.includes('[ ]') || lc.includes('[x]')) return 'checklist';
  if (lc.includes('licitação') || lc.includes('edital') || lc.includes('pregão') || lc.includes('habilitação')) return 'licitacao';
  return 'geral';
}

export const DOC_LABELS: Record<DocType, string> = {
  orcamento: 'ORÇAMENTO',
  declaracao: 'DOCUMENTO OFICIAL',
  contrato: 'CONTRATO',
  checklist: 'CHECKLIST',
  licitacao: 'LICITAÇÃO',
  geral: 'DOCUMENTO',
};

const GREETING_PATTERNS = [
  /^(olá|oi|hey|fala|e aí|bom dia|boa tarde|boa noite|salve)/i,
  /^(pronto|aqui está|segue|conforme|como solicitado|preparei|elaborei|montei)/i,
  /^(chefinho|chefe|boss|querido|meu bem)/i,
  /^(claro|com certeza|sem problemas|pode deixar|feito)/i,
  /^(vou preparar|vou elaborar|vou montar|deixa comigo)/i,
  /^(certo|perfeito|beleza|show|maravilha|excelente)/i,
  /^(tá aqui|ta aqui|prontinho|pronta)/i,
];

const FAREWELL_PATTERNS = [
  /^(espero que|qualquer dúvida|fico à disposição|precisa de mais|posso ajudar)/i,
  /^(abraço|até|tchau|beijo|sucesso|boa sorte)/i,
  /^(se precisar|estou aqui|conte comigo|manda ver)/i,
  /^(🎆|🎇|✨|💫|🔥|😊|😉|👍|💪|🚀)/,
  /^(foi um prazer|com carinho|tamo junto)/i,
  /^(me avise|avise-me|qualquer coisa|estou à disposição)/i,
  /^(bom trabalho|bom proveito|boa leitura)/i,
];

// IMPORTANT: Code blocks MUST be stripped BEFORE [DOCUMENTO ANEXADO] to avoid
// the lazy regex consuming partial code block markers
const META_BLOCK_PATTERNS = [
  /```[\s\S]*?```/g,                                    // 1. Code blocks FIRST
  /\[KMZ_READY\][\s\S]*?\[\/KMZ_READY\]/g,             // 2. KMZ blocks
  /\[JOI_CMD\][\s\S]*?\[\/JOI_CMD\]/g,                  // 3. JOI_CMD blocks
  /\[DOCUMENTO ANEXADO:[^\]]*\][\s\S]*?(?=\n\n\n|\n#{1,3}\s|\[(?:KMZ|JOI)|$)/g, // 4. Attached docs - greedy until triple newline, heading, or another block
  /\{[^{}]*"action"\s*:\s*"[^"]*"[^{}]*\}/g,            // 5. Loose JSON JOI_CMD blocks
];

// Decorative emojis to strip (preserve ☐ ☑ ✓ ✗ for checklists)
const DECORATIVE_EMOJI_RE = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1FA00}-\u{1FAFF}]/gu;

// Table separator lines (---|---|---)
const TABLE_SEPARATOR_RE = /^\|?\s*[-:]+(\s*\|\s*[-:]+)+\s*\|?\s*$/;

// Residual backtick lines
const RESIDUAL_BACKTICK_RE = /^`{1,3}\s*$/;

// Residual debug/code strings
const RESIDUAL_STRINGS_RE = /\b(undefined|null|\[object Object\])\b/g;

export interface ParsedLine {
  text: string;
  headingLevel: number; // 0 = not heading, 1-6 = heading level
}

/**
 * Extracts the formal document body from a Joi message,
 * removing conversational fluff, greetings, farewells, and meta blocks.
 * Preserves heading level info for downstream renderers.
 */
export function extractDocumentBody(markdown: string): { body: string; docType: DocType; parsedLines: ParsedLine[] } {
  let cleaned = markdown;

  // Remove meta blocks in correct order (code blocks first!)
  for (const pattern of META_BLOCK_PATTERNS) {
    cleaned = cleaned.replace(pattern, '');
  }

  // Strip decorative emojis (keep checkbox symbols)
  cleaned = cleaned.replace(DECORATIVE_EMOJI_RE, '');

  // Strip residual debug strings
  cleaned = cleaned.replace(RESIDUAL_STRINGS_RE, '');

  // Collapse multiple spaces into one (emoji/string removal residue)
  cleaned = cleaned.replace(/  +/g, ' ');

  // Collapse 3+ consecutive newlines into 2
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

  const rawLines = cleaned.split('\n');

  // Build parsed lines with heading info before stripping markdown
  const parsedLines: ParsedLine[] = [];
  for (const line of rawLines) {
    const trimmed = line.trim();
    // Skip table separators and residual backticks
    if (TABLE_SEPARATOR_RE.test(trimmed) || RESIDUAL_BACKTICK_RE.test(trimmed)) continue;
    // Skip empty lines that are just spaces
    if (!trimmed) { parsedLines.push({ text: '', headingLevel: 0 }); continue; }
    
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)/);
    if (headingMatch) {
      parsedLines.push({ text: headingMatch[2].replace(/\*\*/g, ''), headingLevel: headingMatch[1].length });
    } else {
      parsedLines.push({ text: trimmed, headingLevel: 0 });
    }
  }

  let formalStart = -1;
  let formalEnd = parsedLines.length - 1;

  for (let i = 0; i < parsedLines.length; i++) {
    const { text: trimmed, headingLevel } = parsedLines[i];
    if (!trimmed) continue;

    const isGreeting = GREETING_PATTERNS.some(p => p.test(trimmed));
    if (isGreeting && formalStart === -1) continue;

    if (formalStart === -1) {
      const isStructured =
        headingLevel > 0 ||
        /^\|/.test(trimmed) ||
        /^[-*]\s/.test(trimmed) ||
        /^\d+\.\s/.test(trimmed) ||
        /^[A-ZÁÉÍÓÚÂÊÔÃÕÇÜ]{3,}/.test(trimmed) ||
        /^(de:|para:|ref|assunto|objeto|data):/i.test(trimmed) ||
        /^(cláusula|artigo|parágrafo|item)\s/i.test(trimmed);

      if (isStructured) {
        formalStart = i;
      } else if (trimmed.length > 60) {
        formalStart = i;
      }
      continue;
    }
  }

  if (formalStart === -1) {
    formalStart = 0;
    for (let i = 0; i < Math.min(5, parsedLines.length); i++) {
      if (GREETING_PATTERNS.some(p => p.test(parsedLines[i].text))) {
        formalStart = i + 1;
      }
    }
  }

  for (let i = parsedLines.length - 1; i > formalStart; i--) {
    const trimmed = parsedLines[i].text;
    if (!trimmed) continue;
    if (FAREWELL_PATTERNS.some(p => p.test(trimmed))) {
      formalEnd = i - 1;
    } else {
      break;
    }
  }

  const formalParsed = parsedLines.slice(formalStart, formalEnd + 1);

  while (formalParsed.length > 0 && !formalParsed[formalParsed.length - 1].text) formalParsed.pop();
  while (formalParsed.length > 0 && !formalParsed[0].text) formalParsed.shift();

  const body = formalParsed.map(l => {
    if (l.headingLevel > 0) return '#'.repeat(l.headingLevel) + ' ' + l.text;
    return l.text;
  }).join('\n');

  const docType = detectDocType(body || markdown);

  return { body: body || markdown, docType, parsedLines: formalParsed };
}

/**
 * Returns template-specific footer text for each document type
 */
export function getDocTypeFooterNote(docType: DocType): string | null {
  switch (docType) {
    case 'orcamento':
      return 'Este orçamento é válido por 30 dias a partir da data de emissão, salvo indicação em contrário.';
    case 'declaracao':
      return 'Documento gerado eletronicamente. Dispensa assinatura conforme MP 2.200-2/2001.';
    case 'contrato':
      return 'As partes declaram ter lido e concordado com todas as cláusulas acima.';
    case 'licitacao':
      return 'Proposta elaborada em conformidade com a Lei 14.133/2021 (Nova Lei de Licitações).';
    case 'checklist':
      return 'Checklist de conformidade — Itens não marcados requerem atenção antes da execução.';
    default:
      return null;
  }
}
