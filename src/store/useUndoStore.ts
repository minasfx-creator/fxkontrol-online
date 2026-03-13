import { create } from 'zustand';
import { useProjectStore, type ProjectState } from './useProjectStore';

type Snapshot = Pick<ProjectState,
  'positions' | 'timelineItems' | 'trajectories' | 'droneFormations' | 'cameraKeyframes'
>;

const MAX_HISTORY = 50;

interface UndoState {
  past: Snapshot[];
  future: Snapshot[];
  /** Call before any mutating action to save current state */
  checkpoint: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

function takeSnapshot(): Snapshot {
  const s = useProjectStore.getState();
  return {
    positions: structuredClone(s.positions),
    timelineItems: structuredClone(s.timelineItems),
    trajectories: structuredClone(s.trajectories),
    droneFormations: structuredClone(s.droneFormations),
    cameraKeyframes: structuredClone(s.cameraKeyframes),
  };
}

function applySnapshot(snap: Snapshot) {
  useProjectStore.setState({
    positions: snap.positions,
    timelineItems: snap.timelineItems,
    trajectories: snap.trajectories,
    droneFormations: snap.droneFormations,
    cameraKeyframes: snap.cameraKeyframes,
  });
}

export const useUndoStore = create<UndoState>((set, get) => ({
  past: [],
  future: [],
  canUndo: false,
  canRedo: false,

  checkpoint: () => {
    const snap = takeSnapshot();
    set((s) => {
      const past = [...s.past, snap];
      if (past.length > MAX_HISTORY) past.shift();
      return { past, future: [], canUndo: true, canRedo: false };
    });
  },

  undo: () => {
    const { past } = get();
    if (past.length === 0) return;
    const current = takeSnapshot();
    const prev = past[past.length - 1];
    applySnapshot(prev);
    set((s) => {
      const newPast = s.past.slice(0, -1);
      return {
        past: newPast,
        future: [current, ...s.future],
        canUndo: newPast.length > 0,
        canRedo: true,
      };
    });
  },

  redo: () => {
    const { future } = get();
    if (future.length === 0) return;
    const current = takeSnapshot();
    const next = future[0];
    applySnapshot(next);
    set((s) => {
      const newFuture = s.future.slice(1);
      return {
        past: [...s.past, current],
        future: newFuture,
        canUndo: true,
        canRedo: newFuture.length > 0,
      };
    });
  },
}));
