/**
 * HUD Layer Manager — Centralized overlay visibility with z-order and mutual exclusion.
 *
 * Layer stack:
 *   L5: Alerts      — panic, collision, armed (highest priority, always shown)
 *   L4: Modals      — RadialMenu, Wizard, ConfirmDialogs
 *   L3: Contextual  — LiveCard, AngleEditor, PropertySliders
 *   L2: Persistent  — Crosshairs, Compass, SafetyIndicators
 *   L1: Ambient     — Telemetry, SMPTE, PerfStats (auto-fade after inactivity)
 *   L0: Canvas      — R3F viewport (always visible)
 *
 * Rules:
 *   - L4 open → suppress L3 (modals block contextual cards)
 *   - L5 open → suppress L3 + L1 (alerts focus attention)
 *   - L1 auto-fades after AMBIENT_FADE_MS of inactivity
 *   - Only one L4 overlay active at a time (mutual exclusion)
 */

import { create } from 'zustand';

// ── Layer Definitions ──
export enum HUDLayer {
  Canvas     = 0,
  Ambient    = 1,
  Persistent = 2,
  Contextual = 3,
  Modal      = 4,
  Alert      = 5,
}

export const HUD_Z_INDEX: Record<HUDLayer, number> = {
  [HUDLayer.Canvas]:     0,
  [HUDLayer.Ambient]:    10,
  [HUDLayer.Persistent]: 20,
  [HUDLayer.Contextual]: 30,
  [HUDLayer.Modal]:      40,
  [HUDLayer.Alert]:      50,
};

// ── Overlay Registration ──
export interface HUDOverlay {
  id: string;
  layer: HUDLayer;
  /** If true, this overlay suppresses all others in its layer (modal exclusion) */
  exclusive?: boolean;
}

// ── Ambient auto-fade timing ──
const AMBIENT_FADE_MS = 5000;

// ── Store ──
interface HUDLayerState {
  /** Currently active overlay IDs per layer */
  activeOverlays: Map<HUDLayer, Set<string>>;

  /** Timestamp of last user interaction (for ambient fade) */
  lastInteractionTime: number;

  /** Whether ambient layer is currently faded */
  ambientFaded: boolean;

  // ── Actions ──
  showOverlay: (overlay: HUDOverlay) => void;
  hideOverlay: (id: string, layer: HUDLayer) => void;
  hideAllInLayer: (layer: HUDLayer) => void;
  touchInteraction: () => void;
  tickAmbientFade: () => void;

  /** Check if an overlay should be visible given exclusion rules */
  isVisible: (id: string, layer: HUDLayer) => boolean;

  /** Check if a layer is suppressed by higher-priority layers */
  isLayerSuppressed: (layer: HUDLayer) => boolean;

  /** Get the z-index for a layer */
  getZIndex: (layer: HUDLayer) => number;

  /** Get all active overlay IDs */
  getActiveIds: () => string[];
}

const createInitialOverlays = (): Map<HUDLayer, Set<string>> => {
  const map = new Map<HUDLayer, Set<string>>();
  for (let i = 0; i <= 5; i++) {
    map.set(i as HUDLayer, new Set());
  }
  return map;
};

export const useHUDLayerStore = create<HUDLayerState>((set, get) => ({
  activeOverlays: createInitialOverlays(),
  lastInteractionTime: Date.now(),
  ambientFaded: false,

  showOverlay: (overlay: HUDOverlay) => {
    set(state => {
      const newOverlays = new Map(state.activeOverlays);
      const layerSet = new Set(newOverlays.get(overlay.layer) || []);

      // Modal exclusion: only one modal at a time
      if (overlay.layer === HUDLayer.Modal && overlay.exclusive !== false) {
        layerSet.clear();
      }

      layerSet.add(overlay.id);
      newOverlays.set(overlay.layer, layerSet);

      return { activeOverlays: newOverlays };
    });
  },

  hideOverlay: (id: string, layer: HUDLayer) => {
    set(state => {
      const newOverlays = new Map(state.activeOverlays);
      const layerSet = new Set(newOverlays.get(layer) || []);
      layerSet.delete(id);
      newOverlays.set(layer, layerSet);
      return { activeOverlays: newOverlays };
    });
  },

  hideAllInLayer: (layer: HUDLayer) => {
    set(state => {
      const newOverlays = new Map(state.activeOverlays);
      newOverlays.set(layer, new Set());
      return { activeOverlays: newOverlays };
    });
  },

  touchInteraction: () => {
    set({ lastInteractionTime: Date.now(), ambientFaded: false });
  },

  tickAmbientFade: () => {
    const { lastInteractionTime, ambientFaded } = get();
    const elapsed = Date.now() - lastInteractionTime;
    if (elapsed > AMBIENT_FADE_MS && !ambientFaded) {
      set({ ambientFaded: true });
    }
  },

  isVisible: (id: string, layer: HUDLayer) => {
    const state = get();

    // Check suppression first
    if (state.isLayerSuppressed(layer)) return false;

    // Check ambient fade
    if (layer === HUDLayer.Ambient && state.ambientFaded) return false;

    // Check if overlay is active
    const layerSet = state.activeOverlays.get(layer);
    return layerSet?.has(id) ?? false;
  },

  isLayerSuppressed: (layer: HUDLayer) => {
    const state = get();
    const alertActive = (state.activeOverlays.get(HUDLayer.Alert)?.size ?? 0) > 0;
    const modalActive = (state.activeOverlays.get(HUDLayer.Modal)?.size ?? 0) > 0;

    // Alerts suppress Contextual + Ambient
    if (alertActive && (layer === HUDLayer.Contextual || layer === HUDLayer.Ambient)) {
      return true;
    }

    // Modals suppress Contextual
    if (modalActive && layer === HUDLayer.Contextual) {
      return true;
    }

    return false;
  },

  getZIndex: (layer: HUDLayer) => HUD_Z_INDEX[layer],

  getActiveIds: () => {
    const state = get();
    const ids: string[] = [];
    state.activeOverlays.forEach(set => {
      set.forEach(id => ids.push(id));
    });
    return ids;
  },
}));

// ── Ambient fade ticker (call from requestAnimationFrame or useEffect interval) ──
let _ambientInterval: ReturnType<typeof setInterval> | null = null;

export function startAmbientFadeTicker(): void {
  if (_ambientInterval) return;
  _ambientInterval = setInterval(() => {
    useHUDLayerStore.getState().tickAmbientFade();
  }, 1000);
}

export function stopAmbientFadeTicker(): void {
  if (_ambientInterval) {
    clearInterval(_ambientInterval);
    _ambientInterval = null;
  }
}

// ── Convenience helpers ──
export function showAlert(id: string): void {
  useHUDLayerStore.getState().showOverlay({ id, layer: HUDLayer.Alert });
}

export function hideAlert(id: string): void {
  useHUDLayerStore.getState().hideOverlay(id, HUDLayer.Alert);
}

export function showModal(id: string): void {
  useHUDLayerStore.getState().showOverlay({ id, layer: HUDLayer.Modal, exclusive: true });
}

export function hideModal(id: string): void {
  useHUDLayerStore.getState().hideOverlay(id, HUDLayer.Modal);
}

export function showContextual(id: string): void {
  useHUDLayerStore.getState().showOverlay({ id, layer: HUDLayer.Contextual });
}

export function hideContextual(id: string): void {
  useHUDLayerStore.getState().hideOverlay(id, HUDLayer.Contextual);
}
