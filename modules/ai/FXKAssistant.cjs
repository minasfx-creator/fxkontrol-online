'use strict';

/**
 * FXKAssistant — non-intrusive state messages and voice feedback.
 */

class FXKAssistant {
  constructor() {
    this.voiceEnabled = false;
    this.lastState = null;
  }

  setVoiceEnabled(v) {
    this.voiceEnabled = !!v;
  }

  /**
   * Update assistant with current operational context.
   * @param {object} ctx - { mode, riskDetected, signalQuality, windMps, dropComing }
   * @returns {{ state, hudMessage, voiceMessage, priority }}
   */
  update(ctx) {
    const { mode, riskDetected, signalQuality, windMps, dropComing } = ctx;

    let state = mode || 'IDLE';
    let hudMessage = '';
    let voiceMessage = '';
    let priority = 'low';

    if (riskDetected) {
      state = 'ALERT';
      hudMessage = 'Risk detected — safety override active';
      voiceMessage = 'Caution: safety override engaged';
      priority = 'high';
    } else if (mode === 'CINEMATIC') {
      state = 'CINEMATIC';
      hudMessage = 'Cinematic mode — smooth tracking active';
      voiceMessage = this.voiceEnabled ? 'Cinematic mode active' : '';
      priority = 'low';
    } else if (mode === 'TRANSIT') {
      state = 'TRANSIT';
      hudMessage = 'Transit — navigating to waypoint';
      voiceMessage = this.voiceEnabled ? 'Transit mode' : '';
      priority = 'low';
    } else if (mode === 'HOLD_FRAME') {
      state = 'HOLD_FRAME';
      hudMessage = dropComing ? 'Hold frame — drop incoming, prepare wide shot' : 'Hold frame — maintaining position';
      voiceMessage = this.voiceEnabled ? 'Holding frame' : '';
      priority = 'medium';
    } else {
      state = 'IDLE';
      hudMessage = 'Systems nominal';
      voiceMessage = '';
      priority = 'low';
    }

    // Wind advisory
    if (windMps > 8) {
      hudMessage += ' | High wind advisory';
      priority = 'medium';
    }

    // Signal advisory
    if (signalQuality < 0.5) {
      hudMessage += ' | Signal degraded';
      priority = 'medium';
    }

    this.lastState = state;
    return { state, hudMessage, voiceMessage, priority };
  }
}

module.exports = { FXKAssistant };
