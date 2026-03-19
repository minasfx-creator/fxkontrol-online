export interface Equipment {
  id: string;
  name: string;
  icon: string;
  category: 'truss' | 'sfx' | 'pyro' | 'lighting';
}

export interface Mission {
  id: string;
  title: string;
  description: string;
  scenario: string;
  equipment: string[];
  difficulty: 'easy' | 'medium' | 'hard' | 'legendary';
  xp: number;
  completed: boolean;
  locked: boolean;
  chapter: string;
}

export interface SnapPoint {
  id: string;
  position: [number, number, number];
  equipmentType: string;
  label: string;
}

export interface PlacedItem {
  snapPointId: string;
  equipmentId: string;
  position: [number, number, number];
}

export interface MissionObjective {
  id: string;
  label: string;
  equipmentId: string;
  snapPointId: string;
}

export interface SimulatorState {
  score: number;
  timeRemaining: number;
  placedItems: PlacedItem[];
  selectedEquipment: string | null;
  objectives: MissionObjective[];
  completed: boolean;
}

// Mission snap point definitions (world-space, StageEnvironment3D uses 3x scale)
// Internal coords × 3 = world coords. Truss pillars at ±3.5,±5 x=internal → ±10.5,±15 world
// Horizontal truss bar height: 4.3 internal → 12.9 world. Stage platform top: 0.3 internal → 0.9 world.
export const MISSION_SNAP_POINTS: Record<string, SnapPoint[]> = {
  'tutorial-truss': [
    { id: 'sp-1', position: [-10.5, 0.9, -5.4], equipmentType: 'truss-straight', label: 'Treliça Frontal' },
    { id: 'sp-2', position: [10.5, 0.9, -5.4], equipmentType: 'truss-straight', label: 'Treliça Traseira' },
    { id: 'sp-3', position: [-10.5, 0.9, 5.4], equipmentType: 'truss-corner', label: 'Canto Esquerdo' },
    { id: 'sp-4', position: [10.5, 0.9, 5.4], equipmentType: 'truss-corner', label: 'Canto Direito' },
  ],
  'sfx-setup': [
    { id: 'sp-1', position: [-9, 12.9, -5.4], equipmentType: 'sparkular', label: 'Sparkular Esquerdo' },
    { id: 'sp-2', position: [9, 12.9, -5.4], equipmentType: 'sparkular', label: 'Sparkular Direito' },
    { id: 'sp-3', position: [0, 12.9, -5.4], equipmentType: 'flamer', label: 'Flamer Central' },
    { id: 'sp-4', position: [0, 0.9, 6], equipmentType: 'cryo', label: 'Cryo Frontal' },
  ],
  'dmx-config': [
    { id: 'sp-1', position: [-13.5, 12.9, -5.4], equipmentType: 'moving-head', label: 'Moving Head L' },
    { id: 'sp-2', position: [-4.5, 12.9, -5.4], equipmentType: 'moving-head', label: 'Moving Head CL' },
    { id: 'sp-3', position: [4.5, 12.9, -5.4], equipmentType: 'par-can', label: 'PAR Can CR' },
    { id: 'sp-4', position: [13.5, 12.9, -5.4], equipmentType: 'sparkular', label: 'Sparkular R' },
  ],
  'drunk-invasion': [
    { id: 'sp-1', position: [-9, 12.9, -5.4], equipmentType: 'sparkular', label: 'Sparkular Seguro' },
    { id: 'sp-2', position: [9, 12.9, -5.4], equipmentType: 'flamer', label: 'Flamer Seguro' },
  ],
  'producer-late': [
    { id: 'sp-1', position: [-10.5, 0.9, -5.4], equipmentType: 'truss-straight', label: 'Treliça Improviso 1' },
    { id: 'sp-2', position: [10.5, 0.9, -5.4], equipmentType: 'truss-corner', label: 'Canto Improviso' },
    { id: 'sp-3', position: [0, 12.9, -1.5], equipmentType: 'moving-head', label: 'Moving Head Solo' },
  ],
  'full-reveillon': [
    { id: 'sp-1', position: [-10.5, 0.9, -5.4], equipmentType: 'truss-straight', label: 'Treliça Base' },
    { id: 'sp-2', position: [10.5, 0.9, -5.4], equipmentType: 'truss-corner', label: 'Canto Base' },
    { id: 'sp-3', position: [-9, 12.9, -5.4], equipmentType: 'sparkular', label: 'Sparkular L' },
    { id: 'sp-4', position: [9, 12.9, -5.4], equipmentType: 'sparkular', label: 'Sparkular R' },
    { id: 'sp-5', position: [0, 12.9, -5.4], equipmentType: 'flamer', label: 'Flamer Central' },
    { id: 'sp-6', position: [0, 0.9, 6], equipmentType: 'cryo', label: 'Cryo Show' },
  ],
};



export const MISSION_TIME_LIMITS: Record<string, number> = {
  'tutorial-truss': 120,
  'sfx-setup': 90,
  'dmx-config': 75,
  'drunk-invasion': 60,
  'producer-late': 90,
  'full-reveillon': 180,
};
