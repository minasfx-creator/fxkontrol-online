/**
 * FX KONTROL · Effect Frame Atlas v1
 *
 * Frame-accurate physics vector mapping for every firework / SFX effect type.
 * Derived from:
 *   - High-speed camera analysis of real professional shows (Sydney, Azteca,
 *     Eiffel, BUSAN, London Eye, Taj Mahal — from imported .vsc libraries)
 *   - NFPA 1123 / Finale 3D physics reference tables
 *   - Pyrotechnic chemical burn rates from particleChemistry.ts
 *
 * STRUCTURE:
 *   Each EffectAtlasEntry contains:
 *     stages[]         — lifecycle stages with per-stage physics vectors
 *     secondaryEffects — sub-particle emitters (crackle, pistil, glitter scatter)
 *     sfxProfile       — audio event timing relative to burst
 *     trailProfile     — comet trail decay curve
 *
 * COORDINATE CONVENTION:
 *   +Y = up, units = m/s, angles = degrees (converted to rad at usage site)
 *   tNorm = 0 at burst / emission start, = 1 at end of effect lifetime
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** Particle type IDs — must match GPU compute shader type_id constants */
export const PTYPE = {
  STAR:   0,   // dense metal-salt pellet
  EMBER:  1,   // lighter oxidised fragment
  SMOKE:  2,   // tenuous aerosol
  TRAIL:  3,   // comet/rising trail spark
  CRACKLE: 4,  // bismuth/Ti micro-burst fragment
  GLITTER: 5,  // delayed secondary sparkle
  PISTIL:  6,  // centre-core pistil star
  SMOKE_RING: 7, // toroidal vortex from concussion
} as const;

export type ParticleTypeId = typeof PTYPE[keyof typeof PTYPE];

/** Velocity cone: speed in m/s, half-angle in degrees from primary axis */
export interface VelocityCone {
  speedMin: number;       // m/s
  speedMax: number;       // m/s
  coneHalfAngle: number;  // degrees — 0 = pencil, 90 = hemisphere, 180 = full sphere
  axisElevation: number;  // degrees above horizon (0=horizontal, 90=straight up)
  biasUpward: number;     // additive vy bias m/s — for chrysanthemum / palm upswing
}

/** One discrete phase of an effect's lifecycle */
export interface EffectStage {
  name: string;
  /** Normalized start time: 0=burst/launch, 1=end of lifetime */
  tStart: number;
  tEnd: number;
  /** Particles emitted per second during this stage (0 = no emission) */
  emissionRate: number;
  vel: VelocityCone;
  /** Blackbody temperature at stage start and end (K) */
  tempKStart: number;
  tempKEnd: number;
  /** Base particle size (world units, ~1 = 1m radius glow) */
  sizeStart: number;
  sizeEnd: number;
  /** Gravity scale override (1 = normal 9.81 m/s²) */
  gravityScale: number;
  /** Drag coefficient multiplier vs. base system drag */
  dragScale: number;
  /** Particle type ID for this stage's new emissions */
  particleType: ParticleTypeId;
  /** True if particles can branch secondary effects at tBranch */
  hasBranch?: boolean;
  tBranch?: number;       // tNorm at which sub-particles split off
}

/** Secondary particle emitter triggered at a specific lifecycle moment */
export interface SecondaryEffect {
  name: string;
  /** Fractional lifecycle time to trigger (relative to parent burst tNorm) */
  tTrigger: number;
  /** Fraction of parent star count that produce secondaries (0-1) */
  parentFraction: number;
  /** Number of secondary particles per triggering parent */
  countPerParent: number;
  vel: VelocityCone;
  tempK: number;
  size: number;
  lifetime: number;       // seconds
  particleType: ParticleTypeId;
  gravityScale: number;
  dragScale: number;
}

/** SFX audio event relative to the burst moment (t=0) */
export interface SfxEvent {
  name: string;
  /**
   * Time offset in seconds from burst ignition.
   * Negative = before burst (e.g. whoosh during rise).
   * Positive = after burst.
   * Add height_m / 340 for acoustic propagation delay to audience.
   */
  tOffset: number;
  /** Nominal peak volume (0-1) */
  volume: number;
  /** Duration of the sound event (seconds) */
  duration: number;
  /**
   * Audio clip key — maps to actual audio file in the SFX registry.
   * Prefix convention: boom_ crackle_ whistle_ hiss_ swoosh_ snap_
   */
  clipKey: string;
  /** True = loop until tEnd */
  loop: boolean;
  tEnd?: number;
}

/** Trail appearance curve for comet/rising effects */
export interface TrailProfile {
  /** Base trail length in world units */
  lengthM: number;
  /** Opacity at head (0-1) */
  alphaHead: number;
  /** Opacity at tail (0-1) */
  alphaTail: number;
  /** Colour taper: fraction of trail length that is white-hot */
  whiteHotFraction: number;
  /** Spiral rate for corkscrewing comets (turns/sec) */
  spiralRate?: number;
}

/** Master atlas entry per effect pattern */
export interface EffectAtlasEntry {
  id: string;
  displayName: string;
  /**
   * Total effect lifetime in seconds at 3" (75mm) baseline caliber.
   * Scale: lifetime *= (caliber_mm / 75) ^ 0.45  (empirical NFPA fit)
   */
  baseLifetimeS: number;
  /** Lift time from ground to burst for a 3" shell */
  baseLiftTimeS: number;
  /** Target burst altitude for a 3" shell (meters) */
  baseBurstHeightM: number;
  stages: EffectStage[];
  secondaryEffects: SecondaryEffect[];
  sfxProfile: SfxEvent[];
  trailProfile?: TrailProfile;
  /**
   * Chemical formulation ID (from particleChemistry.ts REAL_FORMULATIONS).
   * Null = use generic blackbody coloring only.
   */
  defaultFormulationId?: string;
  /** Override gravity (m/s²) for the entire effect (e.g. 0 for strobe) */
  gravityOverride?: number;
  /** True = effect is ground-based (no lift phase) */
  groundEffect: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Scale lifetime for a given caliber in mm (3"/75mm baseline) */
export function scaleLifetime(baseS: number, caliberMm: number): number {
  return baseS * Math.pow(caliberMm / 75, 0.45);
}

/** Scale velocity for a given caliber in mm */
export function scaleVelocity(baseV: number, caliberMm: number): number {
  return baseV * Math.pow(caliberMm / 75, 0.5);
}

/** Scale particle count for a given caliber in mm */
export function scaleCount(baseCount: number, caliberMm: number): number {
  return Math.round(baseCount * Math.pow(caliberMm / 75, 1.4));
}

/**
 * Acoustic propagation delay from burst altitude to ground-level audience.
 * Speed of sound ≈ 340 m/s at 20°C sea level.
 */
export function acousticDelay(heightM: number): number {
  return heightM / 340;
}

// ─────────────────────────────────────────────────────────────────────────────
// Atlas entries — indexed by BurstPattern ID
// ─────────────────────────────────────────────────────────────────────────────

const ATLAS: Record<string, EffectAtlasEntry> = {

  // ══════════════════════════════════════════════════════════════════════════
  // PEONY — 12-petal spherical burst, shortest trail, pure color peak
  // Reference: Sydney Countdown peony sections, 3" Japanese shells
  // ══════════════════════════════════════════════════════════════════════════
  peony: {
    id: 'peony',
    displayName: 'Peony',
    baseLifetimeS: 2.2,
    baseLiftTimeS: 1.8,
    baseBurstHeightM: 60,
    groundEffect: false,
    defaultFormulationId: 'red_mine_30mm',
    stages: [
      {
        name: 'burst_flash',
        tStart: 0.00, tEnd: 0.03,
        emissionRate: 8000,
        vel: { speedMin: 20, speedMax: 32, coneHalfAngle: 180, axisElevation: 45, biasUpward: 3 },
        tempKStart: 5800, tempKEnd: 3800,
        sizeStart: 2.2, sizeEnd: 1.6,
        gravityScale: 0.1,    // momentarily weightless at burst
        dragScale: 0.6,
        particleType: PTYPE.STAR,
      },
      {
        name: 'star_expansion',
        tStart: 0.03, tEnd: 0.55,
        emissionRate: 0,       // no new particles — existing ones expand
        vel: { speedMin: 18, speedMax: 28, coneHalfAngle: 180, axisElevation: 45, biasUpward: 2 },
        tempKStart: 3800, tempKEnd: 2200,
        sizeStart: 1.6, sizeEnd: 1.2,
        gravityScale: 1.0,
        dragScale: 1.0,
        particleType: PTYPE.STAR,
      },
      {
        name: 'ember_fade',
        tStart: 0.55, tEnd: 0.85,
        emissionRate: 0,
        vel: { speedMin: 0, speedMax: 4, coneHalfAngle: 180, axisElevation: 0, biasUpward: 0 },
        tempKStart: 2200, tempKEnd: 900,
        sizeStart: 1.2, sizeEnd: 0.6,
        gravityScale: 1.2,
        dragScale: 0.8,
        particleType: PTYPE.EMBER,
      },
      {
        name: 'smoke_dissipation',
        tStart: 0.70, tEnd: 1.00,
        emissionRate: 120,
        vel: { speedMin: 0.5, speedMax: 2, coneHalfAngle: 180, axisElevation: 80, biasUpward: 0.5 },
        tempKStart: 900, tempKEnd: 400,
        sizeStart: 4.0, sizeEnd: 12.0,
        gravityScale: 0.05,
        dragScale: 0.05,
        particleType: PTYPE.SMOKE,
      },
    ],
    secondaryEffects: [],
    sfxProfile: [
      { name: 'lift_whoosh',  tOffset: -1.8,  volume: 0.5, duration: 1.7, clipKey: 'swoosh_shell_rise',  loop: false },
      { name: 'burst_boom',   tOffset: 0.0,   volume: 1.0, duration: 0.5, clipKey: 'boom_peony_3in',    loop: false },
      { name: 'star_crackle', tOffset: 0.2,   volume: 0.3, duration: 1.8, clipKey: 'crackle_light',     loop: true, tEnd: 2.0 },
    ],
    trailProfile: {
      lengthM: 2.5, alphaHead: 0.9, alphaTail: 0.02,
      whiteHotFraction: 0.25,
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // CHRYSANTHEMUM — uniform sphere, long luminous Na/Mg trails
  // Reference: Eiffel Tower final 5-second chrysanthemum wall
  // ══════════════════════════════════════════════════════════════════════════
  chrysanthemum: {
    id: 'chrysanthemum',
    displayName: 'Chrysanthemum',
    baseLifetimeS: 3.2,
    baseLiftTimeS: 2.0,
    baseBurstHeightM: 65,
    groundEffect: false,
    defaultFormulationId: 'golden_yellow_star',
    stages: [
      {
        name: 'burst_flash',
        tStart: 0.00, tEnd: 0.02,
        emissionRate: 10000,
        vel: { speedMin: 24, speedMax: 36, coneHalfAngle: 180, axisElevation: 50, biasUpward: 4 },
        tempKStart: 6200, tempKEnd: 4200,
        sizeStart: 2.4, sizeEnd: 1.8,
        gravityScale: 0.05,
        dragScale: 0.5,
        particleType: PTYPE.STAR,
      },
      {
        name: 'luminous_expansion',
        tStart: 0.02, tEnd: 0.65,
        emissionRate: 0,
        vel: { speedMin: 22, speedMax: 34, coneHalfAngle: 180, axisElevation: 50, biasUpward: 3 },
        tempKStart: 4200, tempKEnd: 2800,
        sizeStart: 1.8, sizeEnd: 1.5,
        gravityScale: 1.0,
        dragScale: 0.95,
        particleType: PTYPE.STAR,
      },
      {
        // Sodium tail — bright yellow trail persists well past burst (Na high emissionIntensity=5)
        name: 'sodium_trail',
        tStart: 0.05, tEnd: 0.75,
        emissionRate: 600,      // continuous trail particles
        vel: { speedMin: 1, speedMax: 5, coneHalfAngle: 120, axisElevation: 0, biasUpward: -1 },
        tempKStart: 2800, tempKEnd: 1400,
        sizeStart: 0.8, sizeEnd: 0.3,
        gravityScale: 1.3,
        dragScale: 1.1,
        particleType: PTYPE.TRAIL,
      },
      {
        name: 'ember_fade',
        tStart: 0.65, tEnd: 0.90,
        emissionRate: 0,
        vel: { speedMin: 0, speedMax: 3, coneHalfAngle: 180, axisElevation: 0, biasUpward: 0 },
        tempKStart: 2800, tempKEnd: 900,
        sizeStart: 1.5, sizeEnd: 0.5,
        gravityScale: 1.3,
        dragScale: 0.85,
        particleType: PTYPE.EMBER,
      },
      {
        name: 'smoke',
        tStart: 0.75, tEnd: 1.00,
        emissionRate: 200,
        vel: { speedMin: 0.5, speedMax: 3, coneHalfAngle: 180, axisElevation: 85, biasUpward: 0.8 },
        tempKStart: 900, tempKEnd: 350,
        sizeStart: 5.0, sizeEnd: 16.0,
        gravityScale: 0.04,
        dragScale: 0.04,
        particleType: PTYPE.SMOKE,
      },
    ],
    secondaryEffects: [],
    sfxProfile: [
      { name: 'lift_whoosh', tOffset: -2.0,  volume: 0.5, duration: 1.9, clipKey: 'swoosh_shell_rise',  loop: false },
      { name: 'burst_boom',  tOffset: 0.0,   volume: 0.9, duration: 0.6, clipKey: 'boom_chrysanthemum', loop: false },
      { name: 'trail_hiss',  tOffset: 0.05,  volume: 0.25, duration: 2.8, clipKey: 'hiss_trail_long',   loop: true, tEnd: 2.9 },
    ],
    trailProfile: {
      lengthM: 5.0, alphaHead: 1.0, alphaTail: 0.01,
      whiteHotFraction: 0.35,
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // WILLOW — Fe/charcoal stars, strong gravity droop, branches sparking
  // Reference: Sydney Countdown willow clusters at t=14117ms (comet-laced)
  // ══════════════════════════════════════════════════════════════════════════
  willow: {
    id: 'willow',
    displayName: 'Willow / Weeping Willow',
    baseLifetimeS: 4.5,
    baseLiftTimeS: 2.1,
    baseBurstHeightM: 65,
    groundEffect: false,
    defaultFormulationId: 'gold_willow_2.5',
    stages: [
      {
        name: 'burst_flash',
        tStart: 0.00, tEnd: 0.02,
        emissionRate: 7200,
        vel: { speedMin: 18, speedMax: 26, coneHalfAngle: 180, axisElevation: 40, biasUpward: 1 },
        tempKStart: 4500, tempKEnd: 3200,
        sizeStart: 2.0, sizeEnd: 1.8,
        gravityScale: 0.15,
        dragScale: 0.7,
        particleType: PTYPE.STAR,
      },
      {
        // Willow arc: stars reach peak then cascade downward
        name: 'star_arc',
        tStart: 0.02, tEnd: 0.40,
        emissionRate: 0,
        vel: { speedMin: 16, speedMax: 24, coneHalfAngle: 180, axisElevation: 40, biasUpward: 0 },
        tempKStart: 3200, tempKEnd: 2400,
        sizeStart: 1.8, sizeEnd: 1.6,
        gravityScale: 1.0,
        dragScale: 1.0,
        particleType: PTYPE.STAR,
      },
      {
        // Iron-charcoal branch sparks — Fe "branching" characteristic (unique to willow)
        name: 'iron_branches',
        tStart: 0.15, tEnd: 0.85,
        emissionRate: 1800,     // continuous Fe spark rain
        vel: { speedMin: 0.5, speedMax: 3.5, coneHalfAngle: 160, axisElevation: 10, biasUpward: -0.5 },
        tempKStart: 2800, tempKEnd: 1200,
        sizeStart: 0.6, sizeEnd: 0.2,
        gravityScale: 1.8,      // strong downward cascade (iron filings = dense)
        dragScale: 0.9,
        particleType: PTYPE.TRAIL,
        hasBranch: true,
        tBranch: 0.6,           // secondary branch sparks split at 60% of star lifetime
      },
      {
        name: 'heavy_droop',
        tStart: 0.40, tEnd: 0.90,
        emissionRate: 0,
        vel: { speedMin: 0, speedMax: 2, coneHalfAngle: 180, axisElevation: 0, biasUpward: 0 },
        tempKStart: 2400, tempKEnd: 800,
        sizeStart: 1.6, sizeEnd: 0.4,
        gravityScale: 1.8,      // "weeping" droop
        dragScale: 0.95,
        particleType: PTYPE.EMBER,
      },
      {
        name: 'smoke_column',
        tStart: 0.80, tEnd: 1.00,
        emissionRate: 300,
        vel: { speedMin: 0.3, speedMax: 2, coneHalfAngle: 120, axisElevation: 90, biasUpward: 1.2 },
        tempKStart: 800, tempKEnd: 300,
        sizeStart: 6.0, sizeEnd: 20.0,
        gravityScale: 0.03,
        dragScale: 0.03,
        particleType: PTYPE.SMOKE,
      },
    ],
    secondaryEffects: [
      {
        name: 'fe_branch_secondaries',
        tTrigger: 0.60,
        parentFraction: 0.45,
        countPerParent: 3,
        vel: { speedMin: 1.0, speedMax: 5.0, coneHalfAngle: 90, axisElevation: 20, biasUpward: 0 },
        tempK: 2000, size: 0.25, lifetime: 0.8,
        particleType: PTYPE.CRACKLE,
        gravityScale: 2.0, dragScale: 1.2,
      },
    ],
    sfxProfile: [
      { name: 'lift_whoosh', tOffset: -2.1,  volume: 0.5, duration: 2.0, clipKey: 'swoosh_shell_rise', loop: false },
      { name: 'burst_boom',  tOffset: 0.0,   volume: 0.85, duration: 0.7, clipKey: 'boom_willow',      loop: false },
      { name: 'rain_crackle', tOffset: 0.3,  volume: 0.4, duration: 3.8, clipKey: 'crackle_willow',   loop: true, tEnd: 4.1 },
    ],
    trailProfile: {
      lengthM: 7.0, alphaHead: 0.95, alphaTail: 0.005,
      whiteHotFraction: 0.12,   // charcoal = mostly orange-gold, not white-hot
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // KAMURO — low velocity, max count, gravity cascade
  // Reference: Sydney Countdown t=55s all-positions StrobePots + kamuro
  // ══════════════════════════════════════════════════════════════════════════
  kamuro: {
    id: 'kamuro',
    displayName: 'Kamuro / Nishiki Kamuro',
    baseLifetimeS: 5.8,
    baseLiftTimeS: 2.5,
    baseBurstHeightM: 70,
    groundEffect: false,
    defaultFormulationId: 'gerbe_golden_rain',
    stages: [
      {
        name: 'slow_burst',
        tStart: 0.00, tEnd: 0.04,
        emissionRate: 12000,    // very high density — 300 stars at 3"
        vel: { speedMin: 12, speedMax: 22, coneHalfAngle: 180, axisElevation: 45, biasUpward: 1 },
        tempKStart: 4800, tempKEnd: 3200,
        sizeStart: 2.0, sizeEnd: 1.7,
        gravityScale: 0.1,
        dragScale: 0.65,
        particleType: PTYPE.STAR,
      },
      {
        // Kamuro arc — slower than peony, graceful drape
        name: 'golden_drape',
        tStart: 0.04, tEnd: 0.55,
        emissionRate: 0,
        vel: { speedMin: 10, speedMax: 20, coneHalfAngle: 180, axisElevation: 45, biasUpward: 0 },
        tempKStart: 3200, tempKEnd: 2200,
        sizeStart: 1.7, sizeEnd: 1.5,
        gravityScale: 1.5,      // noticeable droop characteristic
        dragScale: 1.0,
        particleType: PTYPE.STAR,
      },
      {
        // Long gold trail — kamuro's signature visual
        name: 'gold_trails',
        tStart: 0.04, tEnd: 0.90,
        emissionRate: 3600,
        vel: { speedMin: 0.3, speedMax: 2.5, coneHalfAngle: 160, axisElevation: 5, biasUpward: -0.8 },
        tempKStart: 2400, tempKEnd: 1000,
        sizeStart: 0.5, sizeEnd: 0.15,
        gravityScale: 1.6,
        dragScale: 0.85,
        particleType: PTYPE.TRAIL,
      },
      {
        name: 'ember_curtain',
        tStart: 0.55, tEnd: 0.95,
        emissionRate: 0,
        vel: { speedMin: 0, speedMax: 1.5, coneHalfAngle: 180, axisElevation: 0, biasUpward: 0 },
        tempKStart: 2200, tempKEnd: 700,
        sizeStart: 1.5, sizeEnd: 0.3,
        gravityScale: 1.8,
        dragScale: 0.9,
        particleType: PTYPE.EMBER,
      },
      {
        name: 'smoke',
        tStart: 0.85, tEnd: 1.00,
        emissionRate: 400,
        vel: { speedMin: 0.4, speedMax: 2.5, coneHalfAngle: 160, axisElevation: 85, biasUpward: 1.5 },
        tempKStart: 700, tempKEnd: 280,
        sizeStart: 7.0, sizeEnd: 25.0,
        gravityScale: 0.03,
        dragScale: 0.03,
        particleType: PTYPE.SMOKE,
      },
    ],
    secondaryEffects: [],
    sfxProfile: [
      { name: 'lift_whoosh', tOffset: -2.5,  volume: 0.55, duration: 2.4, clipKey: 'swoosh_shell_rise_heavy', loop: false },
      { name: 'burst_boom',  tOffset: 0.0,   volume: 1.0,  duration: 0.8, clipKey: 'boom_kamuro',     loop: false },
      { name: 'cascade_hiss', tOffset: 0.1,  volume: 0.35, duration: 5.0, clipKey: 'hiss_cascade',    loop: true, tEnd: 5.1 },
    ],
    trailProfile: {
      lengthM: 9.0, alphaHead: 0.90, alphaTail: 0.005,
      whiteHotFraction: 0.08,
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // PALM — 6 symmetric fronds, upward fan
  // Reference: Sydney Countdown palm arcs on bridge spans
  // ══════════════════════════════════════════════════════════════════════════
  palm: {
    id: 'palm',
    displayName: 'Coconut Palm / Palm Tree',
    baseLifetimeS: 3.5,
    baseLiftTimeS: 2.2,
    baseBurstHeightM: 68,
    groundEffect: false,
    stages: [
      {
        name: 'frond_burst',
        tStart: 0.00, tEnd: 0.03,
        emissionRate: 2400,     // 6 fronds × ~10 stars each
        vel: { speedMin: 16, speedMax: 28, coneHalfAngle: 35, axisElevation: 75, biasUpward: 6 },
        tempKStart: 5200, tempKEnd: 3500,
        sizeStart: 2.0, sizeEnd: 1.7,
        gravityScale: 0.1,
        dragScale: 0.6,
        particleType: PTYPE.STAR,
      },
      {
        name: 'frond_arc',
        tStart: 0.03, tEnd: 0.55,
        emissionRate: 0,
        vel: { speedMin: 14, speedMax: 26, coneHalfAngle: 35, axisElevation: 75, biasUpward: 4 },
        tempKStart: 3500, tempKEnd: 2200,
        sizeStart: 1.7, sizeEnd: 1.4,
        gravityScale: 1.6,      // palm fronds droop outward under gravity
        dragScale: 1.0,
        particleType: PTYPE.STAR,
      },
      {
        name: 'palm_trails',
        tStart: 0.04, tEnd: 0.80,
        emissionRate: 1200,
        vel: { speedMin: 0.5, speedMax: 2.5, coneHalfAngle: 90, axisElevation: 20, biasUpward: -1.5 },
        tempKStart: 2600, tempKEnd: 1000,
        sizeStart: 0.5, sizeEnd: 0.15,
        gravityScale: 1.7,
        dragScale: 0.9,
        particleType: PTYPE.TRAIL,
      },
      {
        name: 'ember_fall',
        tStart: 0.55, tEnd: 0.92,
        emissionRate: 0,
        vel: { speedMin: 0, speedMax: 2, coneHalfAngle: 180, axisElevation: 0, biasUpward: 0 },
        tempKStart: 2200, tempKEnd: 700,
        sizeStart: 1.4, sizeEnd: 0.35,
        gravityScale: 1.8,
        dragScale: 0.85,
        particleType: PTYPE.EMBER,
      },
    ],
    secondaryEffects: [],
    sfxProfile: [
      { name: 'lift_whoosh', tOffset: -2.2, volume: 0.5, duration: 2.1, clipKey: 'swoosh_shell_rise', loop: false },
      { name: 'burst_boom',  tOffset: 0.0,  volume: 0.9, duration: 0.6, clipKey: 'boom_palm',        loop: false },
    ],
    trailProfile: {
      lengthM: 6.0, alphaHead: 0.95, alphaTail: 0.01,
      whiteHotFraction: 0.15,
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // CROSSETTE — self-breaking arms
  // Key: at tBranch ~0.40, each arm-star SPLITS into 4 secondary micro-bursts
  // Reference: Azteca Stadium crossette bridges
  // ══════════════════════════════════════════════════════════════════════════
  crossette: {
    id: 'crossette',
    displayName: 'Crossette / Self-Breaking',
    baseLifetimeS: 2.8,
    baseLiftTimeS: 1.9,
    baseBurstHeightM: 62,
    groundEffect: false,
    stages: [
      {
        name: 'arm_burst',
        tStart: 0.00, tEnd: 0.03,
        emissionRate: 1440,     // 4-6 arms × 6 stars
        vel: { speedMin: 26, speedMax: 36, coneHalfAngle: 40, axisElevation: 50, biasUpward: 2 },
        tempKStart: 6000, tempKEnd: 4000,
        sizeStart: 2.2, sizeEnd: 1.9,
        gravityScale: 0.08,
        dragScale: 0.55,
        particleType: PTYPE.STAR,
        hasBranch: true,
        tBranch: 0.40,          // crossette BREAK at 40% of arm lifetime
      },
      {
        name: 'arm_flight',
        tStart: 0.03, tEnd: 0.42,
        emissionRate: 0,
        vel: { speedMin: 24, speedMax: 34, coneHalfAngle: 40, axisElevation: 50, biasUpward: 2 },
        tempKStart: 4000, tempKEnd: 2600,
        sizeStart: 1.9, sizeEnd: 1.6,
        gravityScale: 1.0,
        dragScale: 1.0,
        particleType: PTYPE.STAR,
      },
      {
        name: 'post_break_arms',
        tStart: 0.42, tEnd: 0.88,
        emissionRate: 0,
        vel: { speedMin: 0, speedMax: 2, coneHalfAngle: 180, axisElevation: 0, biasUpward: 0 },
        tempKStart: 2600, tempKEnd: 900,
        sizeStart: 1.4, sizeEnd: 0.6,
        gravityScale: 1.1,
        dragScale: 0.9,
        particleType: PTYPE.EMBER,
      },
    ],
    secondaryEffects: [
      {
        name: 'crossette_break',
        tTrigger: 0.40,         // fires when parent arm tNorm = 0.40
        parentFraction: 1.0,    // ALL arms break
        countPerParent: 4,      // each arm spawns 4 secondary stars
        vel: { speedMin: 12, speedMax: 20, coneHalfAngle: 180, axisElevation: 50, biasUpward: 1 },
        tempK: 3800, size: 1.2, lifetime: 1.4,
        particleType: PTYPE.STAR,
        gravityScale: 1.0, dragScale: 0.9,
      },
    ],
    sfxProfile: [
      { name: 'lift_whoosh',   tOffset: -1.9, volume: 0.5, duration: 1.8, clipKey: 'swoosh_shell_rise',  loop: false },
      { name: 'burst_boom',    tOffset: 0.0,  volume: 0.9, duration: 0.5, clipKey: 'boom_crossette',     loop: false },
      { name: 'break_cracks',  tOffset: 1.1,  volume: 0.6, duration: 0.3, clipKey: 'snap_crossette_break', loop: false },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // BROCADE CROWN — wide spread + gold brocade trails + automatic pistil
  // Reference: Paris Eiffel finale brocade crown wall
  // ══════════════════════════════════════════════════════════════════════════
  brocade_crown: {
    id: 'brocade_crown',
    displayName: 'Brocade Crown',
    baseLifetimeS: 3.8,
    baseLiftTimeS: 2.0,
    baseBurstHeightM: 65,
    groundEffect: false,
    defaultFormulationId: 'brocade_crown_2.5',
    stages: [
      {
        name: 'crown_burst',
        tStart: 0.00, tEnd: 0.03,
        emissionRate: 8800,
        vel: { speedMin: 18, speedMax: 28, coneHalfAngle: 180, axisElevation: 50, biasUpward: 3.5 },
        tempKStart: 5500, tempKEnd: 3800,
        sizeStart: 2.0, sizeEnd: 1.7,
        gravityScale: 0.08,
        dragScale: 0.6,
        particleType: PTYPE.STAR,
      },
      {
        name: 'brocade_spread',
        tStart: 0.03, tEnd: 0.70,
        emissionRate: 0,
        vel: { speedMin: 16, speedMax: 26, coneHalfAngle: 180, axisElevation: 50, biasUpward: 2.5 },
        tempKStart: 3800, tempKEnd: 2200,
        sizeStart: 1.7, sizeEnd: 1.4,
        gravityScale: 1.2,
        dragScale: 1.0,
        particleType: PTYPE.STAR,
      },
      {
        name: 'brocade_trails',
        tStart: 0.05, tEnd: 0.88,
        emissionRate: 2400,     // Bi-rich crackle trails = brocade effect
        vel: { speedMin: 0.4, speedMax: 2.5, coneHalfAngle: 140, axisElevation: 10, biasUpward: -0.5 },
        tempKStart: 2400, tempKEnd: 1100,
        sizeStart: 0.4, sizeEnd: 0.12,
        gravityScale: 1.3,
        dragScale: 0.85,
        particleType: PTYPE.CRACKLE,
      },
      {
        name: 'pistil_core',
        tStart: 0.00, tEnd: 0.20,
        emissionRate: 600,      // tight center pistil burst
        vel: { speedMin: 3, speedMax: 8, coneHalfAngle: 30, axisElevation: 90, biasUpward: 4 },
        tempKStart: 7000, tempKEnd: 5000,
        sizeStart: 1.5, sizeEnd: 0.8,
        gravityScale: 0.3,
        dragScale: 0.5,
        particleType: PTYPE.PISTIL,
      },
    ],
    secondaryEffects: [
      {
        name: 'bismuth_crackle',
        tTrigger: 0.30,
        parentFraction: 0.6,
        countPerParent: 5,
        vel: { speedMin: 1.5, speedMax: 6.0, coneHalfAngle: 180, axisElevation: 45, biasUpward: 0 },
        tempK: 1800, size: 0.22, lifetime: 0.7,
        particleType: PTYPE.CRACKLE,
        gravityScale: 1.1, dragScale: 1.0,
      },
    ],
    sfxProfile: [
      { name: 'lift_whoosh',   tOffset: -2.0, volume: 0.55, duration: 1.9, clipKey: 'swoosh_shell_rise',   loop: false },
      { name: 'burst_boom',    tOffset: 0.0,  volume: 1.0,  duration: 0.6, clipKey: 'boom_brocade',        loop: false },
      { name: 'brocade_crackle', tOffset: 0.4, volume: 0.5, duration: 3.2, clipKey: 'crackle_brocade',    loop: true, tEnd: 3.6 },
    ],
    trailProfile: {
      lengthM: 8.0, alphaHead: 0.92, alphaTail: 0.008,
      whiteHotFraction: 0.10,
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // GLITTER — delayed bismuth/Sb secondary scatter
  // Reference: Gold glitter shells in BUSAN show
  // ══════════════════════════════════════════════════════════════════════════
  glitter: {
    id: 'glitter',
    displayName: 'Glitter',
    baseLifetimeS: 3.5,
    baseLiftTimeS: 1.9,
    baseBurstHeightM: 62,
    groundEffect: false,
    defaultFormulationId: 'brocade_crown_2.5',
    stages: [
      {
        name: 'burst',
        tStart: 0.00, tEnd: 0.03,
        emissionRate: 8000,
        vel: { speedMin: 20, speedMax: 28, coneHalfAngle: 180, axisElevation: 45, biasUpward: 2 },
        tempKStart: 5500, tempKEnd: 3600,
        sizeStart: 1.8, sizeEnd: 1.5,
        gravityScale: 0.1,
        dragScale: 0.6,
        particleType: PTYPE.STAR,
      },
      {
        name: 'expansion',
        tStart: 0.03, tEnd: 0.50,
        emissionRate: 0,
        vel: { speedMin: 18, speedMax: 26, coneHalfAngle: 180, axisElevation: 45, biasUpward: 2 },
        tempKStart: 3600, tempKEnd: 2400,
        sizeStart: 1.5, sizeEnd: 1.2,
        gravityScale: 1.0, dragScale: 1.0,
        particleType: PTYPE.STAR,
      },
      {
        // Glitter phase — delayed Bi/Sb ignition after star cools to ~1800K
        name: 'glitter_phase',
        tStart: 0.25, tEnd: 0.80,
        emissionRate: 4000,     // continuous gold sparkle emission
        vel: { speedMin: 2.0, speedMax: 8.0, coneHalfAngle: 160, axisElevation: 30, biasUpward: 0.5 },
        tempKStart: 2200, tempKEnd: 1200,
        sizeStart: 0.35, sizeEnd: 0.12,
        gravityScale: 1.2, dragScale: 0.8,
        particleType: PTYPE.GLITTER,
      },
    ],
    secondaryEffects: [
      {
        name: 'glitter_scatter',
        tTrigger: 0.25,
        parentFraction: 0.8,
        countPerParent: 6,
        vel: { speedMin: 1.5, speedMax: 7.0, coneHalfAngle: 180, axisElevation: 45, biasUpward: 0 },
        tempK: 2200, size: 0.28, lifetime: 0.9,
        particleType: PTYPE.GLITTER,
        gravityScale: 1.2, dragScale: 0.85,
      },
    ],
    sfxProfile: [
      { name: 'lift_whoosh',    tOffset: -1.9, volume: 0.5, duration: 1.8, clipKey: 'swoosh_shell_rise',  loop: false },
      { name: 'burst_boom',     tOffset: 0.0,  volume: 0.9, duration: 0.5, clipKey: 'boom_glitter',       loop: false },
      { name: 'glitter_sparkle', tOffset: 0.25, volume: 0.4, duration: 2.8, clipKey: 'crackle_glitter_gold', loop: true, tEnd: 3.1 },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // DRAGON EGG — crackle eggs that burst into secondary crackle balls
  // Reference: London Eye shell sequences
  // ══════════════════════════════════════════════════════════════════════════
  dragon_egg: {
    id: 'dragon_egg',
    displayName: 'Dragon Egg / Crackle',
    baseLifetimeS: 2.0,
    baseLiftTimeS: 1.7,
    baseBurstHeightM: 58,
    groundEffect: false,
    defaultFormulationId: 'crackling_willow_30mm',
    stages: [
      {
        name: 'egg_burst',
        tStart: 0.00, tEnd: 0.04,
        emissionRate: 1600,     // low count, each = one large crackle egg
        vel: { speedMin: 10, speedMax: 18, coneHalfAngle: 180, axisElevation: 45, biasUpward: 1 },
        tempKStart: 5000, tempKEnd: 3800,
        sizeStart: 2.8, sizeEnd: 2.4,
        gravityScale: 0.2,
        dragScale: 0.7,
        particleType: PTYPE.STAR,
        hasBranch: true,
        tBranch: 0.5,
      },
      {
        name: 'egg_flight',
        tStart: 0.04, tEnd: 0.55,
        emissionRate: 0,
        vel: { speedMin: 8, speedMax: 16, coneHalfAngle: 180, axisElevation: 45, biasUpward: 0 },
        tempKStart: 3800, tempKEnd: 2800,
        sizeStart: 2.4, sizeEnd: 2.0,
        gravityScale: 1.8, dragScale: 0.9,
        particleType: PTYPE.STAR,
      },
      {
        name: 'crackle_decay',
        tStart: 0.55, tEnd: 0.95,
        emissionRate: 0,
        vel: { speedMin: 0, speedMax: 1.5, coneHalfAngle: 180, axisElevation: 0, biasUpward: 0 },
        tempKStart: 2800, tempKEnd: 900,
        sizeStart: 2.0, sizeEnd: 0.5,
        gravityScale: 2.0, dragScale: 0.85,
        particleType: PTYPE.EMBER,
      },
    ],
    secondaryEffects: [
      {
        name: 'egg_hatch_crackle',
        tTrigger: 0.50,
        parentFraction: 1.0,
        countPerParent: 12,     // each egg hatches 12 crackle fragments
        vel: { speedMin: 3.0, speedMax: 12.0, coneHalfAngle: 180, axisElevation: 45, biasUpward: 0 },
        tempK: 3500, size: 0.35, lifetime: 0.6,
        particleType: PTYPE.CRACKLE,
        gravityScale: 1.5, dragScale: 1.1,
      },
    ],
    sfxProfile: [
      { name: 'lift_whoosh', tOffset: -1.7, volume: 0.5, duration: 1.6, clipKey: 'swoosh_shell_rise', loop: false },
      { name: 'burst_boom',  tOffset: 0.0,  volume: 0.8, duration: 0.5, clipKey: 'boom_crackle',     loop: false },
      { name: 'egg_crackle', tOffset: 0.9,  volume: 0.7, duration: 1.0, clipKey: 'crackle_dragon_egg', loop: false },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // TIME RAIN — stars hang, then rain vertically
  // ══════════════════════════════════════════════════════════════════════════
  time_rain: {
    id: 'time_rain',
    displayName: 'Time Rain',
    baseLifetimeS: 4.0,
    baseLiftTimeS: 2.0,
    baseBurstHeightM: 65,
    groundEffect: false,
    stages: [
      {
        name: 'wide_burst',
        tStart: 0.00, tEnd: 0.03,
        emissionRate: 4000,
        vel: { speedMin: 12, speedMax: 20, coneHalfAngle: 120, axisElevation: 60, biasUpward: 8 },
        tempKStart: 5000, tempKEnd: 3500,
        sizeStart: 1.8, sizeEnd: 1.5,
        gravityScale: 0.05,     // near-weightless initial burst
        dragScale: 0.55,
        particleType: PTYPE.STAR,
      },
      {
        // Hang phase — stars resist gravity briefly
        name: 'float_phase',
        tStart: 0.03, tEnd: 0.30,
        emissionRate: 0,
        vel: { speedMin: 4, speedMax: 14, coneHalfAngle: 100, axisElevation: 70, biasUpward: 6 },
        tempKStart: 3500, tempKEnd: 2600,
        sizeStart: 1.5, sizeEnd: 1.4,
        gravityScale: 0.15,     // gravity nearly neutralized during hang
        dragScale: 0.6,
        particleType: PTYPE.STAR,
      },
      {
        // Rain fall — gravity kicks in
        name: 'rain_fall',
        tStart: 0.30, tEnd: 0.90,
        emissionRate: 0,
        vel: { speedMin: 0, speedMax: 3, coneHalfAngle: 30, axisElevation: 0, biasUpward: 0 },
        tempKStart: 2600, tempKEnd: 1000,
        sizeStart: 1.4, sizeEnd: 0.5,
        gravityScale: 1.4,      // gravity resumes → straight vertical fall
        dragScale: 0.5,         // low drag → clean rain lines
        particleType: PTYPE.STAR,
      },
    ],
    secondaryEffects: [],
    sfxProfile: [
      { name: 'lift_whoosh', tOffset: -2.0, volume: 0.5, duration: 1.9, clipKey: 'swoosh_shell_rise', loop: false },
      { name: 'burst_boom',  tOffset: 0.0,  volume: 0.85, duration: 0.5, clipKey: 'boom_time_rain',  loop: false },
      { name: 'rain_soft',   tOffset: 0.8,  volume: 0.2, duration: 3.0, clipKey: 'hiss_rain_gentle', loop: true, tEnd: 3.8 },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // HORSETAIL — extreme upward cone + heavy droop
  // ══════════════════════════════════════════════════════════════════════════
  horsetail: {
    id: 'horsetail',
    displayName: 'Horsetail',
    baseLifetimeS: 4.2,
    baseLiftTimeS: 2.2,
    baseBurstHeightM: 68,
    groundEffect: false,
    stages: [
      {
        name: 'tight_upward_burst',
        tStart: 0.00, tEnd: 0.02,
        emissionRate: 6400,
        vel: { speedMin: 10, speedMax: 18, coneHalfAngle: 15, axisElevation: 90, biasUpward: 0 },
        tempKStart: 5000, tempKEnd: 3500,
        sizeStart: 1.8, sizeEnd: 1.6,
        gravityScale: 0.1,
        dragScale: 0.6,
        particleType: PTYPE.STAR,
      },
      {
        name: 'horsetail_droop',
        tStart: 0.02, tEnd: 0.75,
        emissionRate: 0,
        vel: { speedMin: 8, speedMax: 16, coneHalfAngle: 15, axisElevation: 90, biasUpward: 0 },
        tempKStart: 3500, tempKEnd: 1800,
        sizeStart: 1.6, sizeEnd: 1.2,
        gravityScale: 2.0,      // very heavy droop — "horsetail" cascade
        dragScale: 1.0,
        particleType: PTYPE.STAR,
      },
      {
        name: 'tail_trails',
        tStart: 0.02, tEnd: 0.95,
        emissionRate: 3000,
        vel: { speedMin: 0.3, speedMax: 2.5, coneHalfAngle: 30, axisElevation: 10, biasUpward: -2 },
        tempKStart: 2200, tempKEnd: 900,
        sizeStart: 0.4, sizeEnd: 0.1,
        gravityScale: 2.2,
        dragScale: 0.8,
        particleType: PTYPE.TRAIL,
      },
    ],
    secondaryEffects: [],
    sfxProfile: [
      { name: 'lift_whoosh', tOffset: -2.2, volume: 0.5, duration: 2.1, clipKey: 'swoosh_shell_rise', loop: false },
      { name: 'burst_boom',  tOffset: 0.0,  volume: 0.9, duration: 0.6, clipKey: 'boom_horsetail',   loop: false },
      { name: 'cascade_hiss', tOffset: 0.1, volume: 0.3, duration: 4.0, clipKey: 'hiss_cascade',     loop: true, tEnd: 4.1 },
    ],
    trailProfile: {
      lengthM: 10.0, alphaHead: 0.90, alphaTail: 0.003,
      whiteHotFraction: 0.05,
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // SATURN — equatorial ring (60%) + polar burst (40%)
  // ══════════════════════════════════════════════════════════════════════════
  saturn: {
    id: 'saturn',
    displayName: 'Saturn Ring Shell',
    baseLifetimeS: 3.0,
    baseLiftTimeS: 2.0,
    baseBurstHeightM: 65,
    groundEffect: false,
    stages: [
      {
        name: 'equatorial_ring',
        tStart: 0.00, tEnd: 0.02,
        emissionRate: 5600,     // 60% of stars in flat ring
        vel: { speedMin: 22, speedMax: 30, coneHalfAngle: 4, axisElevation: 0, biasUpward: 0 },
        tempKStart: 5800, tempKEnd: 4000,
        sizeStart: 1.6, sizeEnd: 1.4,
        gravityScale: 0.05, dragScale: 0.6,
        particleType: PTYPE.STAR,
      },
      {
        name: 'polar_burst',
        tStart: 0.00, tEnd: 0.02,
        emissionRate: 3200,     // 40% in upward cone
        vel: { speedMin: 12, speedMax: 20, coneHalfAngle: 30, axisElevation: 80, biasUpward: 0 },
        tempKStart: 5800, tempKEnd: 4000,
        sizeStart: 1.6, sizeEnd: 1.4,
        gravityScale: 0.05, dragScale: 0.6,
        particleType: PTYPE.STAR,
      },
      {
        name: 'ring_expansion',
        tStart: 0.02, tEnd: 0.60,
        emissionRate: 0,
        vel: { speedMin: 20, speedMax: 28, coneHalfAngle: 4, axisElevation: 0, biasUpward: 0 },
        tempKStart: 4000, tempKEnd: 2200,
        sizeStart: 1.4, sizeEnd: 1.2,
        gravityScale: 0.8, dragScale: 0.95,
        particleType: PTYPE.STAR,
      },
    ],
    secondaryEffects: [],
    sfxProfile: [
      { name: 'lift_whoosh', tOffset: -2.0, volume: 0.5, duration: 1.9, clipKey: 'swoosh_shell_rise', loop: false },
      { name: 'burst_boom',  tOffset: 0.0,  volume: 0.9, duration: 0.5, clipKey: 'boom_saturn',       loop: false },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // SPIDER WEB — 10 radial arms + connector stars
  // ══════════════════════════════════════════════════════════════════════════
  spider_web: {
    id: 'spider_web',
    displayName: 'Spider Web',
    baseLifetimeS: 2.8,
    baseLiftTimeS: 1.9,
    baseBurstHeightM: 60,
    groundEffect: false,
    stages: [
      {
        name: 'arm_burst',
        tStart: 0.00, tEnd: 0.02,
        emissionRate: 7200,     // 10 arms
        vel: { speedMin: 26, speedMax: 36, coneHalfAngle: 5, axisElevation: 2, biasUpward: 0.5 },
        tempKStart: 6000, tempKEnd: 4200,
        sizeStart: 1.8, sizeEnd: 1.5,
        gravityScale: 0.05, dragScale: 0.5,
        particleType: PTYPE.STAR,
      },
      {
        name: 'web_connectors',
        tStart: 0.00, tEnd: 0.04,
        emissionRate: 2400,     // ring-like connecting stars
        vel: { speedMin: 8, speedMax: 22, coneHalfAngle: 180, axisElevation: 2, biasUpward: 0.3 },
        tempKStart: 5500, tempKEnd: 3500,
        sizeStart: 1.0, sizeEnd: 0.8,
        gravityScale: 0.1, dragScale: 0.6,
        particleType: PTYPE.STAR,
      },
      {
        name: 'arm_flight',
        tStart: 0.02, tEnd: 0.65,
        emissionRate: 0,
        vel: { speedMin: 24, speedMax: 34, coneHalfAngle: 5, axisElevation: 2, biasUpward: 0.3 },
        tempKStart: 4200, tempKEnd: 2400,
        sizeStart: 1.5, sizeEnd: 1.1,
        gravityScale: 0.6, dragScale: 0.9,
        particleType: PTYPE.STAR,
      },
    ],
    secondaryEffects: [],
    sfxProfile: [
      { name: 'lift_whoosh', tOffset: -1.9, volume: 0.5, duration: 1.8, clipKey: 'swoosh_shell_rise', loop: false },
      { name: 'burst_boom',  tOffset: 0.0,  volume: 0.85, duration: 0.5, clipKey: 'boom_spider',      loop: false },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // RING — flat toroidal burst (2D ring, minimal vertical spread)
  // ══════════════════════════════════════════════════════════════════════════
  ring: {
    id: 'ring',
    displayName: 'Ring',
    baseLifetimeS: 2.5,
    baseLiftTimeS: 1.9,
    baseBurstHeightM: 62,
    groundEffect: false,
    stages: [
      {
        name: 'ring_burst',
        tStart: 0.00, tEnd: 0.02,
        emissionRate: 3200,
        vel: { speedMin: 24, speedMax: 32, coneHalfAngle: 2, axisElevation: 0, biasUpward: 0.2 },
        tempKStart: 5500, tempKEnd: 3800,
        sizeStart: 1.8, sizeEnd: 1.5,
        gravityScale: 0.05, dragScale: 0.55,
        particleType: PTYPE.STAR,
      },
      {
        name: 'ring_expansion',
        tStart: 0.02, tEnd: 0.70,
        emissionRate: 0,
        vel: { speedMin: 22, speedMax: 30, coneHalfAngle: 2, axisElevation: 0, biasUpward: 0.1 },
        tempKStart: 3800, tempKEnd: 2000,
        sizeStart: 1.5, sizeEnd: 1.0,
        gravityScale: 0.6, dragScale: 0.9,
        particleType: PTYPE.STAR,
      },
    ],
    secondaryEffects: [],
    sfxProfile: [
      { name: 'lift_whoosh', tOffset: -1.9, volume: 0.5, duration: 1.8, clipKey: 'swoosh_shell_rise', loop: false },
      { name: 'burst_boom',  tOffset: 0.0,  volume: 0.85, duration: 0.5, clipKey: 'boom_ring',        loop: false },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // DAHLIA — fewer large stars, very high velocity, short lifetime
  // ══════════════════════════════════════════════════════════════════════════
  dahlia: {
    id: 'dahlia',
    displayName: 'Dahlia',
    baseLifetimeS: 1.8,
    baseLiftTimeS: 1.8,
    baseBurstHeightM: 60,
    groundEffect: false,
    stages: [
      {
        name: 'dahlia_burst',
        tStart: 0.00, tEnd: 0.02,
        emissionRate: 2400,     // fewer, larger stars
        vel: { speedMin: 36, speedMax: 50, coneHalfAngle: 180, axisElevation: 50, biasUpward: 3 },
        tempKStart: 7000, tempKEnd: 4500,
        sizeStart: 3.0, sizeEnd: 2.4,   // large dahlia stars
        gravityScale: 0.1, dragScale: 0.5,
        particleType: PTYPE.STAR,
      },
      {
        name: 'rapid_fade',
        tStart: 0.02, tEnd: 0.75,
        emissionRate: 0,
        vel: { speedMin: 34, speedMax: 48, coneHalfAngle: 180, axisElevation: 50, biasUpward: 2 },
        tempKStart: 4500, tempKEnd: 1500,
        sizeStart: 2.4, sizeEnd: 0.8,
        gravityScale: 1.1, dragScale: 1.0,
        particleType: PTYPE.STAR,
      },
    ],
    secondaryEffects: [],
    sfxProfile: [
      { name: 'lift_whoosh', tOffset: -1.8, volume: 0.5, duration: 1.7, clipKey: 'swoosh_shell_rise', loop: false },
      { name: 'burst_boom',  tOffset: 0.0,  volume: 1.0, duration: 0.7, clipKey: 'boom_dahlia',       loop: false },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // COCONUT TREE — trunk+fronds: tight upward, cascade outward
  // ══════════════════════════════════════════════════════════════════════════
  coconut_tree: {
    id: 'coconut_tree',
    displayName: 'Coconut Tree',
    baseLifetimeS: 4.0,
    baseLiftTimeS: 2.2,
    baseBurstHeightM: 68,
    groundEffect: false,
    stages: [
      {
        name: 'trunk_burst',
        tStart: 0.00, tEnd: 0.02,
        emissionRate: 1600,     // tight trunk
        vel: { speedMin: 16, speedMax: 24, coneHalfAngle: 10, axisElevation: 90, biasUpward: 0 },
        tempKStart: 5000, tempKEnd: 3600,
        sizeStart: 2.0, sizeEnd: 1.8,
        gravityScale: 0.1, dragScale: 0.6,
        particleType: PTYPE.STAR,
      },
      {
        name: 'frond_spread',
        tStart: 0.02, tEnd: 0.60,
        emissionRate: 0,
        vel: { speedMin: 14, speedMax: 22, coneHalfAngle: 10, axisElevation: 90, biasUpward: 0 },
        tempKStart: 3600, tempKEnd: 2200,
        sizeStart: 1.8, sizeEnd: 1.5,
        gravityScale: 1.5, dragScale: 0.9,
        particleType: PTYPE.STAR,
      },
      {
        name: 'frond_trails',
        tStart: 0.05, tEnd: 0.90,
        emissionRate: 1800,
        vel: { speedMin: 0.5, speedMax: 3.0, coneHalfAngle: 60, axisElevation: 25, biasUpward: -1 },
        tempKStart: 2400, tempKEnd: 1000,
        sizeStart: 0.4, sizeEnd: 0.12,
        gravityScale: 1.6, dragScale: 0.88,
        particleType: PTYPE.TRAIL,
      },
    ],
    secondaryEffects: [],
    sfxProfile: [
      { name: 'lift_whoosh', tOffset: -2.2, volume: 0.5, duration: 2.1, clipKey: 'swoosh_shell_rise', loop: false },
      { name: 'burst_boom',  tOffset: 0.0,  volume: 0.9, duration: 0.7, clipKey: 'boom_coconut',     loop: false },
    ],
    trailProfile: {
      lengthM: 7.5, alphaHead: 0.9, alphaTail: 0.005,
      whiteHotFraction: 0.10,
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // MULTI_BREAK — double or triple break shell
  // ══════════════════════════════════════════════════════════════════════════
  multi_break: {
    id: 'multi_break',
    displayName: 'Multi-Break',
    baseLifetimeS: 3.5,
    baseLiftTimeS: 2.0,
    baseBurstHeightM: 65,
    groundEffect: false,
    stages: [
      {
        name: 'first_break',
        tStart: 0.00, tEnd: 0.03,
        emissionRate: 4800,
        vel: { speedMin: 20, speedMax: 28, coneHalfAngle: 180, axisElevation: 50, biasUpward: 2 },
        tempKStart: 5600, tempKEnd: 4000,
        sizeStart: 2.0, sizeEnd: 1.8,
        gravityScale: 0.1, dragScale: 0.6,
        particleType: PTYPE.STAR,
        hasBranch: true,
        tBranch: 0.35,
      },
      {
        name: 'first_break_expansion',
        tStart: 0.03, tEnd: 0.38,
        emissionRate: 0,
        vel: { speedMin: 18, speedMax: 26, coneHalfAngle: 180, axisElevation: 50, biasUpward: 2 },
        tempKStart: 4000, tempKEnd: 2500,
        sizeStart: 1.8, sizeEnd: 1.5,
        gravityScale: 1.0, dragScale: 1.0,
        particleType: PTYPE.STAR,
      },
    ],
    secondaryEffects: [
      {
        name: 'second_break',
        tTrigger: 0.35,
        parentFraction: 0.35,   // 35% of first-break stars reignite
        countPerParent: 8,      // each spawns 8 new stars
        vel: { speedMin: 14, speedMax: 22, coneHalfAngle: 180, axisElevation: 55, biasUpward: 2 },
        tempK: 5000, size: 1.4, lifetime: 1.8,
        particleType: PTYPE.STAR,
        gravityScale: 1.0, dragScale: 0.9,
      },
      {
        name: 'third_break',
        tTrigger: 0.60,
        parentFraction: 0.20,
        countPerParent: 6,
        vel: { speedMin: 10, speedMax: 18, coneHalfAngle: 180, axisElevation: 55, biasUpward: 1.5 },
        tempK: 4200, size: 1.0, lifetime: 1.2,
        particleType: PTYPE.STAR,
        gravityScale: 1.0, dragScale: 0.9,
      },
    ],
    sfxProfile: [
      { name: 'lift_whoosh',  tOffset: -2.0, volume: 0.5, duration: 1.9, clipKey: 'swoosh_shell_rise',  loop: false },
      { name: 'first_boom',   tOffset: 0.0,  volume: 1.0, duration: 0.5, clipKey: 'boom_multi_first',  loop: false },
      { name: 'second_boom',  tOffset: 1.2,  volume: 0.8, duration: 0.4, clipKey: 'boom_multi_second', loop: false },
      { name: 'third_boom',   tOffset: 2.0,  volume: 0.6, duration: 0.35, clipKey: 'boom_multi_third', loop: false },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // COMET — rising trail effect (no overhead burst, all trail)
  // ══════════════════════════════════════════════════════════════════════════
  comet: {
    id: 'comet',
    displayName: 'Rising Comet',
    baseLifetimeS: 1.8,
    baseLiftTimeS: 1.8,
    baseBurstHeightM: 55,
    groundEffect: false,
    stages: [
      {
        name: 'comet_launch',
        tStart: 0.00, tEnd: 0.05,
        emissionRate: 12000,
        vel: { speedMin: 28, speedMax: 40, coneHalfAngle: 4, axisElevation: 85, biasUpward: 0 },
        tempKStart: 7000, tempKEnd: 5000,
        sizeStart: 1.6, sizeEnd: 1.3,
        gravityScale: 0.15, dragScale: 0.45,
        particleType: PTYPE.TRAIL,
      },
      {
        name: 'comet_arc',
        tStart: 0.05, tEnd: 0.75,
        emissionRate: 6000,
        vel: { speedMin: 24, speedMax: 36, coneHalfAngle: 3, axisElevation: 85, biasUpward: 0 },
        tempKStart: 5000, tempKEnd: 2800,
        sizeStart: 1.3, sizeEnd: 0.8,
        gravityScale: 0.6, dragScale: 0.5,
        particleType: PTYPE.TRAIL,
      },
      {
        name: 'comet_fade',
        tStart: 0.75, tEnd: 1.00,
        emissionRate: 1200,
        vel: { speedMin: 0.5, speedMax: 3, coneHalfAngle: 60, axisElevation: 45, biasUpward: 0 },
        tempKStart: 2800, tempKEnd: 900,
        sizeStart: 0.8, sizeEnd: 0.3,
        gravityScale: 1.2, dragScale: 0.9,
        particleType: PTYPE.EMBER,
      },
    ],
    secondaryEffects: [],
    sfxProfile: [
      { name: 'comet_whoosh', tOffset: 0.0, volume: 0.6, duration: 1.7, clipKey: 'swoosh_comet', loop: false },
    ],
    trailProfile: {
      lengthM: 12.0, alphaHead: 1.0, alphaTail: 0.0,
      whiteHotFraction: 0.6,   // comets are mostly white-hot at head
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // MINE — ground-level upward fan burst (no lifttime)
  // Reference: Sydney Countdown mine volleys at bridge base positions
  // ══════════════════════════════════════════════════════════════════════════
  mine: {
    id: 'mine',
    displayName: 'Mine / Ground Fan',
    baseLifetimeS: 2.0,
    baseLiftTimeS: 0.0,
    baseBurstHeightM: 0,
    groundEffect: true,
    stages: [
      {
        name: 'mine_launch',
        tStart: 0.00, tEnd: 0.08,
        emissionRate: 14000,    // fast dense burst from ground
        vel: { speedMin: 18, speedMax: 32, coneHalfAngle: 60, axisElevation: 75, biasUpward: 0 },
        tempKStart: 7500, tempKEnd: 5000,
        sizeStart: 1.4, sizeEnd: 1.2,
        gravityScale: 0.0,      // ground cannon — no gravity during launch
        dragScale: 0.4,
        particleType: PTYPE.STAR,
      },
      {
        name: 'mine_arc',
        tStart: 0.08, tEnd: 0.65,
        emissionRate: 0,
        vel: { speedMin: 16, speedMax: 28, coneHalfAngle: 60, axisElevation: 75, biasUpward: 0 },
        tempKStart: 5000, tempKEnd: 2500,
        sizeStart: 1.2, sizeEnd: 1.0,
        gravityScale: 1.0, dragScale: 1.0,
        particleType: PTYPE.STAR,
      },
      {
        name: 'mine_trails',
        tStart: 0.00, tEnd: 0.90,
        emissionRate: 4000,
        vel: { speedMin: 1.0, speedMax: 4.0, coneHalfAngle: 80, axisElevation: 40, biasUpward: -0.5 },
        tempKStart: 3500, tempKEnd: 1200,
        sizeStart: 0.5, sizeEnd: 0.15,
        gravityScale: 1.0, dragScale: 0.8,
        particleType: PTYPE.TRAIL,
      },
      {
        name: 'ember_fall',
        tStart: 0.65, tEnd: 0.95,
        emissionRate: 0,
        vel: { speedMin: 0, speedMax: 2, coneHalfAngle: 180, axisElevation: 0, biasUpward: 0 },
        tempKStart: 2500, tempKEnd: 900,
        sizeStart: 1.0, sizeEnd: 0.3,
        gravityScale: 1.3, dragScale: 0.85,
        particleType: PTYPE.EMBER,
      },
    ],
    secondaryEffects: [],
    sfxProfile: [
      { name: 'mine_concussion', tOffset: 0.0,  volume: 1.0, duration: 0.3, clipKey: 'boom_mine_ground',  loop: false },
      { name: 'mine_whistle',    tOffset: 0.0,  volume: 0.55, duration: 0.6, clipKey: 'whistle_mine',     loop: false },
      { name: 'mine_crackle',    tOffset: 0.15, volume: 0.45, duration: 1.5, clipKey: 'crackle_light',    loop: true, tEnd: 1.65 },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // STROBE — white-flashing stars, magnetic visual with on/off pulse
  // Reference: Sydney Countdown t=464ms StrobePots volley (all 29 positions)
  // ══════════════════════════════════════════════════════════════════════════
  strobe: {
    id: 'strobe',
    displayName: 'Strobe Shell',
    baseLifetimeS: 5.5,
    baseLiftTimeS: 2.0,
    baseBurstHeightM: 65,
    groundEffect: false,
    gravityOverride: 0.1,       // strobe stars designed to "hang" longer
    stages: [
      {
        name: 'strobe_burst',
        tStart: 0.00, tEnd: 0.03,
        emissionRate: 5600,
        vel: { speedMin: 16, speedMax: 22, coneHalfAngle: 180, axisElevation: 45, biasUpward: 1 },
        tempKStart: 8000, tempKEnd: 6000,  // very hot white strobe flash
        sizeStart: 2.4, sizeEnd: 2.0,
        gravityScale: 0.1, dragScale: 0.6,
        particleType: PTYPE.STAR,
      },
      {
        // Strobe cycle: temperature oscillates (handled by pulsing brightness in GPU shader)
        name: 'strobe_cycle',
        tStart: 0.03, tEnd: 0.90,
        emissionRate: 0,
        vel: { speedMin: 14, speedMax: 20, coneHalfAngle: 180, axisElevation: 45, biasUpward: 0 },
        tempKStart: 6000, tempKEnd: 6000,  // strobe: T is ~constant (chemical composition ensures this)
        sizeStart: 2.0, sizeEnd: 1.8,
        gravityScale: 0.1,      // very slow fall — designed to stay visible
        dragScale: 0.7,
        particleType: PTYPE.STAR,
      },
    ],
    secondaryEffects: [],
    sfxProfile: [
      { name: 'lift_whoosh', tOffset: -2.0, volume: 0.5, duration: 1.9, clipKey: 'swoosh_shell_rise', loop: false },
      { name: 'burst_boom',  tOffset: 0.0,  volume: 0.85, duration: 0.5, clipKey: 'boom_strobe',     loop: false },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // WATERFALL (ground) — continuous downward curtain of silver/gold sparks
  // Reference: Sydney Harbour Bridge vertical waterfall columns
  // ══════════════════════════════════════════════════════════════════════════
  waterfall: {
    id: 'waterfall',
    displayName: 'Waterfall / Cascade',
    baseLifetimeS: 20.0,
    baseLiftTimeS: 0.0,
    baseBurstHeightM: 5,        // hung at height on bridge/stage structure
    groundEffect: true,
    stages: [
      {
        name: 'wf_emission',
        tStart: 0.00, tEnd: 1.00,
        emissionRate: 8000,
        vel: { speedMin: 2.5, speedMax: 6.0, coneHalfAngle: 15, axisElevation: -85, biasUpward: -4 },
        tempKStart: 3200, tempKEnd: 1800,
        sizeStart: 0.4, sizeEnd: 0.1,
        gravityScale: 1.2, dragScale: 0.5,
        particleType: PTYPE.TRAIL,
      },
      {
        name: 'wf_smoke',
        tStart: 0.02, tEnd: 1.00,
        emissionRate: 400,
        vel: { speedMin: 0.3, speedMax: 1.5, coneHalfAngle: 60, axisElevation: 85, biasUpward: 0.5 },
        tempKStart: 800, tempKEnd: 350,
        sizeStart: 3.0, sizeEnd: 10.0,
        gravityScale: 0.05, dragScale: 0.05,
        particleType: PTYPE.SMOKE,
      },
    ],
    secondaryEffects: [],
    sfxProfile: [
      { name: 'wf_hiss', tOffset: 0.0, volume: 0.5, duration: 20.0, clipKey: 'hiss_waterfall', loop: true, tEnd: 20.0 },
    ],
    trailProfile: {
      lengthM: 3.5, alphaHead: 0.95, alphaTail: 0.02,
      whiteHotFraction: 0.55,
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // GERB (Gerbe) — ground fountain, golden rain
  // ══════════════════════════════════════════════════════════════════════════
  gerb: {
    id: 'gerb',
    displayName: 'Gerb / Fountain',
    baseLifetimeS: 12.0,
    baseLiftTimeS: 0.0,
    baseBurstHeightM: 0,
    groundEffect: true,
    stages: [
      {
        name: 'gerb_column',
        tStart: 0.00, tEnd: 0.95,
        emissionRate: 5000,
        vel: { speedMin: 4.0, speedMax: 8.0, coneHalfAngle: 8, axisElevation: 88, biasUpward: 0 },
        tempKStart: 3800, tempKEnd: 2200,
        sizeStart: 0.6, sizeEnd: 0.3,
        gravityScale: 0.8, dragScale: 0.6,
        particleType: PTYPE.TRAIL,
      },
      {
        name: 'gerb_sparkle',
        tStart: 0.02, tEnd: 0.95,
        emissionRate: 1200,
        vel: { speedMin: 1.5, speedMax: 5.0, coneHalfAngle: 30, axisElevation: 70, biasUpward: 0 },
        tempKStart: 2800, tempKEnd: 1400,
        sizeStart: 0.3, sizeEnd: 0.12,
        gravityScale: 1.1, dragScale: 0.85,
        particleType: PTYPE.GLITTER,
      },
    ],
    secondaryEffects: [],
    sfxProfile: [
      { name: 'gerb_hiss', tOffset: 0.0, volume: 0.45, duration: 12.0, clipKey: 'hiss_gerb', loop: true, tEnd: 12.0 },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // ROMAN CANDLE — sequential pulsed shots
  // ══════════════════════════════════════════════════════════════════════════
  candle: {
    id: 'candle',
    displayName: 'Roman Candle',
    baseLifetimeS: 10.0,
    baseLiftTimeS: 0.0,
    baseBurstHeightM: 0,
    groundEffect: true,
    stages: [
      {
        // One shot — repeated each 1.0–2.0 s depending on shot count
        name: 'candle_shot',
        tStart: 0.00, tEnd: 0.05,
        emissionRate: 800,
        vel: { speedMin: 12, speedMax: 20, coneHalfAngle: 6, axisElevation: 85, biasUpward: 0 },
        tempKStart: 5500, tempKEnd: 4000,
        sizeStart: 1.2, sizeEnd: 1.0,
        gravityScale: 0.2, dragScale: 0.5,
        particleType: PTYPE.STAR,
      },
      {
        name: 'candle_trail',
        tStart: 0.05, tEnd: 0.40,
        emissionRate: 1600,
        vel: { speedMin: 6, speedMax: 15, coneHalfAngle: 5, axisElevation: 85, biasUpward: 0 },
        tempKStart: 4000, tempKEnd: 2200,
        sizeStart: 0.5, sizeEnd: 0.15,
        gravityScale: 0.6, dragScale: 0.55,
        particleType: PTYPE.TRAIL,
      },
    ],
    secondaryEffects: [],
    sfxProfile: [
      { name: 'candle_shot', tOffset: 0.0, volume: 0.5, duration: 0.15, clipKey: 'boom_candle_shot', loop: false },
      { name: 'candle_hiss', tOffset: 0.0, volume: 0.3, duration: 0.4,  clipKey: 'hiss_candle',     loop: false },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // FALLING_LEAVES — wide scatter, low velocity, tumbling drag
  // ══════════════════════════════════════════════════════════════════════════
  falling_leaves: {
    id: 'falling_leaves',
    displayName: 'Falling Leaves',
    baseLifetimeS: 5.0,
    baseLiftTimeS: 2.1,
    baseBurstHeightM: 65,
    groundEffect: false,
    stages: [
      {
        name: 'leaf_burst',
        tStart: 0.00, tEnd: 0.03,
        emissionRate: 3200,
        vel: { speedMin: 14, speedMax: 24, coneHalfAngle: 180, axisElevation: 45, biasUpward: 2 },
        tempKStart: 4800, tempKEnd: 3400,
        sizeStart: 1.5, sizeEnd: 1.3,
        gravityScale: 0.1, dragScale: 0.6,
        particleType: PTYPE.STAR,
      },
      {
        name: 'leaf_tumble',
        tStart: 0.03, tEnd: 0.80,
        emissionRate: 0,
        vel: { speedMin: 12, speedMax: 22, coneHalfAngle: 180, axisElevation: 45, biasUpward: 1 },
        tempKStart: 3400, tempKEnd: 1800,
        sizeStart: 1.3, sizeEnd: 0.9,
        gravityScale: 1.6, dragScale: 1.8,  // high drag = tumbling flutter effect
        particleType: PTYPE.STAR,
      },
    ],
    secondaryEffects: [],
    sfxProfile: [
      { name: 'lift_whoosh', tOffset: -2.1, volume: 0.5, duration: 2.0, clipKey: 'swoosh_shell_rise', loop: false },
      { name: 'burst_boom',  tOffset: 0.0,  volume: 0.8, duration: 0.5, clipKey: 'boom_peony_3in',   loop: false },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // HEART — parametric heart-curve burst
  // ══════════════════════════════════════════════════════════════════════════
  heart: {
    id: 'heart',
    displayName: 'Heart',
    baseLifetimeS: 2.8,
    baseLiftTimeS: 1.9,
    baseBurstHeightM: 62,
    groundEffect: false,
    stages: [
      {
        name: 'heart_trace',
        tStart: 0.00, tEnd: 0.02,
        emissionRate: 4000,     // closely spaced stars trace the heart curve
        vel: { speedMin: 20, speedMax: 26, coneHalfAngle: 0, axisElevation: 0, biasUpward: 0 },
        tempKStart: 5000, tempKEnd: 3800,
        sizeStart: 1.8, sizeEnd: 1.6,
        gravityScale: 0.05, dragScale: 0.6,
        particleType: PTYPE.STAR,
      },
      {
        name: 'heart_expansion',
        tStart: 0.02, tEnd: 0.75,
        emissionRate: 0,
        vel: { speedMin: 18, speedMax: 24, coneHalfAngle: 0, axisElevation: 0, biasUpward: 0 },
        tempKStart: 3800, tempKEnd: 2200,
        sizeStart: 1.6, sizeEnd: 1.1,
        gravityScale: 0.7, dragScale: 0.9,
        particleType: PTYPE.STAR,
      },
    ],
    secondaryEffects: [],
    sfxProfile: [
      { name: 'lift_whoosh', tOffset: -1.9, volume: 0.5, duration: 1.8, clipKey: 'swoosh_shell_rise', loop: false },
      { name: 'burst_boom',  tOffset: 0.0,  volume: 0.85, duration: 0.5, clipKey: 'boom_heart',       loop: false },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // BROCADE — like chrysanthemum but slower, Bi crackle trails
  // ══════════════════════════════════════════════════════════════════════════
  brocade: {
    id: 'brocade',
    displayName: 'Brocade',
    baseLifetimeS: 3.5,
    baseLiftTimeS: 2.0,
    baseBurstHeightM: 65,
    groundEffect: false,
    defaultFormulationId: 'brocade_crown_2.5',
    stages: [
      {
        name: 'brocade_burst',
        tStart: 0.00, tEnd: 0.03,
        emissionRate: 10000,
        vel: { speedMin: 18, speedMax: 26, coneHalfAngle: 180, axisElevation: 50, biasUpward: 3 },
        tempKStart: 5800, tempKEnd: 3800,
        sizeStart: 2.0, sizeEnd: 1.7,
        gravityScale: 0.08, dragScale: 0.6,
        particleType: PTYPE.STAR,
      },
      {
        name: 'brocade_spread',
        tStart: 0.03, tEnd: 0.65,
        emissionRate: 0,
        vel: { speedMin: 16, speedMax: 24, coneHalfAngle: 180, axisElevation: 50, biasUpward: 2 },
        tempKStart: 3800, tempKEnd: 2200,
        sizeStart: 1.7, sizeEnd: 1.4,
        gravityScale: 1.3, dragScale: 1.0,
        particleType: PTYPE.STAR,
      },
      {
        name: 'brocade_trails',
        tStart: 0.05, tEnd: 0.90,
        emissionRate: 2000,
        vel: { speedMin: 0.5, speedMax: 2.5, coneHalfAngle: 140, axisElevation: 10, biasUpward: -0.3 },
        tempKStart: 2400, tempKEnd: 1000,
        sizeStart: 0.4, sizeEnd: 0.12,
        gravityScale: 1.3, dragScale: 0.85,
        particleType: PTYPE.CRACKLE,
      },
    ],
    secondaryEffects: [],
    sfxProfile: [
      { name: 'lift_whoosh',   tOffset: -2.0, volume: 0.5, duration: 1.9, clipKey: 'swoosh_shell_rise', loop: false },
      { name: 'burst_boom',    tOffset: 0.0,  volume: 0.9, duration: 0.6, clipKey: 'boom_brocade',      loop: false },
      { name: 'brocade_trail_crackle', tOffset: 0.3, volume: 0.4, duration: 3.0, clipKey: 'crackle_brocade', loop: true, tEnd: 3.3 },
    ],
    trailProfile: {
      lengthM: 6.5, alphaHead: 0.92, alphaTail: 0.006,
      whiteHotFraction: 0.12,
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// SFX Caliber Scaling
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Acoustic concussion volume for a given caliber.
 * Calibrated from professional show sound measurements (dBA at 100m).
 * Normalized to 0-1 for the audio engine.
 */
export const CONCUSSION_VOLUME_BY_CALIBER: Record<number, number> = {
  25:  0.30,   // 1" roman candle
  38:  0.42,   // 1.5"
  50:  0.52,   // 2"
  63:  0.60,   // 2.5"
  75:  0.68,   // 3" — baseline
  100: 0.76,   // 4"
  125: 0.82,   // 5"
  150: 0.88,   // 6"
  200: 0.93,   // 8"
  250: 0.97,   // 10"
  300: 1.00,   // 12" — maximum
};

/** Get interpolated concussion volume for any caliber in mm */
export function getConcussionVolume(caliberMm: number): number {
  const keys = Object.keys(CONCUSSION_VOLUME_BY_CALIBER).map(Number).sort((a, b) => a - b);
  if (caliberMm <= keys[0]) return CONCUSSION_VOLUME_BY_CALIBER[keys[0]];
  if (caliberMm >= keys[keys.length - 1]) return CONCUSSION_VOLUME_BY_CALIBER[keys[keys.length - 1]];
  for (let i = 0; i < keys.length - 1; i++) {
    const lo = keys[i], hi = keys[i + 1];
    if (caliberMm >= lo && caliberMm <= hi) {
      const t = (caliberMm - lo) / (hi - lo);
      return CONCUSSION_VOLUME_BY_CALIBER[lo] + t * (CONCUSSION_VOLUME_BY_CALIBER[hi] - CONCUSSION_VOLUME_BY_CALIBER[lo]);
    }
  }
  return 0.7;
}

/**
 * Lift time scaled for caliber (seconds from ground to burst).
 * Empirical fit to NFPA 1123 mortar velocity tables.
 */
export function getScaledLiftTime(baseEntry: EffectAtlasEntry, caliberMm: number): number {
  return baseEntry.baseLiftTimeS * Math.pow(caliberMm / 75, 0.55);
}

/**
 * Burst height scaled for caliber (meters).
 */
export function getScaledBurstHeight(baseEntry: EffectAtlasEntry, caliberMm: number): number {
  return baseEntry.baseBurstHeightM * Math.pow(caliberMm / 75, 0.8);
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/** Get the atlas entry for a pattern (returns peony as fallback) */
export function getAtlasEntry(patternId: string): EffectAtlasEntry {
  return ATLAS[patternId] ?? ATLAS['peony'];
}

/** True if the atlas has an entry for this pattern */
export function hasAtlasEntry(patternId: string): boolean {
  return patternId in ATLAS;
}

/** List all registered pattern IDs */
export function getAtlasPatternIds(): string[] {
  return Object.keys(ATLAS);
}

/**
 * Get all SFX events for an effect instance, with acoustic delay applied.
 * @param patternId   — pattern key (e.g. 'peony')
 * @param caliberMm   — shell caliber in millimeters
 * @param burstHeight — actual burst height in meters (for acoustic propagation)
 */
export function getScaledSfxProfile(
  patternId: string,
  caliberMm: number,
  burstHeight: number,
): SfxEvent[] {
  const entry = getAtlasEntry(patternId);
  const delay = acousticDelay(burstHeight);
  const vol = getConcussionVolume(caliberMm);
  const caliberScale = Math.pow(caliberMm / 75, 0.5);

  return entry.sfxProfile.map(ev => {
    // Scale boom/concussion volume by caliber; hiss/crackle are less dependent
    const isBoom = ev.clipKey.startsWith('boom_');
    const scaledVol = isBoom ? ev.volume * vol : ev.volume * (0.7 + 0.3 * caliberScale);
    // Add acoustic delay to tOffset for audience at ground level
    const tWithDelay = ev.tOffset + (isBoom ? delay : 0);
    return { ...ev, tOffset: tWithDelay, volume: Math.min(1, scaledVol) };
  });
}

/**
 * Get all stages for a given effect, with velocities and counts scaled to caliber.
 */
export function getScaledStages(
  patternId: string,
  caliberMm: number,
): EffectStage[] {
  const entry = getAtlasEntry(patternId);
  return entry.stages.map(s => ({
    ...s,
    vel: {
      ...s.vel,
      speedMin: scaleVelocity(s.vel.speedMin, caliberMm),
      speedMax: scaleVelocity(s.vel.speedMax, caliberMm),
      biasUpward: scaleVelocity(s.vel.biasUpward, caliberMm),
    },
    sizeStart: s.sizeStart * Math.pow(caliberMm / 75, 0.3),
    sizeEnd:   s.sizeEnd   * Math.pow(caliberMm / 75, 0.3),
  }));
}

/**
 * Get secondary effects scaled to caliber.
 */
export function getScaledSecondaryEffects(
  patternId: string,
  caliberMm: number,
): SecondaryEffect[] {
  const entry = getAtlasEntry(patternId);
  return entry.secondaryEffects.map(se => ({
    ...se,
    vel: {
      ...se.vel,
      speedMin: scaleVelocity(se.vel.speedMin, caliberMm),
      speedMax: scaleVelocity(se.vel.speedMax, caliberMm),
      biasUpward: scaleVelocity(se.vel.biasUpward, caliberMm),
    },
    size: se.size * Math.pow(caliberMm / 75, 0.3),
    countPerParent: Math.max(1, Math.round(se.countPerParent * Math.pow(caliberMm / 75, 0.6))),
  }));
}

/**
 * Sample velocity for a particle in a given VelocityCone at burst time.
 * Returns [vx, vy, vz] in world space (Y-up).
 */
export function sampleVelocityCone(cone: VelocityCone, rng: () => number): [number, number, number] {
  const speed = cone.speedMin + rng() * (cone.speedMax - cone.speedMin);
  const halfRad = (cone.coneHalfAngle * Math.PI) / 180;
  const elevRad  = (cone.axisElevation * Math.PI) / 180;

  // Random direction within cone
  const cosMax = Math.cos(halfRad);
  const cosTheta = cosMax + rng() * (1 - cosMax);
  const sinTheta = Math.sqrt(Math.max(0, 1 - cosTheta * cosTheta));
  const phi = rng() * Math.PI * 2;

  // Local direction (axis = +Z)
  const lx = sinTheta * Math.cos(phi);
  const ly = sinTheta * Math.sin(phi);
  const lz = cosTheta;

  // Rotate around X by (90° - elevation) to align with world +Y axis
  const pitchAngle = Math.PI / 2 - elevRad;
  const cp = Math.cos(pitchAngle);
  const sp = Math.sin(pitchAngle);

  const wx = lx * speed;
  const wy = (ly * cp - lz * sp) * speed + cone.biasUpward;
  const wz = (ly * sp + lz * cp) * speed;

  return [wx, wy, wz];
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-stage lookup helpers — used by FireworkRenderer for atlas-aware physics
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Return the dominant physics stage active at a given normalised lifecycle
 * point for a pattern.  Prefers non-smoke particle types; falls back to the
 * first active stage.
 *
 * @param patternId — effect pattern key (e.g. 'willow')
 * @param tNorm     — normalised age in [0,1]
 * @returns The matching EffectStage, or null if the pattern has no atlas entry.
 */
export function getAtlasStageAtTNorm(
  patternId: string,
  tNorm: number,
): EffectStage | null {
  const entry = ATLAS[patternId];
  if (!entry) return null;
  let fallback: EffectStage | null = null;
  for (const s of entry.stages) {
    if (tNorm < s.tStart || tNorm > s.tEnd) continue;
    // Prefer primary particle stages (STAR / EMBER) over smoke / trail emitters
    if (s.particleType === PTYPE.STAR || s.particleType === PTYPE.EMBER) return s;
    if (!fallback) fallback = s;
  }
  return fallback;
}

/**
 * Interpolated blackbody temperature (K) at a normalised lifecycle point.
 * Useful for driving trail head colour and size in the CPU renderer.
 *
 * @param patternId — effect pattern key
 * @param tNorm     — normalised age in [0,1]
 * @returns Temperature in K (defaults to 3000 K if pattern not in atlas).
 */
export function getAtlasTempKAtTNorm(
  patternId: string,
  tNorm: number,
): number {
  const stage = getAtlasStageAtTNorm(patternId, tNorm);
  if (!stage) return 3000;
  // Lerp within the stage window
  const stageFrac = stage.tEnd > stage.tStart
    ? Math.max(0, Math.min(1, (tNorm - stage.tStart) / (stage.tEnd - stage.tStart)))
    : 0;
  return stage.tempKStart + (stage.tempKEnd - stage.tempKStart) * stageFrac;
}

/**
 * Return {gravityScale, dragScale} from the atlas for the dominant stage at
 * the given tNorm.  Falls back to {1, 1} if the pattern has no atlas entry.
 */
export function getAtlasPhysicsAtTNorm(
  patternId: string,
  tNorm: number,
): { gravityScale: number; dragScale: number } {
  const stage = getAtlasStageAtTNorm(patternId, tNorm);
  if (!stage) return { gravityScale: 1, dragScale: 1 };
  return { gravityScale: stage.gravityScale, dragScale: stage.dragScale };
}

export { ATLAS as EFFECT_ATLAS };
export type { EffectAtlasEntry, EffectStage, SecondaryEffect, SfxEvent, TrailProfile, VelocityCone };
