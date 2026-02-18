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
}

export type EditorMode = 'select' | 'add-pyro' | 'add-drone';

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
  editorMode: EditorMode;

  setPlaying: (playing: boolean) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  addTimelineItem: (item: TimelineItem) => void;
  removeTimelineItem: (id: string) => void;
  selectEffect: (id: string | null) => void;
  selectTimelineItem: (id: string | null) => void;
  setProjectName: (name: string) => void;
  addPosition: (pos: Position) => void;
  updatePosition: (id: string, updates: Partial<Omit<Position, 'id'>>) => void;
  removePosition: (id: string) => void;
  selectPosition: (id: string | null) => void;
  setEditorMode: (mode: EditorMode) => void;
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
  editorMode: 'select',

  setPlaying: (playing) => set({ isPlaying: playing }),
  setCurrentTime: (time) => set({ currentTime: time }),
  setDuration: (duration) => set({ duration }),
  addTimelineItem: (item) => set((s) => ({ timelineItems: [...s.timelineItems, item] })),
  removeTimelineItem: (id) => set((s) => ({ timelineItems: s.timelineItems.filter((i) => i.id !== id) })),
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
  selectPosition: (id) => set({ selectedPositionId: id }),
  setEditorMode: (mode) => set({ editorMode: mode }),
}));
