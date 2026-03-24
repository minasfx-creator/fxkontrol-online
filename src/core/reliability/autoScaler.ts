/**
 * ─── Performance Auto-Scaler ────────────────────────────────────────
 * Dynamically adjusts visual quality to maintain stable logic timing.
 * Rule: LOGIC NEVER DROPS — only visuals degrade.
 *
 * Tiers: Ultra → High → Medium → Low → Survival
 */

export type QualityTier = 'ultra' | 'high' | 'medium' | 'low' | 'survival';

export interface ScaleState {
  tier: QualityTier;
  particleScale: number;     // 0.1 - 1.0
  lodBias: number;           // 0 (full) to 3 (coarse)
  bloomEnabled: boolean;
  ssrEnabled: boolean;
  shadowsEnabled: boolean;
  smokeEnabled: boolean;
  maxBursts: number;
  terrainSSE: number;
  postProcessing: boolean;
}

const TIER_CONFIG: Record<QualityTier, ScaleState> = {
  ultra:    { tier: 'ultra',    particleScale: 1.0, lodBias: 0, bloomEnabled: true,  ssrEnabled: true,  shadowsEnabled: true,  smokeEnabled: true,  maxBursts: 64, terrainSSE: 16, postProcessing: true },
  high:     { tier: 'high',     particleScale: 0.8, lodBias: 0, bloomEnabled: true,  ssrEnabled: true,  shadowsEnabled: true,  smokeEnabled: true,  maxBursts: 48, terrainSSE: 20, postProcessing: true },
  medium:   { tier: 'medium',   particleScale: 0.5, lodBias: 1, bloomEnabled: true,  ssrEnabled: false, shadowsEnabled: false, smokeEnabled: true,  maxBursts: 32, terrainSSE: 24, postProcessing: true },
  low:      { tier: 'low',      particleScale: 0.3, lodBias: 2, bloomEnabled: false, ssrEnabled: false, shadowsEnabled: false, smokeEnabled: false, maxBursts: 16, terrainSSE: 32, postProcessing: false },
  survival: { tier: 'survival', particleScale: 0.1, lodBias: 3, bloomEnabled: false, ssrEnabled: false, shadowsEnabled: false, smokeEnabled: false, maxBursts: 8,  terrainSSE: 48, postProcessing: false },
};

const TIER_ORDER: QualityTier[] = ['ultra', 'high', 'medium', 'low', 'survival'];

class AutoScaler {
  private currentTier: QualityTier = 'high';
  private fpsBuffer: number[] = [];
  private maxSamples = 30;
  private upgradeThreshold = 55;   // FPS above this → try upgrading
  private downgradeThreshold = 40; // FPS below this → downgrade
  private stableFrames = 0;
  private cooldownFrames = 60;     // Wait 1s after tier change
  private listeners = new Set<(state: ScaleState) => void>();
  private locked = false;
  private pixelRatio = 1.0;
  private stableTime = 0;         // seconds at current tier
  private lastTierChange = 0;     // timestamp
  private restoreDelay = 10_000;  // 10s stable before restore

  /** Feed a frame's FPS. Auto-adjusts tier. */
  tick(fps: number): ScaleState {
    this.fpsBuffer.push(fps);
    if (this.fpsBuffer.length > this.maxSamples) this.fpsBuffer.shift();

    if (this.locked || this.stableFrames < this.cooldownFrames) {
      this.stableFrames++;
      return this.getState();
    }

    const avgFps = this.fpsBuffer.reduce((a, b) => a + b, 0) / this.fpsBuffer.length;
    const idx = TIER_ORDER.indexOf(this.currentTier);

    // Performance Governor: staged degradation
    if (avgFps < this.downgradeThreshold && idx < TIER_ORDER.length - 1) {
      // Stage 1: reduce pixelRatio first
      if (this.pixelRatio > 0.5) {
        this.pixelRatio = Math.max(0.5, this.pixelRatio - 0.15);
        console.log(`[AutoScaler] Governor: pixelRatio → ${this.pixelRatio.toFixed(2)}`);
      } else {
        // Stage 2: drop quality tier
        this.currentTier = TIER_ORDER[idx + 1];
        this.pixelRatio = 1.0; // reset for new tier
        console.log(`[AutoScaler] Governor: tier → ${this.currentTier}`);
      }
      this.stableFrames = 0;
      this.lastTierChange = Date.now();
      this.notify();
    } else if (avgFps > this.upgradeThreshold && idx > 0) {
      // Gradual restore after sustained stability
      if (Date.now() - this.lastTierChange > this.restoreDelay) {
        if (this.pixelRatio < 1.0) {
          this.pixelRatio = Math.min(1.0, this.pixelRatio + 0.1);
          console.log(`[AutoScaler] Governor: restoring pixelRatio → ${this.pixelRatio.toFixed(2)}`);
        } else {
          this.currentTier = TIER_ORDER[idx - 1];
          console.log(`[AutoScaler] Governor: restoring tier → ${this.currentTier}`);
        }
        this.stableFrames = 0;
        this.lastTierChange = Date.now();
        this.notify();
      }
    }

    return this.getState();
  }

  getState(): ScaleState {
    return { ...TIER_CONFIG[this.currentTier] };
  }

  getTier(): QualityTier {
    return this.currentTier;
  }

  /** Get current pixel ratio from governor */
  getPixelRatio(): number {
    return this.pixelRatio;
  }

  /** Force a specific tier (manual override). */
  setTier(tier: QualityTier): void {
    this.currentTier = tier;
    this.stableFrames = 0;
    this.lastTierChange = Date.now();
    this.notify();
  }

  /** Lock current tier — prevents auto-scaling. */
  lock(locked = true): void {
    this.locked = locked;
  }

  onChange(listener: (state: ScaleState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    const state = this.getState();
    for (const l of this.listeners) {
      try { l(state); } catch { /* no-op */ }
    }
  }

  reset(): void {
    this.currentTier = 'high';
    this.fpsBuffer = [];
    this.stableFrames = 0;
    this.locked = false;
    this.pixelRatio = 1.0;
    this.stableTime = 0;
    this.lastTierChange = 0;
  }
}

export const autoScaler = new AutoScaler();
