/**
 * FX KONTROL · Adaptive Exposure System v2
 * UE5.7 Auto-Exposure: darkens during bright bursts, recovers in darkness.
 * Supports scene luminance estimation and flash events.
 */

export interface ExposureState {
  currentExposure: number;
  targetExposure: number;
  minExposure: number;
  maxExposure: number;
  adaptSpeed: number;
  /** Accumulated scene luminance for averaging */
  luminanceAccum: number;
  luminanceSamples: number;
  /** Speed-up for darkening (UE5: faster darken than brighten) */
  darkenSpeed: number;
  brightenSpeed: number;
}

export function createExposureController(): ExposureState {
  return {
    currentExposure: 1.2,
    targetExposure: 1.2,
    minExposure: 0.3,
    maxExposure: 2.0,
    adaptSpeed: 1.5,
    luminanceAccum: 0,
    luminanceSamples: 0,
    darkenSpeed: 4.0,   // fast darken like real cameras
    brightenSpeed: 1.0,  // slow brighten
  };
}

/**
 * Update adaptive exposure based on scene luminance.
 * @param luminance - estimated average scene luminance (0-10+)
 */
export function updateExposure(state: ExposureState, luminance: number, dt: number): number {
  // Inverse relationship: brighter scene → lower exposure
  state.targetExposure = Math.max(
    state.minExposure,
    Math.min(state.maxExposure, 1.2 / (1 + luminance * 0.5))
  );

  // Asymmetric adaptation: fast darken, slow brighten (like real cameras / UE5)
  const isDarkening = state.targetExposure < state.currentExposure;
  const speed = isDarkening ? state.darkenSpeed : state.brightenSpeed;
  const t = 1 - Math.exp(-speed * dt);
  state.currentExposure += (state.targetExposure - state.currentExposure) * t;

  // Accumulate luminance for averaging
  state.luminanceAccum += luminance;
  state.luminanceSamples++;

  return state.currentExposure;
}

/**
 * Register a bright flash event (explosion).
 */
export function flashEvent(state: ExposureState, intensity: number) {
  state.targetExposure = Math.max(
    state.minExposure,
    state.currentExposure - intensity * 0.5
  );
}

/**
 * Get average luminance over accumulated samples.
 */
export function getAverageLuminance(state: ExposureState): number {
  if (state.luminanceSamples === 0) return 0;
  return state.luminanceAccum / state.luminanceSamples;
}

/**
 * Reset luminance accumulator (call once per frame after reading).
 */
export function resetLuminanceAccum(state: ExposureState) {
  state.luminanceAccum = 0;
  state.luminanceSamples = 0;
}
