'use strict';

const DEFAULT_AI_CONTROLS = {
  enabled: false,
  assistLevel: 0.5,
  voiceEnabled: false,
  mode: 'ASSISTED',
};

function updateAIControlState(state, patch) {
  return {
    ...state,
    ...patch,
    assistLevel: Math.max(0, Math.min(1, patch.assistLevel ?? state.assistLevel)),
  };
}

module.exports = {
  DEFAULT_AI_CONTROLS,
  updateAIControlState,
};
