/**
 * Bengal silhouette — ground-anchored flame jet.
 *
 * Bengal effects are sustained colored flares (typically 1–30s). The
 * silhouette describes a single near-vertical jet with low spread, used by
 * the flame renderer to spawn long-lived particles with the bengal duration
 * extracted from the filename (e.g. `Bengal Light Red (30s).fwe` → 30s).
 *
 * Honest: no invented physics — only geometric hints consumed by the
 * existing flame system.
 */

export interface BengalSilhouette {
  /** Number of jets — bengals are always single-source. */
  jets: 1;
  /** Half-angle of the cone around vertical (degrees). */
  spreadDeg: number;
  /** Effect duration in seconds (from filename). */
  durationS: number;
  /** Whether to add a glowing ground halo under the jet. */
  groundHalo: boolean;
}

const DEFAULT_DURATION_S = 5;

/** Parse `Bengal Light Red (30s)` → 30. Returns `null` when no match. */
export function bengalDurationFromName(name: string): number | null {
  const m = /\(\s*0*(\d{1,3})\s*s\s*\)/i.exec(name);
  return m ? parseInt(m[1], 10) : null;
}

export function selectBengalSilhouette(name: string): BengalSilhouette {
  const durationS = bengalDurationFromName(name) ?? DEFAULT_DURATION_S;
  return {
    jets: 1,
    spreadDeg: 6,
    durationS,
    groundHalo: durationS >= 10,
  };
}
