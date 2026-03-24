'use strict';

/**
 * AICoPilot — processes pilot input with safety overrides.
 * Modes: MANUAL (no override), ASSISTED (smooth + safety), AI_CONTROL (full auto).
 */

const { AIDecisionEngine } = require('./AIDecisionEngine.cjs');

class AICoPilot {
  constructor(mode = 'ASSISTED') {
    this.mode = mode; // 'MANUAL' | 'ASSISTED' | 'AI_CONTROL'
    this.engine = new AIDecisionEngine();
    this.smoothingFactor = 0.7; // How much to smooth pilot input
  }

  setMode(mode) {
    this.mode = mode;
  }

  /**
   * Process pilot input through safety layer.
   * @param {object} input - { pitch, roll, yaw, throttle } each 0-1
   * @param {object} state - drone state
   * @param {Array} obstacles
   * @param {object} intent - { mode, target }
   * @returns {{ smoothedInput, overrideActive, reason, trajectory }}
   */
  processInput(input, state, obstacles = [], intent = {}) {
    // MANUAL mode — pass through raw input
    if (this.mode === 'MANUAL') {
      return {
        smoothedInput: { ...input },
        overrideActive: false,
        reason: null,
        trajectory: null,
      };
    }

    // Run decision engine
    const decision = this.engine.computeSafeTrajectory(state, obstacles, intent);

    let overrideActive = false;
    let reason = null;
    const smoothedInput = { ...input };

    if (decision.riskDetected) {
      overrideActive = true;
      reason = decision.adjustments.map(a => a.type).join(', ');

      // Attenuate dangerous inputs
      const attenuation = this.mode === 'AI_CONTROL' ? 0.1 : 0.5;
      smoothedInput.pitch = input.pitch * attenuation;
      smoothedInput.roll = input.roll * attenuation;
      smoothedInput.yaw = input.yaw * attenuation;

      // Force altitude correction if below minimum
      const altAdj = decision.adjustments.find(a => a.type === 'altitude');
      if (altAdj) {
        smoothedInput.throttle = Math.max(input.throttle, 0.8);
      }
    } else if (this.mode === 'ASSISTED') {
      // Gentle smoothing even without risk
      smoothedInput.pitch = input.pitch * this.smoothingFactor;
      smoothedInput.roll = input.roll * this.smoothingFactor;
      smoothedInput.yaw = input.yaw * this.smoothingFactor;
      smoothedInput.throttle = input.throttle;
    }

    return {
      smoothedInput,
      overrideActive,
      reason,
      trajectory: decision.safeTrajectory,
    };
  }
}

module.exports = { AICoPilot };
