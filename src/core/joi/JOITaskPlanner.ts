/**
 * ─── JOITaskPlanner — Intent Classification & Task Decomposition ───
 * Classifies user intent and decomposes requests into subtasks
 * with appropriate resolver assignments.
 */

import type { JOIIntent, JOIIntentCategory, JOISubtask, JOITaskPlan } from './joiTypes';
import type { JoiMode } from './joiModes';

// ── Intent classification patterns ──
const INTENT_PATTERNS: { pattern: RegExp; category: JOIIntentCategory }[] = [
  { pattern: /estado|diagnóst|analise.*sistema|status|health|saúde/i, category: 'diagnose' },
  { pattern: /planta|blueprint|wireframe|layout|diagrama|visual|topolog|mermaid/i, category: 'generate_visual' },
  { pattern: /plano|fase|sprint|prioridade|backlog|roadmap|planej/i, category: 'plan' },
  { pattern: /verifica|check|readiness|blocker|pronto|export.*bloq/i, category: 'verify' },
  { pattern: /relatório|report|checklist|documento|contrato|licença|orçamento/i, category: 'document' },
  { pattern: /arquitetura|módulo|interface|dependênc|pipeline|system/i, category: 'architecture' },
  { pattern: /hardware|provenance|integra[çc]ão|simula|adapter|dispositivo|stale/i, category: 'hardware_truth' },
  { pattern: /estilo.*aprender|learn.*style|extrair.*estilo|aprender.*estilo/i, category: 'style_learn' },
  { pattern: /aplicar.*estilo|apply.*style|usar.*estilo/i, category: 'style_apply' },
  { pattern: /show|coreograf|efeito|posição|réveillon|casamento|finale|create.*show/i, category: 'show_design' },
  { pattern: /explique|por\s?que|como\s+funciona|o\s+que\s+é/i, category: 'explain' },
];

// ── Mode to primary category mapping ──
const MODE_CATEGORIES: Record<JoiMode, JOIIntentCategory> = {
  show: 'show_design',
  architect: 'architecture',
  analyst: 'diagnose',
  verify: 'verify',
  hardware_truth: 'hardware_truth',
  planner: 'plan',
  blueprint: 'generate_visual',
  docs: 'document',
};

// ── Subtask templates by category ──
const SUBTASK_TEMPLATES: Record<JOIIntentCategory, { label: string; resolver: string }[]> = {
  diagnose: [
    { label: 'Coletar estado do ShowPlan', resolver: 'CurrentStateMatrixResolver' },
    { label: 'Rodar verificação', resolver: 'VerificationResolver' },
    { label: 'Avaliar readiness', resolver: 'ReadinessResolver' },
    { label: 'Inspecionar hardware', resolver: 'HardwareTruthResolver' },
  ],
  plan: [
    { label: 'Diagnosticar estado atual', resolver: 'CurrentStateMatrixResolver' },
    { label: 'Identificar gaps', resolver: 'VerificationResolver' },
  ],
  generate_visual: [
    { label: 'Gerar blueprint visual', resolver: 'VisualBlueprintResolver' },
    { label: 'Coletar dados de arquitetura', resolver: 'ArchitectureResolver' },
  ],
  document: [
    { label: 'Coletar dados do projeto', resolver: 'DocumentationResolver' },
    { label: 'Verificar estado', resolver: 'VerificationResolver' },
  ],
  verify: [
    { label: 'Executar verificação', resolver: 'VerificationResolver' },
    { label: 'Avaliar readiness', resolver: 'ReadinessResolver' },
  ],
  style_learn: [
    { label: 'Analisar show atual', resolver: 'StyleLearningResolver' },
    { label: 'Extrair padrões', resolver: 'ShowDesignResolver' },
  ],
  style_apply: [
    { label: 'Carregar estilo', resolver: 'StyleLearningResolver' },
  ],
  show_design: [
    { label: 'Analisar projeto atual', resolver: 'ShowDesignResolver' },
  ],
  architecture: [
    { label: 'Mapear módulos', resolver: 'ArchitectureResolver' },
    { label: 'Analisar estado', resolver: 'CurrentStateMatrixResolver' },
  ],
  hardware_truth: [
    { label: 'Inspecionar hardware', resolver: 'HardwareTruthResolver' },
    { label: 'Avaliar readiness', resolver: 'ReadinessResolver' },
  ],
  explain: [
    { label: 'Coletar contexto', resolver: 'CurrentStateMatrixResolver' },
  ],
  resolve: [
    { label: 'Diagnosticar', resolver: 'CurrentStateMatrixResolver' },
    { label: 'Verificar', resolver: 'VerificationResolver' },
  ],
};

class JOITaskPlannerImpl {
  /** Classify user input into intent categories */
  classifyIntent(input: string, currentMode: JoiMode): JOIIntent {
    const categories: JOIIntentCategory[] = [];

    // Match against patterns
    for (const { pattern, category } of INTENT_PATTERNS) {
      if (pattern.test(input) && !categories.includes(category)) {
        categories.push(category);
      }
    }

    // If nothing matched, use mode default
    if (categories.length === 0) {
      categories.push(MODE_CATEGORIES[currentMode]);
    }

    const primary = categories[0];

    // Enhance input — add context suggestions
    let enhanced = input;
    if (categories.includes('diagnose') && !/completo|full|todo/i.test(input)) {
      enhanced += ' (análise completa com todos os subsistemas)';
    }
    if (categories.includes('generate_visual') && !/mermaid|svg|blueprint/i.test(input)) {
      enhanced += ' (gerar diagramas visuais estruturados)';
    }

    return {
      category: primary,
      subcategories: categories.slice(1),
      raw_input: input,
      enhanced_input: enhanced,
      suggested_mode: this.suggestMode(categories),
    };
  }

  /** Decompose intent into subtasks */
  planTasks(intent: JOIIntent): JOITaskPlan {
    const allCategories = [intent.category, ...intent.subcategories];
    const subtaskSet = new Map<string, JOISubtask>();

    for (const cat of allCategories) {
      const templates = SUBTASK_TEMPLATES[cat] || [];
      for (const t of templates) {
        if (!subtaskSet.has(t.resolver)) {
          subtaskSet.set(t.resolver, {
            id: `task-${subtaskSet.size}`,
            label: t.label,
            category: cat,
            resolver: t.resolver,
            status: 'pending',
          });
        }
      }
    }

    return {
      intent,
      subtasks: Array.from(subtaskSet.values()),
      created_at: Date.now(),
    };
  }

  /** Suggest best mode for the intent */
  private suggestMode(categories: JOIIntentCategory[]): string {
    const modeMap = Object.entries(MODE_CATEGORIES);
    for (const cat of categories) {
      const match = modeMap.find(([, c]) => c === cat);
      if (match) return match[0];
    }
    return 'analyst';
  }
}

export const joiTaskPlanner = new JOITaskPlannerImpl();
