/**
 * FX KONTROL · Adaptive Exposure System
 * Simulates camera auto-exposure — darkens during bright bursts, recovers in darkness.
 */

export interface ExposureState {
  currentExposure: number;
  targetExposure: number;
  minExposure: number;
  maxExposure: number;
  adaptSpeed: number;     // seconds to adapt
}

export function createExposureController(): ExposureState {
  return {
    currentExposure: 1.2,
    targetExposure: 1.2,
    minExposure: 0.4,
    maxExposure: 1.8,
    adaptSpeed: 1.5,
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

  // Smooth interpolation — fast darken, slow brighten (like real cameras)
  const speed = luminance > 2 ? state.adaptSpeed * 3 : state.adaptSpeed;
  const t = 1 - Math.exp(-speed * dt);
  state.currentExposure += (state.targetExposure - state.currentExposure) * t;

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
