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

// Mission snap point definitions
export const MISSION_SNAP_POINTS: Record<string, SnapPoint[]> = {
  'tutorial-truss': [
    { id: 'sp-1', position: [-3, 0.3, -1.5], equipmentType: 'truss-straight', label: 'Treliça Frontal' },
    { id: 'sp-2', position: [3, 0.3, -1.5], equipmentType: 'truss-straight', label: 'Treliça Traseira' },
    { id: 'sp-3', position: [-3, 0.3, 1.5], equipmentType: 'truss-corner', label: 'Canto Esquerdo' },
    { id: 'sp-4', position: [3, 0.3, 1.5], equipmentType: 'truss-corner', label: 'Canto Direito' },
  ],
  'sfx-setup': [
    { id: 'sp-1', position: [-2, 4.2, -1.8], equipmentType: 'sparkular', label: 'Sparkular Esquerdo' },
    { id: 'sp-2', position: [2, 4.2, -1.8], equipmentType: 'sparkular', label: 'Sparkular Direito' },
    { id: 'sp-3', position: [0, 4.2, -1.8], equipmentType: 'flamer', label: 'Flamer Central' },
    { id: 'sp-4', position: [0, 0.3, 2], equipmentType: 'cryo', label: 'Cryo Frontal' },
  ],
  'dmx-config': [
    { id: 'sp-1', position: [-3, 4.2, -1.8], equipmentType: 'moving-head', label: 'Moving Head L' },
    { id: 'sp-2', position: [-1, 4.2, -1.8], equipmentType: 'moving-head', label: 'Moving Head CL' },
    { id: 'sp-3', position: [1, 4.2, -1.8], equipmentType: 'par-can', label: 'PAR Can CR' },
    { id: 'sp-4', position: [3, 4.2, -1.8], equipmentType: 'sparkular', label: 'Sparkular R' },
  ],
  'drunk-invasion': [
    { id: 'sp-1', position: [-2, 4.2, -1.8], equipmentType: 'sparkular', label: 'Sparkular Seguro' },
    { id: 'sp-2', position: [2, 4.2, -1.8], equipmentType: 'flamer', label: 'Flamer Seguro' },
  ],
  'producer-late': [
    { id: 'sp-1', position: [-3, 0.3, -1.5], equipmentType: 'truss-straight', label: 'Treliça Improviso 1' },
    { id: 'sp-2', position: [3, 0.3, -1.5], equipmentType: 'truss-corner', label: 'Canto Improviso' },
    { id: 'sp-3', position: [0, 4.2, -1.8], equipmentType: 'moving-head', label: 'Moving Head Solo' },
  ],
  'full-reveillon': [
    { id: 'sp-1', position: [-3, 0.3, -1.5], equipmentType: 'truss-straight', label: 'Treliça Base' },
    { id: 'sp-2', position: [-2, 4.2, -1.8], equipmentType: 'sparkular', label: 'Sparkular L' },
    { id: 'sp-3', position: [2, 4.2, -1.8], equipmentType: 'flamer', label: 'Flamer R' },
    { id: 'sp-4', position: [0, 4.2, -1.8], equipmentType: 'moving-head', label: 'Moving Head C' },
    { id: 'sp-5', position: [0, 0.3, 3], equipmentType: 'mortar', label: 'Morteiro Frontal' },
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
