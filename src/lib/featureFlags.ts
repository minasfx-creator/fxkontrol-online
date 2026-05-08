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

  /**
   * SkyCanvas 2.0 StageLayer — palco arco curvo + truss + LEDs + beams.
   * Default ON (visualmente esperado). Override per-device via localStorage
   * 'fxk.flag.skycanvas_v2_stage' = '0' pra esconder em capturas cinematográficas.
   */
  skycanvas_v2_stage: true,

  /**
   * UE5 FixturesLayer — renderiza 838 fixtures GDTF do MVR (DMXLib_v4)
   * sobre o palco do SkyCanvas 2.0. Presentation only. Default OFF
   * (operadores ligam via /dev/ue5-bridge ou localStorage).
   */
  ue5_fixtures_layer: false,

  /**
   * ECS Unified Kernel — SoA world (pyro/particles/drones) + WASM-first
   * deterministic step (Rust crate at wasm/fxk_ecs_kernel/, TS fallback at
   * src/ecs/tsKernel.ts). Default ON: opt-out via localStorage
   * 'fxk.flag.ecs_unified_kernel' = '0'. Bench: /dev/perf-bench.
   */
  ecs_unified_kernel: true,

  /**
   * Editor Legacy Chrome 26-04 — recria o chrome visual do bookmark de 9-abr
   * sobre o /skycanvas atual (HUD topo PYRO/DRONE/ADD+/SHOWS, tool rails,
   * painel LASER CONTROL flutuante, transport + lanes PYRO SYS / DRONE SYS,
   * JOI FAB). Visual-only — zero impacto em safety/hardware/showplan.
   * Default ON. Override:
   *   - URL ?legacyChrome=0 (sessão)
   *   - localStorage 'fxk.flag.editor_legacy_chrome_2604' = '0'
   */
  editor_legacy_chrome_2604: true,
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

/**
 * StageLayer runtime gate. Default ON (FLAGS.skycanvas_v2_stage=true).
 * localStorage 'fxk.flag.skycanvas_v2_stage' = '0' esconde; '1' força ON.
 */
export function isSkycanvasV2StageEnabled(): boolean {
  if (typeof window !== 'undefined') {
    try {
      const v = window.localStorage.getItem('fxk.flag.skycanvas_v2_stage');
      if (v === '1' || v === 'true') return true;
      if (v === '0' || v === 'false') return false;
    } catch {
      /* localStorage blocked → fall back to static flag */
    }
  }
  return FLAGS.skycanvas_v2_stage;
}


/**
 * FireOne XL4-3 / XLII+ live ops gate. Default OFF.
 * localStorage 'fxk.flag.fireone_xl43_realops' = '1' → reveals tab.
 * The CSV/ZIP exporter is NOT gated by this flag.
 */
export function isFireOneXL43RealOpsEnabled(): boolean {
  if (typeof window !== 'undefined') {
    try {
      const v = window.localStorage.getItem('fxk.flag.fireone_xl43_realops');
      if (v === '1' || v === 'true') return true;
      if (v === '0' || v === 'false') return false;
    } catch { /* fall through */ }
  }
  return false;
}

/**
 * Editor Legacy Chrome 26-04 runtime gate.
 * URL ?legacyChrome=0/1 → localStorage → static flag.
 */
export function isEditorLegacyChrome2604Enabled(): boolean {
  if (typeof window !== 'undefined') {
    try {
      const url = new URL(window.location.href);
      const q = url.searchParams.get('legacyChrome');
      if (q === '0' || q === 'false') return false;
      if (q === '1' || q === 'true') return true;
    } catch { /* */ }
    try {
      const v = window.localStorage.getItem('fxk.flag.editor_legacy_chrome_2604');
      if (v === '1' || v === 'true') return true;
      if (v === '0' || v === 'false') return false;
    } catch { /* */ }
  }
  return FLAGS.editor_legacy_chrome_2604;
}

/**
 * FXK32Q (32ch ESP32-S3 + 2×16-relay) field-ops tab gate. Default OFF.
 * localStorage 'fxk.flag.fxk32q_fieldops' = '1' → reveals tab even when
 * no controller is online (bench preflight). When the adapter is promoted
 * to LIVE-RO via discoveryRegistryBridge, the tab auto-shows regardless.
 */
export function isFxk32qFieldOpsEnabled(): boolean {
  if (typeof window !== 'undefined') {
    try {
      const v = window.localStorage.getItem('fxk.flag.fxk32q_fieldops');
      if (v === '1' || v === 'true') return true;
      if (v === '0' || v === 'false') return false;
    } catch { /* fall through */ }
  }
  return false;
}
