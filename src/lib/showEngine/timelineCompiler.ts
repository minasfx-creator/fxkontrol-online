/**
 * Timeline Compiler — flattens ShowPlan timelineItems into pre-resolved
 * cues with explicit start/end and high-level scene commands.
 *
 * Separates "show time" (deterministic) from "real delta" (smooth render).
 * Engine playback applies only newly-active cues; scrub uses the same data
 * but rewinds first to keep the visual state idempotent.
 *
 * No Three.js imports — fully unit-testable.
 */

import type { PlannedTimelineItem, ShowPlan } from '@/lib/aiShowBuilder/types';

export type SceneCommandKind =
  | 'spawn-pyro'
  | 'move-drone'
  | 'finale-burst'
  | 'marker';

export interface SceneCommand {
  kind: SceneCommandKind;
  positionId?: string;
  effectId?: string;
  intensity?: 'low' | 'medium' | 'high';
  label?: string;
}

export interface CompiledCue {
  id: string;
  startTime: number;
  endTime: number;
  commands: SceneCommand[];
}

export interface CompiledTimeline {
  duration: number;
  cues: CompiledCue[];
  /** Source plan id, for memoization keys. */
  planId: string;
}

function itemToCommand(item: PlannedTimelineItem): SceneCommand {
  switch (item.type) {
    case 'pyro_effect':
      return {
        kind: 'spawn-pyro',
        positionId: item.positionId,
        effectId: item.effectId,
        intensity: item.intensity,
        label: item.label,
      };
    case 'drone_move':
      return {
        kind: 'move-drone',
        positionId: item.positionId,
        label: item.label,
      };
    case 'finale':
      return { kind: 'finale-burst', intensity: item.intensity ?? 'high', label: item.label };
    case 'marker':
    default:
      return { kind: 'marker', label: item.label };
  }
}

export function compileTimeline(plan: ShowPlan): CompiledTimeline {
  const cues: CompiledCue[] = plan.timelineItems
    .slice()
    .sort((a, b) => a.startTime - b.startTime)
    .map((item) => {
      const dur = Math.max(0, item.duration ?? 0.5);
      return {
        id: item.id,
        startTime: Math.max(0, item.startTime),
        endTime: Math.max(0, item.startTime) + dur,
        commands: [itemToCommand(item)],
      };
    });
  return { duration: plan.duration, cues, planId: plan.id };
}

/**
 * Returns cues that became newly active between `prev` and `next` show
 * time. Used by the engine for `playback` mode (incremental).
 */
export function cuesActivatedBetween(
  timeline: CompiledTimeline,
  prev: number,
  next: number,
): CompiledCue[] {
  if (next <= prev) return [];
  return timeline.cues.filter((c) => c.startTime > prev && c.startTime <= next);
}

/**
 * Returns cues that overlap the instant `t`. Used by `scrub` mode after
 * clearing temporary effects.
 */
export function cuesAt(timeline: CompiledTimeline, t: number): CompiledCue[] {
  return timeline.cues.filter((c) => c.startTime <= t && c.endTime >= t);
}
