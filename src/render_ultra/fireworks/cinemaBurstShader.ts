/**
 * FX KONTROL · Cinema Burst/Explosion Shader — RECALIBRATED v2 (Camada 9)
 * Multi-layer energy system with secondary flash (debris re-ignition),
 * HDR peak ×14 for maximum bloom impact, faster shockwave decay.
 *
 * Calibrated for pipeline:
 *   Burst(Additive, peak ~14.0) → Bloom(threshold 1.2) → ACES → Final
 */

import * as THREE from 'three';

const BURST_VERTEX = /* glsl */ `
  attribute float aLife;
  attribute float aMaxLife;
  attribute float aEnergy;

  varying vec2 vUv;
  varying float vLifeRatio;
  varying float vEnergy;

  void main() {
    vUv = uv;
    vLifeRatio = clamp(aLife / max(aMaxLife, 0.001), 0.0, 1.0);
    vEnergy = aEnergy;

    vec4 mvPos = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPos;
  }
`;

const BURST_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uCoreIntensity;
  uniform float uWaveSpeed;
  uniform float uWaveDecay;
  uniform float uChromaticSpread;

  varying vec2 vUv;
  varying float vLifeRatio;
  varying float vEnergy;

  float radialFalloff(float r, float sharpness) {
    return exp(-sharpness * r * r);
  }

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  void main() {
    vec2 center = vec2(0.5);
    float dist = distance(vUv, center);

    // ── Primary energy envelope ──
    float envelope = exp(-4.5 * vLifeRatio) * vEnergy;

    // ── Secondary flash: debris re-ignition at ~30% life ──
    float secondaryFlash = exp(-25.0 * (vLifeRatio - 0.30) * (vLifeRatio - 0.30)) * 0.35;
    envelope += secondaryFlash * vEnergy;

    // ── Shockwave ──
    float waveRadius = vLifeRatio * 0.6;
    float waveDist = abs(dist - waveRadius);
    float waveWidth = 0.03 + vLifeRatio * 0.08;
    float wave = exp(-waveDist * waveDist / (waveWidth * waveWidth));
    wave *= exp(-uWaveDecay * vLifeRatio);

    // ── Core: white-hot center ──
    float core = radialFalloff(dist, 18.0) * uCoreIntensity;
    float coreFade = exp(-6.0 * vLifeRatio);
    core *= coreFade;

    // ── Mid-zone: orange-yellow thermal ──
    float mid = radialFalloff(dist, 6.0) * 0.7;
    float midFade = exp(-3.0 * vLifeRatio);
    mid *= midFade;

    // ── Edge: red peripheral glow ──
    float edge = radialFalloff(dist, 2.5) * 0.3;
    float edgeFade = exp(-1.5 * vLifeRatio);
    edge *= edgeFade;

    // ── Chromatic energy bands ──
    vec3 coreColor  = vec3(1.15, 1.08, 0.98);
    vec3 midColor   = vec3(1.0, 0.65, 0.22);
    vec3 edgeColor  = vec3(0.85, 0.18, 0.04);
    vec3 waveColor  = vec3(0.95, 0.80, 0.55);

    vec3 color = coreColor * core
               + midColor * mid
               + edgeColor * edge
               + waveColor * wave * 0.6;

    // ── HDR output: peak ×14 for intense bloom ──
    color *= envelope * 14.0;

    // ── Procedural sparkling (lowered threshold for more debris) ──
    float sparkle = hash(vUv * 200.0 + uTime * 10.0);
    float sparkMask = step(0.96, sparkle) * core * 3.0;
    color += vec3(1.1, 0.95, 0.8) * sparkMask * envelope;

    // ── Alpha ──
    float alpha = smoothstep(0.75, 0.0, dist) * envelope;
    alpha = max(alpha, wave * 0.3 * exp(-uWaveDecay * vLifeRatio));

    gl_FragColor = vec4(color, alpha);
  }
`;

export interface CinemaBurstConfig {
  coreIntensity: number;
  waveSpeed: number;
  waveDecay: number;
  chromaticSpread: number;
}

const DEFAULT_BURST_CONFIG: CinemaBurstConfig = {
  coreIntensity: 2.0,          // recalibrated: stronger flash
  waveSpeed: 8.0,
  waveDecay: 4.0,              // recalibrated: faster energy loss
  chromaticSpread: 0.35,
};

/**
 * Create a cinema-grade burst/explosion ShaderMaterial.
 */
export function createCinemaBurstMaterial(config?: Partial<CinemaBurstConfig>): THREE.ShaderMaterial {
  const cfg = { ...DEFAULT_BURST_CONFIG, ...config };

  return new THREE.ShaderMaterial({
    vertexShader: BURST_VERTEX,
    fragmentShader: BURST_FRAGMENT,
    uniforms: {
      uTime: { value: 0 },
      uCoreIntensity: { value: cfg.coreIntensity },
      uWaveSpeed: { value: cfg.waveSpeed },
      uWaveDecay: { value: cfg.waveDecay },
      uChromaticSpread: { value: cfg.chromaticSpread },
    },
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}
