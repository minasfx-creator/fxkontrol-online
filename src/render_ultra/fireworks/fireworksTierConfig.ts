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
}

const TIERS: Record<RenderQuality, FireworksTierCaps> = {
  cinema: {
    particleCount: 80_000,
    smokeCount: 1_200,
    trails: true,
    minParticlesPerBurst: 600,
  },
  balanced: {
    particleCount: 40_000,
    smokeCount: 600,
    trails: true,
    minParticlesPerBurst: 400,
  },
  eco: {
    particleCount: 15_000,
    smokeCount: 0,
    trails: false,
    minParticlesPerBurst: 200,
  },
};

export function capsForTier(tier: RenderQuality): FireworksTierCaps {
  return TIERS[tier] ?? TIERS.balanced;
}
