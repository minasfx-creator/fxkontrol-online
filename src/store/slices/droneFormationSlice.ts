/**
 * Drone Formation Slice — Zustand slice for all drone formation actions.
 * Extracted from useProjectStore (Phase 4D).
 */
import type { DroneFormation, Position, Trajectory } from '@/types/projectTypes';
import { materializeFormation as materialize } from '@/lib/formationMaterializer';

/** Minimal state shape this slice reads/writes */
export interface DroneFormationSliceState {
  droneFormations: DroneFormation[];
  selectedFormationId: string | null;
  selectedTrajectoryIds: string[];
  showFormations: boolean;
  positions: Position[];
  trajectories: Trajectory[];
}

export interface DroneFormationSliceActions {
  addDroneFormation: (formation: DroneFormation) => void;
  updateDroneFormation: (id: string, updates: Partial<Omit<DroneFormation, 'id'>>) => void;
  removeDroneFormation: (id: string) => void;
  selectFormation: (id: string | null) => void;
  materializeFormation: (formation: DroneFormation) => void;
  toggleTrajectorySelection: (id: string) => void;
  selectAllFormationTrajectories: (formationIndex: number) => void;
  clearTrajectorySelection: () => void;
  batchOffsetWaypoints: (trajectoryIds: string[], offset: { x: number; y: number; z: number }) => void;
  batchScaleWaypoints: (trajectoryIds: string[], scale: number) => void;
  setShowFormations: (show: boolean) => void;
  reorderDroneFormation: (fromIndex: number, toIndex: number) => void;
  duplicateDroneFormation: (id: string) => void;
  clearAllFormations: () => void;
  recalculateFormationTimings: () => void;
}

type Set = (fn: ((s: DroneFormationSliceState) => Partial<DroneFormationSliceState>) | Partial<DroneFormationSliceState>) => void;
type Get = () => DroneFormationSliceState;

export const createDroneFormationSlice = (set: Set, get: Get): DroneFormationSliceActions => ({
  addDroneFormation: (formation) => set((s) => ({
    droneFormations: [...s.droneFormations, formation],
  })),
  updateDroneFormation: (id, updates) => set((s) => ({
    droneFormations: s.droneFormations.map((f) => f.id === id ? { ...f, ...updates } : f),
  })),
  removeDroneFormation: (id) => set((s) => ({
    droneFormations: s.droneFormations.filter((f) => f.id !== id),
    selectedFormationId: s.selectedFormationId === id ? null : s.selectedFormationId,
  })),
  selectFormation: (id) => set({ selectedFormationId: id }),
  materializeFormation: (formation) => set((s) => {
    const existingPadCount = s.positions.filter(p => p.type === 'drone-pad').length;
    const isReuse = existingPadCount >= formation.droneCount;
    const existingPadIds = isReuse
      ? s.positions.filter(p => p.type === 'drone-pad').map(p => p.id).slice(0, formation.droneCount)
      : undefined;
    const { positions: newPads, trajectories: newTrajs } = materialize(
      formation, s.droneFormations.length, existingPadIds,
    );
    return {
      positions: isReuse ? s.positions : [...s.positions, ...newPads],
      trajectories: [...s.trajectories, ...newTrajs],
    };
  }),

  toggleTrajectorySelection: (id) => set((s) => {
    const ids = s.selectedTrajectoryIds.includes(id)
      ? s.selectedTrajectoryIds.filter((i) => i !== id)
      : [...s.selectedTrajectoryIds, id];
    return { selectedTrajectoryIds: ids };
  }),
  selectAllFormationTrajectories: (formationIndex) => set((s) => {
    const pads = s.positions.filter(p => p.type === 'drone-pad');
    const formation = s.droneFormations[formationIndex];
    if (!formation) return {};
    const padIds = pads.slice(0, formation.droneCount).map(p => p.id);
    const trajIds = s.trajectories.filter(t => padIds.includes(t.positionId)).map(t => t.id);
    return { selectedTrajectoryIds: trajIds };
  }),
  clearTrajectorySelection: () => set({ selectedTrajectoryIds: [] }),
  batchOffsetWaypoints: (trajectoryIds, offset) => set((s) => ({
    trajectories: s.trajectories.map((t) =>
      trajectoryIds.includes(t.id)
        ? {
          ...t,
          waypoints: t.waypoints.map((w) => ({
            ...w,
            position: {
              x: Math.round((w.position.x + offset.x) * 10) / 10,
              y: Math.max(0.1, Math.round((w.position.y + offset.y) * 10) / 10),
              z: Math.round((w.position.z + offset.z) * 10) / 10,
            },
          })),
        }
        : t
    ),
  })),
  batchScaleWaypoints: (trajectoryIds, scale) => set((s) => ({
    trajectories: s.trajectories.map((t) =>
      trajectoryIds.includes(t.id)
        ? {
          ...t,
          waypoints: t.waypoints.map((w) => ({
            ...w,
            position: {
              x: Math.round(w.position.x * scale * 10) / 10,
              y: Math.max(0.1, Math.round(w.position.y * scale * 10) / 10),
              z: Math.round(w.position.z * scale * 10) / 10,
            },
          })),
        }
        : t
    ),
  })),
  setShowFormations: (show) => set({ showFormations: show }),

  reorderDroneFormation: (fromIndex, toIndex) => set((s) => {
    const arr = [...s.droneFormations];
    const [moved] = arr.splice(fromIndex, 1);
    arr.splice(toIndex, 0, moved);
    let time = 0;
    const updated = arr.map(f => {
      const newF = { ...f, startTime: time };
      time += f.transitionDuration + f.holdDuration;
      return newF;
    });
    return { droneFormations: updated };
  }),

  duplicateDroneFormation: (id) => set((s) => {
    const src = s.droneFormations.find(f => f.id === id);
    if (!src) return {};
    const lastEnd = s.droneFormations.reduce((t, f) => Math.max(t, f.startTime + f.transitionDuration + f.holdDuration), 0);
    const dup: DroneFormation = {
      ...src,
      id: `form-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      startTime: lastEnd,
    };
    return { droneFormations: [...s.droneFormations, dup] };
  }),

  clearAllFormations: () => set({
    droneFormations: [],
    selectedFormationId: null,
  }),

  recalculateFormationTimings: () => set((s) => {
    let time = 0;
    const updated = s.droneFormations.map(f => {
      const newF = { ...f, startTime: time };
      time += f.transitionDuration + f.holdDuration;
      return newF;
    });
    return { droneFormations: updated };
  }),
});
