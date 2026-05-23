/**
 * ─── JOI Modes — Intelligence Mode Definitions ─────────────────────
 * Defines JOI's 6 operational modes with presets, colors, and prompts.
 */

import {
  Cpu, BarChart3, ShieldCheck, ListChecks, PenTool, FileText,
  Sparkles, Search, AlertTriangle, Target, Network, BookOpen,
  Heart, Zap, Music, Building2, PartyPopper, RefreshCw, Trash2,
  Radio, Eye, Wifi, Clock, Palette, FolderHeart, Wand2,
  Gavel, Plane, MapPin, Activity,
} from 'lucide-react';

export type JoiMode = 'architect' | 'analyst' | 'verify' | 'hardware_truth' | 'planner' | 'blueprint' | 'docs' | 'show';

export interface JoiModeConfig {
  id: JoiMode;
  label: string;
  shortLabel: string;
  icon: React.ElementType;
  accentHsl: string; // HSL values for accent
  description: string;
  systemInstruction: string;
}

export interface JoiModePreset {
  label: string;
  icon: React.ElementType;
  prompt: string;
  mode: JoiMode;
}

export const JOI_MODES: JoiModeConfig[] = [
  {
    id: 'show',
    label: 'Show Design',
    shortLabel: 'SHOW',
    icon: Sparkles,
    accentHsl: '38 100% 55%',
    description: 'Criação de shows: posições, efeitos, coreografias',
    systemInstruction: `Você está no modo SHOW DESIGN. Crie shows pirotécnicos e de drones com qualidade de show real.

PADRÕES DE SHOWS REAIS (extraídos de Sydney, Azteca, Eiffel, Taj Mahal, Busan):
- PONTES (ex: Sydney): 29 posições em arco, espaçamento ~25m. Abre com StrobePots simultâneos em todas as posições (t=0.4s, 55s de duração), depois cometas em cascata, fogos 3" a 8".
- ESTÁDIOS (ex: Azteca): Layout radial periférico, 16–32 posições em anel. Alternância vermelho/branco/nacional, finais com 5" peônias simultâneas em grupo.
- MONUMENTOS (ex: Eiffel, Taj Mahal): Posições frontais simétricas em camadas (base, meio, topo). Cascata de baixo para cima, finale com obus de 8" em volley.
- SHOWS GENÉRICOS: Mínimo 5 posições, máximo 30. Duração real: introdução (0-15%), desenvolvimento (15-70%), finale (70-90%), apoteose (90-100%).

REGRAS DE COREOGRAFIA PROFISSIONAL:
1. Nunca use menos de 5 posições para shows acima de 2 minutos
2. Efeitos simultâneos em todas as posições = "volley" — use para transições marcantes
3. Cascata (posições disparadas sequencialmente com 0.2–0.5s de offset) = movimento/ondulação
4. Duração de efeitos: mines/gerbs 3–10s, peônias/crisântemos 4–8s, waterfall 10–60s, strobe pots 30–120s
5. Intensidade dramática: densidade de efeitos aumenta ao longo do show (1 efeito/5s no início → 5 efeitos/s no finale)
6. Calibres reais: 3" (75mm) para efeitos de recheio, 5" (125mm) padrão, 8" (200mm) para momentos-chave, 12" (300mm) apenas no grand finale
7. Drones: formações em círculo, linha, grade, forma livre. Alturas 30–120m. Cores LED sincronizadas com paleta do show.

Use create_choreography para gerar shows completos. Sempre inclua: posições + cues + sections (marcadores de seção).`,
  },
  {
    id: 'architect',
    label: 'Architect',
    shortLabel: 'ARCH',
    icon: Cpu,
    accentHsl: '270 80% 60%',
    description: 'Projeto de módulos, hierarquias, interfaces',
    systemInstruction: 'Você está no modo ARCHITECT. Foque em design de sistemas, módulos, interfaces e contratos. Proponha arquiteturas, reorganize hierarquias e escolha as melhores abstrações. Gere diagramas Mermaid quando útil.',
  },
  {
    id: 'analyst',
    label: 'Analyst',
    shortLabel: 'ANALYST',
    icon: BarChart3,
    accentHsl: '190 100% 50%',
    description: 'Análise de estado, gaps, inconsistências',
    systemInstruction: 'Você está no modo ANALYST. Analise o estado atual do sistema usando o contexto injetado. Identifique inconsistências, gaps, e produza análises comparativas. Use inspect_showplan, check_readiness e inspect_hardware para dados atualizados.',
  },
  {
    id: 'verify',
    label: 'Verification',
    shortLabel: 'VERIFY',
    icon: ShieldCheck,
    accentHsl: '45 90% 50%',
    description: 'Checks, readiness, blockers, segurança',
    systemInstruction: 'Você está no modo VERIFICATION. Rode checks lógicos, interprete readiness, identifique blockers e explique falhas com precisão. Use run_verification e check_readiness. Nunca ignore alertas de safety.',
  },
  {
    id: 'hardware_truth',
    label: 'Hardware Truth',
    shortLabel: 'TRUTH',
    icon: Radio,
    accentHsl: '160 80% 45%',
    description: 'Provenance, integration modes, evidence, stale data',
    systemInstruction: 'Você está no modo HARDWARE TRUTH. Foque em interpretar provenance de cada adapter, distinguir simulated/replay/live_read_only/not_integrated, identificar dados stale, avaliar risco operacional e declarar evidence level com honestidade absoluta. Use inspect_hardware e get_system_state.',
  },
  {
    id: 'planner',
    label: 'Planner',
    shortLabel: 'PLAN',
    icon: ListChecks,
    accentHsl: '210 90% 55%',
    description: 'Fases, prioridades, dependências, backlog',
    systemInstruction: 'Você está no modo PLANNER. Transforme objetivos em fases concretas, defina prioridades, estime dependências e organize backlog técnico. Estruture respostas como planos acionáveis.',
  },
  {
    id: 'blueprint',
    label: 'Visual Blueprint',
    shortLabel: 'BLUE',
    icon: PenTool,
    accentHsl: '150 70% 45%',
    description: 'Diagramas, layouts, mapas visuais',
    systemInstruction: 'Você está no modo VISUAL BLUEPRINT. Gere plantas, diagramas Mermaid, layouts de dashboard, mapas de módulos e fluxos operacionais. Priorize saídas visuais estruturadas. Use generate_mermaid quando aplicável.',
  },
  {
    id: 'docs',
    label: 'Documentation',
    shortLabel: 'DOCS',
    icon: FileText,
    accentHsl: '42 85% 55%',
    description: 'Relatórios, checklists, matrizes, contratos',
    systemInstruction: 'Você está no modo DOCUMENTATION. Gere documentação técnica, matrizes de estado, checklists de validação, relatórios comparativos e contratos. Documente diferenças entre simulated/replay/live/not_integrated.',
  },
];

export const JOI_MODE_PRESETS: JoiModePreset[] = [
  // Show Design presets
  { mode: 'show', label: 'RÉVEILLON', icon: Sparkles, prompt: 'Crie um show de Réveillon de 5 minutos com estrutura dramática completa usando create_choreography.' },
  { mode: 'show', label: 'CASAMENTO', icon: Heart, prompt: 'Crie um show intimista de casamento de 2 minutos usando create_choreography.' },
  { mode: 'show', label: 'FINALE', icon: Zap, prompt: 'Crie um finale explosivo de 30 segundos com 20 posições usando create_choreography.' },
  { mode: 'show', label: 'SHOW 3MIN', icon: Music, prompt: 'Crie um show pirotécnico completo de 3 minutos com arco dramático usando create_choreography.' },
  { mode: 'show', label: 'CORPORATIVO', icon: Building2, prompt: 'Crie um show corporativo elegante de 3 minutos usando create_choreography.' },
  { mode: 'show', label: 'ANIVERSÁRIO', icon: PartyPopper, prompt: 'Crie um show festivo de aniversário de 1.5 minutos usando create_choreography.' },
  { mode: 'show', label: 'MODIFICAR', icon: RefreshCw, prompt: 'Analise o projeto atual e sugira melhorias. Use list_positions e list_effects primeiro.' },
  { mode: 'show', label: 'LIMPAR', icon: Trash2, prompt: 'Limpe todo o projeto para recomeçar do zero.\n[JOI_CMD]{"action":"clear_project","params":{}}[/JOI_CMD]' },
  { mode: 'show', label: 'APRENDER ESTILO', icon: Palette, prompt: 'Analise o show atual e extraia um perfil de estilo reutilizável. Use learn_style para salvar.\n[JOI_CMD]{"action":"learn_style","params":{"name":"Estilo do Show Atual"}}[/JOI_CMD]' },
  { mode: 'show', label: 'MEUS ESTILOS', icon: FolderHeart, prompt: 'Liste todos os meus estilos de show salvos.\n[JOI_CMD]{"action":"list_styles","params":{}}[/JOI_CMD]' },
  { mode: 'show', label: 'APLICAR ESTILO', icon: Wand2, prompt: 'Mostre meus estilos salvos para eu escolher qual aplicar no próximo show.\n[JOI_CMD]{"action":"list_styles","params":{}}[/JOI_CMD]' },

  // ── Templates de shows reais ────────────────────────────────────────
  {
    mode: 'show', label: 'PONTE/ARCO', icon: Activity,
    prompt: `Crie um show estilo Sydney Harbour Bridge: 29 posições em arco (espaçamento 25m), abre com StrobePots simultâneos em todas as posições por 55s, depois cascata de cometas fire-gold, finale com crisântemos 5" em volley.\n[JOI_CMD]{"action":"create_bridge_show","params":{"positionCount":29,"spanMeters":700,"style":"sydney_countdown"}}[/JOI_CMD]`,
  },
  {
    mode: 'show', label: 'ESTÁDIO', icon: Building2,
    prompt: `Crie um show estilo Estádio Azteca: 24 posições em anel periférico (raio 80m), paleta nacional verde/branco/vermelho, volleys sincronizados a cada 30s, grande finale com 8 posições disparando 5" peônias simultâneas.\n[JOI_CMD]{"action":"create_stadium_show","params":{"positionCount":24,"ringRadius":80,"style":"azteca"}}[/JOI_CMD]`,
  },
  {
    mode: 'show', label: 'MONUMENTO', icon: MapPin,
    prompt: `Crie um show estilo Eiffel/Taj Mahal: posições em camadas simétricas (base, meio, topo). Cascata de baixo para cima, efeitos dourados e brancos, finale com obus de 8" em todas as camadas simultaneamente. Use create_choreography com layout simétrico frontal.`,
  },
  {
    mode: 'show', label: 'CASCATA LINEAR', icon: Zap,
    prompt: `Crie uma coreografia de cascata linear em 16 posições (linha reta, 10m de espaçamento). Efeito cascata: posições disparam sequencialmente com 0.3s de offset — da esquerda para direita e de volta. Repita 4 vezes com efeitos diferentes (comet, waterfall, chrysanthemum, finale). Use create_choreography.`,
  },
  {
    mode: 'show', label: 'RÉVEILLON REAL', icon: Sparkles,
    prompt: `Crie um show de Réveillon completo baseado em padrões de shows reais: 5 minutos, 20 posições, estrutura: [0-30s] abertura waterfall simultânea, [30s-2min] desenvolvimento com cascatas e peônias coloridas, [2-4min] clímax com crisântemos e cometas em volley, [4min-4:30] silêncio/strobe lento, [4:30-5min] apoteose total. Use create_choreography.`,
  },
  {
    mode: 'show', label: 'DRONES + FOGOS', icon: Plane,
    prompt: `Crie uma coreografia híbrida drones + fogos: 100 drones em formação circular (raio 40m, altura 60m) com cores sincronizadas, intercalados com 12 posições de fogos no solo. Drones formam figuras (círculo → estrela → coração) enquanto fogos fazem cascata nos momentos de transição. Use add_formation e create_choreography.`,
  },

  // Architect presets
  { mode: 'architect', label: 'ARQUITETURA', icon: Cpu, prompt: 'Gere um diagrama Mermaid completo da arquitetura atual do FX KONTROL com todos os módulos, adapters e pipelines.\n[JOI_CMD]{"action":"generate_mermaid","params":{"type":"architecture"}}[/JOI_CMD]' },
  { mode: 'architect', label: 'MÓDULOS', icon: Network, prompt: 'Mapeie todos os módulos do sistema, suas dependências e interfaces.\n[JOI_CMD]{"action":"get_system_state","params":{}}[/JOI_CMD]' },
  { mode: 'architect', label: 'INTERFACES', icon: Target, prompt: 'Liste e analise os contratos/interfaces entre os subsistemas (ShowPlan, Verification, Hardware, Export).' },

  // Analyst presets
  { mode: 'analyst', label: 'ESTADO', icon: Search, prompt: 'Analise o estado completo do sistema agora.\n[JOI_CMD]{"action":"inspect_showplan","params":{}}[/JOI_CMD]\n[JOI_CMD]{"action":"check_readiness","params":{}}[/JOI_CMD]\n[JOI_CMD]{"action":"inspect_hardware","params":{}}[/JOI_CMD]' },
  { mode: 'analyst', label: 'GAP ANALYSIS', icon: AlertTriangle, prompt: 'Faça uma gap analysis completa: o que está implementado vs o que falta, o que é simulado vs real.' },
  { mode: 'analyst', label: 'COMPARAR', icon: BarChart3, prompt: 'Compare o estado esperado do ShowPlan com o estado observado do hardware. Identifique discrepâncias.' },

  // Verify presets
  { mode: 'verify', label: 'VERIFICAR', icon: ShieldCheck, prompt: 'Execute verificação completa do sistema.\n[JOI_CMD]{"action":"run_verification","params":{}}[/JOI_CMD]' },
  { mode: 'verify', label: 'BLOCKERS', icon: AlertTriangle, prompt: 'Identifique e explique todos os blockers atuais do sistema.\n[JOI_CMD]{"action":"check_readiness","params":{}}[/JOI_CMD]' },
  { mode: 'verify', label: 'READINESS', icon: Target, prompt: 'Avalie readiness completo com detalhamento por subsistema.\n[JOI_CMD]{"action":"check_readiness","params":{}}[/JOI_CMD]' },

  // Hardware Truth presets
  { mode: 'hardware_truth', label: 'PROVENANCE', icon: Radio, prompt: 'Analise a provenance de cada adapter: integration_mode, evidence_level, data_freshness. Identifique o que é simulated vs real.\n[JOI_CMD]{"action":"inspect_hardware","params":{}}[/JOI_CMD]' },
  { mode: 'hardware_truth', label: 'INTEGRAÇÃO', icon: Eye, prompt: 'Mostre o status de integração completo: o que é simulated, replay, live_read_only e not_integrated.\n[JOI_CMD]{"action":"get_system_state","params":{}}[/JOI_CMD]' },
  { mode: 'hardware_truth', label: 'STALE DATA', icon: Clock, prompt: 'Identifique todos os dados stale no sistema. Qual a freshness de cada adapter? Há risco operacional?\n[JOI_CMD]{"action":"inspect_hardware","params":{}}[/JOI_CMD]' },
  { mode: 'hardware_truth', label: 'RISCO', icon: AlertTriangle, prompt: 'Avalie o risco operacional atual baseado nos integration modes e evidence levels. O que precisa evoluir de simulated para live?\n[JOI_CMD]{"action":"get_system_state","params":{}}[/JOI_CMD]' },

  // Planner presets
  { mode: 'planner', label: 'FASES', icon: ListChecks, prompt: 'Monte um plano por fases para a próxima evolução do sistema, considerando o estado atual.' },
  { mode: 'planner', label: 'PRIORIDADES', icon: Target, prompt: 'Defina prioridades técnicas para os próximos sprints baseado nos gaps e blockers atuais.' },
  { mode: 'planner', label: 'DEPENDÊNCIAS', icon: Network, prompt: 'Mapeie dependências entre os módulos e identifique o caminho crítico.' },

  // Blueprint presets
  { mode: 'blueprint', label: 'PIPELINE', icon: PenTool, prompt: 'Gere um diagrama Mermaid do pipeline ShowPlan → Verification → Readiness → Export.\n[JOI_CMD]{"action":"generate_mermaid","params":{"type":"pipeline"}}[/JOI_CMD]' },
  { mode: 'blueprint', label: 'HARDWARE', icon: Cpu, prompt: 'Gere um diagrama da topologia de hardware com todos os adapters e seus estados.\n[JOI_CMD]{"action":"generate_mermaid","params":{"type":"hardware"}}[/JOI_CMD]' },
  { mode: 'blueprint', label: 'DASHBOARD', icon: BarChart3, prompt: 'Proponha um layout ideal para o dashboard do CommandCenter com todos os consoles necessários.' },

  // Docs presets — includes legacy document presets
  { mode: 'docs', label: 'RELATÓRIO', icon: FileText, prompt: 'Gere um relatório técnico do estado atual do sistema com todos os subsistemas, seus status de integração e recomendações.\n[JOI_CMD]{"action":"get_system_state","params":{}}[/JOI_CMD]' },
  { mode: 'docs', label: 'CHECKLIST', icon: ListChecks, prompt: 'Gere um checklist de validação pré-show cobrindo hardware, safety, verificação e export.' },
  { mode: 'docs', label: 'MATRIZ', icon: BarChart3, prompt: 'Gere a Current State Matrix completa com módulo, status, integration mode, evidence level, source e detail.\n[JOI_CMD]{"action":"get_system_state","params":{}}[/JOI_CMD]' },
  { mode: 'docs', label: 'AUDITORIA', icon: BookOpen, prompt: 'Gere um resumo da trilha de auditoria com eventos recentes, verificações e exportações.\n[JOI_CMD]{"action":"get_audit_log","params":{}}[/JOI_CMD]' },
  { mode: 'docs', label: 'ORÇAMENTO', icon: Sparkles, prompt: 'Me ajude a criar um orçamento detalhado para um show pirotécnico. Preciso incluir itens, quantidades, calibres e custos.' },
  { mode: 'docs', label: 'LICENÇAS', icon: ShieldCheck, prompt: 'Quais documentos e licenças preciso para realizar este show? Liste todos os órgãos, prazos e requisitos.' },
  { mode: 'docs', label: 'CONTRATO', icon: Zap, prompt: 'Me ajude a redigir uma proposta comercial / contrato de prestação de serviços para um show.' },
  { mode: 'docs', label: 'LICITAÇÃO', icon: Gavel, prompt: 'Me ajude a analisar um edital de licitação e preparar a proposta técnica e de preços.' },
  { mode: 'docs', label: 'ESPAÇO AÉREO', icon: Plane, prompt: 'Me ajude a preparar a documentação de fechamento de espaço aéreo (NOTAM/DECEA) e planta de distanciamento de segurança.' },
  { mode: 'docs', label: 'PLANTA', icon: MapPin, prompt: 'Gere uma planta de distanciamento de segurança conforme NFPA 1123 para este show.' },
  { mode: 'docs', label: 'ACREDITAÇÃO', icon: ShieldCheck, prompt: 'Me ajude a preparar toda a documentação para acreditação junto aos órgãos fiscalizadores.' },
  { mode: 'docs', label: 'PRAZOS', icon: AlertTriangle, prompt: 'Verifique prazos de licenças, certificados e seguros. Me alerte sobre vencimentos e renovações urgentes.' },
  { mode: 'docs', label: 'DECLARAÇÃO', icon: FileText, prompt: 'Preciso redigir uma declaração/ofício para um órgão regulador. Me ajude com o formato oficial completo.' },
];

export function getPresetsForMode(mode: JoiMode): JoiModePreset[] {
  return JOI_MODE_PRESETS.filter(p => p.mode === mode);
}

export function getModeConfig(mode: JoiMode): JoiModeConfig {
  return JOI_MODES.find(m => m.id === mode) || JOI_MODES[0];
}
