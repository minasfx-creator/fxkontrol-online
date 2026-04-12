/**
 * ─── useShowPlanSync — Live ShowPlan Synchronization ────────────────
 * Subscribes to useProjectStore and automatically rebuilds the
 * canonical ShowPlan via ShowPlanManager.fromProjectStore() on every
 * relevant change (timeline, positions, trajectories).
 *
 * Mount once at app root (EngineProvider).
 */

import { useEffect, useRef } from 'react';
import { useProjectStore } from '@/store/useProjectStore';
import { showPlanManager } from '@/core/showplan/ShowPlanManager';
import { useVerificationStore } from '@/core/verification/useVerificationStore';

export function useShowPlanSync(): void {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Subscribe to granular slices that affect ShowPlan
    const unsub = useProjectStore.subscribe(
      (state, prev) => {
        const changed =
          state.timelineItems !== prev.timelineItems ||
          state.positions !== prev.positions ||
          state.trajectories !== prev.trajectories ||
          state.projectName !== prev.projectName;

        if (!changed) return;

        // Debounce rapid changes (e.g. dragging timeline items)
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          const s = useProjectStore.getState();
          showPlanManager.fromProjectStore({
            name: s.projectName,
            timeline: s.timelineItems.map(t => ({
              id: t.id,
              effectId: t.effectId,
              startTime: t.startTime,
              trackIndex: t.trackIndex,
              position: t.position,
              rack: t.rack,
              tube: t.tube,
              section: t.section,
              universe: t.universe,
              cueHeading: t.cueHeading,
              cuePitch: t.cuePitch,
            })),
            positions: s.positions.map(p => ({
              id: p.id,
              name: p.name,
              type: p.type as 'pyro' | 'drone-pad' | 'light',
              x: p.x,
              y: p.y,
              z: p.z,
              heading: p.heading,
              pitch: p.pitch,
              section: p.section,
            })),
            trajectories: s.trajectories?.map(t => ({
              id: t.id,
              positionId: t.positionId,
              waypoints: t.waypoints.map(w => ({
                id: w.id,
                position: w.position,
                time: w.time,
                maxSpeed: w.maxSpeed,
                controlIn: w.controlIn,
                controlOut: w.controlOut,
              })),
              name: t.name ?? `Trajectory ${t.id}`,
            })),
          });

          // Auto-run verification after ShowPlan rebuild
          useVerificationStore.getState().runVerification();
        }, 150);
      }
    );

    // Initial sync on mount
    const s = useProjectStore.getState();
    showPlanManager.fromProjectStore({
      name: s.projectName,
      timeline: s.timelineItems.map(t => ({
        id: t.id,
        effectId: t.effectId,
        startTime: t.startTime,
        trackIndex: t.trackIndex,
        position: t.position,
        rack: t.rack,
        tube: t.tube,
        section: t.section,
        universe: t.universe,
        cueHeading: t.cueHeading,
        cuePitch: t.cuePitch,
      })),
      positions: s.positions.map(p => ({
        id: p.id,
        name: p.name,
        type: p.type as 'pyro' | 'drone-pad' | 'light',
        x: p.x,
        y: p.y,
        z: p.z,
        heading: p.heading,
        pitch: p.pitch,
        section: p.section,
      })),
      trajectories: s.trajectories?.map(t => ({
        id: t.id,
        positionId: t.positionId,
        waypoints: t.waypoints.map(w => ({
          id: w.id,
          position: w.position,
          time: w.time,
          maxSpeed: w.maxSpeed,
          controlIn: w.controlIn,
          controlOut: w.controlOut,
        })),
        name: t.name ?? `Trajectory ${t.id}`,
      })),
    });
    useVerificationStore.getState().runVerification();

    return () => {
      unsub();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);
}
