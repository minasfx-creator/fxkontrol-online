import { create } from 'zustand';

export type RackType = 'single-shot' | 'fan' | 'circle' | 'tiltable' | 'variable-tube' | 'cake-rack' | 'candle-rack' | 'z-rack';

export interface RackTube {
  id: string;
  caliber: number;   // inches
  angle: number;     // tilt angle from vertical (0 = straight up)
  heading: number;   // azimuth angle (degrees)
  effectId?: string; // assigned timeline item id
  row: number;       // grid row
  col: number;       // grid column
  status: 'empty' | 'loaded' | 'fired' | 'dud';
  label?: string;    // e.g. "A1", "B3"
}

export interface Rack {
  id: string;
  name: string;
  type: RackType;
  positionId: string;
  tubes: RackTube[];
  rows: number;
  cols: number;
  // Fan-specific
  fanAngleStart?: number;
  fanAngleEnd?: number;
  // Circle-specific
  circleRadius?: number;
  // Visual
  color: string;
  rotation: number;  // rack rotation in degrees on the ground
  locked: boolean;
}

export const RACK_TYPE_INFO: Record<RackType, { label: string; icon: string; description: string; defaultRows: number; defaultCols: number; defaultCaliber: number }> = {
  'single-shot': { label: 'Single Shot', icon: '🎯', description: 'Individual mortar tubes', defaultRows: 1, defaultCols: 6, defaultCaliber: 3 },
  'fan': { label: 'Fan Rack', icon: '🪭', description: 'Tubes angled in a fan spread', defaultRows: 1, defaultCols: 9, defaultCaliber: 3 },
  'circle': { label: 'Circle Rack', icon: '⭕', description: 'Tubes arranged in a circle', defaultRows: 1, defaultCols: 8, defaultCaliber: 4 },
  'tiltable': { label: 'Tiltable Rack', icon: '📐', description: 'Adjustable-angle rack', defaultRows: 2, defaultCols: 6, defaultCaliber: 3 },
  'variable-tube': { label: 'Multi-Caliber', icon: '🧪', description: 'Mixed caliber tubes', defaultRows: 2, defaultCols: 5, defaultCaliber: 3 },
  'cake-rack': { label: 'Cake Rack', icon: '🎂', description: 'Holds cake/battery devices', defaultRows: 2, defaultCols: 3, defaultCaliber: 1 },
  'candle-rack': { label: 'Roman Candle', icon: '🕯️', description: 'Roman candle holder rack', defaultRows: 1, defaultCols: 12, defaultCaliber: 1 },
  'z-rack': { label: 'Z-Rack', icon: '⚡', description: 'Zigzag angled for spread patterns', defaultRows: 2, defaultCols: 6, defaultCaliber: 3 },
};

// Pre-built rack templates
export interface RackTemplate {
  id: string;
  name: string;
  type: RackType;
  rows: number;
  cols: number;
  caliber: number;
  fanAngleStart?: number;
  fanAngleEnd?: number;
  description: string;
}

export const RACK_TEMPLATES: RackTemplate[] = [
  { id: 'tpl-6x3-fan', name: '6-Shot 3" Fan', type: 'fan', rows: 1, cols: 6, caliber: 3, fanAngleStart: -30, fanAngleEnd: 30, description: 'Standard 6-tube fan rack' },
  { id: 'tpl-9x3-fan', name: '9-Shot 3" Fan', type: 'fan', rows: 1, cols: 9, caliber: 3, fanAngleStart: -45, fanAngleEnd: 45, description: 'Wide 9-tube fan rack' },
  { id: 'tpl-12x2-fan', name: '12-Shot 2" Fan', type: 'fan', rows: 1, cols: 12, caliber: 2, fanAngleStart: -50, fanAngleEnd: 50, description: '12-tube small-caliber fan' },
  { id: 'tpl-6x4-single', name: '6-Shot 4" Mortar', type: 'single-shot', rows: 1, cols: 6, caliber: 4, description: '4-inch mortar rack' },
  { id: 'tpl-4x5-single', name: '4-Shot 5" Mortar', type: 'single-shot', rows: 1, cols: 4, caliber: 5, description: '5-inch mortar rack' },
  { id: 'tpl-3x6-single', name: '3-Shot 6" Mortar', type: 'single-shot', rows: 1, cols: 3, caliber: 6, description: '6-inch single shots' },
  { id: 'tpl-2x8-single', name: '2-Shot 8" Mortar', type: 'single-shot', rows: 1, cols: 2, caliber: 8, description: '8-inch artillery shells' },
  { id: 'tpl-8-circle', name: '8-Tube Circle', type: 'circle', rows: 1, cols: 8, caliber: 3, description: 'Circular arrangement' },
  { id: 'tpl-12x3-tilt', name: '12-Shot Tiltable', type: 'tiltable', rows: 2, cols: 6, caliber: 3, description: '2x6 tiltable rack' },
  { id: 'tpl-2x3-cake', name: '6-Pos Cake Rack', type: 'cake-rack', rows: 2, cols: 3, caliber: 1, description: 'Holds 6 cakes/batteries' },
  { id: 'tpl-12-candle', name: '12-Candle Holder', type: 'candle-rack', rows: 1, cols: 12, caliber: 1, description: '12 roman candle slots' },
  { id: 'tpl-z12', name: '12-Shot Z-Rack', type: 'z-rack', rows: 2, cols: 6, caliber: 3, description: 'Zigzag pattern spread' },
  { id: 'tpl-mixed-10', name: '10-Tube Mixed', type: 'variable-tube', rows: 2, cols: 5, caliber: 3, description: 'Mixed 2"-5" calibers' },
];

interface RackState {
  racks: Rack[];
  selectedRackId: string | null;
  selectedTubeId: string | null;
  showRack3D: boolean;

  addRack: (rack: Rack) => void;
  addRackFromTemplate: (templateId: string, positionId: string) => void;
  updateRack: (id: string, updates: Partial<Omit<Rack, 'id'>>) => void;
  removeRack: (id: string) => void;
  selectRack: (id: string | null) => void;
  selectTube: (tubeId: string | null) => void;
  duplicateRack: (id: string) => void;
  setShowRack3D: (v: boolean) => void;

  addTube: (rackId: string, tube: RackTube) => void;
  updateTube: (rackId: string, tubeId: string, updates: Partial<Omit<RackTube, 'id'>>) => void;
  removeTube: (rackId: string, tubeId: string) => void;
  setAllTubesCaliber: (rackId: string, caliber: number) => void;
  setAllTubesAngle: (rackId: string, angle: number) => void;
  clearAllEffects: (rackId: string) => void;

  // Auto-assign racks to positions
  autoAssignToPositions: (positionIds: string[]) => void;
}

function generateTubes(type: RackType, rows: number, cols: number, caliber: number, opts?: { fanAngleStart?: number; fanAngleEnd?: number }): RackTube[] {
  const tubes: RackTube[] = [];
  const count = type === 'circle' ? cols : rows * cols;

  for (let i = 0; i < count; i++) {
    const row = type === 'circle' ? 0 : Math.floor(i / cols);
    const col = type === 'circle' ? i : i % cols;
    const id = `tube-${Date.now()}-${i}`;
    let angle = 0;
    let heading = 0;
    let tubeCaliber = caliber;

    switch (type) {
      case 'circle':
        heading = (360 / count) * i;
        angle = 15;
        break;
      case 'fan': {
        const start = opts?.fanAngleStart ?? -45;
        const end = opts?.fanAngleEnd ?? 45;
        heading = count > 1 ? start + ((end - start) / (count - 1)) * i : 0;
        angle = 30;
        break;
      }
      case 'tiltable':
        angle = 30;
        heading = 0;
        break;
      case 'z-rack':
        heading = row % 2 === 0 ? -25 + (50 / Math.max(cols - 1, 1)) * col : 25 - (50 / Math.max(cols - 1, 1)) * col;
        angle = 25 + row * 10;
        break;
      case 'variable-tube':
        angle = 0;
        heading = 0;
        // Vary calibers: 2, 3, 4, 5 in pattern
        tubeCaliber = [2, 3, 4, 5, 3][i % 5];
        break;
      case 'cake-rack':
      case 'candle-rack':
        angle = 0;
        heading = 0;
        tubeCaliber = 1;
        break;
      default:
        angle = 0;
        heading = 0;
    }

    const rowLabel = String.fromCharCode(65 + row);
    const label = `${rowLabel}${col + 1}`;

    tubes.push({ id, caliber: tubeCaliber, angle, heading, row, col, status: 'empty', label });
  }
  return tubes;
}

const RACK_COLORS = ['#e63946', '#457b9d', '#2a9d8f', '#e9c46a', '#f4a261', '#264653', '#8338ec', '#ff006e'];
let colorIdx = 0;

export const useRackStore = create<RackState>((set, get) => ({
  racks: [],
  selectedRackId: null,
  selectedTubeId: null,
  showRack3D: true,

  addRack: (rack) => set((s) => ({ racks: [...s.racks, rack] })),

  addRackFromTemplate: (templateId, positionId) => {
    const tpl = RACK_TEMPLATES.find(t => t.id === templateId);
    if (!tpl) return;
    const rack: Rack = {
      id: `rack-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: tpl.name,
      type: tpl.type,
      positionId,
      rows: tpl.rows,
      cols: tpl.cols,
      tubes: generateTubes(tpl.type, tpl.rows, tpl.cols, tpl.caliber, { fanAngleStart: tpl.fanAngleStart, fanAngleEnd: tpl.fanAngleEnd }),
      fanAngleStart: tpl.fanAngleStart,
      fanAngleEnd: tpl.fanAngleEnd,
      color: RACK_COLORS[colorIdx++ % RACK_COLORS.length],
      rotation: 0,
      locked: false,
    };
    set(s => ({ racks: [...s.racks, rack], selectedRackId: rack.id }));
  },

  updateRack: (id, updates) => set((s) => ({
    racks: s.racks.map(r => r.id === id ? { ...r, ...updates } : r),
  })),
  removeRack: (id) => set((s) => ({
    racks: s.racks.filter(r => r.id !== id),
    selectedRackId: s.selectedRackId === id ? null : s.selectedRackId,
  })),
  selectRack: (id) => set({ selectedRackId: id, selectedTubeId: null }),
  selectTube: (tubeId) => set({ selectedTubeId: tubeId }),
  setShowRack3D: (v) => set({ showRack3D: v }),

  duplicateRack: (id) => {
    const state = get();
    const source = state.racks.find(r => r.id === id);
    if (!source) return;
    const newRack: Rack = {
      ...source,
      id: `rack-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: `${source.name} (copy)`,
      tubes: source.tubes.map(t => ({ ...t, id: `tube-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, effectId: undefined, status: 'empty' as const })),
      locked: false,
    };
    set(s => ({ racks: [...s.racks, newRack], selectedRackId: newRack.id }));
  },

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
  setAllTubesCaliber: (rackId, caliber) => set((s) => ({
    racks: s.racks.map(r =>
      r.id === rackId ? { ...r, tubes: r.tubes.map(t => ({ ...t, caliber })) } : r
    ),
  })),
  setAllTubesAngle: (rackId, angle) => set((s) => ({
    racks: s.racks.map(r =>
      r.id === rackId ? { ...r, tubes: r.tubes.map(t => ({ ...t, angle })) } : r
    ),
  })),
  clearAllEffects: (rackId) => set((s) => ({
    racks: s.racks.map(r =>
      r.id === rackId ? { ...r, tubes: r.tubes.map(t => ({ ...t, effectId: undefined, status: 'empty' as const })) } : r
    ),
  })),

  autoAssignToPositions: (positionIds) => {
    const state = get();
    const unassigned = state.racks.filter(r => !r.positionId || r.positionId === '');
    if (unassigned.length === 0 || positionIds.length === 0) return;

    const updates = unassigned.map((rack, i) => ({
      ...rack,
      positionId: positionIds[i % positionIds.length],
    }));

    set(s => ({
      racks: s.racks.map(r => {
        const updated = updates.find(u => u.id === r.id);
        return updated || r;
      }),
    }));
  },
}));

export { generateTubes };
