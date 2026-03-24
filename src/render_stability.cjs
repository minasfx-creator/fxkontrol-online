'use strict';

/**
 * Perfis de qualidade em ordem decrescente de custo.
 */
const QUALITY_PROFILES = Object.freeze(['ultra', 'high', 'medium', 'low', 'safe']);

/**
 * APIs gráficas em ordem de preferência.
 */
const GRAPHICS_APIS = Object.freeze(['webgpu', 'webgl2', 'static_preview']);

/**
 * Política padrão de hardening para runtime.
 */
const DEFAULT_RUNTIME_POLICY = Object.freeze({
  targetFrameMs: 16.6,
  overBudgetFramesBeforeDegrade: 120,
  maxDrawCalls: 1500,
  maxVisibleTriangles: 1200000,
  maxGpuMemoryMb: 1024,
  maxSceneNodes: 10000,
  maxAssetMb: 40,
  maxTextureDimension: 4096,
  maxTrianglesPerAsset: 800000,
  maxRestartsPerWindow: 2,
  restartWindowMs: 60_000,
  hardFailCooldownMs: 30_000,
});

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function safeNow() {
  return Date.now();
}

class ResourceTracker {
  constructor() {
    this._resources = new Set();
  }

  track(resource) {
    if (!resource || typeof resource.dispose !== 'function') {
      throw new TypeError('Resource precisa implementar dispose().');
    }
    this._resources.add(resource);
    return resource;
  }

  untrack(resource) {
    this._resources.delete(resource);
  }

  disposeAll() {
    const errors = [];
    for (const res of this._resources) {
      try {
        res.dispose();
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
    }
    this._resources.clear();
    return { ok: errors.length === 0, errors };
  }

  size() {
    return this._resources.size;
  }
}

class FrameHealthMonitor {
  constructor(policy = DEFAULT_RUNTIME_POLICY) {
    this.policy = { ...DEFAULT_RUNTIME_POLICY, ...policy };
    this.overBudgetStreak = 0;
    this.lastFrameMs = 0;
  }

  observeFrame(frameMs, drawCalls, visibleTriangles) {
    this.lastFrameMs = frameMs;

    const frameOverBudget =
      frameMs > this.policy.targetFrameMs ||
      drawCalls > this.policy.maxDrawCalls ||
      visibleTriangles > this.policy.maxVisibleTriangles;

    if (frameOverBudget) {
      this.overBudgetStreak += 1;
    } else {
      this.overBudgetStreak = 0;
    }

    return {
      frameOverBudget,
      overBudgetStreak: this.overBudgetStreak,
      shouldDegrade: this.overBudgetStreak >= this.policy.overBudgetFramesBeforeDegrade,
    };
  }

  reset() {
    this.overBudgetStreak = 0;
    this.lastFrameMs = 0;
  }
}

function validateAsset(asset, policy = DEFAULT_RUNTIME_POLICY) {
  const cfg = { ...DEFAULT_RUNTIME_POLICY, ...policy };
  const violations = [];

  if (asset.sizeMb > cfg.maxAssetMb) violations.push('maxAssetMb');
  if (asset.triangles > cfg.maxTrianglesPerAsset) violations.push('maxTrianglesPerAsset');
  if (asset.maxTextureDimension > cfg.maxTextureDimension) violations.push('maxTextureDimension');

  return { valid: violations.length === 0, violations };
}

class RenderStabilityController {
  constructor(policy = DEFAULT_RUNTIME_POLICY) {
    this.policy = { ...DEFAULT_RUNTIME_POLICY, ...policy };
    this.resources = new ResourceTracker();
    this.frames = new FrameHealthMonitor(this.policy);

    this.qualityIndex = 1; // high
    this.apiIndex = 0; // webgpu
    this.crashTimestamps = [];
    this.hardFailUntil = 0;
  }

  getState() {
    return {
      qualityProfile: QUALITY_PROFILES[this.qualityIndex],
      graphicsApi: GRAPHICS_APIS[this.apiIndex],
      hardFailActive: safeNow() < this.hardFailUntil,
      trackedResources: this.resources.size(),
      overBudgetStreak: this.frames.overBudgetStreak,
    };
  }

  registerFrame({ frameMs, drawCalls, visibleTriangles }) {
    if (safeNow() < this.hardFailUntil) {
      return { action: 'hard_fail_cooldown', state: this.getState() };
    }

    const frame = this.frames.observeFrame(frameMs, drawCalls, visibleTriangles);
    if (!frame.shouldDegrade) {
      return { action: 'none', state: this.getState() };
    }

    this.frames.reset();
    const qualityDegraded = this._degradeQuality();
    if (qualityDegraded) {
      return { action: 'degrade_quality', state: this.getState() };
    }

    const apiDegraded = this._fallbackApi();
    if (apiDegraded) {
      return { action: 'fallback_api', state: this.getState() };
    }

    this._activateHardFail();
    return { action: 'hard_fail_cooldown', state: this.getState() };
  }

  handleContextLoss() {
    const now = safeNow();
    const startWindow = now - this.policy.restartWindowMs;
    this.crashTimestamps = this.crashTimestamps.filter((ts) => ts >= startWindow);
    this.crashTimestamps.push(now);

    if (this.crashTimestamps.length > this.policy.maxRestartsPerWindow) {
      this._activateHardFail();
      return { action: 'hard_fail_cooldown', state: this.getState() };
    }

    const disposed = this.resources.disposeAll();
    const apiDegraded = this._fallbackApi();

    return {
      action: apiDegraded ? 'recover_with_api_fallback' : 'recover_without_fallback',
      disposed,
      state: this.getState(),
    };
  }

  canLoadAsset(asset) {
    return validateAsset(asset, this.policy);
  }

  _degradeQuality() {
    const next = clamp(this.qualityIndex + 1, 0, QUALITY_PROFILES.length - 1);
    if (next === this.qualityIndex) return false;
    this.qualityIndex = next;
    return true;
  }

  _fallbackApi() {
    const next = clamp(this.apiIndex + 1, 0, GRAPHICS_APIS.length - 1);
    if (next === this.apiIndex) return false;
    this.apiIndex = next;
    return true;
  }

  _activateHardFail() {
    this.hardFailUntil = safeNow() + this.policy.hardFailCooldownMs;
  }
}

module.exports = {
  DEFAULT_RUNTIME_POLICY,
  GRAPHICS_APIS,
  QUALITY_PROFILES,
  ResourceTracker,
  FrameHealthMonitor,
  RenderStabilityController,
  validateAsset,
};
