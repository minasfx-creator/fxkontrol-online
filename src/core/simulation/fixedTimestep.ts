/**
 * ─── Fixed Timestep Simulation Loop ─────────────────────────────────
 * Deterministic physics with accumulator pattern.
 * Decouples simulation rate from render rate for consistent behavior
 * regardless of frame rate.
 * 
 * Usage inside useFrame:
 *   fixedUpdate(delta, (fixedDt) => { simulate(fixedDt); });
 */

const FIXED_STEP = 1 / 60;     // 60 Hz simulation
const MAX_SUBSTEPS = 4;        // Prevent spiral of death
const MAX_ACCUMULATOR = 0.25;  // Cap at 250ms to avoid freezes

let _accumulator = 0;
let _simulationTime = 0;
let _stepCount = 0;

/**
 * Call once per render frame. Executes `stepFn` zero or more times
 * with a fixed delta, consuming the accumulated time.
 * 
 * @param rawDelta - Elapsed time since last frame (seconds)
 * @param stepFn - Called with fixedDt for each simulation step
 * @returns Number of steps executed this frame
 */
export function fixedUpdate(rawDelta: number, stepFn: (fixedDt: number) => void): number {
  _accumulator += Math.min(rawDelta, MAX_ACCUMULATOR);
  let steps = 0;

  while (_accumulator >= FIXED_STEP && steps < MAX_SUBSTEPS) {
    stepFn(FIXED_STEP);
    _accumulator -= FIXED_STEP;
    _simulationTime += FIXED_STEP;
    _stepCount++;
    steps++;
  }

  return steps;
}

/**
 * Get the interpolation alpha for rendering between simulation steps.
 * Use this to smoothly interpolate visual positions between the last
 * two simulation states.
 * 
 * @returns Alpha value 0-1 (0 = last step, 1 = next step)
 */
export function getInterpolationAlpha(): number {
  return _accumulator / FIXED_STEP;
}

/** Total simulation time elapsed (seconds, deterministic). */
export function getSimulationTime(): number {
  return _simulationTime;
}

/** Total number of fixed steps executed. */
export function getStepCount(): number {
  return _stepCount;
}

/** Reset accumulator (use after pause/resume or tab refocus). */
export function resetFixedTimestep(): void {
  _accumulator = 0;
  _simulationTime = 0;
  _stepCount = 0;
}

/**
 * Configure the fixed timestep (advanced).
 * Returns previous step value for restoration.
 */
let _fixedStep = FIXED_STEP;
export function setFixedStep(step: number): number {
  const prev = _fixedStep;
  _fixedStep = Math.max(1 / 240, Math.min(1 / 20, step));
  return prev;
}
