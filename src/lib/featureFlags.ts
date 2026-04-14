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
  advanced_ballistics: false,
  /** Blackbody temperature→color mapping (Planckian locus) */
  thermal_color_model: false,
  /** Enhanced smoke with density fields, cluster breakup, buoyancy */
  smoke_volume_system: false,
  /** Layer-separated bloom pipeline with physical intensity */
  hdr_bloom_physical: false,
  /** Camera desaturation at peak luminance + highlight compression */
  cinematic_camera_response: false,
  /** Layered wind with vertical shear + micro-turbulence */
  turbulence_field: false,
  /** 2× particle budget for ultra-dense displays */
  high_density_particles: false,
} as const;

export type FeatureFlag = keyof typeof FLAGS;

export function isEnabled(flag: FeatureFlag): boolean {
  return FLAGS[flag] ?? false;
}

export function getFlags(): Readonly<typeof FLAGS> {
  return FLAGS;
}
