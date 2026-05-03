/**
 * Training v2 — Pure FSM for mission progression.
 *
 * No React, no THREE. Fully testable. UI subscribes via callbacks.
 */
import type {
  MissionRuntimeState,
  MissionScript,
  MissionStage,
} from './types';

export interface RunnerSnapshot extends MissionRuntimeState {
  currentStage: MissionStage | null;
  isLastStage: boolean;
  starRating: number;
  totalStages: number;
}

export type RunnerListener = (snap: RunnerSnapshot) => void;

export interface CompleteObjectiveResult {
  /** Snap point/objective id that was completed. */
  objectiveId: string;
  /** Score delta (+ for correct, - for safety violation). */
  scoreDelta: number;
  /** Whether the stage advanced as a result. */
  stageAdvanced: boolean;
}

const MIN_BUDGET = 5;

export function createMissionRunner(script: MissionScript) {
  const listeners = new Set<RunnerListener>();
  const completedPerStage: Set<string>[] = script.stages.map(() => new Set());

  const state: MissionRuntimeState = {
    scriptId: script.id,
    stageIndex: 0,
    completedObjectiveIds: completedPerStage[0],
    score: 0,
    safetyViolations: 0,
    elapsedSeconds: 0,
    remainingSeconds: script.timeLimitSeconds,
    phase: 'briefing',
  };

  const snapshot = (): RunnerSnapshot => {
    const currentStage = script.stages[state.stageIndex] ?? null;
    return {
      ...state,
      completedObjectiveIds: completedPerStage[state.stageIndex] ?? new Set(),
      currentStage,
      isLastStage: state.stageIndex >= script.stages.length - 1,
      totalStages: script.stages.length,
      starRating: computeStarRating(script, state),
    };
  };

  const emit = () => {
    const snap = snapshot();
    listeners.forEach((l) => l(snap));
  };

  return {
    get state() {
      return snapshot();
    },
    subscribe(listener: RunnerListener): () => void {
      listeners.add(listener);
      listener(snapshot());
      return () => listeners.delete(listener);
    },
    /** Move from 'briefing' → 'running'. Idempotent. */
    startMission(): void {
      if (state.phase !== 'briefing') return;
      state.phase = 'running';
      emit();
    },
    /** Tick clock by `dtSec`. Auto-fails on timeout. */
    tick(dtSec: number): void {
      if (state.phase !== 'running') return;
      state.elapsedSeconds += dtSec;
      state.remainingSeconds = Math.max(0, state.remainingSeconds - dtSec);
      if (state.remainingSeconds <= 0) {
        state.phase = 'failed';
      }
      emit();
    },
    /**
     * Mark an objective in the current stage as complete.
     * Returns score delta and whether the stage advanced.
     */
    completeObjective(objectiveId: string): CompleteObjectiveResult {
      if (state.phase !== 'running') {
        return { objectiveId, scoreDelta: 0, stageAdvanced: false };
      }
      const stage = script.stages[state.stageIndex];
      if (!stage) {
        return { objectiveId, scoreDelta: 0, stageAdvanced: false };
      }
      const set = completedPerStage[state.stageIndex];
      if (set.has(objectiveId)) {
        return { objectiveId, scoreDelta: 0, stageAdvanced: false };
      }
      set.add(objectiveId);
      const delta = 100;
      state.score += delta;

      // Stage complete?
      const stageDone = stage.objectives.every((obj) => {
        const id = obj.snapPointId ?? obj.label;
        return set.has(id);
      });
      let stageAdvanced = false;
      if (stageDone) {
        if (state.stageIndex >= script.stages.length - 1) {
          // Final stage → mission complete.
          state.phase = 'complete';
          state.score += Math.round(
            state.remainingSeconds * script.scoreRules.timeBonusPerSecond,
          );
        } else {
          state.stageIndex += 1;
          stageAdvanced = true;
        }
      }
      emit();
      return { objectiveId, scoreDelta: delta, stageAdvanced };
    },
    /** Manually advance (used by dialogue / cutscene-only stages). */
    advanceStage(): void {
      if (state.phase !== 'running') return;
      if (state.stageIndex >= script.stages.length - 1) {
        state.phase = 'complete';
      } else {
        state.stageIndex += 1;
      }
      emit();
    },
    /** Record a safety violation. Decreases score. */
    reportSafetyViolation(): void {
      if (state.phase !== 'running') return;
      state.safetyViolations += 1;
      state.score = Math.max(
        0,
        state.score - script.scoreRules.safetyPenalty,
      );
      emit();
    },
    /** Force-fail (E-STOP, quit, etc). */
    fail(): void {
      if (state.phase === 'complete' || state.phase === 'failed') return;
      state.phase = 'failed';
      emit();
    },
    /** Reset for replay. */
    reset(): void {
      completedPerStage.forEach((s) => s.clear());
      state.stageIndex = 0;
      state.score = 0;
      state.safetyViolations = 0;
      state.elapsedSeconds = 0;
      state.remainingSeconds = script.timeLimitSeconds;
      state.phase = 'briefing';
      emit();
    },
    snapshot,
  };
}

export function computeStarRating(
  script: MissionScript,
  state: MissionRuntimeState,
): number {
  if (state.phase === 'failed') return 0;
  const max = script.scoreRules.maxStars;
  // 1 star: completed. +1 per quartile of remaining time. -1 per 2 violations.
  const completionStar = state.phase === 'complete' ? 1 : 0;
  const timeRatio = state.remainingSeconds / Math.max(MIN_BUDGET, script.timeLimitSeconds);
  const timeStars = Math.floor(timeRatio * (max - 1));
  const violationDeduction = Math.floor(state.safetyViolations / 2);
  return Math.max(
    0,
    Math.min(max, completionStar + timeStars - violationDeduction),
  );
}

export type MissionRunner = ReturnType<typeof createMissionRunner>;
