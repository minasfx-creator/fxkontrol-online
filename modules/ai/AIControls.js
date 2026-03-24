'use strict';

/**
 * AIControls — toggle state for co-pilot, assistance level, voice, and mode.
 */

const DEFAULT_AI_CONTROLS = {
  enabled: false,
  assistLevel: 0.5,    // 0-1
  voiceEnabled: false,
  mode: 'ASSISTED',    // 'MANUAL' | 'ASSISTED' | 'AI_CONTROL'
};

/**
 * Immutably update AI control state.
 * @param {object} current
 * @param {object} patch
 * @returns {object} new state
 */
function updateAIControlState(current, patch) {
  const next = { ...current };
  if (patch.enabled !== undefined) next.enabled = !!patch.enabled;
  if (patch.assistLevel !== undefined) next.assistLevel = Math.max(0, Math.min(1, patch.assistLevel));
  if (patch.voiceEnabled !== undefined) next.voiceEnabled = !!patch.voiceEnabled;
  if (patch.mode !== undefined) next.mode = patch.mode;
  return next;
}

module.exports = { DEFAULT_AI_CONTROLS, updateAIControlState };
