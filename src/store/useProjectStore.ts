import { create } from 'zustand';
import type { VideoChoreoResult } from '@/lib/videoChoreoEngine';
import { createDroneFormationSlice, type DroneFormationSliceActions } from '@/store/slices/droneFormationSlice';

// ── Effect types & EFFECT_LIBRARY re-exported from src/data for backward compat ──
export type { Effect, PartType } from '@/data/effectLibrary';

// ── Project types re-exported from src/types for backward compat ──
export type {
  DepthLayer, TimelineItem, PositionType, Position,
  BezierHandle, Waypoint, Trajectory,
  EditorMode, SelectionMode, DroneFormation,
  CueMarker, CameraKeyframe, WindSettings,
} from '@/types/projectTypes';

import type {
  DepthLayer, TimelineItem, Position, PositionType, BezierHandle, Waypoint, Trajectory,
  EditorMode, SelectionMode, DroneFormation, CueMarker, CameraKeyframe, WindSettings,
} from '@/types/projectTypes';

export interface ProjectState {
  projectName: string;
  activeLockouts: string[];  // Risk groups currently locked out from firing
  setActiveLockouts: (lockouts: string[]) => void;
  toggleLockout: (riskGroup: string) => void;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  timelineItems: TimelineItem[];
  selectedEffectId: string | null;
  selectedTimelineItemId: string | null;
  selectedTimelineItemIds: string[]; // Multi-select
  positions: Position[];
  selectedPositionId: string | null;
  selectedPositionIds: string[];
  editorMode: EditorMode;
  selectionMode: SelectionMode;
  linkedTimelineItemIds: string[]; // Timeline items highlighted via position selection
  trajectories: Trajectory[];
  selectedTrajectoryId: string | null;
  selectedWaypointId: string | null;
  showTrajectories: boolean;
  drawHeight: number;
  waypointUndoStack: { trajectoryId: string; waypoint: Waypoint }[];
  audioUrl: string | null;
  bpm: number | null;
  snapToBeat: boolean;
  playbackSpeed: number;
  projectId: string | null;
  cameraKeyframes: CameraKeyframe[];
  cameraAnimationEnabled: boolean;
  wind: WindSettings;
  droneFormations: DroneFormation[];
  selectedFormationId: string | null;
  selectedTrajectoryIds: string[];
  showFormations: boolean;
  cueMarkers: CueMarker[];
  videoChoreoResult: VideoChoreoResult | null;
  depthLayers: DepthLayer[];
  gpsOrigin: { lat: number; lng: number; heading: number; altitude: number };
  locationName: string | null;
  timeZoneId: string | null;
  timeZoneOffset: number | null;   // total offset in seconds from UTC
  terrainElevation: number | null; // meters
  staticMapUrl: string | null;
  setGpsOrigin: (origin: { lat: number; lng: number; heading: number; altitude: number }) => void;
  setGeoIntelligence: (data: {
    locationName?: string | null;
    timeZoneId?: string | null;
    timeZoneOffset?: number | null;
    terrainElevation?: number | null;
    staticMapUrl?: string | null;
  }) => void;

  setPlaying: (playing: boolean) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  addTimelineItem: (item: TimelineItem) => void;
  removeTimelineItem: (id: string) => void;
  removeMultipleTimelineItems: (ids: string[]) => void;
  updateTimelineItem: (id: string, updates: Partial<Omit<TimelineItem, 'id'>>) => void;
  selectEffect: (id: string | null) => void;
  selectTimelineItem: (id: string | null) => void;
  toggleTimelineItemSelection: (id: string) => void;
  clearTimelineItemSelection: () => void;
  duplicateTimelineItems: (ids: string[]) => void;
  setProjectName: (name: string) => void;
  addPosition: (pos: Position) => void;
  updatePosition: (id: string, updates: Partial<Omit<Position, 'id'>>) => void;
  removePosition: (id: string) => void;
  selectPosition: (id: string | null) => void;
  togglePositionSelection: (id: string) => void;
  selectMultiplePositions: (ids: string[]) => void;
  setEditorMode: (mode: EditorMode) => void;
  setSelectionMode: (mode: SelectionMode) => void;
  selectPositionAndLinkedEvents: (positionId: string) => void;
  selectMultiplePositionsAndLinkedEvents: (ids: string[]) => void;
  selectTimelineItemAndLinkedPosition: (itemId: string) => void;
  addTrajectory: (traj: Trajectory) => void;
  batchImportVVIZ: (positions: Position[], trajectories: Trajectory[], projectName?: string, duration?: number) => void;
  replaceImportVVIZ: (positions: Position[], trajectories: Trajectory[], projectName?: string, duration?: number) => void;
  batchImportVVIZChunk: (positions: Position[], trajectories: Trajectory[]) => void;
  finalizeBatchImport: (projectName?: string, duration?: number) => void;
  updateTrajectory: (id: string, updates: Partial<Omit<Trajectory, 'id'>>) => void;
  removeTrajectory: (id: string) => void;
  selectTrajectory: (id: string | null) => void;
  selectWaypoint: (id: string | null) => void;
  addWaypoint: (trajectoryId: string, waypoint: Waypoint) => void;
  updateWaypoint: (trajectoryId: string, waypointId: string, updates: Partial<Omit<Waypoint, 'id'>>) => void;
  removeWaypoint: (trajectoryId: string, waypointId: string) => void;
  setShowTrajectories: (show: boolean) => void;
  setDrawHeight: (h: number) => void;
  undoLastWaypoint: () => void;
  setAudioUrl: (url: string | null) => void;
  setBpm: (bpm: number | null) => void;
  setSnapToBeat: (snap: boolean) => void;
  setPlaybackSpeed: (speed: number) => void;
  setProjectId: (id: string | null) => void;
  combineAsChain: (itemIds: string[], gap?: number) => void;
  breakChain: (chainRef: string) => void;
  addCameraKeyframe: (kf: CameraKeyframe) => void;
  updateCameraKeyframe: (id: string, updates: Partial<Omit<CameraKeyframe, 'id'>>) => void;
  removeCameraKeyframe: (id: string) => void;
  setCameraAnimationEnabled: (enabled: boolean) => void;
  setWind: (updates: Partial<WindSettings>) => void;
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
  addCueMarker: (marker: CueMarker) => void;
  removeCueMarker: (id: string) => void;
  updateCueMarker: (id: string, updates: Partial<Omit<CueMarker, 'id'>>) => void;
  clearCueMarkers: () => void;
  setVideoChoreoResult: (result: VideoChoreoResult | null) => void;
  setDepthLayers: (layers: DepthLayer[]) => void;
}

// ── EFFECT_LIBRARY re-exported from src/data/effectLibrary for backward compat ──
export { EFFECT_LIBRARY } from '@/data/effectLibrary';

export const useProjectStore = create<ProjectState>((set) => ({
  projectName: 'Untitled Show',
  isPlaying: false,
  activeLockouts: [],
  setActiveLockouts: (lockouts) => set({ activeLockouts: lockouts }),
  toggleLockout: (riskGroup) => set((s) => ({
    activeLockouts: s.activeLockouts.includes(riskGroup)
      ? s.activeLockouts.filter(r => r !== riskGroup)
      : [...s.activeLockouts, riskGroup],
  })),
  currentTime: 0,
  duration: 120,
  timelineItems: [],
  selectedEffectId: null,
  selectedTimelineItemId: null,
  selectedTimelineItemIds: [],
  positions: [],
  selectedPositionId: null,
  selectedPositionIds: [],
  editorMode: 'select',
  selectionMode: 'both',
  linkedTimelineItemIds: [],
  trajectories: [],
  selectedTrajectoryId: null,
  selectedWaypointId: null,
  showTrajectories: true,
  drawHeight: 10,
  waypointUndoStack: [],
  audioUrl: null,
  bpm: null,
  snapToBeat: false,
  playbackSpeed: 1,
  projectId: null,
  cameraKeyframes: [],
  cameraAnimationEnabled: false,
  wind: { enabled: false, direction: 0, speed: 3, gustStrength: 0.3 },
  droneFormations: [],
  selectedFormationId: null,
  selectedTrajectoryIds: [],
  showFormations: true,
  cueMarkers: [],
  videoChoreoResult: null,
  depthLayers: [],
  gpsOrigin: { lat: -23.5505, lng: -46.6333, heading: 0, altitude: 0 },
  locationName: null,
  timeZoneId: null,
  timeZoneOffset: null,
  terrainElevation: null,
  staticMapUrl: null,
  setGpsOrigin: (origin) => set({ gpsOrigin: origin }),
  setGeoIntelligence: (data) => set({
    ...(data.locationName !== undefined && { locationName: data.locationName }),
    ...(data.timeZoneId !== undefined && { timeZoneId: data.timeZoneId }),
    ...(data.timeZoneOffset !== undefined && { timeZoneOffset: data.timeZoneOffset }),
    ...(data.terrainElevation !== undefined && { terrainElevation: data.terrainElevation }),
    ...(data.staticMapUrl !== undefined && { staticMapUrl: data.staticMapUrl }),
  }),

  setPlaying: (playing) => set({ isPlaying: playing }),
  setCurrentTime: (time) => set({ currentTime: time }),
  setDuration: (duration) => set({ duration }),
  addTimelineItem: (item) => set((s) => ({ timelineItems: [...s.timelineItems, item] })),
  removeTimelineItem: (id) => set((s) => {
    const removed = s.timelineItems.find(i => i.id === id);
    const nextTimeline = s.timelineItems.filter(i => i.id !== id);
    // Auto-clean orphaned positions
    let nextPositions = s.positions;
    if (removed?.positionId) {
      const stillReferenced = nextTimeline.some(i => i.positionId === removed.positionId);
      if (!stillReferenced) {
        nextPositions = s.positions.filter(p => p.id !== removed.positionId);
      }
    }
    return {
      timelineItems: nextTimeline,
      positions: nextPositions,
      selectedTimelineItemId: s.selectedTimelineItemId === id ? null : s.selectedTimelineItemId,
    };
  }),
  removeMultipleTimelineItems: (ids) => set((s) => {
    const removedItems = s.timelineItems.filter(i => ids.includes(i.id));
    const nextTimeline = s.timelineItems.filter(i => !ids.includes(i.id));
    // Auto-clean orphaned positions
    const posIdsToCheck = [...new Set(removedItems.map(i => i.positionId).filter(Boolean))] as string[];
    const orphanedIds = posIdsToCheck.filter(pId => !nextTimeline.some(i => i.positionId === pId));
    const nextPositions = orphanedIds.length > 0 ? s.positions.filter(p => !orphanedIds.includes(p.id)) : s.positions;
    return {
      timelineItems: nextTimeline,
      positions: nextPositions,
      selectedTimelineItemId: ids.includes(s.selectedTimelineItemId || '') ? null : s.selectedTimelineItemId,
      selectedTimelineItemIds: [],
    };
  }),
  updateTimelineItem: (id, updates) => set((s) => ({
    timelineItems: s.timelineItems.map((i) => i.id === id ? { ...i, ...updates } : i),
  })),
  selectEffect: (id) => set({ selectedEffectId: id }),
  selectTimelineItem: (id) => set({ selectedTimelineItemId: id, selectedTimelineItemIds: [] }),
  toggleTimelineItemSelection: (id) => set((s) => {
    const ids = s.selectedTimelineItemIds.includes(id)
      ? s.selectedTimelineItemIds.filter((i) => i !== id)
      : [...s.selectedTimelineItemIds, id];
    return { selectedTimelineItemIds: ids, selectedTimelineItemId: ids[ids.length - 1] ?? null };
  }),
  clearTimelineItemSelection: () => set({ selectedTimelineItemIds: [], selectedTimelineItemId: null }),
  duplicateTimelineItems: (ids) => set((s) => {
    const newItems = ids.map((id) => {
      const item = s.timelineItems.find((i) => i.id === id);
      if (!item) return null;
      return {
        ...item,
        id: `tl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        startTime: item.startTime + 0.5,
      };
    }).filter(Boolean) as TimelineItem[];
    return { timelineItems: [...s.timelineItems, ...newItems] };
  }),
  setProjectName: (name) => set({ projectName: name }),
  addPosition: (pos) => set((s) => ({ positions: [...s.positions, pos] })),
  updatePosition: (id, updates) => set((s) => ({
    positions: s.positions.map((p) => p.id === id ? { ...p, ...updates } : p),
  })),
  removePosition: (id) => set((s) => ({
    positions: s.positions.filter((p) => p.id !== id),
    selectedPositionId: s.selectedPositionId === id ? null : s.selectedPositionId,
  })),
  selectPosition: (id) => set({ selectedPositionId: id, selectedPositionIds: id ? [id] : [] }),
  togglePositionSelection: (id) => set((s) => {
    const ids = s.selectedPositionIds.includes(id)
      ? s.selectedPositionIds.filter((i) => i !== id)
      : [...s.selectedPositionIds, id];
    return { selectedPositionIds: ids, selectedPositionId: ids[ids.length - 1] ?? null };
  }),
  selectMultiplePositions: (ids) => set({ selectedPositionIds: ids, selectedPositionId: ids[ids.length - 1] ?? null }),
  setEditorMode: (mode) => set({ editorMode: mode }),
  setSelectionMode: (mode) => set({ selectionMode: mode }),
  selectPositionAndLinkedEvents: (positionId) => set((s) => {
    const linkedItems = s.selectionMode !== 'positions'
      ? s.timelineItems.filter(i => i.positionId === positionId || i.positionIds?.includes(positionId)).map(i => i.id)
      : [];
    return {
      selectedPositionId: positionId,
      selectedPositionIds: [positionId],
      linkedTimelineItemIds: linkedItems,
    };
  }),
  selectMultiplePositionsAndLinkedEvents: (ids) => set((s) => {
    const linkedItems = s.selectionMode !== 'positions'
      ? s.timelineItems.filter(i => ids.includes(i.positionId || '') || i.positionIds?.some(pid => ids.includes(pid))).map(i => i.id)
      : [];
    return {
      selectedPositionIds: ids,
      selectedPositionId: ids[ids.length - 1] ?? null,
      linkedTimelineItemIds: linkedItems,
    };
  }),
  selectTimelineItemAndLinkedPosition: (itemId) => set((s) => {
    const item = s.timelineItems.find(i => i.id === itemId);
    if (!item) return { selectedTimelineItemId: itemId, selectedTimelineItemIds: [] };
    const posIds = s.selectionMode !== 'events'
      ? [item.positionId, ...(item.positionIds || [])].filter(Boolean) as string[]
      : [];
    return {
      selectedTimelineItemId: itemId,
      selectedTimelineItemIds: [],
      selectedPositionIds: posIds,
      selectedPositionId: posIds[0] ?? s.selectedPositionId,
      linkedTimelineItemIds: [],
    };
  }),

  addTrajectory: (traj) => set((s) => ({ trajectories: [...s.trajectories, traj] })),
  batchImportVVIZ: (positions, trajectories, projectName, duration) => set((s) => ({
    positions: [...s.positions, ...positions],
    trajectories: [...s.trajectories, ...trajectories],
    ...(projectName && projectName !== 'Import Error' ? { projectName } : {}),
    ...(duration && duration > 0 ? { duration } : {}),
  })),
  replaceImportVVIZ: (positions, trajectories, projectName, duration) => set((s) => ({
    positions: [...s.positions.filter(p => p.type !== 'drone-pad'), ...positions],
    trajectories: [...s.trajectories.filter(t => !positions.some(p => p.id === t.positionId) && !s.positions.some(sp => sp.type === 'drone-pad' && sp.id === t.positionId)), ...trajectories],
    ...(projectName && projectName !== 'Import Error' ? { projectName } : {}),
    ...(duration && duration > 0 ? { duration } : {}),
  })),
  batchImportVVIZChunk: (positions, trajectories) => {
    // Mutate + new ref: push into copies for O(n_chunk) not O(n_total)
    set((s) => {
      const newP = [...s.positions];
      const newT = [...s.trajectories];
      for (let i = 0; i < positions.length; i++) newP.push(positions[i]);
      for (let i = 0; i < trajectories.length; i++) newT.push(trajectories[i]);
      return { positions: newP, trajectories: newT };
    });
  },
  finalizeBatchImport: (projectName, duration) => set(() => ({
    ...(projectName && projectName !== 'Import Error' ? { projectName } : {}),
    ...(duration && duration > 0 ? { duration } : {}),
  })),
  updateTrajectory: (id, updates) => set((s) => ({
    trajectories: s.trajectories.map((t) => t.id === id ? { ...t, ...updates } : t),
  })),
  removeTrajectory: (id) => set((s) => ({
    trajectories: s.trajectories.filter((t) => t.id !== id),
    selectedTrajectoryId: s.selectedTrajectoryId === id ? null : s.selectedTrajectoryId,
  })),
  selectTrajectory: (id) => set({ selectedTrajectoryId: id }),
  selectWaypoint: (id) => set({ selectedWaypointId: id }),
  addWaypoint: (trajectoryId, waypoint) => set((s) => ({
    trajectories: s.trajectories.map((t) =>
      t.id === trajectoryId ? { ...t, waypoints: [...t.waypoints, waypoint] } : t
    ),
    waypointUndoStack: [...s.waypointUndoStack, { trajectoryId, waypoint }],
  })),
  updateWaypoint: (trajectoryId, waypointId, updates) => set((s) => ({
    trajectories: s.trajectories.map((t) =>
      t.id === trajectoryId
        ? { ...t, waypoints: t.waypoints.map((w) => w.id === waypointId ? { ...w, ...updates } : w) }
        : t
    ),
  })),
  removeWaypoint: (trajectoryId, waypointId) => set((s) => ({
    trajectories: s.trajectories.map((t) =>
      t.id === trajectoryId
        ? { ...t, waypoints: t.waypoints.filter((w) => w.id !== waypointId) }
        : t
    ),
  })),
  setShowTrajectories: (show) => set({ showTrajectories: show }),
  setDrawHeight: (h) => set({ drawHeight: h }),
  undoLastWaypoint: () => set((s) => {
    if (s.waypointUndoStack.length === 0) return s;
    const last = s.waypointUndoStack[s.waypointUndoStack.length - 1];
    return {
      waypointUndoStack: s.waypointUndoStack.slice(0, -1),
      trajectories: s.trajectories.map((t) =>
        t.id === last.trajectoryId
          ? { ...t, waypoints: t.waypoints.filter((w) => w.id !== last.waypoint.id) }
          : t
      ),
    };
  }),
  setAudioUrl: (url) => set({ audioUrl: url }),
  setBpm: (bpm) => set({ bpm }),
  setSnapToBeat: (snap) => set({ snapToBeat: snap }),
  setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),
  setProjectId: (id) => set({ projectId: id }),

  combineAsChain: (itemIds, gap = 0) => set((s) => {
    if (itemIds.length < 2) return s;
    const chainRef = `chain-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
    const items = itemIds
      .map((id) => s.timelineItems.find((i) => i.id === id))
      .filter(Boolean)
      .sort((a, b) => a!.startTime - b!.startTime) as TimelineItem[];
    return {
      timelineItems: s.timelineItems.map((item) => {
        const idx = items.findIndex((i) => i.id === item.id);
        if (idx === -1) return item;
        return { ...item, chainRef, chainGap: idx === 0 ? 0 : gap || Math.round((items[idx].startTime - items[idx - 1].startTime) * 1000) };
      }),
    };
  }),

  breakChain: (chainRef) => set((s) => ({
    timelineItems: s.timelineItems.map((item) =>
      item.chainRef === chainRef ? { ...item, chainRef: undefined, chainGap: undefined } : item
    ),
  })),

  addCameraKeyframe: (kf) => set((s) => ({
    cameraKeyframes: [...s.cameraKeyframes, kf].sort((a, b) => a.time - b.time),
  })),
  updateCameraKeyframe: (id, updates) => set((s) => ({
    cameraKeyframes: s.cameraKeyframes.map((kf) => kf.id === id ? { ...kf, ...updates } : kf).sort((a, b) => a.time - b.time),
  })),
  removeCameraKeyframe: (id) => set((s) => ({
    cameraKeyframes: s.cameraKeyframes.filter((kf) => kf.id !== id),
  })),
  setCameraAnimationEnabled: (enabled) => set({ cameraAnimationEnabled: enabled }),

  setWind: (updates) => set((s) => ({ wind: { ...s.wind, ...updates } })),

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
    if (!formation) return s;
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
    // Recalculate start times sequentially
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
    if (!src) return s;
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

  addCueMarker: (marker) => set((s) => ({ cueMarkers: [...s.cueMarkers, marker].sort((a, b) => a.time - b.time) })),
  removeCueMarker: (id) => set((s) => ({ cueMarkers: s.cueMarkers.filter((c) => c.id !== id) })),
  updateCueMarker: (id, updates) => set((s) => ({
    cueMarkers: s.cueMarkers.map((c) => c.id === id ? { ...c, ...updates } : c),
  })),
  clearCueMarkers: () => set({ cueMarkers: [] }),
  setVideoChoreoResult: (result) => set({ videoChoreoResult: result }),
  setDepthLayers: (layers) => set({ depthLayers: layers }),
}));

/**
 * effectWorldOrientation: Computes world Euler rotation by combining
 * Position (heading/pitch/roll) with Effect (pan/tilt/spin).
 * Position: R = RotY(heading) × RotX(pitch) × RotZ(roll)  — Mortar rack model
 * Effect:   R = RotY(pan) × RotX(tilt) × RotY(spin)       — Moving-head model
 * Returns combined Euler angles (in degrees) for the effect's world orientation.
 */
export function effectWorldOrientation(
  position: Position,
  item: { pan?: number; tilt?: number; spin?: number }
): { heading: number; pitch: number; roll: number } {
  const toRad = (d: number) => (d || 0) * Math.PI / 180;
  const toDeg = (r: number) => r * 180 / Math.PI;

  // Position quaternion: YXZ order (heading × pitch × roll)
  const euler1 = { x: toRad(position.pitch), y: toRad(position.heading), z: toRad(position.roll) };
  const cy1 = Math.cos(euler1.y / 2), sy1 = Math.sin(euler1.y / 2);
  const cx1 = Math.cos(euler1.x / 2), sx1 = Math.sin(euler1.x / 2);
  const cz1 = Math.cos(euler1.z / 2), sz1 = Math.sin(euler1.z / 2);

  // YXZ quaternion
  const qw1 = cy1 * cx1 * cz1 + sy1 * sx1 * sz1;
  const qx1 = cy1 * sx1 * cz1 + sy1 * cx1 * sz1;
  const qy1 = sy1 * cx1 * cz1 - cy1 * sx1 * sz1;
  const qz1 = cy1 * cx1 * sz1 - sy1 * sx1 * cz1;

  // Effect pan/tilt/spin — simplified: treat as additional YXZ
  const pan = toRad(item.pan || 0);
  const tilt = toRad(item.tilt || 0);
  const spin = toRad(item.spin || 0);
  const cy2 = Math.cos((pan + spin) / 2), sy2 = Math.sin((pan + spin) / 2);
  const cx2 = Math.cos(tilt / 2), sx2 = Math.sin(tilt / 2);

  const qw2 = cy2 * cx2;
  const qx2 = cy2 * sx2;
  const qy2 = sy2 * cx2;
  const qz2 = -sy2 * sx2;

  // Multiply q1 × q2
  const w = qw1 * qw2 - qx1 * qx2 - qy1 * qy2 - qz1 * qz2;
  const x = qw1 * qx2 + qx1 * qw2 + qy1 * qz2 - qz1 * qy2;
  const y = qw1 * qy2 - qx1 * qz2 + qy1 * qw2 + qz1 * qx2;
  const z = qw1 * qz2 + qx1 * qy2 - qy1 * qx2 + qz1 * qw2;

  // Extract YXZ Euler from quaternion
  const sinP = 2 * (w * x - y * z);
  const outPitch = toDeg(Math.asin(Math.max(-1, Math.min(1, sinP))));
  const outHeading = toDeg(Math.atan2(2 * (w * y + x * z), 1 - 2 * (x * x + y * y)));
  const outRoll = toDeg(Math.atan2(2 * (w * z + x * y), 1 - 2 * (x * x + z * z)));

  return { heading: outHeading, pitch: outPitch, roll: outRoll };
}
