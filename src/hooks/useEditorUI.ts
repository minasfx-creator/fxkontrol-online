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
import { useTimelineClock } from '@/hooks/useTimelineClock';

// ── Playback state ──
export function usePlaybackState() {
  const { time, playing, duration, speed, source, play, pause, toggle, seek, setSpeed } = useTimelineClock();
  return {
    currentTime: time,
    isPlaying: playing,
    duration,
    playbackSpeed: speed,
    timelineSource: source,
    setPlaying: (next: boolean) => (next ? play() : pause()),
    togglePlaying: toggle,
    setCurrentTime: seek,
    setPlaybackSpeed: setSpeed,
    play,
    pause,
    seek,
  };
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
