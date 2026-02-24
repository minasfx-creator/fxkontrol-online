import { create } from 'zustand';

// ─── Module Specification ───────────────────────────────────────────

export interface ModuleSpec {
  id: string;
  name: string;            // e.g. "Cobra 18R2"
  slatCount: number;       // physical slats per module
  pinsPerSlat: number;     // pins per slat
  firingSystem: string;    // universe / firing system name
}

export const DEFAULT_MODULE_SPECS: ModuleSpec[] = [
  { id: 'cobra-18r2', name: 'Cobra 18R2', slatCount: 6, pinsPerSlat: 18, firingSystem: 'Default' },
  { id: 'cobra-18r3', name: 'Cobra 18R3', slatCount: 9, pinsPerSlat: 18, firingSystem: 'Default' },
  { id: 'fireone-32', name: 'FireOne 32ch', slatCount: 4, pinsPerSlat: 8, firingSystem: 'Default' },
  { id: 'pyrodigital-32', name: 'PyroDigital 32', slatCount: 4, pinsPerSlat: 8, firingSystem: 'Default' },
  { id: 'galaxis-g2', name: 'Galaxis G2', slatCount: 5, pinsPerSlat: 20, firingSystem: 'Default' },
  { id: 'custom', name: 'Custom Module', slatCount: 5, pinsPerSlat: 20, firingSystem: 'Default' },
];

// ─── Address Assignment ─────────────────────────────────────────────

export interface Address {
  timelineItemId: string;
  module: number;
  slat: number;
  pin: number;
  locked: boolean;
  firingSystem: string;
  virtualSlat?: boolean;   // virtual slat (splitter box)
  splitterBoxId?: string;
  rackId?: string;         // rack-based addressing
}

export type AddressSortMode = 'time' | 'position' | 'module' | 'rack';

// ─── Splitter Box ───────────────────────────────────────────────────

export interface SplitterBox {
  id: string;
  name: string;
  parentModule: number;
  parentSlat: number;
  parentPin: number;
  virtualPinCount: number; // how many virtual pins this box provides
}

// ─── Firing System / Universe ───────────────────────────────────────

export interface FiringSystem {
  id: string;
  name: string;
  moduleSpec: string; // references ModuleSpec.id
}

// ─── Store ──────────────────────────────────────────────────────────

interface AddressingState {
  addresses: Address[];
  moduleSpecs: ModuleSpec[];
  activeModuleSpecId: string;
  splitterBoxes: SplitterBox[];
  firingSystems: FiringSystem[];
  sortMode: AddressSortMode;

  // Module specs
  addModuleSpec: (spec: ModuleSpec) => void;
  updateModuleSpec: (id: string, updates: Partial<Omit<ModuleSpec, 'id'>>) => void;
  removeModuleSpec: (id: string) => void;
  setActiveModuleSpec: (id: string) => void;

  // Addresses
  setAddress: (addr: Address) => void;
  removeAddress: (timelineItemId: string) => void;
  clearAddresses: () => void;
  toggleLock: (timelineItemId: string) => void;
  autoAssign: (timelineItemIds: string[], startModule?: number) => void;

  // Splitter boxes
  addSplitterBox: (box: SplitterBox) => void;
  removeSplitterBox: (id: string) => void;

  // Firing systems
  addFiringSystem: (fs: FiringSystem) => void;
  removeFiringSystem: (id: string) => void;

  // Sort
  setSortMode: (mode: AddressSortMode) => void;
}

export const useAddressingStore = create<AddressingState>((set, get) => ({
  addresses: [],
  moduleSpecs: [...DEFAULT_MODULE_SPECS],
  activeModuleSpecId: 'cobra-18r2',
  splitterBoxes: [],
  firingSystems: [{ id: 'default', name: 'Default', moduleSpec: 'cobra-18r2' }],
  sortMode: 'time',

  // Module specs
  addModuleSpec: (spec) => set(s => ({ moduleSpecs: [...s.moduleSpecs, spec] })),
  updateModuleSpec: (id, updates) => set(s => ({
    moduleSpecs: s.moduleSpecs.map(m => m.id === id ? { ...m, ...updates } : m),
  })),
  removeModuleSpec: (id) => set(s => ({
    moduleSpecs: s.moduleSpecs.filter(m => m.id !== id),
    activeModuleSpecId: s.activeModuleSpecId === id ? (s.moduleSpecs[0]?.id || '') : s.activeModuleSpecId,
  })),
  setActiveModuleSpec: (id) => set({ activeModuleSpecId: id }),

  // Addresses
  setAddress: (addr) => set(s => ({
    addresses: [
      ...s.addresses.filter(a => a.timelineItemId !== addr.timelineItemId),
      addr,
    ],
  })),
  removeAddress: (timelineItemId) => set(s => ({
    addresses: s.addresses.filter(a => a.timelineItemId !== timelineItemId),
  })),
  clearAddresses: () => set(s => ({
    addresses: s.addresses.filter(a => a.locked), // keep locked ones
  })),
  toggleLock: (timelineItemId) => set(s => ({
    addresses: s.addresses.map(a =>
      a.timelineItemId === timelineItemId ? { ...a, locked: !a.locked } : a
    ),
  })),

  autoAssign: (timelineItemIds, startModule = 1) => {
    const state = get();
    const spec = state.moduleSpecs.find(m => m.id === state.activeModuleSpecId);
    if (!spec) return;

    const locked = state.addresses.filter(a => a.locked);
    const lockedSet = new Set(locked.map(a => a.timelineItemId));
    const occupiedSlots = new Set(
      locked.map(a => `${a.module}-${a.slat}-${a.pin}`)
    );

    const toAssign = timelineItemIds.filter(id => !lockedSet.has(id));
    const newAddresses: Address[] = [...locked];

    let mod = startModule;
    let slat = 1;
    let pin = 1;

    const nextSlot = () => {
      while (occupiedSlots.has(`${mod}-${slat}-${pin}`)) {
        pin++;
        if (pin > spec.pinsPerSlat) { pin = 1; slat++; }
        if (slat > spec.slatCount) { slat = 1; mod++; }
      }
    };

    for (const itemId of toAssign) {
      nextSlot();
      const addr: Address = {
        timelineItemId: itemId,
        module: mod,
        slat,
        pin,
        locked: false,
        firingSystem: spec.firingSystem,
      };
      newAddresses.push(addr);
      occupiedSlots.add(`${mod}-${slat}-${pin}`);
      pin++;
      if (pin > spec.pinsPerSlat) { pin = 1; slat++; }
      if (slat > spec.slatCount) { slat = 1; mod++; }
    }

    set({ addresses: newAddresses });
  },

  // Splitter boxes
  addSplitterBox: (box) => set(s => ({ splitterBoxes: [...s.splitterBoxes, box] })),
  removeSplitterBox: (id) => set(s => ({ splitterBoxes: s.splitterBoxes.filter(b => b.id !== id) })),

  // Firing systems
  addFiringSystem: (fs) => set(s => ({ firingSystems: [...s.firingSystems, fs] })),
  removeFiringSystem: (id) => set(s => ({ firingSystems: s.firingSystems.filter(f => f.id !== id) })),

  // Sort
  setSortMode: (mode) => set({ sortMode: mode }),
}));
