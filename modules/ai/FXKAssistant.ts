import { AICoPilotMode } from './AIDecisionEngine';
import { buildHologramFrame, getHologramUXTokens, HologramFrame } from './HologramAssistantUX';

export type AssistantState = 'IDLE' | 'GUIDING' | 'ALERT' | 'CINEMATIC';

export interface AssistantContext {
  mode: AICoPilotMode;
  riskDetected: boolean;
  signalQuality: number;
  windMps: number;
  dropComing?: boolean;
}

export interface AssistantOutput {
  state: AssistantState;
  hudMessage: string;
  voiceMessage?: string;
  orbColor: string;
  orbOpacity: number;
  hologram: HologramFrame;
  uxTokens: ReturnType<typeof getHologramUXTokens>;
}

export class FXKAssistant {
  private voiceEnabled = false;

  setVoiceEnabled(enabled: boolean): void {
    this.voiceEnabled = enabled;
  }

  update(context: AssistantContext): AssistantOutput {
    const hologram = buildHologramFrame({
      riskDetected: context.riskDetected,
      cinematic: context.mode === 'CINEMATIC' || !!context.dropComing,
      signalQuality: context.signalQuality,
      windMps: context.windMps,
    });

    const stateByMood: Record<HologramFrame['mood'], AssistantState> = {
      ALERT: 'ALERT',
      CINEMATIC: 'CINEMATIC',
      FOCUS: 'GUIDING',
      CALM: 'IDLE',
    };

    return {
      state: stateByMood[hologram.mood],
      hudMessage: hologram.title,
      voiceMessage: this.voiceEnabled ? hologram.voiceHint : undefined,
      orbColor: hologram.theme.core,
      orbOpacity: hologram.theme.opacity,
      hologram,
      uxTokens: getHologramUXTokens(),
    };
  }
}
