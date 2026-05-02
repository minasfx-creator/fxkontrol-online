/**
 * continueShowPlan — utilitários puros para "Continuar coreografia".
 *
 * Permite anexar um novo trecho gerado pela IA ao final do plano atual,
 * sem apagar o conteúdo já criado. Determina o ponto de retomada a partir
 * do último cue da timeline (ou da duração do plano, o que for maior).
 *
 * Não muta os planos de entrada. Não toca no useProjectStore.
 */
import type { PlannedTimelineItem, ShowPlan, ShowSection } from './types';

/** Tempo do último cue (incluindo duração) ou 0 se vazio. */
export function lastCueEndTime(plan: ShowPlan): number {
  let end = 0;
  for (const it of plan.timelineItems) {
    const t = it.startTime + (it.duration ?? 0);
    if (t > end) end = t;
  }
  return end;
}

/** Ponto de retomada — máximo entre fim do último cue e duration. */
export function resumeOffsetFor(plan: ShowPlan): number {
  return Math.max(plan.duration, lastCueEndTime(plan));
}

/**
 * Ponto de retomada ancorado em um cue específico (fim do cue = startTime + duration).
 * Se o cue não for encontrado, faz fallback para `resumeOffsetFor(plan)`.
 */
export function resumeOffsetAtCue(plan: ShowPlan, cueId: string): number {
  const cue = plan.timelineItems.find((it) => it.id === cueId);
  if (!cue) return resumeOffsetFor(plan);
  return cue.startTime + (cue.duration ?? 0);
}

interface AppendOptions {
  /** Espaçamento (s) entre o fim do plano atual e o início do novo trecho. */
  gap?: number;
  /**
   * Se definido, ancora a continuação no fim deste cue (em vez do último).
   * Conteúdo posterior ao âncora é PRESERVADO — o novo trecho é inserido
   * em paralelo a partir do ponto âncora (overlay), e a duração final é
   * o máximo entre o plano atual e (âncora + duração do trecho novo).
   */
  anchorCueId?: string;
}

/**
 * Anexa `next` ao final de `current` deslocando todos os tempos do trecho
 * novo. Posições e trajetórias são mescladas (ids do `next` mantidos —
 * o gerador usa ids únicos por execução).
 */
export function appendShowPlan(
  current: ShowPlan,
  next: ShowPlan,
  opts: AppendOptions = {},
): ShowPlan {
  const gap = Math.max(0, opts.gap ?? 0);
  const base = opts.anchorCueId
    ? resumeOffsetAtCue(current, opts.anchorCueId)
    : resumeOffsetFor(current);
  const offset = base + gap;

  const shiftedSections: ShowSection[] = next.sections.map((s) => ({
    ...s,
    startTime: s.startTime + offset,
  }));

  const shiftedItems: PlannedTimelineItem[] = next.timelineItems.map((it) => ({
    ...it,
    startTime: it.startTime + offset,
  }));

  const shiftedTrajectories = next.trajectories.map((t) => ({
    ...t,
    waypoints: t.waypoints.map((w) => ({ ...w, time: w.time + offset })),
  }));

  const newDuration = Math.max(
    current.duration,
    offset + Math.max(next.duration, 0),
  );

  return {
    ...current,
    duration: newDuration,
    intent: current.intent
      ? `${current.intent}\n→ continuação: ${next.intent}`
      : next.intent,
    sections: [...current.sections, ...shiftedSections],
    positions: [...current.positions, ...next.positions],
    timelineItems: [...current.timelineItems, ...shiftedItems],
    trajectories: [...current.trajectories, ...shiftedTrajectories],
    safetyWarnings: dedupe([...current.safetyWarnings, ...next.safetyWarnings]),
    assumptions: dedupe([...current.assumptions, ...next.assumptions]),
  };
}

function dedupe(arr: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of arr) {
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}
