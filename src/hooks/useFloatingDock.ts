/**
 * useFloatingDock — persisted layout for SkyCanvas floating panels.
 *
 * Schema v2: { version: 2, panels: Record<id, PanelState> }.
 * Migrates silently from v1 (legacy { collapsed }).
 *
 * Pure UI state — never touches CommandBus / FieldBus / safety.
 */
import { useEffect, useSyncExternalStore } from 'react';

export type DockSlot = 'TL' | 'TR' | 'BL' | 'BR' | 'T' | 'B' | 'free';

export interface PanelState {
  slot: DockSlot;
  x: number;       // free-mode position
  y: number;
  w: number;
  h: number;
  collapsed: boolean;
}

export interface DockShape {
  version: 2;
  panels: Record<string, PanelState>;
}

const STORAGE_KEY = 'fxk.skycanvas.dock.v2';
const LEGACY_KEY = 'fxk.skycanvas.dock.v1';

const DEFAULT_PANELS: Record<string, PanelState> = {
  library:   { slot: 'TL', x: 16,  y: 80,  w: 280, h: 460, collapsed: false },
  inspector: { slot: 'TR', x: 0,   y: 80,  w: 320, h: 460, collapsed: false },
  timeline:  { slot: 'B',  x: 16,  y: 0,   w: 0,   h: 200, collapsed: false },
};

function readLS(): DockShape {
  if (typeof localStorage === 'undefined') {
    return { version: 2, panels: { ...DEFAULT_PANELS } };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.version === 2 && parsed.panels) {
        // merge so new panels added later get defaults
        return { version: 2, panels: { ...DEFAULT_PANELS, ...parsed.panels } };
      }
    }
    // migrate v1 silently
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      try {
        const v1 = JSON.parse(legacy) as Record<string, { collapsed?: boolean }>;
        const panels = { ...DEFAULT_PANELS };
        for (const k of Object.keys(panels)) {
          if (v1[k]?.collapsed != null) panels[k].collapsed = !!v1[k].collapsed;
        }
        localStorage.removeItem(LEGACY_KEY);
        return { version: 2, panels };
      } catch { /* ignore */ }
    }
  } catch { /* ignore */ }
  return { version: 2, panels: { ...DEFAULT_PANELS } };
}

function writeLS(shape: DockShape): void {
  if (typeof localStorage === 'undefined') return;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(shape)); }
  catch { /* quota */ }
}

// ── tiny pub/sub store (no zustand to keep bundle lean) ──
let state: DockShape = readLS();
const listeners = new Set<() => void>();
function emit() { for (const l of listeners) l(); }

function setState(next: DockShape) {
  state = next;
  writeLS(state);
  emit();
}

export const dockStore = {
  get: () => state,
  subscribe(l: () => void) { listeners.add(l); return () => listeners.delete(l); },

  updatePanel(id: string, patch: Partial<PanelState>) {
    const cur = state.panels[id];
    if (!cur) return;
    setState({ ...state, panels: { ...state.panels, [id]: { ...cur, ...patch } } });
  },

  toggleCollapsed(id: string) {
    const cur = state.panels[id];
    if (!cur) return;
    this.updatePanel(id, { collapsed: !cur.collapsed });
  },

  setAllCollapsed(collapsed: boolean) {
    const panels: Record<string, PanelState> = {};
    for (const k of Object.keys(state.panels)) panels[k] = { ...state.panels[k], collapsed };
    setState({ ...state, panels });
  },

  reset() {
    setState({ version: 2, panels: { ...DEFAULT_PANELS } });
  },

  /** Clamp every panel inside current viewport (run on mount + resize). */
  clampToViewport(vw: number, vh: number) {
    const panels: Record<string, PanelState> = {};
    let changed = false;
    for (const [k, p] of Object.entries(state.panels)) {
      const w = Math.min(p.w || 280, vw - 24);
      const h = Math.min(p.h || 200, vh - 24);
      const x = Math.max(8, Math.min(p.x, vw - w - 8));
      const y = Math.max(8, Math.min(p.y, vh - h - 8));
      panels[k] = { ...p, x, y, w, h };
      if (x !== p.x || y !== p.y || w !== p.w || h !== p.h) changed = true;
    }
    if (changed) setState({ ...state, panels });
  },

  /** Test-only: reset module state. */
  __resetForTests() {
    if (typeof localStorage !== 'undefined') {
      try { localStorage.removeItem(STORAGE_KEY); localStorage.removeItem(LEGACY_KEY); } catch { /* */ }
    }
    state = { version: 2, panels: { ...DEFAULT_PANELS } };
    emit();
  },
};

export function useFloatingDock() {
  const snap = useSyncExternalStore(
    (cb) => dockStore.subscribe(cb),
    () => dockStore.get(),
    () => dockStore.get(),
  );

  // Clamp on viewport resize / orientation change.
  useEffect(() => {
    const onResize = () => {
      dockStore.clampToViewport(window.innerWidth, window.innerHeight);
    };
    onResize();
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);

  return snap;
}
