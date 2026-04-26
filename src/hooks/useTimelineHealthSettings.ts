/**
 * useTimelineHealthSettings — operator-tunable thresholds for the timeline
 * clock watchdog (`useTimelineClockHealthCheck`).
 *
 * The watchdog defaults (750 ms stall threshold, 4 s recovery cooldown,
 * 200 ms sample interval) are tuned for typical desktop/laptop conditions,
 * but real shows run on a wide range of hardware:
 *
 *   - Underpowered live machines may need a *larger* stall threshold so a
 *     normal frame hitch isn't flagged as a stall.
 *   - QA / studio rigs may want an aggressive *smaller* threshold to catch
 *     micro-freezes early.
 *   - When debugging chronic stalls the operator may want the cooldown to
 *     drop to ~1 s so the watchdog tries to recover more aggressively.
 *
 * This store persists the operator's preferences in `localStorage`, exposes
 * them via Zustand, and is the single source of truth that the watchdog
 * reads on mount and re-reads whenever the settings change.
 *
 * Bounds chosen to keep the system safe:
 *   - stallThresholdMs : 250..5000 ms
 *   - recoveryCooldownMs: 500..30000 ms
 *   - sampleIntervalMs : 50..1000 ms
 *
 * Outside-of-bounds values from a tampered localStorage payload are clamped
 * on hydrate via `clampSettings()`.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface TimelineHealthSettings {
  stallThresholdMs: number;
  recoveryCooldownMs: number;
  sampleIntervalMs: number;
}

export const TIMELINE_HEALTH_DEFAULTS: TimelineHealthSettings = {
  stallThresholdMs: 750,
  recoveryCooldownMs: 4000,
  sampleIntervalMs: 200,
};

export const TIMELINE_HEALTH_BOUNDS = {
  stallThresholdMs: { min: 250, max: 5000, step: 50 },
  recoveryCooldownMs: { min: 500, max: 30000, step: 250 },
  sampleIntervalMs: { min: 50, max: 1000, step: 50 },
} as const;

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

export function clampSettings(s: Partial<TimelineHealthSettings>): TimelineHealthSettings {
  return {
    stallThresholdMs: clamp(
      s.stallThresholdMs ?? TIMELINE_HEALTH_DEFAULTS.stallThresholdMs,
      TIMELINE_HEALTH_BOUNDS.stallThresholdMs.min,
      TIMELINE_HEALTH_BOUNDS.stallThresholdMs.max,
    ),
    recoveryCooldownMs: clamp(
      s.recoveryCooldownMs ?? TIMELINE_HEALTH_DEFAULTS.recoveryCooldownMs,
      TIMELINE_HEALTH_BOUNDS.recoveryCooldownMs.min,
      TIMELINE_HEALTH_BOUNDS.recoveryCooldownMs.max,
    ),
    sampleIntervalMs: clamp(
      s.sampleIntervalMs ?? TIMELINE_HEALTH_DEFAULTS.sampleIntervalMs,
      TIMELINE_HEALTH_BOUNDS.sampleIntervalMs.min,
      TIMELINE_HEALTH_BOUNDS.sampleIntervalMs.max,
    ),
  };
}

interface TimelineHealthSettingsStore extends TimelineHealthSettings {
  set: (partial: Partial<TimelineHealthSettings>) => void;
  reset: () => void;
}

export const useTimelineHealthSettings = create<TimelineHealthSettingsStore>()(
  persist(
    (set) => ({
      ...TIMELINE_HEALTH_DEFAULTS,
      set: (partial) =>
        set((prev) => clampSettings({ ...prev, ...partial })),
      reset: () => set({ ...TIMELINE_HEALTH_DEFAULTS }),
    }),
    {
      name: 'fxk:timeline:health-settings',
      storage: createJSONStorage(() => localStorage),
      // Re-clamp on hydrate so a tampered payload can never push the
      // watchdog into a runaway state (eg sampleInterval = 1ms).
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const safe = clampSettings(state);
        Object.assign(state, safe);
      },
    },
  ),
);
