'use strict';

/**
 * AssistantOrb — visual presets for the AI assistant indicator orb.
 */

const ORB_PRESETS = {
  IDLE:      { color: '#4488FF', glow: 0.3, opacity: 0.5, pulseSpeed: 1.0, size: 1.0 },
  CINEMATIC: { color: '#88FFAA', glow: 0.5, opacity: 0.7, pulseSpeed: 0.8, size: 1.1 },
  TRANSIT:   { color: '#FFAA44', glow: 0.4, opacity: 0.6, pulseSpeed: 1.2, size: 1.0 },
  ALERT:     { color: '#FF4444', glow: 0.9, opacity: 0.95, pulseSpeed: 2.5, size: 1.3 },
  AI_CONTROL:{ color: '#AA44FF', glow: 0.7, opacity: 0.8, pulseSpeed: 1.5, size: 1.2 },
  HOLD_FRAME:{ color: '#44DDFF', glow: 0.5, opacity: 0.65, pulseSpeed: 0.6, size: 1.05 },
};

/**
 * Get visual properties for the assistant orb by state.
 * @param {string} state
 * @returns {{ color, glow, opacity, pulseSpeed, size }}
 */
function getAssistantOrbVisual(state) {
  return ORB_PRESETS[state] || ORB_PRESETS.IDLE;
}

module.exports = { getAssistantOrbVisual, ORB_PRESETS };
