import * as THREE from 'three';

// ── Niagara-style Resource Budgets ──────────────────────────────────

const DESKTOP_RULES = {
  maxConcurrentBursts: 6,
  maxStarBudget: 1400,
  maxStarsPerBurst: 320,
} as const;

const MOBILE_RULES = {
  maxConcurrentBursts: 2,
  maxStarBudget: 420,
  maxStarsPerBurst: 120,
} as const;

const MAX_HDR_CHANNEL = 1.35;
const MAX_HDR_LUMA = 1.15;

// ── V-Ray / Blender View Transform System ──────────────────────────

export type ViewTransform = 'aces-filmic' | 'agx' | 'standard';

export interface ViewTransformConfig {
  maxHDRChannel: number;
  maxHDRLuma: number;
  energyCap: number;
  label: string;
}

const VIEW_TRANSFORM_CONFIGS: Record<ViewTransform, ViewTransformConfig> = {
  'aces-filmic': {
    maxHDRChannel: 1.35,
    maxHDRLuma: 1.15,
    energyCap: 1.35,
    label: 'ACES Filmic',
  },
  'agx': {
    maxHDRChannel: 1.1,
    maxHDRLuma: 0.95,
    energyCap: 1.0,
    label: 'AgX (Blender 4.0)',
  },
  'standard': {
    maxHDRChannel: 8.0,
    maxHDRLuma: 8.0,
    energyCap: 8.0,
    label: 'Standard (Linear)',
  },
};

export function getViewTransformConfig(mode: ViewTransform): ViewTransformConfig {
  return VIEW_TRANSFORM_CONFIGS[mode];
}

export function getAllViewTransforms(): { id: ViewTransform; label: string }[] {
  return Object.entries(VIEW_TRANSFORM_CONFIGS).map(([id, cfg]) => ({ id: id as ViewTransform, label: cfg.label }));
}
let _adaptiveBurstLoad = 0;

export function getNiagaraBudgets(isMobile: boolean) {
  return isMobile ? MOBILE_RULES : DESKTOP_RULES;
}

export function clampNiagaraHDR(r: number, g: number, b: number): [number, number, number] {
  const maxChannel = Math.max(r, g, b, 0.0001);
  let sr = r;
  let sg = g;
  let sb = b;

  if (maxChannel > MAX_HDR_CHANNEL) {
    const s = MAX_HDR_CHANNEL / maxChannel;
    sr *= s;
    sg *= s;
    sb *= s;
  }

  const luma = sr * 0.2126 + sg * 0.7152 + sb * 0.0722;
  if (luma > MAX_HDR_LUMA) {
    const s = MAX_HDR_LUMA / luma;
    sr *= s;
    sg *= s;
    sb *= s;
  }

  return [sr, sg, sb];
}

export function setAdaptivePipelineState(exposure: number, burstLoad: number) {
  _adaptiveExposure = THREE.MathUtils.clamp(exposure, 0.35, 1.8);
  _adaptiveBurstLoad = THREE.MathUtils.clamp(burstLoad, 0, 1);
}

export function getAdaptiveExposure() {
  return _adaptiveExposure;
}

export function getAdaptiveBurstLoad() {
  return _adaptiveBurstLoad;
}

export function getBloomCompression(exposure: number, burstLoad: number) {
  const exposureFactor = THREE.MathUtils.clamp(exposure / 1.2, 0.55, 1.15);
  const loadFactor = THREE.MathUtils.lerp(1.0, 0.58, burstLoad);
  return exposureFactor * loadFactor;
}

export function getDynamicBloomThreshold(baseThreshold: number, burstLoad: number) {
  return baseThreshold + burstLoad * 1.4;
}

// ── V-Ray/Blender Blend Mode System for THREE.js ───────────────────

export type NiagaraBlendMode =
  | 'additive'
  | 'screen'
  | 'normal'
  | 'multiply'
  | 'soft-light'
  | 'overlay'
  | 'hard-light';

export interface ThreeBlendConfig {
  blending: THREE.Blending;
  blendEquation?: THREE.BlendingEquation;
  blendSrc?: THREE.BlendingDstFactor | THREE.BlendingSrcFactor;
  blendDst?: THREE.BlendingDstFactor;
}

/**
 * Maps Niagara/Blender blend modes to THREE.js CustomBlending configs.
 * 
 * - Additive: SrcAlpha + One (incandescent star cores only)
 * - Screen: One + OneMinusSrcColor (halos, afterglow, flashes — energy-conserving)
 * - Normal: SrcAlpha + OneMinusSrcAlpha (smoke, debris, opaque fog)
 * - Multiply: DstColor + Zero (ground shadows)
 * - Soft Light / Overlay / Hard Light: approximated via CustomBlending
 */
export function getThreeBlending(mode: NiagaraBlendMode): ThreeBlendConfig {
  switch (mode) {
    case 'additive':
      return {
        blending: THREE.CustomBlending,
        blendEquation: THREE.AddEquation,
        blendSrc: THREE.SrcAlphaFactor,
        blendDst: THREE.OneFactor,
      };

    case 'screen':
      // Screen: result = 1 - (1-src)*(1-dst) ≈ src + dst - src*dst
      // THREE approximation: src*1 + dst*(1-srcColor)
      return {
        blending: THREE.CustomBlending,
        blendEquation: THREE.AddEquation,
        blendSrc: THREE.OneFactor,
        blendDst: THREE.OneMinusSrcColorFactor,
      };

    case 'normal':
      return {
        blending: THREE.CustomBlending,
        blendEquation: THREE.AddEquation,
        blendSrc: THREE.SrcAlphaFactor,
        blendDst: THREE.OneMinusSrcAlphaFactor,
      };

    case 'multiply':
      return {
        blending: THREE.CustomBlending,
        blendEquation: THREE.AddEquation,
        blendSrc: THREE.DstColorFactor,
        blendDst: THREE.ZeroFactor,
      };

    case 'soft-light':
      // Approximation: lighter additive with reduced source contribution
      return {
        blending: THREE.CustomBlending,
        blendEquation: THREE.AddEquation,
        blendSrc: THREE.OneFactor,
        blendDst: THREE.OneMinusSrcColorFactor,
      };

    case 'overlay':
      // Overlay approx: screen-like for bright areas
      return {
        blending: THREE.CustomBlending,
        blendEquation: THREE.AddEquation,
        blendSrc: THREE.OneFactor,
        blendDst: THREE.OneMinusSrcColorFactor,
      };

    case 'hard-light':
      // Hard light for laser beams: stronger than screen, less than additive
      return {
        blending: THREE.CustomBlending,
        blendEquation: THREE.AddEquation,
        blendSrc: THREE.SrcAlphaFactor,
        blendDst: THREE.OneMinusSrcAlphaFactor,
      };

    default:
      return { blending: THREE.NormalBlending };
  }
}

/**
 * Returns a THREE.js material props object for the given blend mode.
 * Spread this into <meshBasicMaterial {...getBlendProps('screen')} />
 */
export function getBlendProps(mode: NiagaraBlendMode) {
  const config = getThreeBlending(mode);
  return {
    blending: config.blending,
    blendEquation: config.blendEquation,
    blendSrc: config.blendSrc,
    blendDst: config.blendDst,
  };
}

/**
 * Returns GLSL snippet for energy-conserving blend in fragment shaders.
 * MAX_ENERGY adapts based on current burst load to prevent white-out.
 */
export function getEnergyCapGLSL(): string {
  return `
    uniform float uMaxEnergy;
    vec3 applyEnergyCap(vec3 color) {
      return min(color, vec3(uMaxEnergy));
    }
  `;
}

/**
 * Calculates max energy cap based on burst load.
 * High load = lower cap to prevent accumulation white-out.
 */
export function getMaxEnergy(burstLoad: number): number {
  return THREE.MathUtils.lerp(1.35, 0.7, THREE.MathUtils.clamp(burstLoad, 0, 1));
}

/**
 * Canvas 2D composite operation mapping (for ParticleEditorPanel preview).
 */
export function getCanvasCompositeOp(mode: NiagaraBlendMode): GlobalCompositeOperation {
  const map: Record<NiagaraBlendMode, GlobalCompositeOperation> = {
    'additive': 'lighter',
    'normal': 'source-over',
    'multiply': 'multiply',
    'screen': 'screen',
    'overlay': 'overlay',
    'soft-light': 'soft-light',
    'hard-light': 'hard-light',
  };
  return map[mode] || 'source-over';
}

/**
 * Ground illumination intensity scaler.
 * Per plan: reduce pointLight intensity × 0.4 to prevent ground white-out.
 */
export const GROUND_LIGHT_SCALE = 0.4;
