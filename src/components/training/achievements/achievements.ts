/**
 * Training v2.1 — Pure Achievements Engine.
 *
 * No React, no THREE, no Zustand. Fully testable.
 * Consumes: MissionScript + RunnerSnapshot + PlacementAttempt[].
 * Returns: list of awarded achievement ids + per-achievement XP bonus.
 *
 * Achievement catalog (4):
 *   • zero-violations    — snap.safetyViolations === 0 && completed
 *   • perfect-cue-timing — completed with ≥60% time remaining
 *   • no-unknown-devices — completed with zero wrong placements
 *   • e-stop-ready       — completed AND mission contained inspect / fire-check stage
 *                          AND zero safety violations (ready to react if needed)
 *
 * Unlock policy (deterministic):
 *   - Completing a mission unlocks the next mission in MISSION_SCRIPTS order.
 *   - Earning 3+ distinct achievements (lifetime) unlocks 'producer-late'.
 *   - Earning 4 distinct achievements (lifetime) unlocks 'full-reveillon'.
 *
 * Pure functions only. Persistence lives in useAchievementsStore.
 */
import type { MissionScript } from '../missions/types';
import type { RunnerSnapshot } from '../missions/missionRunner';
import type { PlacementAttempt } from '../missions/debriefMetrics';

export type AchievementId =
  | 'zero-violations'
  | 'perfect-cue-timing'
  | 'no-unknown-devices'
  | 'e-stop-ready';

export interface AchievementDef {
  id: AchievementId;
  label: string;
  description: string;
  /** XP bonus added on first unlock for a mission. */
  xpBonus: number;
  /** UI status token (semantic only — never literal hex). */
  tone: 'ok' | 'sync' | 'warn' | 'fail';
}

export const ACHIEVEMENT_CATALOG: Readonly<Record<AchievementId, AchievementDef>> = Object.freeze({
  'zero-violations': {
    id: 'zero-violations',
    label: 'Zero Violations',
    description: 'Concluiu a missão sem violações de segurança.',
    xpBonus: 250,
    tone: 'ok',
  },
  'perfect-cue-timing': {
    id: 'perfect-cue-timing',
    label: 'Perfect Cue Timing',
    description: 'Terminou com ≥60% do tempo restante.',
    xpBonus: 200,
    tone: 'sync',
  },
  'no-unknown-devices': {
    id: 'no-unknown-devices',
    label: 'No Unknown Devices',
    description: 'Nenhuma colocação errada de equipamento.',
    xpBonus: 200,
    tone: 'sync',
  },
  'e-stop-ready': {
    id: 'e-stop-ready',
    label: 'E-STOP Ready',
    description: 'Inspeção/fire-check executada com zero violações.',
    xpBonus: 300,
    tone: 'warn',
  },
});

export interface AchievementEvaluationInput {
  script: MissionScript;
  snap: RunnerSnapshot;
  attempts: ReadonlyArray<PlacementAttempt>;
}

export interface AchievementResult {
  awarded: AchievementId[];
  /** Total XP from achievements (no double-counting). */
  bonusXP: number;
}

const MIN_TIME_RATIO_FOR_PERFECT = 0.6;

export function evaluateAchievements(input: AchievementEvaluationInput): AchievementResult {
  const { script, snap, attempts } = input;
  const completed = snap.phase === 'complete';
  if (!completed) return { awarded: [], bonusXP: 0 };

  const awarded: AchievementId[] = [];
  const wrongAttempts = attempts.filter((a) => !a.correct).length;
  const timeRatioRemaining = snap.remainingSeconds / Math.max(1, script.timeLimitSeconds);
  const hasInspect = script.stages.some((s) => s.kind === 'inspect' || s.kind === 'fire-check');

  if (snap.safetyViolations === 0) awarded.push('zero-violations');
  if (timeRatioRemaining >= MIN_TIME_RATIO_FOR_PERFECT) awarded.push('perfect-cue-timing');
  if (wrongAttempts === 0) awarded.push('no-unknown-devices');
  if (hasInspect && snap.safetyViolations === 0) awarded.push('e-stop-ready');

  const bonusXP = awarded.reduce((acc, id) => acc + ACHIEVEMENT_CATALOG[id].xpBonus, 0);
  return { awarded, bonusXP };
}

/**
 * Pure unlock policy. Receives the canonical mission order + current state,
 * returns the new list of unlocked mission ids (superset of current).
 */
export interface UnlockPolicyInput {
  /** Mission ids in canonical catalog order. */
  orderedMissionIds: ReadonlyArray<string>;
  /** Mission just completed. */
  justCompletedId: string;
  /** Lifetime distinct achievements earned (after merging current run). */
  lifetimeAchievements: ReadonlyArray<AchievementId>;
  /** Current unlocked set. */
  currentUnlocked: ReadonlyArray<string>;
}

export function computeUnlocks(input: UnlockPolicyInput): {
  unlocked: string[];
  newlyUnlocked: string[];
} {
  const set = new Set(input.currentUnlocked);
  const newly: string[] = [];
  const add = (id?: string) => {
    if (id && !set.has(id)) {
      set.add(id);
      newly.push(id);
    }
  };

  // 1) Sequential unlock: next mission after completion.
  const idx = input.orderedMissionIds.indexOf(input.justCompletedId);
  if (idx >= 0 && idx + 1 < input.orderedMissionIds.length) {
    add(input.orderedMissionIds[idx + 1]);
  }

  // 2) Achievement-gated bonus missions.
  const distinct = new Set(input.lifetimeAchievements).size;
  if (distinct >= 3) add('producer-late');
  if (distinct >= 4) add('full-reveillon');

  return { unlocked: Array.from(set), newlyUnlocked: newly };
}
