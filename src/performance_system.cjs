'use strict';

const QUALITY_LEVELS = Object.freeze(['cinematic', 'high', 'balanced', 'performance', 'safe']);

const DEFAULT_THRESHOLDS = Object.freeze({
  fpsSoftFloor: 50,
  fpsHardFloor: 40,
  gpuFrameSoftMs: 18,
  gpuFrameHardMs: 24,
  maxVramMb: 1024,
  maxDrawCalls: 1500,
});

class AdaptiveQualitySystem {
  constructor(options = {}) {
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...options };
    this.levelIndex = 1; // high
    this.effectBudget = {
      bloom: true,
      volumetricFog: true,
      heavyShaders: true,
      particlesHighQuality: true,
    };
  }

  getLevel() {
    return QUALITY_LEVELS[this.levelIndex];
  }

  getEffectBudget() {
    return { ...this.effectBudget };
  }

  evaluateFrame({ fps, gpuFrameMs, vramMb, drawCalls }) {
    const actions = [];

    const hardPressure =
      fps < this.thresholds.fpsHardFloor ||
      gpuFrameMs > this.thresholds.gpuFrameHardMs ||
      vramMb > this.thresholds.maxVramMb ||
      drawCalls > this.thresholds.maxDrawCalls;

    const softPressure =
      fps < this.thresholds.fpsSoftFloor ||
      gpuFrameMs > this.thresholds.gpuFrameSoftMs;

    if (hardPressure) {
      this._degradeLevel();
      this._disableHeavyShaders();
      actions.push('hard_pressure_detected', 'degrade_quality', 'disable_heavy_shaders');
    } else if (softPressure) {
      this._degradeLevel();
      this._reduceEffects();
      actions.push('soft_pressure_detected', 'degrade_quality', 'reduce_effects');
    } else {
      this._recoverLevel();
      this._recoverEffects();
      actions.push('stable_frame');
    }

    return {
      actions,
      qualityLevel: this.getLevel(),
      effectBudget: this.getEffectBudget(),
    };
  }

  _degradeLevel() {
    if (this.levelIndex < QUALITY_LEVELS.length - 1) this.levelIndex += 1;
  }

  _recoverLevel() {
    if (this.levelIndex > 0) this.levelIndex -= 1;
  }

  _reduceEffects() {
    this.effectBudget.bloom = false;
    this.effectBudget.volumetricFog = false;
  }

  _disableHeavyShaders() {
    this.effectBudget.heavyShaders = false;
    this.effectBudget.particlesHighQuality = false;
  }

  _recoverEffects() {
    if (this.getLevel() === 'cinematic' || this.getLevel() === 'high') {
      this.effectBudget.bloom = true;
      this.effectBudget.volumetricFog = true;
      this.effectBudget.heavyShaders = true;
      this.effectBudget.particlesHighQuality = true;
    }
  }
}

module.exports = {
  AdaptiveQualitySystem,
  DEFAULT_THRESHOLDS,
  QUALITY_LEVELS,
};
