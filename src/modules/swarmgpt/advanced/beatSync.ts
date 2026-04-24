/**
 * SwarmGPT Advanced — Beat snapping helpers.
 */
export function snapToBeat(time: number, beats: number[]): number {
  if (!beats || beats.length === 0) return time;
  let best = beats[0];
  let bestDist = Math.abs(time - best);
  for (let i = 1; i < beats.length; i++) {
    const d = Math.abs(time - beats[i]);
    if (d < bestDist) {
      best = beats[i];
      bestDist = d;
    }
  }
  return best;
}

/** Build a uniform beat grid over `[0, duration]` from a BPM value. */
export function buildBeatGrid(bpm: number, duration: number): number[] {
  if (bpm <= 0 || duration <= 0) return [];
  const period = 60 / bpm;
  const beats: number[] = [];
  for (let t = 0; t <= duration + 1e-6; t += period) {
    beats.push(t);
  }
  return beats;
}
