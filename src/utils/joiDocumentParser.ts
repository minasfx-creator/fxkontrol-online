/**
 * joiDocumentParser — Intelligent extraction of formal document body
 * from Joi assistant conversation markdown.
 * Strips greetings, farewells, conversational context, KMZ blocks, etc.
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

// Patterns that indicate conversational (non-document) content
const GREETING_PATTERNS = [
  /^(olá|oi|hey|fala|e aí|bom dia|boa tarde|boa noite|salve)/i,
  /^(pronto|aqui está|segue|conforme|como solicitado|preparei|elaborei|montei)/i,
  /^(chefinho|chefe|boss|querido|meu bem)/i,
  /^(claro|com certeza|sem problemas|pode deixar|feito)/i,
  /^(vou preparar|vou elaborar|vou montar|deixa comigo)/i,
];

const FAREWELL_PATTERNS = [
  /^(espero que|qualquer dúvida|fico à disposição|precisa de mais|posso ajudar)/i,
  /^(abraço|até|tchau|beijo|sucesso|boa sorte)/i,
  /^(se precisar|estou aqui|conte comigo|manda ver)/i,
  /^(🎆|🎇|✨|💫|🔥|😊|😉|👍|💪|🚀)/,
  /^(foi um prazer|com carinho|tamo junto)/i,
];

const META_BLOCK_PATTERNS = [
  /\[KMZ_READY\][\s\S]*?\[\/KMZ_READY\]/g,
  /```[\s\S]*?```/g,
];

/**
 * Extracts the formal document body from a Joi message,
 * removing conversational fluff, greetings, farewells, and meta blocks.
 */
export function extractDocumentBody(markdown: string): { body: string; docType: DocType } {
  let cleaned = markdown;

  // Remove meta blocks (KMZ, code blocks)
  for (const pattern of META_BLOCK_PATTERNS) {
    cleaned = cleaned.replace(pattern, '');
  }

  const lines = cleaned.split('\n');
  
  // Find the start of formal content (first heading, table, or structured block)
  let formalStart = -1;
  let formalEnd = lines.length - 1;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) continue;

    // Check if it's a greeting/conversational line
    const isGreeting = GREETING_PATTERNS.some(p => p.test(trimmed));
    if (isGreeting && formalStart === -1) continue;

    // First heading or structured content marks formal start
    if (formalStart === -1) {
      const isStructured = 
        /^#{1,6}\s/.test(trimmed) ||          // Heading
        /^\|/.test(trimmed) ||                 // Table
        /^[-*]\s/.test(trimmed) ||             // Bullet
        /^\d+\.\s/.test(trimmed) ||            // Numbered list
        /^[A-ZÁÉÍÓÚÂÊÔÃÕÇÜ]{3,}/.test(trimmed) || // ALL CAPS title
        /^(de:|para:|ref|assunto|objeto|data):/i.test(trimmed) || // Document headers
        /^(cláusula|artigo|parágrafo|item)\s/i.test(trimmed); // Legal terms
      
      if (isStructured) {
        formalStart = i;
      } else if (trimmed.length > 60) {
        // Long paragraph likely is document content
        formalStart = i;
      }
      continue;
    }
  }

  // If no formal start found, use everything after removing first greeting line
  if (formalStart === -1) {
    formalStart = 0;
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const trimmed = lines[i].trim();
      if (GREETING_PATTERNS.some(p => p.test(trimmed))) {
        formalStart = i + 1;
      }
    }
  }

  // Find end of formal content (trim farewell lines from the bottom)
  for (let i = lines.length - 1; i > formalStart; i--) {
    const trimmed = lines[i].trim();
    if (!trimmed) continue;
    
    const isFarewell = FAREWELL_PATTERNS.some(p => p.test(trimmed));
    if (isFarewell) {
      formalEnd = i - 1;
    } else {
      break; // Stop at first non-farewell non-empty line from bottom
    }
  }

  const formalLines = lines.slice(formalStart, formalEnd + 1);
  
  // Clean trailing empty lines
  while (formalLines.length > 0 && !formalLines[formalLines.length - 1].trim()) {
    formalLines.pop();
  }
  while (formalLines.length > 0 && !formalLines[0].trim()) {
    formalLines.shift();
  }

  const body = formalLines.join('\n');
  const docType = detectDocType(body || markdown);

  return { body: body || markdown, docType };
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
