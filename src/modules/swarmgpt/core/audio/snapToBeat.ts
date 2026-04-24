export function snapToBeat(
  timeSeconds: number,
  beatOffsets: number[],
): number {
  if (!Number.isFinite(timeSeconds) || !Array.isArray(beatOffsets) || beatOffsets.length === 0) {
    return timeSeconds;
  }
  let best = beatOffsets[0];
  let bestDist = Math.abs(timeSeconds - best);
  for (let i = 1; i < beatOffsets.length; i++) {
    const d = Math.abs(timeSeconds - beatOffsets[i]);
    if (d < bestDist) {
      best = beatOffsets[i];
      bestDist = d;
    }
  }
  return best;
}

