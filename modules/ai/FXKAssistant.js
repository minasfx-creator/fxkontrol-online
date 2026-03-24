'use strict';

const { buildHologramFrame, getHologramUXTokens } = require('./HologramAssistantUX');

class FXKAssistant {
  constructor() {
    this.voiceEnabled = false;
  }

  setVoiceEnabled(enabled) {
    this.voiceEnabled = enabled;
  }

  update(context) {
    const hologram = buildHologramFrame({
      riskDetected: context.riskDetected,
      cinematic: context.mode === 'CINEMATIC' || !!context.dropComing,
      signalQuality: context.signalQuality,
      windMps: context.windMps,
    });

    const stateByMood = {
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

module.exports = { FXKAssistant };
