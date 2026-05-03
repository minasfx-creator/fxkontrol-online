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
  /**
   * Run the new src/modules/vviz pipeline (read → parse → reduce → validate →
   * normalize) as a pre-flight gate before the legacy worker path. Pure
   * pre-validation: rendering still goes through vvizWorker. If the new
   * pipeline throws, we fall back transparently to the legacy path so the
   * viewport never breaks.
   */
  vviz_module_pipeline: true,
  /**
   * RealityScan 2.0 Quality Analysis: tie-point + mesh coverage scoring with
   * green→red overlays and bake-to-vertex-color / bake-to-texture actions.
   * UI lives in src/components/editor/RealityScanQualityPanel.tsx.
   */
  realityscan_quality_analysis: true,
  /**
   * Hierarchical Poisson → Farthest Point Sampling for drone formations.
   * Opt-in via samplingStrategy='poisson+fps' on extractFormationFromMesh.
   */
  swarmgpt_fps_sampling: true,
  /**
   * Optimal Kuhn–Munkres assignment for drone transitions (n ≤ 512).
   * Opt-in via assignment='hungarian' on optimizeDroneTransition.
   */
  swarmgpt_hungarian_optimal: true,
  /**
   * RealityScan PLY importer + drag-drop panel feeding planFormationFromAsset.
   * UI: src/components/editor/RealityScanImportPanel.tsx.
   */
  realityscan_import_ui: true,
  /**
   * Physics repair pipeline (matchPointsByCost → validators → repair).
   * Opt-in via planFormationFromAsset({ usePhysicsRepair: true }).
   */
  swarmgpt_physics_repair: true,

  // ============================================================
  // CLEANUP / DEPRECATION FLAGS — turn modules OFF without deleting.
  // Set to `false` to hide the UI surface; underlying code stays in tree
  // so behavior can be validated before final removal. Default: true (visible).
  // ============================================================
  /** Pre-flight VerificationEngine UI (VerificationBar in CommandCenter, readiness panels). */
  module_verification: true,
  /** Legacy PCBViewer panels (currently no consumers — flag reserved for future cleanup). */
  module_pcbviewer: false,
  /** Device pairing + Mobile Link surfaces (sidebar entries, /pairing nav, MobileLink panels). */
  module_pairing_mobilelink: true,
  /** Organizer menu items (groupings/categorization shortcuts in FullscreenCommandMenu). */
  module_organizer_menu: true,

  // ============================================================
  // HARDWARE SIMULATOR — Master gate for ALL synthetic data.
  // OFF (default): adapters/ContinuityCheck/FireOne/MA3 emit ZERO
  // synthetic values. Only real hardware via Web Serial / WebUSB /
  // WebBLE / Art-Net feeds the UI. Flip to true ONLY for dev tooling.
  // ============================================================
  dev_hardware_simulator: false,

  // ============================================================
  // REAL-ONLY MODE — Strict honest hardware enforcement.
  // ON (default): UI só considera um device "integrado" após
  //   handshake real (resposta confirmada do hardware via Web
  //   Serial/USB/BLE/Art-Net). Qualquer tentativa de emitir
  //   telemetria/eventos a partir de um adapter `not_integrated`
  //   é silenciosamente rejeitada e contabilizada em
  //   `realOnlyGate.getRejectedCount()`.
  // OFF: comportamento legado (snapshots sem provenance verificada
  //   passam pela ingestão).
  // ============================================================
  real_only_mode: true,

  // ============================================================
  // SAFETY GATE STRICT — Re-arms ALL blocking layers (lockoutGroups,
  // interlockChain, modeGuard, uiLocks). When ON:
  //   - safetyGate.enableAll() runs at boot
  //   - setMaster(false) / setLayer(_, false) are NO-OPS (cannot disable)
  //   - SettingsGate UI renders read-only "STRICT MODE LOCKED" badges
  // Default: TRUE in production. Flip OFF only for explicit dev sessions.
  // ============================================================
  safety_gate_strict: true,

  /**
   * Training v2 — Cinematic mission flow (staged objectives, MetaHuman-style
   * NPCs, GTA V-style HUD, briefing/debrief cutscenes). Falls back to legacy
   * TrainingSimulator when off.
   */
  training_v2_cinematic: true,

  // ============================================================
  // (`floating_chrome` removed — Mission Control desktop chrome is the
  // only desktop layout now. Mobile shell is gated separately by
  // `useIsMobile()` in src/pages/Index.tsx.)
  // ============================================================

  /**
   * SkyCanvas 2.0 — lighter presentation engine (single draw call per layer,
   * pooled bursts, time via ref). Runtime opt-in via localStorage
   * 'fxk.flag.skycanvas_v2' = '1'. Wrapped by an ErrorBoundary in
   * SkyCanvasMount so a render fault cleanly falls back to the legacy
   * SkyCanvas (zero risk to production).
   */
  skycanvas_v2: false,
} as const;

export type FeatureFlag = keyof typeof FLAGS;

export function isEnabled(flag: FeatureFlag): boolean {
  return FLAGS[flag] ?? false;
}

export function getFlags(): Readonly<typeof FLAGS> {
  return FLAGS;
}

/** Convenience: master gate for all synthetic hardware data. */
export function isHardwareSimulatorEnabled(): boolean {
  return FLAGS.dev_hardware_simulator;
}

/** Convenience: real-only mode (only verified-handshake adapters emit data). */
export function isRealOnlyMode(): boolean {
  return FLAGS.real_only_mode;
}

/**
 * SkyCanvas 2.0 runtime gate.
 * Order: localStorage override → static flag → false.
 * Allows ops to flip the new engine on per-device without a deploy.
 * Safe in SSR/jsdom (guards `typeof window`).
 */
export function isSkycanvasV2Enabled(): boolean {
  if (typeof window !== 'undefined') {
    try {
      const v = window.localStorage.getItem('fxk.flag.skycanvas_v2');
      if (v === '1' || v === 'true') return true;
      if (v === '0' || v === 'false') return false;
    } catch {
      /* localStorage blocked → fall back to static flag */
    }
  }
  return FLAGS.skycanvas_v2;
}

