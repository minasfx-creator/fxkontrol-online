/**
 * SwarmGPT Physics — Adaptive sample-rate selection.
 *
 * Sample rates scale inversely with swarm size to keep validation O(N) per
 * frame within budget for swarms up to a few thousand drones.
 *
 *   100  drones → 20 Hz
 *   500  drones → 10 Hz
 *   2000 drones → 5  Hz (preview) / 10 Hz (final)
 *
 * Pure: zero allocations, no I/O.
 */
export interface AdaptiveSampleOptions {
  droneCount: number;
  /** Total duration of the transition (s). */
  duration: number;
  /** 'preview' is faster + less precise; 'final' clamps the floor higher. */
  mode?: 'preview' | 'final';
  /** Hard cap on samples per drone. Default 1024. */
  maxSamples?: number;
  /** Hard cap on Hz regardless of size. Default 30. */
  maxRate?: number;
  /** Hard floor on Hz (≥1). Default 4. */
  minRate?: number;
}

export interface AdaptiveSampleResult {
  sampleRate: number;
  sampleCount: number;
  /** Effective dt between samples. */
  dt: number;
}

/** Choose a sample rate (Hz) appropriate for the swarm size and mode. */
export function pickAdaptiveSampleRate(opts: AdaptiveSampleOptions): AdaptiveSampleResult {
  const droneCount = Math.max(1, Math.floor(opts.droneCount));
  const duration = Math.max(0.001, Number(opts.duration) || 0);
  const mode = opts.mode ?? 'final';
  const maxSamples = Math.max(8, Math.floor(opts.maxSamples ?? 1024));
  const maxRate = Math.max(2, Math.floor(opts.maxRate ?? 30));
  const minRate = Math.max(1, Math.floor(opts.minRate ?? 4));

  // Base curve: piecewise tiers from the brief.
  let rate: number;
  if (droneCount <= 100) rate = 20;
  else if (droneCount <= 500) rate = 10;
  else if (droneCount <= 2000) rate = mode === 'preview' ? 5 : 10;
  else rate = mode === 'preview' ? 4 : 6;

  // Apply caps.
  rate = Math.min(maxRate, Math.max(minRate, rate));

  // Respect the maxSamples budget.
  let sampleCount = Math.max(2, Math.ceil(rate * duration) + 1);
  if (sampleCount > maxSamples) {
    sampleCount = maxSamples;
    rate = Math.max(minRate, (sampleCount - 1) / duration);
  }

  return {
    sampleRate: rate,
    sampleCount,
    dt: duration / Math.max(1, sampleCount - 1),
  };
}
