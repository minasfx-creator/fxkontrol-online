/**
 * ─── Imported .fwe Effects store ──────────────────────────────────
 * Holds runtime-imported `Effect` records produced by `parseFweXml`.
 * Persisted to localStorage so an imported library survives reloads.
 *
 * Stable key: each Effect's `id` (derived from filename via
 * `fweEffectId`) — re-importing the same file replaces the entry
 * rather than duplicating it.
 */

import { create } from 'zustand';
import type { Effect } from '@/data/effectLibrary';

const LS_KEY = 'fxk.imported-fwe-effects.v1';

function loadFromStorage(): Effect[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((e): e is Effect => !!e && typeof e.id === 'string');
  } catch {
    return [];
  }
}

function saveToStorage(items: Effect[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(items));
  } catch {
    /* quota / private mode — ignore */
  }
}

interface ImportedFweState {
  effects: Effect[];
  addOrReplace: (fx: Effect) => void;
  remove: (id: string) => void;
  clear: () => void;
}

export const useImportedFweStore = create<ImportedFweState>((set, get) => ({
  effects: loadFromStorage(),
  addOrReplace: (fx) => {
    const next = [...get().effects.filter((e) => e.id !== fx.id), fx];
    saveToStorage(next);
    set({ effects: next });
  },
  remove: (id) => {
    const next = get().effects.filter((e) => e.id !== id);
    saveToStorage(next);
    set({ effects: next });
  },
  clear: () => {
    saveToStorage([]);
    set({ effects: [] });
  },
}));
