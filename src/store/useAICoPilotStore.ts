/**
 * useAICoPilotStore — Zustand store for AI CoPilot state in the React UI.
 * Bridges the CJS AI modules into React land.
 */
import { create } from 'zustand';

export type AICoPilotMode = 'MANUAL' | 'ASSISTED' | 'AI_CONTROL' | 'CINEMATIC';
export type AssistantState = 'IDLE' | 'GUIDING' | 'ALERT' | 'CINEMATIC';

interface AICoPilotState {
  enabled: boolean;
  mode: AICoPilotMode;
  assistLevel: number; // 0-1
  voiceEnabled: boolean;
  // Live status from assistant
  assistantState: AssistantState;
  hudMessage: string;
  orbColor: string;
  orbOpacity: number;
  overrideActive: boolean;
  // Actions
  setEnabled: (v: boolean) => void;
  setMode: (mode: AICoPilotMode) => void;
  setAssistLevel: (level: number) => void;
  setVoiceEnabled: (v: boolean) => void;
  updateAssistantStatus: (status: { state: AssistantState; hudMessage: string; orbColor: string; orbOpacity: number }) => void;
  setOverrideActive: (v: boolean) => void;
}

export const useAICoPilotStore = create<AICoPilotState>((set) => ({
  enabled: false,
  mode: 'ASSISTED',
  assistLevel: 0.5,
  voiceEnabled: false,
  assistantState: 'IDLE',
  hudMessage: 'Systems nominal',
  orbColor: '#55C8FF',
  orbOpacity: 0.58,
  overrideActive: false,
  setEnabled: (v) => set({ enabled: v }),
  setMode: (mode) => set({ mode }),
  setAssistLevel: (level) => set({ assistLevel: Math.max(0, Math.min(1, level)) }),
  setVoiceEnabled: (v) => set({ voiceEnabled: v }),
  updateAssistantStatus: (status) => set({
    assistantState: status.state,
    hudMessage: status.hudMessage,
    orbColor: status.orbColor,
    orbOpacity: status.orbOpacity,
  }),
  setOverrideActive: (v) => set({ overrideActive: v }),
}));
