'use strict';

/**
 * FXKAssistant — non-intrusive state messages, voice feedback, and orb visuals.
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
   * @returns {{ state, hudMessage, voiceMessage, priority, orbColor, orbOpacity }}
   */
  update(ctx) {
    const { mode, riskDetected, signalQuality, windMps, dropComing } = ctx;

    let result;

    if (riskDetected) {
      result = {
        state: 'ALERT',
        hudMessage: 'Risk detected — AI safety override active',
        voiceMessage: this.voiceEnabled ? 'Safety override active.' : '',
        priority: 'high',
        orbColor: '#FF8A3D',
        orbOpacity: 0.75,
      };
    } else if (mode === 'CINEMATIC' || dropComing) {
      result = {
        state: 'CINEMATIC',
        hudMessage: 'Trajectory optimized for cinematic framing',
        voiceMessage: this.voiceEnabled ? 'Cinematic trajectory locked.' : '',
        priority: 'low',
        orbColor: '#36D1FF',
        orbOpacity: 0.6,
      };
    } else if (windMps > 8) {
      result = {
        state: 'GUIDING',
        hudMessage: 'Wind compensation active',
        voiceMessage: this.voiceEnabled ? 'Compensating wind.' : '',
        priority: 'medium',
        orbColor: '#60E0FF',
        orbOpacity: 0.62,
      };
    } else {
      result = {
        state: 'IDLE',
        hudMessage: signalQuality < 0.4 ? 'Signal unstable' : 'Signal stable',
        voiceMessage: this.voiceEnabled ? 'System stable.' : '',
        priority: 'low',
        orbColor: '#55C8FF',
        orbOpacity: 0.58,
      };
    }

    // Signal advisory appended
    if (signalQuality < 0.5 && result.state !== 'IDLE') {
      result.hudMessage += ' | Signal degraded';
      if (result.priority === 'low') result.priority = 'medium';
    }

    this.lastState = result.state;
    return result;
  }
}

module.exports = { FXKAssistant };
