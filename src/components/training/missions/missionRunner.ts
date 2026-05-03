/**
 * Training v2.1 — Pure FSM for mission progression.
 *
 * No React, no THREE. Fully testable. UI subscribes via callbacks.
 *
 * v2.1: emits structured events (`stage:start`, `stage:complete`,
 * `objective:revealed`, `objective:complete`, `beat:start`,
 * `mission:complete`, `mission:failed`) for camera director and HUD layers.
 */
import type {
  CinematicBeat,
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

export type RunnerEvent =
  | { kind: 'stage:start'; stage: MissionStage; stageIndex: number }
  | { kind: 'stage:complete'; stage: MissionStage; stageIndex: number }
  | { kind: 'objective:revealed'; objectiveId: string; stageIndex: number }
  | { kind: 'objective:complete'; objectiveId: string; scoreDelta: number }
  | { kind: 'beat:start'; beat: CinematicBeat }
  | { kind: 'mission:complete'; finalScore: number; stars: number }
  | { kind: 'mission:failed'; reason: 'timeout' | 'safety' | 'manual' }
  | { kind: 'safety:violation'; total: number };

export type RunnerEventListener = (ev: RunnerEvent) => void;

export interface CompleteObjectiveResult {
  objectiveId: string;
  scoreDelta: number;
  stageAdvanced: boolean;
}

const MIN_BUDGET = 5;
const SAFETY_VIOLATION_LIMIT = 5;

export function createMissionRunner(script: MissionScript) {
  const listeners = new Set<RunnerListener>();
  const eventListeners = new Set<RunnerEventListener>();
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

  const fire = (ev: RunnerEvent) => {
    eventListeners.forEach((l) => {
      try { l(ev); } catch { /* swallow */ }
    });
  };

  const triggerBeats = (when: CinematicBeat['triggerOn'], stageId?: string) => {
    (script.cinematicBeats ?? []).forEach((b) => {
      if (b.triggerOn !== when) return;
      if ((when === 'stage-start' || when === 'stage-complete') && stageId && b.stageId && b.stageId !== stageId) return;
      fire({ kind: 'beat:start', beat: b });
    });
  };

  const enterStage = (idx: number) => {
    state.stageIndex = idx;
    const s = script.stages[idx];
    if (!s) return;
    fire({ kind: 'stage:start', stage: s, stageIndex: idx });
    s.objectives.forEach((o) => {
      const id = o.snapPointId ?? o.label;
      fire({ kind: 'objective:revealed', objectiveId: id, stageIndex: idx });
    });
    triggerBeats('stage-start', s.id);
  };

  return {
    get state() { return snapshot(); },
    subscribe(listener: RunnerListener): () => void {
      listeners.add(listener);
      listener(snapshot());
      return () => { listeners.delete(listener); };
    },
    onEvent(listener: RunnerEventListener): () => void {
      eventListeners.add(listener);
      return () => { eventListeners.delete(listener); };
    },
    startMission(): void {
      if (state.phase !== 'briefing') return;
      state.phase = 'running';
      emit();
      enterStage(0);
    },
    tick(dtSec: number): void {
      if (state.phase !== 'running') return;
      state.elapsedSeconds += dtSec;
      state.remainingSeconds = Math.max(0, state.remainingSeconds - dtSec);
      if (state.remainingSeconds <= 0) {
        state.phase = 'failed';
        fire({ kind: 'mission:failed', reason: 'timeout' });
      }
      emit();
    },
    completeObjective(objectiveId: string): CompleteObjectiveResult {
      if (state.phase !== 'running') return { objectiveId, scoreDelta: 0, stageAdvanced: false };
      const stage = script.stages[state.stageIndex];
      if (!stage) return { objectiveId, scoreDelta: 0, stageAdvanced: false };
      const set = completedPerStage[state.stageIndex];
      if (set.has(objectiveId)) return { objectiveId, scoreDelta: 0, stageAdvanced: false };
      set.add(objectiveId);
      const delta = 100;
      state.score += delta;
      fire({ kind: 'objective:complete', objectiveId, scoreDelta: delta });

      const stageDone = stage.objectives.every((obj) => set.has(obj.snapPointId ?? obj.label));
      let stageAdvanced = false;
      if (stageDone) {
        fire({ kind: 'stage:complete', stage, stageIndex: state.stageIndex });
        triggerBeats('stage-complete', stage.id);
        if (state.stageIndex >= script.stages.length - 1) {
          state.phase = 'complete';
          state.score += Math.round(state.remainingSeconds * script.scoreRules.timeBonusPerSecond);
          const stars = computeStarRating(script, state);
          triggerBeats('debrief');
          fire({ kind: 'mission:complete', finalScore: state.score, stars });
        } else {
          stageAdvanced = true;
          enterStage(state.stageIndex + 1);
        }
      }
      emit();
      return { objectiveId, scoreDelta: delta, stageAdvanced };
    },
    advanceStage(): void {
      if (state.phase !== 'running') return;
      const stage = script.stages[state.stageIndex];
      if (stage) {
        fire({ kind: 'stage:complete', stage, stageIndex: state.stageIndex });
        triggerBeats('stage-complete', stage.id);
      }
      if (state.stageIndex >= script.stages.length - 1) {
        state.phase = 'complete';
        const stars = computeStarRating(script, state);
        triggerBeats('debrief');
        fire({ kind: 'mission:complete', finalScore: state.score, stars });
      } else {
        enterStage(state.stageIndex + 1);
      }
      emit();
    },
    reportSafetyViolation(): void {
      if (state.phase !== 'running') return;
      state.safetyViolations += 1;
      state.score = Math.max(0, state.score - script.scoreRules.safetyPenalty);
      fire({ kind: 'safety:violation', total: state.safetyViolations });
      if (state.safetyViolations >= SAFETY_VIOLATION_LIMIT) {
        state.phase = 'failed';
        fire({ kind: 'mission:failed', reason: 'safety' });
      }
      emit();
    },
    fail(reason: 'timeout' | 'safety' | 'manual' = 'manual'): void {
      if (state.phase === 'complete' || state.phase === 'failed') return;
      state.phase = 'failed';
      fire({ kind: 'mission:failed', reason });
      emit();
    },
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
  const completionStar = state.phase === 'complete' ? 1 : 0;
  const timeRatio = state.remainingSeconds / Math.max(MIN_BUDGET, script.timeLimitSeconds);
  const timeStars = Math.floor(timeRatio * (max - 1));
  const violationDeduction = Math.floor(state.safetyViolations / 2);
  return Math.max(0, Math.min(max, completionStar + timeStars - violationDeduction));
}

export type MissionRunner = ReturnType<typeof createMissionRunner>;
