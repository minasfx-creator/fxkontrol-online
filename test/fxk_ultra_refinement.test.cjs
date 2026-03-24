'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { AdaptiveQualitySystem } = require('../src/performance_system.cjs');
const { ThemeEngine } = require('../src/theme_engine.cjs');
const { AnimationEngine } = require('../src/animation_engine.cjs');
const { FXKUltraRefinement, useAnimation, usePerformance, useTheme } = require('../src/fxk_ultra_refinement.cjs');

test('AdaptiveQualitySystem reduz efeitos sob pressão', () => {
  const q = new AdaptiveQualitySystem();
  const out = q.evaluateFrame({ fps: 35, gpuFrameMs: 28, vramMb: 1100, drawCalls: 2000 });

  assert.equal(out.qualityLevel, 'balanced');
  assert.equal(out.effectBudget.heavyShaders, false);
  assert.equal(out.effectBudget.particlesHighQuality, false);
});

test('ThemeEngine alterna temas e gera glass overlay', () => {
  const theme = new ThemeEngine('dark');
  theme.setTheme('ultra_dark');

  const style = theme.getCanvasOverlayStyle();
  assert.match(style.backdropFilter, /blur\(/);
  assert.match(style.background, /rgba/);
});

test('AnimationEngine cria movimento natural para painel', () => {
  const a = new AnimationEngine();
  const panel = a.createPanelOpenMotion();

  assert.equal(panel.duration, 240);
  assert.ok(panel.translateY(0) > panel.translateY(1));
});

test('FXKUltraRefinement orquestra performance + estabilidade + tema', () => {
  const fxk = new FXKUltraRefinement();
  const result = fxk.onFrame({ fps: 60, gpuFrameMs: 10, drawCalls: 500, visibleTriangles: 50000, vramMb: 300 });

  assert.equal(result.perf.actions.includes('stable_frame'), true);
  assert.equal(typeof result.stability.action, 'string');
  assert.equal(result.theme.id, 'dark');
});

test('hooks utilitários retornam motores esperados', () => {
  assert.equal(typeof usePerformance().evaluateFrame, 'function');
  assert.equal(typeof useTheme('high_contrast').setTheme, 'function');
  assert.equal(typeof useAnimation().createSelectionPulse, 'function');
});
