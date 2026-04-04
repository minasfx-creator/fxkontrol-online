/**
 * useEditorUI — Facade hook for common editor UI state
 * 
 * Consolidates the most frequently co-accessed selectors from
 * useProjectStore, useLiveSfxStore, useUSBDeviceStore, and useSMPTEStore
 * into a single import.
 * 
 * Target components: MobileHUD, LiveModeOverlay, Toolbar, and any
 * component that needs playback + hardware status at once.
 * 
 * Each selector is individually subscribed via Zustand's selector API
 * to prevent unnecessary re-renders.
 */
import { useProjectStore } from '@/store/useProjectStore';
import { useLiveSfxStore } from '@/store/useLiveSfxStore';
import { useUSBDeviceStore } from '@/store/useUSBDeviceStore';
import { useSMPTEStore } from '@/store/useSMPTEStore';

// ── Playback state ──
export function usePlaybackState() {
  const currentTime = useProjectStore(s => s.currentTime);
  const isPlaying = useProjectStore(s => s.isPlaying);
  const setPlaying = useProjectStore(s => s.setPlaying);
  const setCurrentTime = useProjectStore(s => s.setCurrentTime);
  const duration = useProjectStore(s => s.duration);
  return { currentTime, isPlaying, setPlaying, setCurrentTime, duration };
}

// ── Editor mode ──
export function useEditorMode() {
  const editorMode = useProjectStore(s => s.editorMode);
  const setEditorMode = useProjectStore(s => s.setEditorMode);
  const isPlacingMode = editorMode === 'add-pyro' || editorMode === 'add-drone';
  return { editorMode, setEditorMode, isPlacingMode };
}

// ── Selection state ──
export function useSelectionState() {
  const positions = useProjectStore(s => s.positions);
  const selectedPositionIds = useProjectStore(s => s.selectedPositionIds);
  const selectPosition = useProjectStore(s => s.selectPosition);
  const selectMultiplePositions = useProjectStore(s => s.selectMultiplePositions);
  return { positions, selectedPositionIds, selectPosition, selectMultiplePositions };
}

// ── Live hardware status (SFX + USB + SMPTE) ──
export function useHardwareStatus() {
  const activeEffects = useLiveSfxStore(s => s.activeEffects);
  const clearAll = useLiveSfxStore(s => s.clearAll);
  const usbConnected = useUSBDeviceStore(s => s.dmxDevices.length > 0);
  const smpteRunning = useSMPTEStore(s => s.running);
  const isArmed = activeEffects.length > 0;
  return { activeEffects, clearAll, usbConnected, smpteRunning, isArmed };
}

// ── Combined "editor UI" facade (most common combo) ──
export function useEditorUI() {
  const playback = usePlaybackState();
  const mode = useEditorMode();
  const hw = useHardwareStatus();
  return { ...playback, ...mode, ...hw };
}
