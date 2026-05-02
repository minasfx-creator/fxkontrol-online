/**
 * showPlanDiff — comparação determinística entre dois ShowPlans.
 *
 * Usado pelo histórico de "Estender show" do AIShowBuilderPanel para
 * exibir o que mudou em cada continuação. Pure, sem dependências.
 */
import type { ShowPlan } from './types';

export interface ShowPlanDiff {
  /** Cues novos (id presente em next, ausente em prev). */
  addedCueIds: string[];
  /** Cues removidos (id presente em prev, ausente em next). */
  removedCueIds: string[];
  /** Posições novas. */
  addedPositionIds: string[];
  /** Trajetórias novas. */
  addedTrajectoryIds: string[];
  /** Seções novas. */
  addedSectionIds: string[];
  /** Variação de duração (next - prev), em segundos. */
  durationDelta: number;
  /** prev.duration */
  prevDuration: number;
  /** next.duration */
  nextDuration: number;
}

export function diffShowPlan(prev: ShowPlan, next: ShowPlan): ShowPlanDiff {
  const prevCues = new Set(prev.timelineItems.map((i) => i.id));
  const nextCues = new Set(next.timelineItems.map((i) => i.id));
  const prevPos = new Set(prev.positions.map((p) => p.id));
  const prevTraj = new Set(prev.trajectories.map((t) => t.id));
  const prevSec = new Set(prev.sections.map((s) => s.id));

  return {
    addedCueIds: next.timelineItems.filter((i) => !prevCues.has(i.id)).map((i) => i.id),
    removedCueIds: prev.timelineItems.filter((i) => !nextCues.has(i.id)).map((i) => i.id),
    addedPositionIds: next.positions.filter((p) => !prevPos.has(p.id)).map((p) => p.id),
    addedTrajectoryIds: next.trajectories.filter((t) => !prevTraj.has(t.id)).map((t) => t.id),
    addedSectionIds: next.sections.filter((s) => !prevSec.has(s.id)).map((s) => s.id),
    durationDelta: +(next.duration - prev.duration).toFixed(2),
    prevDuration: prev.duration,
    nextDuration: next.duration,
  };
}

export function summarizeDiff(d: ShowPlanDiff): string {
  const parts: string[] = [];
  if (d.addedCueIds.length) parts.push(`+${d.addedCueIds.length} cues`);
  if (d.removedCueIds.length) parts.push(`-${d.removedCueIds.length} cues`);
  if (d.addedPositionIds.length) parts.push(`+${d.addedPositionIds.length} pos`);
  if (d.addedTrajectoryIds.length) parts.push(`+${d.addedTrajectoryIds.length} traj`);
  if (d.addedSectionIds.length) parts.push(`+${d.addedSectionIds.length} sec`);
  if (d.durationDelta !== 0) {
    const sign = d.durationDelta > 0 ? '+' : '';
    parts.push(`${sign}${d.durationDelta.toFixed(1)}s`);
  }
  return parts.length ? parts.join(' · ') : 'sem mudanças';
}
