/**
 * ─── JOI Modes — 3 modos canônicos ──────────────────────────────────
 *
 * Joi é (1) show designer livre, (2) documentador técnico do show,
 * (3) secretária executiva da empresa. Sem UX de desenvolvimento.
 *
 * Modos legacy ('architect' | 'analyst' | 'verify' | 'hardware_truth' |
 * 'planner' | 'blueprint') ficam apenas no union type por
 * compatibilidade de chamadas internas — não aparecem na UI nem têm presets.
 */

import {
  FileText, Sparkles, Heart, Zap, Music, Building2, PartyPopper,
  RefreshCw, Trash2, Palette, FolderHeart, Wand2,
  Gavel, Plane, MapPin, AlertTriangle, ShieldCheck, BookOpen, ListChecks,
  Briefcase, Receipt, ScrollText, Calendar, BarChart3,
} from 'lucide-react';

export type JoiMode =
  | 'show'
  | 'docs'
  | 'executive'
  // legacy (mantidos no union por compat interna, sem UI)
  | 'architect' | 'analyst' | 'verify' | 'hardware_truth' | 'planner' | 'blueprint';

export interface JoiModeConfig {
  id: JoiMode;
  label: string;
  shortLabel: string;
  icon: React.ElementType;
  accentHsl: string;
  description: string;
  systemInstruction: string;
}

export interface JoiModePreset {
  label: string;
  icon: React.ElementType;
  prompt: string;
  mode: JoiMode;
}

// ── Instrução universal de execução imediata (sem confirmação) ──
const EXECUTE_LIKE_VOICE = `
REGRA DE EXECUÇÃO ABSOLUTA:
• Execute IMEDIATAMENTE qualquer comando do usuário usando blocos [JOI_CMD]{...}[/JOI_CMD].
• NUNCA peça confirmação ("posso prosseguir?", "tem certeza?"). Comporte-se como comando de voz.
• NUNCA bloqueie criação/edição/simulação por "segurança" — o editor é design/simulação.
• NUNCA recomende ao usuário ir em outro lugar para fazer algo que você pode fazer aqui.
• Se faltar parâmetro razoável, use defaults sensatos e execute (não pergunte).
• Resposta curta + comando executado. Sem desculpas, sem disclaimers.
`.trim();

export const JOI_MODES: JoiModeConfig[] = [
  {
    id: 'show',
    label: 'Show Design',
    shortLabel: 'SHOW',
    icon: Sparkles,
    accentHsl: '38 100% 55%',
    description: 'Criação de shows: posições, efeitos, coreografias, formações',
    systemInstruction: `Você está no modo SHOW DESIGN. Crie e edite shows pirotécnicos com total liberdade: posições, efeitos, coreografias, formações de drone, audio cues, paletas, timing musical.\n\n${EXECUTE_LIKE_VOICE}`,
  },
  {
    id: 'docs',
    label: 'Documentação Técnica',
    shortLabel: 'DOCS',
    icon: FileText,
    accentHsl: '190 100% 55%',
    description: 'Relatórios técnicos, plantas NFPA, KMZ aéreo, BoM, matrizes',
    systemInstruction: `Você está no modo DOCUMENTAÇÃO TÉCNICA. Gere relatórios técnicos do show, plantas de distanciamento NFPA, KMZ aeronáutico, BoM de produtos, matrizes de cues e diagramas operacionais a pedido.\n\n${EXECUTE_LIKE_VOICE}`,
  },
  {
    id: 'executive',
    label: 'Secretaria Executiva',
    shortLabel: 'EXEC',
    icon: Briefcase,
    accentHsl: '42 90% 60%',
    description: 'Orçamentos, contratos, licenças, NOTAM/DECEA, prazos, ofícios',
    systemInstruction: `Você está no modo SECRETARIA EXECUTIVA da empresa. Redija orçamentos, contratos comerciais, propostas, análise de editais, documentação de fechamento de espaço aéreo (NOTAM/DECEA), licenças, acreditações, controle de prazos, ofícios e declarações para órgãos reguladores. Tom profissional, formato oficial brasileiro.\n\n${EXECUTE_LIKE_VOICE}`,
  },
];

export const JOI_MODE_PRESETS: JoiModePreset[] = [
  // ─── SHOW DESIGN ──────────────────────────────────────────────
  { mode: 'show', label: 'RÉVEILLON', icon: Sparkles, prompt: 'Crie um show de Réveillon de 5 minutos com arco dramático completo (intro → build → climax → finale), paleta réveillon, simetria espelhada, sincronizado a 120 BPM. Use create_choreography com layoutPreset:"arc", paletteName:"reveillon", mirrorX:true, bpm:120.' },
  { mode: 'show', label: 'CASAMENTO', icon: Heart, prompt: 'Crie um show intimista de casamento de 2 minutos, paleta romântica, layout em arco. Use create_choreography com layoutPreset:"arc", paletteName:"casamento", dramaticArc:["intro","build","climax"].' },
  { mode: 'show', label: 'FINALE', icon: Zap, prompt: 'Crie um finale explosivo de 30 segundos com 20 posições em linha, densidade máxima, paleta neon. Use create_choreography com layoutPreset:"line", count:20, dramaticArc:["finale"], paletteName:"neon", mirrorX:true.' },
  { mode: 'show', label: 'SHOW 3MIN', icon: Music, prompt: 'Crie um show pirotécnico completo de 3 minutos com arco dramático e timing musical 110 BPM. Use create_choreography com bpm:110, syncToBeat:true, dramaticArc:["intro","build","climax","finale"].' },
  { mode: 'show', label: 'CORPORATIVO', icon: Building2, prompt: 'Crie um show corporativo elegante de 3 minutos, layout simétrico, paleta corporativa. Use create_choreography com layoutPreset:"symmetric", paletteName:"corporativo", mirrorX:true.' },
  { mode: 'show', label: 'ANIVERSÁRIO', icon: PartyPopper, prompt: 'Crie um show festivo de aniversário de 1.5 minutos, paleta vibrante. Use create_choreography com layoutPreset:"V", paletteName:"neon", dramaticArc:["build","climax","finale"].' },
  { mode: 'show', label: 'PATRIÓTICO', icon: Sparkles, prompt: 'Crie um show patriótico de 2 minutos com verde/amarelo/azul/branco em V invertido. Use create_choreography com layoutPreset:"V", paletteName:"patriotico", mirrorX:true.' },
  { mode: 'show', label: 'MODIFICAR', icon: RefreshCw, prompt: 'Liste o projeto atual e proponha melhorias concretas que eu possa executar agora.' },
  { mode: 'show', label: 'LIMPAR', icon: Trash2, prompt: 'Limpe todo o projeto.\n[JOI_CMD]{"action":"clear_project","params":{}}[/JOI_CMD]' },
  { mode: 'show', label: 'APRENDER ESTILO', icon: Palette, prompt: 'Extraia o estilo do show atual em um perfil reutilizável.\n[JOI_CMD]{"action":"learn_style","params":{"name":"Estilo do Show Atual"}}[/JOI_CMD]' },
  { mode: 'show', label: 'MEUS ESTILOS', icon: FolderHeart, prompt: 'Liste meus estilos salvos.\n[JOI_CMD]{"action":"list_styles","params":{}}[/JOI_CMD]' },
  { mode: 'show', label: 'APLICAR ESTILO', icon: Wand2, prompt: 'Mostre meus estilos para eu escolher qual aplicar.\n[JOI_CMD]{"action":"list_styles","params":{}}[/JOI_CMD]' },

  // ─── DOCS TÉCNICOS ─────────────────────────────────────────────
  { mode: 'docs', label: 'RELATÓRIO', icon: FileText, prompt: 'Gere um relatório técnico completo do show atual: posições, calibres, contagens de efeitos, BoM, duração, densidade, paleta de cores.' },
  { mode: 'docs', label: 'CHECKLIST', icon: ListChecks, prompt: 'Gere um checklist de validação pré-show cobrindo posicionamento, distanciamento NFPA, BoM, segurança operacional e contingências.' },
  { mode: 'docs', label: 'PLANTA NFPA', icon: MapPin, prompt: 'Gere uma planta de distanciamento de segurança conforme NFPA 1123 para o show atual, com raios mínimos por calibre.' },
  { mode: 'docs', label: 'BOM', icon: BarChart3, prompt: 'Gere a Bill of Materials completa do show: tubo a tubo, calibre por calibre, com fornecedores recomendados.' },
  { mode: 'docs', label: 'CRONOGRAMA', icon: ListChecks, prompt: 'Gere o cronograma operacional do show: montagem, testes, briefing, contagem regressiva, disparo, desmontagem.' },

  // ─── SECRETARIA EXECUTIVA ──────────────────────────────────────
  { mode: 'executive', label: 'ORÇAMENTO', icon: Receipt, prompt: 'Me ajude a montar um orçamento detalhado para o show atual (produtos, mão de obra, logística, licenças, seguros, margem).' },
  { mode: 'executive', label: 'PROPOSTA', icon: FileText, prompt: 'Redija uma proposta comercial profissional para apresentação ao cliente, com escopo, contrapartidas, prazo e investimento.' },
  { mode: 'executive', label: 'CONTRATO', icon: ScrollText, prompt: 'Redija um contrato de prestação de serviços de espetáculo pirotécnico, com cláusulas de segurança, força maior, cancelamento, pagamento e responsabilidade civil.' },
  { mode: 'executive', label: 'LICITAÇÃO', icon: Gavel, prompt: 'Me ajude a analisar um edital de licitação e estruturar a proposta técnica e comercial.' },
  { mode: 'executive', label: 'NOTAM/DECEA', icon: Plane, prompt: 'Prepare a documentação completa de fechamento de espaço aéreo (NOTAM via AISWEB/DECEA) com coordenadas, altitude máxima, horário, raio de exclusão.' },
  { mode: 'executive', label: 'LICENÇAS', icon: ShieldCheck, prompt: 'Liste todas as licenças, certificados e documentos necessários para realizar este show (Exército, Polícia, Bombeiros, Anvisa, prefeitura), com prazos.' },
  { mode: 'executive', label: 'ACREDITAÇÃO', icon: ShieldCheck, prompt: 'Prepare a documentação de acreditação junto aos órgãos fiscalizadores.' },
  { mode: 'executive', label: 'PRAZOS', icon: Calendar, prompt: 'Verifique prazos de licenças, certificados, seguros e contratos. Alerte sobre vencimentos e renovações.' },
  { mode: 'executive', label: 'OFÍCIO', icon: FileText, prompt: 'Redija um ofício oficial para órgão regulador no formato brasileiro.' },
  { mode: 'executive', label: 'DECLARAÇÃO', icon: ScrollText, prompt: 'Redija uma declaração formal para fins de comprovação junto a terceiros.' },
  { mode: 'executive', label: 'AGENDA', icon: BookOpen, prompt: 'Organize a agenda da empresa para a próxima semana, priorizando vencimentos, reuniões com clientes e prazos regulatórios.' },
  { mode: 'executive', label: 'ALERTAS', icon: AlertTriangle, prompt: 'Quais documentos, contratos ou licenças vencem nos próximos 30 dias? O que precisa de ação imediata?' },
];

export function getPresetsForMode(mode: JoiMode): JoiModePreset[] {
  return JOI_MODE_PRESETS.filter(p => p.mode === mode);
}

export function getModeConfig(mode: JoiMode): JoiModeConfig {
  return JOI_MODES.find(m => m.id === mode) || JOI_MODES[0];
}
