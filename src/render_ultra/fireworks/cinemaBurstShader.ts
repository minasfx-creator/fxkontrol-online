/**
 * FX KONTROL · Cinema Burst/Explosion Shader — RECALIBRATED
 * Multi-layer energy system: white-hot core → orange mid → red edge,
 * physically-motivated shockwave with decay, secondary debris glow,
 * and chromatic energy bands.
 *
 * Calibrated for pipeline:
 *   Burst(Additive, peak ~12.0) → Bloom → ACES → Final
 *   Designed to produce visible bloom halo at burst moment.
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

  // ── Multi-exponent radial falloff ──
  float radialFalloff(float r, float sharpness) {
    return exp(-sharpness * r * r);
  }

  // ── Hash for procedural detail ──
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  void main() {
    vec2 center = vec2(0.5);
    float dist = distance(vUv, center);

    // ── Energy envelope: sharp attack, exponential decay ──
    float envelope = exp(-4.5 * vLifeRatio) * vEnergy;

    // ── Shockwave: expanding ring with physical decay ──
    float waveRadius = vLifeRatio * 0.6;  // expansion
    float waveDist = abs(dist - waveRadius);
    float waveWidth = 0.03 + vLifeRatio * 0.08; // ring thickens as it expands
    float wave = exp(-waveDist * waveDist / (waveWidth * waveWidth));
    wave *= exp(-uWaveDecay * vLifeRatio);  // energy loss over time

    // ── Core: white-hot center with tight falloff ──
    float core = radialFalloff(dist, 18.0) * uCoreIntensity;
    // Core shrinks as energy dissipates
    float coreFade = exp(-6.0 * vLifeRatio);
    core *= coreFade;

    // ── Mid-zone: orange-yellow thermal glow ──
    float mid = radialFalloff(dist, 6.0) * 0.7;
    float midFade = exp(-3.0 * vLifeRatio);
    mid *= midFade;

    // ── Edge: red peripheral glow ──
    float edge = radialFalloff(dist, 2.5) * 0.3;
    float edgeFade = exp(-1.5 * vLifeRatio);
    edge *= edgeFade;

    // ── Chromatic energy bands ──
    vec3 coreColor  = vec3(1.15, 1.08, 0.98);   // white-hot (slightly warm)
    vec3 midColor   = vec3(1.0, 0.65, 0.22);     // orange thermal
    vec3 edgeColor  = vec3(0.85, 0.18, 0.04);    // deep red
    vec3 waveColor  = vec3(0.95, 0.80, 0.55);    // shockwave: golden

    // ── Chromatic shift: blue→white at core, red at edge ──
    float chromShift = smoothstep(0.0, uChromaticSpread, dist);

    vec3 color = coreColor * core
               + midColor * mid
               + edgeColor * edge
               + waveColor * wave * 0.6;

    // ── HDR output: calibrated peak ×12 for prominent bloom ──
    color *= envelope * 12.0;

    // ── Procedural sparkling detail ──
    float sparkle = hash(vUv * 200.0 + uTime * 10.0);
    float sparkMask = step(0.97, sparkle) * core * 3.0;
    color += vec3(1.1, 0.95, 0.8) * sparkMask * envelope;

    // ── Alpha: radial fade with energy envelope ──
    float alpha = smoothstep(0.75, 0.0, dist) * envelope;
    // Keep minimum alpha for the wave ring
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
  coreIntensity: 1.5,          // white-hot core multiplier
  waveSpeed: 8.0,              // shockwave expansion rate
  waveDecay: 3.5,              // shockwave energy loss
  chromaticSpread: 0.35,       // chromatic band width
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
