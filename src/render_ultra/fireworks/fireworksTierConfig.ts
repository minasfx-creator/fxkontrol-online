/**
 * Per-tier caps for the InstancedFireworks renderer.
 * Reads the canonical RenderQuality tier from feature flags; the
 * RenderStabilityController auto-degrades it under sustained load.
 */
import type { RenderQuality } from '@/lib/featureFlags';

export interface FireworksTierCaps {
  /** Max simultaneous core particles (additive sparks). */
  particleCount: number;
  /** Max smoke puffs (dark instanced quads). 0 disables smoke. */
  smokeCount: number;
  /** Enable per-particle ribbon trails? Off in eco. */
  trails: boolean;
  /** Lower clamp for spawn-per-burst — keeps eco bursts readable. */
  minParticlesPerBurst: number;
  /**
   * Multiplier applied to the visual intensity of each burst (count, ejection
   * speed, smoke puff count). Stability controller degrades the tier and this
   * scale shrinks bursts proportionally — cinema 1.0, balanced 0.7, eco 0.45.
   */
  burstIntensityScale: number;
  /** Hard ceiling on particles spawned per single burst. */
  maxParticlesPerBurst: number;
  /** Hard ceiling on smoke puffs spawned per single burst. */
  maxSmokePerBurst: number;
}

const TIERS: Record<RenderQuality, FireworksTierCaps> = {
  cinema: {
    particleCount: 80_000,
    smokeCount: 1_200,
    trails: true,
    minParticlesPerBurst: 600,
    burstIntensityScale: 1.0,
    maxParticlesPerBurst: 1_200,
    maxSmokePerBurst: 14,
  },
  balanced: {
    particleCount: 40_000,
    smokeCount: 600,
    trails: true,
    minParticlesPerBurst: 400,
    burstIntensityScale: 0.7,
    maxParticlesPerBurst: 700,
    maxSmokePerBurst: 8,
  },
  eco: {
    particleCount: 15_000,
    smokeCount: 0,
    trails: false,
    minParticlesPerBurst: 200,
    burstIntensityScale: 0.45,
    maxParticlesPerBurst: 320,
    maxSmokePerBurst: 0,
  },
};

export function capsForTier(tier: RenderQuality): FireworksTierCaps {
  return TIERS[tier] ?? TIERS.balanced;
}
