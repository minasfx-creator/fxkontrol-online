/**
 * ─── useShowPlanProjection ──────────────────────────────────────────
 * Read-only canonical projection of the active ShowPlan for the
 * Round-15 consoles (FireOne, DMX/Art-Net, Cue Conflicts, Addressing).
 *
 * • Subscribes to `useProjectStore` so a re-render is triggered when
 *   the underlying timeline / positions / trajectories change (the
 *   actual ShowPlan rebuild is performed centrally by
 *   `useShowPlanSync` mounted at app root).
 * • Returns a stable, memoised reference over the same plan object —
 *   consumers can compare `plan === prev.plan` to detect mutations.
 * • Pure observer: never mutates state, never calls the safety chain.
 */
import { useMemo } from 'react';
import { useProjectStore } from '@/store/useProjectStore';
import { showPlanManager } from '@/core/showplan/ShowPlanManager';
import type { ShowPlan } from '@/core/showplan/ShowPlan';

export interface ShowPlanProjection {
  plan: Readonly<ShowPlan>;
  pyroCueCount: number;
  dmxCueCount: number;
  droneCueCount: number;
  moduleCount: number;
  universeIds: number[];
  durationSec: number;
  updatedAt: number;
}

export function useShowPlanProjection(): ShowPlanProjection {
  // React to project-store mutations that drive ShowPlan rebuilds.
  const updatedAt = useProjectStore(
    (s) => s.timelineItems.length + s.positions.length + (s.trajectories?.length ?? 0),
  );

  return useMemo<ShowPlanProjection>(() => {
    const plan = showPlanManager.current;
    const universeIds = Array.from(
      new Set(plan.dmxCues.map((c) => c.universe)),
    ).sort((a, b) => a - b);
    return {
      plan,
      pyroCueCount: plan.pyroCues.length,
      dmxCueCount: plan.dmxCues.length,
      droneCueCount: plan.dronePaths.length,
      moduleCount: plan.hardwareConfig.modules.length,
      universeIds,
      durationSec: plan.metadata.duration,
      updatedAt: plan.metadata.updatedAt,
    };
    // Recompute when project-store hash bumps OR plan timestamp moves.
  }, [updatedAt, showPlanManager.current.metadata.updatedAt]);
}

export default useShowPlanProjection;
