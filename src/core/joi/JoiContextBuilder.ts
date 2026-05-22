/**
 * ─── JoiContextBuilder — Show Context Assembler ──────────────────
 * Joi opera como secretária executiva / diretora de show & documentação.
 * Contexto é puramente criativo: ShowPlan + biblioteca de efeitos.
 * Gates de readiness/hardware/operationalMode foram REMOVIDOS — Joi não
 * é instrumento de inspeção de software, e o editor é zona de criação livre.
 */

import { useProjectStore } from '@/store/useProjectStore';
import { findEffectById } from '@/data/effectsLibraries/resolveEffect';

export interface JoiSystemContext {
  showPlan: {
    projectName: string;
    positionCount: number;
    timelineItemCount: number;
    droneFormationCount: number;
    duration: number;
    currentTime: number;
    positions: string;
    effectsSummary: string;
    recentItems: string;
  };
}

class JoiContextBuilder {
  /** Build show context for AI injection */
  build(): JoiSystemContext {
    const store = useProjectStore.getState();

    const positionsSummary = store.positions.length > 0
      ? store.positions.map(p => `${p.name}(${p.type})@(${p.x.toFixed(1)},${p.z.toFixed(1)})${p.section ? `[${p.section}]` : ''}`).join('; ')
      : 'Nenhuma';

    const effectCounts = new Map<string, number>();
    store.timelineItems.forEach(item => {
      const effect = findEffectById(item.effectId);
      const key = effect?.name || item.effectId;
      effectCounts.set(key, (effectCounts.get(key) || 0) + 1);
    });
    const effectsSummary = effectCounts.size > 0
      ? Array.from(effectCounts.entries()).map(([n, c]) => `${n}×${c}`).join(', ')
      : 'Nenhum';

    const recentItems = store.timelineItems.slice(-20).map(item => {
      const effect = findEffectById(item.effectId);
      return `${item.id}[${effect?.name || item.effectId}@${item.positionName || '?'},t=${item.startTime.toFixed(1)}s]`;
    }).join(', ') || 'Nenhum';

    return {
      showPlan: {
        projectName: store.projectName,
        positionCount: store.positions.length,
        timelineItemCount: store.timelineItems.length,
        droneFormationCount: store.droneFormations.length,
        duration: store.duration,
        currentTime: store.currentTime,
        positions: positionsSummary,
        effectsSummary,
        recentItems,
      },
    };
  }

  /** Serialize context as a system message string */
  toSystemMessage(): string {
    const ctx = this.build();
    return `[JOI SHOW CONTEXT]

## ShowPlan
- Projeto: ${ctx.showPlan.projectName}
- Posições: ${ctx.showPlan.positionCount} | Efeitos: ${ctx.showPlan.timelineItemCount} | Formações drone: ${ctx.showPlan.droneFormationCount}
- Duração: ${ctx.showPlan.duration}s | Tempo atual: ${ctx.showPlan.currentTime.toFixed(1)}s
- Posições: ${ctx.showPlan.positions}
- Efeitos no timeline: ${ctx.showPlan.effectsSummary}
- Itens recentes: ${ctx.showPlan.recentItems}

## Style Learning
- Use learn_style para extrair e salvar padrões do show atual
- Use list_styles para listar estilos salvos do usuário
- Use apply_style para referenciar um estilo ao criar novos shows`;
  }
}

export const joiContextBuilder = new JoiContextBuilder();
