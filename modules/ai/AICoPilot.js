'use strict';

const { AIDecisionEngine } = require('./AIDecisionEngine');

const clamp = (n, min = -1, max = 1) => Math.max(min, Math.min(max, n));
const lerp = (a, b, t) => a + (b - a) * t;

class AICoPilot {
  constructor(mode = 'ASSISTED') {
    this.mode = mode;
    this.decisionEngine = new AIDecisionEngine();
  }

  setMode(mode) {
    this.mode = mode;
  }

  getMode() {
    return this.mode;
  }

  processInput(input, state, obstacles, goal) {
    const decision = this.decisionEngine.computeSafeTrajectory(state, obstacles, goal);

    const safeInput = {
      pitch: clamp(input.pitch * 0.85),
      roll: clamp(input.roll * 0.85),
      yaw: clamp(input.yaw * 0.9),
      throttle: clamp(input.throttle * 0.9, 0, 1),
    };

    const assistedInput = {
      pitch: lerp(input.pitch, safeInput.pitch, 0.2),
      roll: lerp(input.roll, safeInput.roll, 0.2),
      yaw: lerp(input.yaw, safeInput.yaw, 0.2),
      throttle: lerp(input.throttle, safeInput.throttle, 0.2),
    };

    const overrideActive = decision.riskDetected && this.mode !== 'MANUAL';

    const modeInput = {
      MANUAL: input,
      ASSISTED: assistedInput,
      AI_CONTROL: safeInput,
      CINEMATIC: {
        pitch: assistedInput.pitch * 0.7,
        roll: assistedInput.roll * 0.7,
        yaw: assistedInput.yaw * 0.65,
        throttle: clamp(assistedInput.throttle * 0.8, 0, 1),
      },
    };

    const finalInput = overrideActive ? safeInput : modeInput[this.mode];

    return {
      mode: this.mode,
      smoothedInput: finalInput,
      overrideActive,
      decision,
      suggestedCameraTarget: decision.safeTrajectory[decision.safeTrajectory.length - 1],
    };
  }
}

module.exports = { AICoPilot };
