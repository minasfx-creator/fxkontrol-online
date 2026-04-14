/**
 * ─── PyroLODManager ─────────────────────────────────────────────────
 * Extended LOD with importance scoring, particle budget,
 * and screen-size culling.
 * 
 * Integrates with existing useLOD.ts distance-based system.
 */

export type QualityPreset = 'ultra' | 'high' | 'medium' | 'safe';

export interface BurstImportance {
  burstId: string;
  caliber: number;
  age: number;           // seconds since burst
  screenCoverage: number; // 0-1 fraction of screen
  distance: number;       // meters from camera
  score: number;          // computed importance
}

export interface LODBudget {
  maxParticles: number;
  maxSmokePuffs: number;
  maxTrailPoints: number;
  qualityMultiplier: number;
}

const QUALITY_BUDGETS: Record<QualityPreset, LODBudget> = {
  ultra: { maxParticles: 100000, maxSmokePuffs: 512, maxTrailPoints: 50000, qualityMultiplier: 1.0 },
  high:  { maxParticles: 75000,  maxSmokePuffs: 384, maxTrailPoints: 35000, qualityMultiplier: 0.75 },
  medium: { maxParticles: 50000, maxSmokePuffs: 256, maxTrailPoints: 20000, qualityMultiplier: 0.5 },
  safe:  { maxParticles: 25000,  maxSmokePuffs: 128, maxTrailPoints: 10000, qualityMultiplier: 0.25 },
};

/**
 * Compute importance score for a burst.
 * Higher = more visual importance = gets more particle budget.
 */
export function computeImportance(
  caliber: number,
  age: number,
  screenCoverage: number,
  distance: number,
): number {
  // Caliber weight (bigger shells = more important)
  const caliberWeight = Math.min(caliber / 6, 2.0);

  // Recency weight (fresh bursts = high priority)
  const recencyWeight = Math.max(0, 1.0 - age * 0.3);

  // Screen coverage (bigger on screen = more important)
  const coverageWeight = Math.min(screenCoverage * 50, 2.0);

  // Distance penalty (far away = less important)
  const distancePenalty = 1.0 / (1.0 + distance * 0.001);

  return caliberWeight * recencyWeight * coverageWeight * distancePenalty;
}

/**
 * Estimate screen coverage of a burst given camera parameters.
 */
export function estimateScreenCoverage(
  burstRadius: number,
  distance: number,
  fov: number,
  viewportHeight: number,
): number {
  if (distance <= 0) return 1;
  const angularSize = 2 * Math.atan(burstRadius / distance);
  const fovRad = (fov * Math.PI) / 180;
  return angularSize / fovRad;
}

/**
 * Should this burst be culled entirely?
 * Returns true if it covers less than ~2px on screen.
 */
export function shouldCull(screenCoverage: number, viewportHeight: number): boolean {
  const pixelCoverage = screenCoverage * viewportHeight;
  return pixelCoverage < 2;
}

/**
 * Distribute particle budget across active bursts by importance.
 */
export function distributeBudget(
  bursts: BurstImportance[],
  budget: LODBudget,
): Map<string, number> {
  const totalScore = bursts.reduce((sum, b) => sum + b.score, 0);
  const allocation = new Map<string, number>();

  if (totalScore <= 0) return allocation;

  for (const burst of bursts) {
    const share = burst.score / totalScore;
    const particles = Math.floor(share * budget.maxParticles);
    allocation.set(burst.burstId, Math.max(10, particles)); // minimum 10
  }

  return allocation;
}

/**
 * Get budget for a quality preset.
 */
export function getBudget(quality: QualityPreset): Readonly<LODBudget> {
  return QUALITY_BUDGETS[quality];
}

/**
 * Get per-burst particle multiplier combining distance LOD + importance.
 */
export function getParticleMultiplier(
  distanceTier: 'ultra' | 'high' | 'medium' | 'low',
  importance: number,
): number {
  const tierMultiplier = {
    ultra: 1.0,
    high: 0.75,
    medium: 0.5,
    low: 0.25,
  }[distanceTier];

  // Importance scales within tier range
  return tierMultiplier * Math.min(1.0, 0.3 + importance * 0.7);
}
