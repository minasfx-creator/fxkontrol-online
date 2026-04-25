import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/**
 * Persisted UI preferences for the DMX Panel.
 *
 * - `usbStreamFps`: last selected broadcast rate (10/20/40 Hz).
 * - `usbStreamingDesired`: whether the user wanted streaming ON when they
 *   left the panel. On remount, the panel should auto-resume *only if*
 *   the prerequisites are met (devices connected, universes patched).
 *
 * Stored in `localStorage` under `fxk:dmx-panel-prefs`.
 */
export type DMXStreamFps = 10 | 20 | 40;

interface DMXPanelPrefsState {
  usbStreamFps: DMXStreamFps;
  usbStreamingDesired: boolean;
  setUsbStreamFps: (fps: DMXStreamFps) => void;
  setUsbStreamingDesired: (on: boolean) => void;
}

export const useDMXPanelPrefs = create<DMXPanelPrefsState>()(
  persist(
    (set) => ({
      usbStreamFps: 40,
      usbStreamingDesired: false,
      setUsbStreamFps: (fps) => set({ usbStreamFps: fps }),
      setUsbStreamingDesired: (on) => set({ usbStreamingDesired: on }),
    }),
    {
      name: 'fxk:dmx-panel-prefs',
      storage: createJSONStorage(() => localStorage),
      version: 1,
      partialize: (s) => ({
        usbStreamFps: s.usbStreamFps,
        usbStreamingDesired: s.usbStreamingDesired,
      }),
    }
  )
);
