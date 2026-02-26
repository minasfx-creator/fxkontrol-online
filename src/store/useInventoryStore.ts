import { create } from 'zustand';
import { EFFECT_LIBRARY, type Effect } from './useProjectStore';

export interface InventoryItem {
  effectId: string;
  onHand: number;       // total available in stock
  allocated: number;    // used in current show (auto-calculated)
  supplier: string;
  unitCost: number;     // override cost per unit
  lotNumber: string;
  notes: string;
}

export interface InventoryState {
  items: InventoryItem[];
  showCostMultiplier: number; // markup multiplier (1 = no markup)

  // Actions
  setItem: (effectId: string, updates: Partial<Omit<InventoryItem, 'effectId'>>) => void;
  removeItem: (effectId: string) => void;
  importItems: (items: InventoryItem[]) => void;
  setShowCostMultiplier: (m: number) => void;
  initDefaults: () => void;
}

export const useInventoryStore = create<InventoryState>((set) => ({
  items: [],
  showCostMultiplier: 1,

  setItem: (effectId, updates) => set((s) => {
    const existing = s.items.find((i) => i.effectId === effectId);
    if (existing) {
      return { items: s.items.map((i) => i.effectId === effectId ? { ...i, ...updates } : i) };
    }
    const effect = EFFECT_LIBRARY.find((e) => e.id === effectId);
    return {
      items: [...s.items, {
        effectId,
        onHand: 0,
        allocated: 0,
        supplier: '',
        unitCost: effect?.cost ?? 0,
        lotNumber: '',
        notes: '',
        ...updates,
      }],
    };
  }),

  removeItem: (effectId) => set((s) => ({
    items: s.items.filter((i) => i.effectId !== effectId),
  })),

  importItems: (items) => set((s) => {
    const merged = [...s.items];
    items.forEach((newItem) => {
      const idx = merged.findIndex((i) => i.effectId === newItem.effectId);
      if (idx >= 0) {
        merged[idx] = { ...merged[idx], ...newItem };
      } else {
        merged.push(newItem);
      }
    });
    return { items: merged };
  }),

  setShowCostMultiplier: (m) => set({ showCostMultiplier: m }),

  initDefaults: () => set((s) => {
    if (s.items.length > 0) return s;
    return {
      items: EFFECT_LIBRARY.map((e) => ({
        effectId: e.id,
        onHand: 50,
        allocated: 0,
        supplier: '',
        unitCost: e.cost,
        lotNumber: '',
        notes: '',
      })),
    };
  }),
}));
