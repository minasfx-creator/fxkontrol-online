'use strict';

const { RenderStabilityController } = require('./render_stability');
const { AdaptiveQualitySystem } = require('./performance_system');
const { ThemeEngine } = require('./theme_engine');
const { AnimationEngine } = require('./animation_engine');

class FXKUltraRefinement {
  constructor(options = {}) {
    this.stability = new RenderStabilityController(options.runtimePolicy);
    this.quality = new AdaptiveQualitySystem(options.performancePolicy);
    this.theme = new ThemeEngine(options.defaultTheme || 'dark');
    this.animation = new AnimationEngine();
  }

  onFrame(frameStats) {
    const perf = this.quality.evaluateFrame(frameStats);
    const stability = this.stability.registerFrame({
      frameMs: frameStats.gpuFrameMs,
      drawCalls: frameStats.drawCalls,
      visibleTriangles: frameStats.visibleTriangles,
    });

    return {
      perf,
      stability,
      theme: this.theme.getTheme(),
    };
  }

  onContextLoss() {
    return this.stability.handleContextLoss();
  }

  setTheme(themeId) {
    return this.theme.setTheme(themeId);
  }

  getUiPreset() {
    return {
      overlay: this.theme.getCanvasOverlayStyle(),
      panelMotion: this.animation.createPanelOpenMotion(),
      selectMotion: this.animation.createSelectionPulse(),
    };
  }
}

function usePerformance(options) {
  return new AdaptiveQualitySystem(options);
}

function useTheme(defaultTheme) {
  return new ThemeEngine(defaultTheme);
}

function useAnimation() {
  return new AnimationEngine();
}

module.exports = {
  FXKUltraRefinement,
  usePerformance,
  useTheme,
  useAnimation,
};
