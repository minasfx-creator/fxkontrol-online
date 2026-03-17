import * as THREE from 'three';

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

let _adaptiveExposure = 1.2;
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
