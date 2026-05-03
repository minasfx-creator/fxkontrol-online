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
  // ── v2.1 — novas missões ───────────────────────────────────────
  'ground-support': [
    { id: 'sp-1', position: [-10.5, 0.9, -5.4], equipmentType: 'truss-corner', label: 'GS Coluna FL' },
    { id: 'sp-2', position: [10.5, 0.9, -5.4], equipmentType: 'truss-corner', label: 'GS Coluna FR' },
    { id: 'sp-3', position: [-10.5, 0.9, 5.4], equipmentType: 'truss-corner', label: 'GS Coluna BL' },
    { id: 'sp-4', position: [10.5, 0.9, 5.4], equipmentType: 'truss-corner', label: 'GS Coluna BR' },
    { id: 'sp-5', position: [0, 12.9, -5.4], equipmentType: 'truss-straight', label: 'Header Frontal' },
  ],
  'ac-distro-check': [
    { id: 'sp-1', position: [-13.5, 0.9, 7], equipmentType: 'par-can', label: 'PE Bomba Esq.' },
    { id: 'sp-2', position: [13.5, 0.9, 7], equipmentType: 'par-can', label: 'PE Bomba Dir.' },
    { id: 'sp-3', position: [0, 0.9, 7], equipmentType: 'moving-head', label: 'RCD Centro' },
  ],
  'nfpa-mortar-layout': [
    { id: 'sp-1', position: [-12, 0.9, 8], equipmentType: 'mortar', label: 'Morteiro 3" L' },
    { id: 'sp-2', position: [12, 0.9, 8], equipmentType: 'mortar', label: 'Morteiro 3" R' },
    { id: 'sp-3', position: [0, 0.9, 9], equipmentType: 'mortar', label: 'Morteiro 3" C' },
  ],
  'rain-emergency': [
    { id: 'sp-1', position: [-9, 12.9, -5.4], equipmentType: 'sparkular', label: 'Cobrir Sparkular L' },
    { id: 'sp-2', position: [9, 12.9, -5.4], equipmentType: 'sparkular', label: 'Cobrir Sparkular R' },
    { id: 'sp-3', position: [0, 12.9, -5.4], equipmentType: 'flamer', label: 'Desligar Flamer' },
    { id: 'sp-4', position: [0, 0.9, 6], equipmentType: 'cryo', label: 'Reposicionar Cryo' },
  ],
  // ── v2.2 — Cap. 6 Soundcheck & Cap. 7 Pós-Show ─────────────────
  'soundcheck-runthrough': [
    { id: 'sp-1', position: [-9, 12.9, -5.4], equipmentType: 'moving-head', label: 'Cue 1 — Moving L' },
    { id: 'sp-2', position: [9, 12.9, -5.4], equipmentType: 'moving-head', label: 'Cue 2 — Moving R' },
    { id: 'sp-3', position: [0, 12.9, -5.4], equipmentType: 'sparkular', label: 'Cue 3 — Sparkular C' },
  ],
  'doors-open': [
    { id: 'sp-1', position: [0, 0.9, 8], equipmentType: 'mortar', label: 'Sweep Frente Palco' },
    { id: 'sp-2', position: [-10.5, 0.9, 5.4], equipmentType: 'truss-corner', label: 'Sweep Canto Esq.' },
    { id: 'sp-3', position: [10.5, 0.9, 5.4], equipmentType: 'truss-corner', label: 'Sweep Canto Dir.' },
  ],
  'cue-call-live': [
    { id: 'sp-1', position: [-4.5, 12.9, -5.4], equipmentType: 'moving-head', label: 'Patch Movings A' },
    { id: 'sp-2', position: [4.5, 12.9, -5.4], equipmentType: 'par-can', label: 'Patch PARs B' },
    { id: 'sp-3', position: [0, 12.9, -5.4], equipmentType: 'sparkular', label: 'Cue Sparkular Refrão' },
  ],
  'encore-improv': [
    { id: 'sp-1', position: [-9, 12.9, -5.4], equipmentType: 'sparkular', label: 'Sparkular Bis L' },
    { id: 'sp-2', position: [9, 12.9, -5.4], equipmentType: 'sparkular', label: 'Sparkular Bis R' },
    { id: 'sp-3', position: [0, 0.9, 6], equipmentType: 'cryo', label: 'Cryo Bis Final' },
  ],
  'teardown-rush': [
    { id: 'sp-1', position: [0, 0.9, 6], equipmentType: 'cryo', label: 'Recolher Cryo' },
    { id: 'sp-2', position: [-9, 12.9, -5.4], equipmentType: 'sparkular', label: 'Descer Sparkular L' },
    { id: 'sp-3', position: [9, 12.9, -5.4], equipmentType: 'sparkular', label: 'Descer Sparkular R' },
    { id: 'sp-4', position: [-10.5, 0.9, -5.4], equipmentType: 'truss-straight', label: 'Truss Frontal' },
  ],
  'blackbox-debrief': [
    { id: 'sp-1', position: [0, 0.9, 0], equipmentType: 'moving-head', label: 'Estação Debrief' },
  ],
  // ── v2.3 — Cap. 8 VIP & Eventos Corporativos ────────────────────
  'vip-meet-greet': [
    { id: 'sp-1', position: [-6, 0.9, 4], equipmentType: 'truss-corner', label: 'Backdrop VIP L' },
    { id: 'sp-2', position: [6, 0.9, 4], equipmentType: 'truss-corner', label: 'Backdrop VIP R' },
    { id: 'sp-3', position: [0, 0.9, 5], equipmentType: 'par-can', label: 'Spot Foto Frontal' },
    { id: 'sp-4', position: [-3, 0.9, 5.5], equipmentType: 'par-can', label: 'Spot Foto Esq.' },
    { id: 'sp-5', position: [3, 0.9, 5.5], equipmentType: 'par-can', label: 'Spot Foto Dir.' },
  ],
  'press-conference-arena': [
    { id: 'sp-1', position: [0, 0.9, 0], equipmentType: 'moving-head', label: 'Lectern Center' },
    { id: 'sp-2', position: [-4.5, 0.9, 5], equipmentType: 'par-can', label: 'Câmera Broadcast L' },
    { id: 'sp-3', position: [4.5, 0.9, 5], equipmentType: 'par-can', label: 'Câmera Broadcast R' },
    { id: 'sp-4', position: [0, 12.9, -5.4], equipmentType: 'moving-head', label: 'Key Light Lectern' },
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
