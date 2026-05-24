/**
 * FX KONTROL · Smooth Frame Pacer
 * Weighted Moving Average delta-time to eliminate micro-stuttering.
 * 
 * Instead of raw per-frame delta (which oscillates 14ms→18ms→15ms),
 * outputs a smooth delta that converges to the true average, removing
 * visual judder on timeline scrubbing and particle motion.
 */

const HISTORY_SIZE = 10;
const MAX_DELTA = 0.05;   // Cap at 50ms (20 FPS floor)
const MIN_DELTA = 0.001;  // Floor at 1ms

// ─── Singleton state (zero-alloc per frame) ───
const _history = new Float64Array(HISTORY_SIZE);
let _head = 0;
let _filled = 0;
let _smoothDelta = 1 / 60;
let _fps = 60;
let _fpsHistory = new Float64Array(60);
let _fpsHead = 0;
let _fpsFilled = 0;

/**
 * Feed a raw delta (seconds) and get back a smoothed delta.
 * Call once per frame from the main render loop.
 */
export function tickFramePacer(rawDelta: number): number {
  const clamped = Math.max(MIN_DELTA, Math.min(MAX_DELTA, rawDelta));

  _history[_head] = clamped;
  _head = (_head + 1) % HISTORY_SIZE;
  if (_filled < HISTORY_SIZE) _filled++;

  // Weighted moving average — recent frames weigh more
  let sum = 0;
  let weightSum = 0;
  for (let i = 0; i < _filled; i++) {
    const idx = ((_head - 1 - i) + HISTORY_SIZE) % HISTORY_SIZE;
    const weight = 1.0 + ((_filled - i) / _filled); // 2.0 → 1.0
    sum += _history[idx] * weight;
    weightSum += weight;
  }

  _smoothDelta = sum / weightSum;

  // FPS tracking (1-second rolling window)
  const instantFPS = 1.0 / clamped;
  _fpsHistory[_fpsHead] = instantFPS;
  _fpsHead = (_fpsHead + 1) % 60;
  if (_fpsFilled < 60) _fpsFilled++;

  let fpsSum = 0;
  for (let i = 0; i < _fpsFilled; i++) fpsSum += _fpsHistory[i];
  _fps = fpsSum / _fpsFilled;

  return _smoothDelta;
}

/** Get the current smoothed delta without advancing. */
export function getSmoothDelta(): number {
  return _smoothDelta;
}

/** Get rolling average FPS (1-second window). */
export function getSmoothFPS(): number {
  return _fps;
}

/** Reset pacer state (e.g. after tab re-focus or pause). */
export function resetFramePacer(): void {
  _filled = 0;
  _head = 0;
  _smoothDelta = 1 / 60;
  _fps = 60;
  _fpsFilled = 0;
  _fpsHead = 0;
}

// ═══════════════════════════════════════════════════════════════════
// Adaptive Quality Controller
// Dynamically adjusts rendering quality based on FPS headroom.
// ═══════════════════════════════════════════════════════════════════

export type QualityTier = 'ultra' | 'high' | 'medium' | 'low';

export interface AdaptiveQualityState {
  tier: QualityTier;
  particleBudgetMul: number;   // 0.25 – 1.0
  bloomEnabled: boolean;
  ssrHalfRes: boolean;
  ssaoEnabled: boolean;
  tileSSE: number;             // Google 3D Tiles screen-space error
  postProcessScale: number;    // 0.5 – 1.0 post-process resolution
}

const TIER_CONFIG: Record<QualityTier, AdaptiveQualityState> = {
  ultra: {
    tier: 'ultra',
    particleBudgetMul: 1.0,
    bloomEnabled: true,
    ssrHalfRes: false,
    ssaoEnabled: true,
    tileSSE: 16,
    postProcessScale: 1.0,
  },
  high: {
    tier: 'high',
    particleBudgetMul: 0.8,
    bloomEnabled: true,
    ssrHalfRes: true,
    ssaoEnabled: true,
    tileSSE: 20,
    postProcessScale: 1.0,
  },
  medium: {
    tier: 'medium',
    particleBudgetMul: 0.5,
    bloomEnabled: true,
    ssrHalfRes: true,
    ssaoEnabled: false,
    tileSSE: 28,
    postProcessScale: 0.75,
  },
  low: {
    tier: 'low',
    particleBudgetMul: 0.25,
    bloomEnabled: false,
    ssrHalfRes: true,
    ssaoEnabled: false,
    tileSSE: 40,
    postProcessScale: 0.5,
  },
};

let _currentTier: QualityTier = 'high';
let _tierHoldFrames = 0;
const TIER_HOLD_THRESHOLD = 90; // ~1.5s at 60fps before changing tier

/**
 * Evaluate and return the adaptive quality state.
 * Call once per frame after tickFramePacer.
 */
export function evaluateAdaptiveQuality(): AdaptiveQualityState {
  const fps = _fps;

  let targetTier = _currentTier;
  if (fps > 55) targetTier = 'ultra';
  else if (fps > 45) targetTier = 'high';
  else if (fps > 30) targetTier = 'medium';
  else targetTier = 'low';

  if (targetTier !== _currentTier) {
    _tierHoldFrames++;
    // Only downgrade quickly, upgrade slowly
    const threshold = targetTier < _currentTier ? 30 : TIER_HOLD_THRESHOLD;
    if (_tierHoldFrames >= threshold) {
      _currentTier = targetTier;
      _tierHoldFrames = 0;
      console.log(`[AdaptiveQuality] Tier → ${_currentTier} (FPS: ${fps.toFixed(1)})`);
    }
  } else {
    _tierHoldFrames = 0;
  }

  return TIER_CONFIG[_currentTier];
}

/** Force a specific quality tier (manual override). */
export function setQualityTier(tier: QualityTier): void {
  _currentTier = tier;
  _tierHoldFrames = 0;
}

/** Get current tier without evaluation. */
export function getCurrentTier(): QualityTier {
  return _currentTier;
}
