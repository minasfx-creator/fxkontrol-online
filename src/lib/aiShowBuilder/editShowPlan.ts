/**
 * Helpers imutáveis para edição manual de um ShowPlan no modo de revisão.
 *
 * Todas as funções recebem um plano e retornam um novo plano com mudanças
 * aplicadas, sem mutar o objeto original. Pensado para ser usado no
 * `ShowPlanReviewEditor` antes do `materializeShowPlan`.
 */
import type {
  PlannedPosition,
  PlannedTimelineItem,
  ShowPlan,
  ShowSection,
} from './types';

// ── Sections ─────────────────────────────────────────────────────────
export function updateSection(
  plan: ShowPlan,
  id: string,
  patch: Partial<ShowSection>,
): ShowPlan {
  return {
    ...plan,
    sections: plan.sections.map((s) => (s.id === id ? { ...s, ...patch } : s)),
  };
}

// ── Positions ────────────────────────────────────────────────────────
export function updatePosition(
  plan: ShowPlan,
  id: string,
  patch: Partial<PlannedPosition>,
): ShowPlan {
  return {
    ...plan,
    positions: plan.positions.map((p) => (p.id === id ? { ...p, ...patch } : p)),
  };
}

export function removePosition(plan: ShowPlan, id: string): ShowPlan {
  return {
    ...plan,
    positions: plan.positions.filter((p) => p.id !== id),
    // Limpa positionId órfão nos timeline items (mas mantém o cue).
    timelineItems: plan.timelineItems.map((it) =>
      it.positionId === id ? { ...it, positionId: undefined, positionName: undefined } : it,
    ),
    // Remove trajectories que apontavam para essa posição.
    trajectories: plan.trajectories.filter((t) => t.positionId !== id),
  };
}

// ── Timeline items ───────────────────────────────────────────────────
export function updateTimelineItem(
  plan: ShowPlan,
  id: string,
  patch: Partial<PlannedTimelineItem>,
): ShowPlan {
  return {
    ...plan,
    timelineItems: plan.timelineItems.map((it) => (it.id === id ? { ...it, ...patch } : it)),
  };
}

export function removeTimelineItem(plan: ShowPlan, id: string): ShowPlan {
  return {
    ...plan,
    timelineItems: plan.timelineItems.filter((it) => it.id !== id),
  };
}

// ── Plan-level ───────────────────────────────────────────────────────
export function updatePlanMeta(
  plan: ShowPlan,
  patch: Partial<Pick<ShowPlan, 'title' | 'duration' | 'style' | 'intent'>>,
): ShowPlan {
  return { ...plan, ...patch };
}
