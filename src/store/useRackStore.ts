import { create } from 'zustand';

export type RackType = 'circle' | 'tiltable' | 'fan' | 'variable-tube';

export interface RackTube {
  id: string;
  caliber: number; // inches
  angle: number;   // tilt angle from vertical
  heading: number;  // azimuth angle
  effectId?: string; // assigned timeline item id
}

export interface Rack {
  id: string;
  name: string;
  type: RackType;
  positionId: string; // linked to a Position
  tubes: RackTube[];
  // Fan-specific
  fanAngleStart?: number;
  fanAngleEnd?: number;
  // Circle-specific
  circleRadius?: number;
}

export const RACK_TYPE_INFO: Record<RackType, { label: string; icon: string; description: string }> = {
  'circle': { label: 'Circle Rack', icon: '⭕', description: 'Tubes arranged in a circle pattern' },
  'tiltable': { label: 'Tiltable Rack', icon: '📐', description: 'Single-angle tiltable rack' },
  'fan': { label: 'Fan Rack', icon: '🪭', description: 'Tubes spread in a fan pattern' },
  'variable-tube': { label: 'Variable Tube', icon: '🧪', description: 'Mixed-caliber tube rack' },
};

interface RackState {
  racks: Rack[];
  selectedRackId: string | null;
  addRack: (rack: Rack) => void;
  updateRack: (id: string, updates: Partial<Omit<Rack, 'id'>>) => void;
  removeRack: (id: string) => void;
  selectRack: (id: string | null) => void;
  addTube: (rackId: string, tube: RackTube) => void;
  updateTube: (rackId: string, tubeId: string, updates: Partial<Omit<RackTube, 'id'>>) => void;
  removeTube: (rackId: string, tubeId: string) => void;
}

function generateTubes(type: RackType, count: number, caliber: number): RackTube[] {
  const tubes: RackTube[] = [];
  for (let i = 0; i < count; i++) {
    const id = `tube-${Date.now()}-${i}`;
    let angle = 0;
    let heading = 0;
    switch (type) {
      case 'circle':
        heading = (360 / count) * i;
        angle = 15;
        break;
      case 'fan':
        heading = -45 + (90 / Math.max(count - 1, 1)) * i;
        angle = 30;
        break;
      case 'tiltable':
        angle = 30;
        heading = 0;
        break;
      case 'variable-tube':
        angle = 0;
        heading = (360 / count) * i;
        break;
    }
    tubes.push({ id, caliber, angle, heading });
  }
  return tubes;
}

export const useRackStore = create<RackState>((set) => ({
  racks: [],
  selectedRackId: null,

  addRack: (rack) => set((s) => ({ racks: [...s.racks, rack] })),
  updateRack: (id, updates) => set((s) => ({
    racks: s.racks.map(r => r.id === id ? { ...r, ...updates } : r),
  })),
  removeRack: (id) => set((s) => ({
    racks: s.racks.filter(r => r.id !== id),
    selectedRackId: s.selectedRackId === id ? null : s.selectedRackId,
  })),
  selectRack: (id) => set({ selectedRackId: id }),

  addTube: (rackId, tube) => set((s) => ({
    racks: s.racks.map(r =>
      r.id === rackId ? { ...r, tubes: [...r.tubes, tube] } : r
    ),
  })),
  updateTube: (rackId, tubeId, updates) => set((s) => ({
    racks: s.racks.map(r =>
      r.id === rackId
        ? { ...r, tubes: r.tubes.map(t => t.id === tubeId ? { ...t, ...updates } : t) }
        : r
    ),
  })),
  removeTube: (rackId, tubeId) => set((s) => ({
    racks: s.racks.map(r =>
      r.id === rackId ? { ...r, tubes: r.tubes.filter(t => t.id !== tubeId) } : r
    ),
  })),
}));

export { generateTubes };
