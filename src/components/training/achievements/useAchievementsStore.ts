/**
 * Training v2.1 — Achievements + Unlock persistent store.
 *
 * localStorage key: fxk.training.achievements.v1
 * Persists: lifetime achievements, mission completions, unlocked mission ids.
 * Pure store — never mutates safety, workMode, or CommandBus.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  ACHIEVEMENT_CATALOG,
  computeUnlocks,
  evaluateAchievements,
  type AchievementId,
  type AchievementEvaluationInput,
} from './achievements';
import { MISSION_SCRIPTS } from '../missions/missionScripts';

interface MissionRecord {
  missionId: string;
  completedAt: number;
  achievements: AchievementId[];
  bonusXP: number;
}

interface AchievementsState {
  /** Distinct achievement ids earned across all runs. */
  lifetime: AchievementId[];
  /** Per-mission run history (latest wins). */
  missionRuns: Record<string, MissionRecord>;
  /** Mission ids unlocked (always includes initially-unlocked missions). */
  unlockedMissions: string[];
  /** Last batch of newly-unlocked items for the toast/flash UI. */
  lastBatch: { achievements: AchievementId[]; missions: string[] } | null;

  recordMissionCompletion: (input: AchievementEvaluationInput) => {
    awarded: AchievementId[];
    bonusXP: number;
    newlyUnlockedMissions: string[];
  };
  clearLastBatch: () => void;
  isMissionUnlocked: (missionId: string) => boolean;
  hasAchievement: (id: AchievementId) => boolean;
  resetAll: () => void;
}

const initiallyUnlocked = (): string[] =>
  MISSION_SCRIPTS.filter((m) => !m.locked).map((m) => m.id);

const orderedIds = (): string[] => MISSION_SCRIPTS.map((m) => m.id);

export const useAchievementsStore = create<AchievementsState>()(
  persist(
    (set, get) => ({
      lifetime: [],
      missionRuns: {},
      unlockedMissions: initiallyUnlocked(),
      lastBatch: null,

      recordMissionCompletion: (input) => {
        const { script } = input;
        const { awarded, bonusXP } = evaluateAchievements(input);

        const prev = get();
        const lifetimeMerged = Array.from(new Set([...prev.lifetime, ...awarded]));

        const { unlocked, newlyUnlocked } = computeUnlocks({
          orderedMissionIds: orderedIds(),
          justCompletedId: script.id,
          lifetimeAchievements: lifetimeMerged,
          currentUnlocked: prev.unlockedMissions,
        });

        const newAchievements = awarded.filter((a) => !prev.lifetime.includes(a));

        set({
          lifetime: lifetimeMerged,
          missionRuns: {
            ...prev.missionRuns,
            [script.id]: {
              missionId: script.id,
              completedAt: Date.now(),
              achievements: awarded,
              bonusXP,
            },
          },
          unlockedMissions: unlocked,
          lastBatch:
            newAchievements.length || newlyUnlocked.length
              ? { achievements: newAchievements, missions: newlyUnlocked }
              : null,
        });

        return { awarded, bonusXP, newlyUnlockedMissions: newlyUnlocked };
      },

      clearLastBatch: () => set({ lastBatch: null }),

      isMissionUnlocked: (missionId) => {
        const s = get();
        return s.unlockedMissions.includes(missionId);
      },

      hasAchievement: (id) => get().lifetime.includes(id),

      resetAll: () =>
        set({
          lifetime: [],
          missionRuns: {},
          unlockedMissions: initiallyUnlocked(),
          lastBatch: null,
        }),
    }),
    {
      name: 'fxk.training.achievements.v1',
      storage: createJSONStorage(() => localStorage),
      version: 1,
    },
  ),
);

export { ACHIEVEMENT_CATALOG };
