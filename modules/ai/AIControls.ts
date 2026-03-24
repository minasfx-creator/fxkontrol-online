import { AICoPilotMode } from './AIDecisionEngine';

export interface AIControlState {
  enabled: boolean;
  assistLevel: number; // 0..1
  voiceEnabled: boolean;
  mode: AICoPilotMode;
}

export const DEFAULT_AI_CONTROLS: AIControlState = {
  enabled: false,
  assistLevel: 0.5,
  voiceEnabled: false,
  mode: 'ASSISTED',
};

export function updateAIControlState(state: AIControlState, patch: Partial<AIControlState>): AIControlState {
  return {
    ...state,
    ...patch,
    assistLevel: Math.max(0, Math.min(1, patch.assistLevel ?? state.assistLevel)),
  };
}
