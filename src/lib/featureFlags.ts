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
  // ── FWsim graphics.xml canonical tuning (data registered; renderer wiring opt-in) ──
  /** Apply FWsim Bloom AmountOfBloom + Upsampling_Weights calibration to legacy Bloom layers (kernelSize+intensity). */
  r_fwsim_bloom_weights: true,
  /** Apply FWsim TonemappingConfig (Contrast 1.7, HdrMax 16) to ACES tone-mapper. */
  r_fwsim_tonemapping: true,

  /** Apply FWsim ShellLaunchFlame.SizeDependingOnEnergy + brightness/duration curves to PrefireShell muzzle flash. */
  r_fwsim_launch_flash_v2: true,

  /** Apply FWsim MineFlame.sizeDependingOnEnergy + brightness/duration to MineEffect muzzle flash. */
  r_fwsim_mine_calibration: true,
  /** Use canonical FWsim smoke sprite (smoke_with_alpha.png) in MineEffect ground plume. */
  r_fwsim_smoke_texture: true,
  /** Use canonical Effect Behavior Map (vetor PTS + cinemática por família) em renderers (Comet/Mine/Salute/FallingLeaves). */
  r_behavior_map_v1: true,
  /** Apply FWsim launchSparks.mine* (mineNrStars/mineExplosionRelativeSpeed/mineSpeedVariance/mineMineWidth) to MineEffect spray spark layer. */
  r_fwsim_launch_sparks_mine: true,
  /** Expose FWsim PresetColors_ palette to renderers (read-only lookup via getFwsimPresetHex). */
  fwsim_extended_palette: true,
} as const;

export type FeatureFlag = keyof typeof FLAGS;

export function isEnabled(flag: FeatureFlag): boolean {
  return FLAGS[flag] ?? false;
}

export function getFlags(): Readonly<typeof FLAGS> {
  return FLAGS;
}
