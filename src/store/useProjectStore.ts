import { create } from 'zustand';

export interface Effect {
  id: string;
  name: string;
  category: 'morteiros' | 'peonias' | 'drones' | 'formacoes';
  type: 'firework' | 'drone';
  color: string;
  duration: number;
  cost: number;
  icon: string;
}

export interface TimelineItem {
  id: string;
  effectId: string;
  startTime: number;
  trackIndex: number;
  position: { x: number; y: number; z: number };
  // Finale 3D Script fields
  pan?: number;       // counter-clockwise around Y-axis, 0 = facing viewer
  tilt?: number;      // angle from vertical
  chainRef?: string;  // chain reference ID - all items in same chain share this
  chainGap?: number;  // delay (ms) from previous item in chain
  positionName?: string; // assigned position name
  notes?: string;
}

export type PositionType = 'pyro' | 'drone-pad';

export interface Position {
  id: string;
  name: string;
  type: PositionType;
  x: number;
  y: number;
  z: number;
  heading: number;
  pitch: number;
  roll: number;
  color: string;
}

export interface Waypoint {
  id: string;
  position: { x: number; y: number; z: number };
  time: number;
}

export interface Trajectory {
  id: string;
  positionId: string;
  waypoints: Waypoint[];
  name: string;
}

export type EditorMode = 'select' | 'add-pyro' | 'add-drone' | 'add-waypoint';

export interface DroneFormation {
  id: string;
  formationType: string; // heart, star, circle, etc.
  droneCount: number;
  height: number; // meters
  radius: number;
  spacing: number;
  rotation: number;
  startTime: number; // seconds - when transition starts
  transitionDuration: number; // seconds - time to reach formation
  holdDuration: number; // seconds - time to hold formation
  color: string;
  points: { x: number; z: number }[]; // 2D formation points
}

export interface CameraKeyframe {
  id: string;
  time: number; // seconds
  position: [number, number, number];
  lookAt: [number, number, number];
  fov: number;
}

export interface WindSettings {
  enabled: boolean;
  direction: number; // degrees, 0 = north (+Z)
  speed: number;     // m/s
  gustStrength: number; // 0-1 multiplier for random gusts
}

export interface ProjectState {
  projectName: string;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  timelineItems: TimelineItem[];
  selectedEffectId: string | null;
  selectedTimelineItemId: string | null;
  positions: Position[];
  selectedPositionId: string | null;
  selectedPositionIds: string[];
  editorMode: EditorMode;
  trajectories: Trajectory[];
  selectedTrajectoryId: string | null;
  showTrajectories: boolean;
  audioUrl: string | null;
  bpm: number | null;
  snapToBeat: boolean;
  playbackSpeed: number;
  projectId: string | null;
  // Camera animation
  cameraKeyframes: CameraKeyframe[];
  cameraAnimationEnabled: boolean;
  // Wind
  wind: WindSettings;
  // Drone choreography formations
  droneFormations: DroneFormation[];
  selectedFormationId: string | null;

  setPlaying: (playing: boolean) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  addTimelineItem: (item: TimelineItem) => void;
  removeTimelineItem: (id: string) => void;
  updateTimelineItem: (id: string, updates: Partial<Omit<TimelineItem, 'id'>>) => void;
  selectEffect: (id: string | null) => void;
  selectTimelineItem: (id: string | null) => void;
  setProjectName: (name: string) => void;
  addPosition: (pos: Position) => void;
  updatePosition: (id: string, updates: Partial<Omit<Position, 'id'>>) => void;
  removePosition: (id: string) => void;
  selectPosition: (id: string | null) => void;
  togglePositionSelection: (id: string) => void;
  selectMultiplePositions: (ids: string[]) => void;
  setEditorMode: (mode: EditorMode) => void;
  addTrajectory: (traj: Trajectory) => void;
  updateTrajectory: (id: string, updates: Partial<Omit<Trajectory, 'id'>>) => void;
  removeTrajectory: (id: string) => void;
  selectTrajectory: (id: string | null) => void;
  addWaypoint: (trajectoryId: string, waypoint: Waypoint) => void;
  updateWaypoint: (trajectoryId: string, waypointId: string, updates: Partial<Omit<Waypoint, 'id'>>) => void;
  removeWaypoint: (trajectoryId: string, waypointId: string) => void;
  setShowTrajectories: (show: boolean) => void;
  setAudioUrl: (url: string | null) => void;
  setBpm: (bpm: number | null) => void;
  setSnapToBeat: (snap: boolean) => void;
  setPlaybackSpeed: (speed: number) => void;
  setProjectId: (id: string | null) => void;
  // Chain operations
  combineAsChain: (itemIds: string[], gap?: number) => void;
  breakChain: (chainRef: string) => void;
  // Camera keyframe operations
  addCameraKeyframe: (kf: CameraKeyframe) => void;
  updateCameraKeyframe: (id: string, updates: Partial<Omit<CameraKeyframe, 'id'>>) => void;
  removeCameraKeyframe: (id: string) => void;
  setCameraAnimationEnabled: (enabled: boolean) => void;
  // Wind
  setWind: (updates: Partial<WindSettings>) => void;
  // Drone formations
  addDroneFormation: (formation: DroneFormation) => void;
  updateDroneFormation: (id: string, updates: Partial<Omit<DroneFormation, 'id'>>) => void;
  removeDroneFormation: (id: string) => void;
  selectFormation: (id: string | null) => void;
}

export const EFFECT_LIBRARY: Effect[] = [
  // Morteiros
  { id: 'mort-01', name: 'Chrysanthemum 3"', category: 'morteiros', type: 'firework', color: '#FFD700', duration: 2.5, cost: 12, icon: '💥' },
  { id: 'mort-02', name: 'Willow 4"', category: 'morteiros', type: 'firework', color: '#FFA500', duration: 3.5, cost: 18, icon: '🎆' },
  { id: 'mort-03', name: 'Brocade Crown 5"', category: 'morteiros', type: 'firework', color: '#FFE4B5', duration: 4, cost: 25, icon: '👑' },
  { id: 'mort-04', name: 'Coconut Palm 6"', category: 'morteiros', type: 'firework', color: '#FF6347', duration: 5, cost: 35, icon: '🌴' },
  // Peônias
  { id: 'peon-01', name: 'Red Peony', category: 'peonias', type: 'firework', color: '#FF0000', duration: 2, cost: 10, icon: '🔴' },
  { id: 'peon-02', name: 'Blue Peony', category: 'peonias', type: 'firework', color: '#0088FF', duration: 2, cost: 10, icon: '🔵' },
  { id: 'peon-03', name: 'Green Peony', category: 'peonias', type: 'firework', color: '#00FF88', duration: 2, cost: 10, icon: '🟢' },
  { id: 'peon-04', name: 'Purple Dahlia', category: 'peonias', type: 'firework', color: '#9B30FF', duration: 2.5, cost: 14, icon: '🟣' },
  // Drones
  { id: 'drone-01', name: 'Single LED Point', category: 'drones', type: 'drone', color: '#00FFFF', duration: 10, cost: 0.5, icon: '💡' },
  { id: 'drone-02', name: 'RGB Cluster x4', category: 'drones', type: 'drone', color: '#FFFFFF', duration: 10, cost: 2, icon: '✨' },
  { id: 'drone-03', name: 'Strobe Unit', category: 'drones', type: 'drone', color: '#FFFFFF', duration: 5, cost: 1, icon: '⚡' },
  // Formações
  { id: 'form-01', name: 'Heart Formation', category: 'formacoes', type: 'drone', color: '#FF69B4', duration: 15, cost: 50, icon: '❤️' },
  { id: 'form-02', name: 'Star Formation', category: 'formacoes', type: 'drone', color: '#FFD700', duration: 15, cost: 50, icon: '⭐' },
  { id: 'form-03', name: 'Wave Pattern', category: 'formacoes', type: 'drone', color: '#00BFFF', duration: 12, cost: 40, icon: '🌊' },
  { id: 'form-04', name: 'Spiral Ascent', category: 'formacoes', type: 'drone', color: '#FF4500', duration: 20, cost: 60, icon: '🌀' },
  // Spark
  { id: 'spark-01', name: 'Silver Spark Fountain', category: 'morteiros', type: 'firework', color: '#C0C0C0', duration: 3, cost: 8, icon: '✳️' },
  { id: 'spark-02', name: 'Gold Spark Jet', category: 'morteiros', type: 'firework', color: '#FFD700', duration: 4, cost: 10, icon: '⚜️' },
  // Shell
  { id: 'shell-01', name: 'Titanium Shell 4"', category: 'morteiros', type: 'firework', color: '#E8E8E8', duration: 3, cost: 20, icon: '💫' },
  { id: 'shell-02', name: 'Color Shell 6"', category: 'morteiros', type: 'firework', color: '#FF1493', duration: 4.5, cost: 30, icon: '🎇' },
  // Comet
  { id: 'comet-01', name: 'Rising Comet', category: 'peonias', type: 'firework', color: '#00FFFF', duration: 1.5, cost: 6, icon: '☄️' },
  { id: 'comet-02', name: 'Falling Comet Trail', category: 'peonias', type: 'firework', color: '#FFA07A', duration: 2, cost: 8, icon: '🌠' },
  // Flare
  { id: 'flare-01', name: 'Red Signal Flare', category: 'peonias', type: 'firework', color: '#FF0000', duration: 5, cost: 4, icon: '🔥' },
  { id: 'flare-02', name: 'White Magnesium Flare', category: 'peonias', type: 'firework', color: '#FFFAFA', duration: 6, cost: 5, icon: '💡' },
  // MultiBurst
  { id: 'mburst-01', name: 'Triple Burst 3"', category: 'morteiros', type: 'firework', color: '#FF6347', duration: 3.5, cost: 22, icon: '🎆' },
  { id: 'mburst-02', name: 'Penta Burst 5"', category: 'morteiros', type: 'firework', color: '#9400D3', duration: 5, cost: 40, icon: '💥' },
  // Fan
  { id: 'fan-01', name: 'Fan Spread 90°', category: 'morteiros', type: 'firework', color: '#FFD700', duration: 2, cost: 15, icon: '🪭' },
  { id: 'fan-02', name: 'Wide Fan 180°', category: 'morteiros', type: 'firework', color: '#00FF7F', duration: 2.5, cost: 20, icon: '🌈' },
  // AerialRing
  { id: 'aring-01', name: 'Saturn Ring', category: 'formacoes', type: 'drone', color: '#FFD700', duration: 12, cost: 45, icon: '💍' },
  { id: 'aring-02', name: 'Neon Halo', category: 'formacoes', type: 'drone', color: '#00FFFF', duration: 10, cost: 35, icon: '⭕' },
  // Shockwave
  { id: 'shock-01', name: 'Ground Shockwave', category: 'morteiros', type: 'firework', color: '#FF4500', duration: 1.5, cost: 18, icon: '💢' },
  { id: 'shock-02', name: 'Aerial Shockwave', category: 'morteiros', type: 'firework', color: '#FFFFFF', duration: 2, cost: 25, icon: '🔆' },
];

export const useProjectStore = create<ProjectState>((set) => ({
  projectName: 'Untitled Show',
  isPlaying: false,
  currentTime: 0,
  duration: 120,
  timelineItems: [],
  selectedEffectId: null,
  selectedTimelineItemId: null,
  positions: [],
  selectedPositionId: null,
  selectedPositionIds: [],
  editorMode: 'select',
  trajectories: [],
  selectedTrajectoryId: null,
  showTrajectories: true,
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

  setPlaying: (playing) => set({ isPlaying: playing }),
  setCurrentTime: (time) => set({ currentTime: time }),
  setDuration: (duration) => set({ duration }),
  addTimelineItem: (item) => set((s) => ({ timelineItems: [...s.timelineItems, item] })),
  removeTimelineItem: (id) => set((s) => ({ timelineItems: s.timelineItems.filter((i) => i.id !== id) })),
  updateTimelineItem: (id, updates) => set((s) => ({
    timelineItems: s.timelineItems.map((i) => i.id === id ? { ...i, ...updates } : i),
  })),
  selectEffect: (id) => set({ selectedEffectId: id }),
  selectTimelineItem: (id) => set({ selectedTimelineItemId: id }),
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

  addTrajectory: (traj) => set((s) => ({ trajectories: [...s.trajectories, traj] })),
  updateTrajectory: (id, updates) => set((s) => ({
    trajectories: s.trajectories.map((t) => t.id === id ? { ...t, ...updates } : t),
  })),
  removeTrajectory: (id) => set((s) => ({
    trajectories: s.trajectories.filter((t) => t.id !== id),
    selectedTrajectoryId: s.selectedTrajectoryId === id ? null : s.selectedTrajectoryId,
  })),
  selectTrajectory: (id) => set({ selectedTrajectoryId: id }),
  addWaypoint: (trajectoryId, waypoint) => set((s) => ({
    trajectories: s.trajectories.map((t) =>
      t.id === trajectoryId ? { ...t, waypoints: [...t.waypoints, waypoint] } : t
    ),
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
  setAudioUrl: (url) => set({ audioUrl: url }),
  setBpm: (bpm) => set({ bpm }),
  setSnapToBeat: (snap) => set({ snapToBeat: snap }),
  setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),
  setProjectId: (id) => set({ projectId: id }),

  // Chain operations
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
        return {
          ...item,
          chainRef,
          chainGap: idx === 0 ? 0 : gap || Math.round((items[idx].startTime - items[idx - 1].startTime) * 1000),
        };
      }),
    };
  }),

  breakChain: (chainRef) => set((s) => ({
    timelineItems: s.timelineItems.map((item) =>
      item.chainRef === chainRef
        ? { ...item, chainRef: undefined, chainGap: undefined }
        : item
    ),
  })),

  // Camera keyframe operations
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

  // Wind
  setWind: (updates) => set((s) => ({ wind: { ...s.wind, ...updates } })),

  // Drone formations
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
}));
