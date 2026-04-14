import { create } from 'zustand';

interface DisplayState {
  backlight: number;       // 10-100
  nightMode: boolean;
  showMode: boolean;
  operationMode: 'design' | 'live';
  setBacklight: (v: number) => void;
  setNightMode: (v: boolean) => void;
  setShowMode: (v: boolean) => void;
  setOperationMode: (v: 'design' | 'live') => void;
}

const stored = (key: string, fallback: any) => {
  if (typeof window === 'undefined') return fallback;
  const v = localStorage.getItem(key);
  if (v === null) return fallback;
  try { return JSON.parse(v); } catch { return fallback; }
};

export const useDisplayStore = create<DisplayState>((set) => ({
  backlight: stored('fxk-backlight', 100),
  nightMode: stored('fxk-nightmode', false),
  showMode: stored('fxk-showmode', false),
  operationMode: stored('fxk-opmode', 'design') as 'design' | 'live',
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
  setOperationMode: (v) => {
    localStorage.setItem('fxk-opmode', JSON.stringify(v));
    set({ operationMode: v });
  },
}));
