/**
 * useViewportStore — Central viewport interaction state machine.
 * Coordinates camera, gizmo, box-select, and animation states.
 */
import { create } from 'zustand';

export type ViewportInteractionState = 'idle' | 'navigating' | 'transforming' | 'boxSelecting' | 'cameraAnimating';
export type ViewPreset = 'perspective' | 'top' | 'front' | 'back' | 'left' | 'right' | 'iso';
export type ProjectionMode = 'perspective' | 'orthographic';

/** Standard view camera configs (distance from origin) */
const VIEW_DISTANCE = 3000;
export const STANDARD_VIEW_CONFIGS: Record<ViewPreset, { position: [number, number, number]; target: [number, number, number]; projection: ProjectionMode }> = {
  perspective: { position: [0, 15, 150], target: [0, 5, 0], projection: 'perspective' },
  top:         { position: [0, VIEW_DISTANCE, 0.01], target: [0, 0, 0], projection: 'orthographic' },
  front:       { position: [0, 200, VIEW_DISTANCE], target: [0, 200, 0], projection: 'orthographic' },
  back:        { position: [0, 200, -VIEW_DISTANCE], target: [0, 200, 0], projection: 'orthographic' },
  left:        { position: [-VIEW_DISTANCE, 200, 0], target: [0, 200, 0], projection: 'orthographic' },
  right:       { position: [VIEW_DISTANCE, 200, 0], target: [0, 200, 0], projection: 'orthographic' },
  iso:         { position: [VIEW_DISTANCE * 0.7, VIEW_DISTANCE * 0.7, VIEW_DISTANCE * 0.7], target: [0, 0, 0], projection: 'perspective' },
};

interface ViewportState {
  interactionState: ViewportInteractionState;
  viewPreset: ViewPreset;
  projection: ProjectionMode;
  showGrid: boolean;
  showAxes: boolean;
  showHelpers: boolean;
  showGround: boolean;

  // Actions
  setInteractionState: (state: ViewportInteractionState) => void;
  setViewPreset: (preset: ViewPreset) => void;
  setProjection: (mode: ProjectionMode) => void;
  toggleGrid: () => void;
  toggleAxes: () => void;
  toggleHelpers: () => void;
  toggleGround: () => void;
  frameSelection: () => void;
  frameAll: () => void;
  cancelCameraAnimation: () => void;
  resetCamera: () => void;
}

export const useViewportStore = create<ViewportState>((set, get) => ({
  interactionState: 'idle',
  viewPreset: 'perspective',
  projection: 'perspective',
  showGrid: true,
  showAxes: false,
  showHelpers: true,
  showGround: true,

  setInteractionState: (state) => set({ interactionState: state }),

  setViewPreset: (preset) => {
    const config = STANDARD_VIEW_CONFIGS[preset];
    set({ viewPreset: preset, projection: config.projection });
    // Dispatch event for CameraController to consume
    window.dispatchEvent(new CustomEvent('viewport-set-view', { detail: { preset, ...config } }));
  },

  setProjection: (mode) => {
    set({ projection: mode });
    window.dispatchEvent(new CustomEvent('viewport-set-projection', { detail: mode }));
  },

  toggleGrid: () => set(s => ({ showGrid: !s.showGrid })),
  toggleAxes: () => set(s => ({ showAxes: !s.showAxes })),
  toggleHelpers: () => set(s => ({ showHelpers: !s.showHelpers })),
  toggleGround: () => set(s => ({ showGround: !s.showGround })),

  frameSelection: () => {
    window.dispatchEvent(new Event('viewport-frame-selection'));
  },

  frameAll: () => {
    window.dispatchEvent(new Event('viewport-frame-all'));
  },

  cancelCameraAnimation: () => {
    set({ interactionState: 'idle' });
    window.dispatchEvent(new Event('viewport-cancel-animation'));
  },

  resetCamera: () => {
    const config = STANDARD_VIEW_CONFIGS.perspective;
    set({ viewPreset: 'perspective', projection: 'perspective', interactionState: 'idle' });
    window.dispatchEvent(new CustomEvent('viewport-set-view', { detail: { preset: 'perspective', ...config } }));
  },
}));
