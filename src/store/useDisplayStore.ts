import { create } from 'zustand';

interface DisplayState {
  backlight: number;       // 10-100
  nightMode: boolean;
  showMode: boolean;
  setBacklight: (v: number) => void;
  setNightMode: (v: boolean) => void;
  setShowMode: (v: boolean) => void;
}

const stored = (key: string, fallback: any) => {
  if (typeof window === 'undefined') return fallback;
  const v = localStorage.getItem(key);
  if (v === null) return fallback;
  try { return JSON.parse(v); } catch { return fallback; }
};

export const useDisplayStore = create<DisplayState>((set) => ({
  backlight: stored('fxk-backlight', 80),
  nightMode: stored('fxk-nightmode', false),
  showMode: stored('fxk-showmode', false),
  setBacklight: (v) => {
    localStorage.setItem('fxk-backlight', JSON.stringify(v));
    set({ backlight: v });
  },
  setNightMode: (v) => {
    localStorage.setItem('fxk-nightmode', JSON.stringify(v));
    set({ nightMode: v });
  },
  setShowMode: (v) => {
    localStorage.setItem('fxk-showmode', JSON.stringify(v));
    set({ showMode: v });
  },
}));
