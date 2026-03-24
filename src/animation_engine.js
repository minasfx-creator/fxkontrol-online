'use strict';

const DURATION = Object.freeze({
  micro: 120,
  ui: 240,
  major: 400,
});

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function spring(step, stiffness = 170, damping = 26) {
  const x = step;
  const envelope = Math.exp((-damping * x) / 100);
  return 1 - envelope * Math.cos((stiffness * x) / 100);
}

class AnimationEngine {
  createTransition({ type = 'ui', from = 0, to = 1 }) {
    const duration = DURATION[type] || DURATION.ui;
    return {
      duration,
      sample: (progress) => from + (to - from) * easeInOutCubic(Math.max(0, Math.min(1, progress))),
    };
  }

  createPanelOpenMotion() {
    const transition = this.createTransition({ type: 'ui', from: 16, to: 0 });
    return {
      duration: transition.duration,
      translateY: transition.sample,
      opacity: (progress) => easeInOutCubic(Math.max(0, Math.min(1, progress))),
    };
  }

  createSelectionPulse() {
    return {
      duration: DURATION.micro,
      scale: (progress) => 1 + 0.02 * spring(progress),
      glow: (progress) => 0.4 + 0.6 * easeInOutCubic(progress),
    };
  }
}

module.exports = {
  AnimationEngine,
  DURATION,
  easeInOutCubic,
  spring,
};
