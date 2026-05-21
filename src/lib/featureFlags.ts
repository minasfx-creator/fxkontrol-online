/**
 * FXK Feature Flags — Minimal, safe feature toggle system.
 * 
 * All flags default to false if not defined.
 * Used to control rollout of refactored systems with automatic fallback.
 */

const FLAGS = {
  /** Use extracted effectLibrary module instead of store-embedded version */
  useNewEffectLibrary: true,
  /** Use facade hooks (useEditorUI, useTelemetryData) in migrated components */
  useEditorUIHooks: true,
  /** Velocity-Verlet integration + per-particle drag coefficients */
  advanced_ballistics: true,
  /** Blackbody temperature→color mapping (Planckian locus) */
  thermal_color_model: true,
  /** Enhanced smoke with density fields, cluster breakup, buoyancy */
  smoke_volume_system: true,
  /** Layer-separated bloom pipeline with physical intensity */
  hdr_bloom_physical: true,
  /** Camera desaturation at peak luminance + highlight compression */
  cinematic_camera_response: true,
  /** Layered wind with vertical shear + micro-turbulence */
  turbulence_field: true,
  /** 2× particle budget for ultra-dense displays */
  high_density_particles: false,
  /** MineEffect uses fan-shape silhouettes from FWsim vectors (Mine_01/02/03) */
  r_silhouette_mines: true,
  /** Extend silhouette mode to Comet/Shell/Cake/RomanCandle (opt-in, perf cost) */
  r_silhouette_all: false,
  /** Soft particle blend (depth-aware) — fragment fade against scene depth */
  r_soft_particles: true,
  /** HDR ember-tail decay uses pow(life,2.4) instead of linear */
  r_hdr_ember_tail: true,
  /** Ambient LightProbe driven by top-N luminous bursts */
  r_lightprobe_from_bursts: false,
  /** Pass 1: velocity-stretched stars + HDR break flash + ember temperature ramp */
  r_star_stretch_v2: true,
  /** Pass 2: per-star spark trails wired from sparkTrailsGPU (desktop only) */
  r_spark_trails: true,
  /** Pass 3: residual smoke puff at break point (caliber ≥ 3", no rain) */
  r_break_puff: true,
  /** Pass 3: pearl-string spacing on shape geometries (heart/smiley/ring/saturn) */
  r_pearl_spacing: true,
} as const;

export type FeatureFlag = keyof typeof FLAGS;

export function isEnabled(flag: FeatureFlag): boolean {
  return FLAGS[flag] ?? false;
}

export function getFlags(): Readonly<typeof FLAGS> {
  return FLAGS;
}
