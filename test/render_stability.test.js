'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  FrameHealthMonitor,
  RenderStabilityController,
  validateAsset,
} = require('../src/render_stability');

test('FrameHealthMonitor aciona degrade após streak', () => {
  const monitor = new FrameHealthMonitor({ overBudgetFramesBeforeDegrade: 3, targetFrameMs: 10 });
  assert.equal(monitor.observeFrame(12, 1, 1).shouldDegrade, false);
  assert.equal(monitor.observeFrame(12, 1, 1).shouldDegrade, false);
  assert.equal(monitor.observeFrame(12, 1, 1).shouldDegrade, true);
});

test('RenderStabilityController degrada qualidade e depois API', () => {
  const ctrl = new RenderStabilityController({
    overBudgetFramesBeforeDegrade: 1,
    targetFrameMs: 1,
  });

  const first = ctrl.registerFrame({ frameMs: 20, drawCalls: 2000, visibleTriangles: 2000000 });
  assert.equal(first.action, 'degrade_quality');

  ctrl.qualityIndex = 4; // safe
  const second = ctrl.registerFrame({ frameMs: 20, drawCalls: 2000, visibleTriangles: 2000000 });
  assert.equal(second.action, 'fallback_api');
});

test('validateAsset bloqueia asset fora de policy', () => {
  const verdict = validateAsset({
    sizeMb: 999,
    triangles: 9999999,
    maxTextureDimension: 8192,
  });

  assert.equal(verdict.valid, false);
  assert.deepEqual(verdict.violations.sort(), ['maxAssetMb', 'maxTextureDimension', 'maxTrianglesPerAsset'].sort());
});

test('handleContextLoss entra em cooldown em crash loop', () => {
  const ctrl = new RenderStabilityController({
    maxRestartsPerWindow: 1,
    restartWindowMs: 60_000,
    hardFailCooldownMs: 1_000,
  });

  const first = ctrl.handleContextLoss();
  assert.match(first.action, /recover_/);

  const second = ctrl.handleContextLoss();
  assert.equal(second.action, 'hard_fail_cooldown');
});
