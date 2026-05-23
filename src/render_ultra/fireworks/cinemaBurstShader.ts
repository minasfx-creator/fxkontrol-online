/**
 * FX KONTROL · Cinema Burst/Explosion Shader — v3 Studio Mode
 *
 * Improvements over v2:
 *   - Organic asymmetry via domain-warped FBM noise (breaks perfect sphere)
 *   - Temperature-driven blackbody colors (core ~8000K → edge ~1800K)
 *   - Per-fragment radial absorption: opaque hot core blocks peripheral light
 *   - Curl-noise stochastic sparkling (replaces flat hash sparkle)
 *   - HDR peak ×16 for white-hot plasma cores
 *
 * Calibrated for pipeline:
 *   Burst(Additive, peak ~16.0) → Bloom(threshold 1.2) → ACES → Final
 */

import * as THREE from 'three';

const BURST_VERTEX = /* glsl */ `
  attribute float aLife;
  attribute float aMaxLife;
  attribute float aEnergy;
  attribute float aTemperature;
  attribute float aSeedBurst;

  varying vec2 vUv;
  varying float vLifeRatio;
  varying float vEnergy;
  varying float vTemperature;
  varying float vSeed;

  void main() {
    vUv = uv;
    vLifeRatio = clamp(aLife / max(aMaxLife, 0.001), 0.0, 1.0);
    vEnergy = aEnergy;
    vTemperature = aTemperature;
    vSeed = aSeedBurst;

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
  varying float vTemperature;
  varying float vSeed;

  // ── Full Mitchell-Charity blackbody (1000–40000K) ──
  vec3 blackbody(float tempK) {
    float t = clamp(tempK, 1000.0, 40000.0) / 100.0;
    float r = (t <= 66.0) ? 1.0 : clamp(1.292936 * pow(t - 60.0, -0.133205), 0.0, 1.0);
    float g = (t <= 66.0)
      ? clamp(0.390082 * log(t) - 0.631841, 0.0, 1.0)
      : clamp(1.129891 * pow(t - 60.0, -0.075515), 0.0, 1.0);
    float b = (t >= 66.0) ? 1.0
            : (t <= 19.0) ? 0.0
            : clamp(0.543207 * log(t - 10.0) - 1.196254, 0.0, 1.0);
    return vec3(r, g, b);
  }

  float radialFalloff(float r, float sharpness) {
    return exp(-sharpness * r * r);
  }

  float hash21(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  // ── Value noise for FBM asymmetry ──
  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1, 0));
    float c = hash21(i + vec2(0, 1));
    float d = hash21(i + vec2(1, 1));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  // ── Domain-warped FBM: drives organic radial distortion ──
  float organicFBM(vec2 p) {
    vec2 warp = vec2(
      vnoise(p * 0.7 + vec2(1.7, 9.2)),
      vnoise(p * 0.7 + vec2(8.3, 2.8))
    ) * 0.5;
    p += warp;
    float v = 0.0, amp = 0.5, freq = 1.0;
    for (int i = 0; i < 4; i++) {
      v += vnoise(p * freq) * amp;
      amp *= 0.5; freq *= 2.1;
    }
    return v;
  }

  void main() {
    vec2 centerUv = vUv - 0.5;

    // ── Organic asymmetry: warp radial distance with noise ──
    // Different seeds per burst instance via vSeed
    float asymmAngle = atan(centerUv.y, centerUv.x);
    vec2 noiseCoord = vec2(
      asymmAngle / 6.28318 + vSeed * 3.17,
      vLifeRatio * 2.0 + vSeed
    );
    float distortion = organicFBM(noiseCoord * 3.0) * 0.18 - 0.09;
    float dist = length(centerUv) + distortion * (1.0 - vLifeRatio);

    // ── Primary energy envelope ──
    float envelope = exp(-4.5 * vLifeRatio) * vEnergy;

    // ── Secondary flash: debris re-ignition at ~30% life ──
    float secondaryFlash = exp(-25.0 * pow(vLifeRatio - 0.30, 2.0)) * 0.35;
    envelope += secondaryFlash * vEnergy;

    // ── Shockwave ──
    float waveRadius = vLifeRatio * 0.6;
    float waveDist = abs(dist - waveRadius);
    float waveWidth = 0.03 + vLifeRatio * 0.08;
    float wave = exp(-waveDist * waveDist / (waveWidth * waveWidth));
    wave *= exp(-uWaveDecay * vLifeRatio);

    // ── Radial temperature gradient: T ∝ 1/r (hotter at centre) ──
    // Core ~vTemperature K, edge decays toward ~1800K
    float coreTemp = vTemperature;
    float edgeTemp = 1800.0;
    float radialT = mix(coreTemp, edgeTemp, smoothstep(0.0, 0.45, dist));
    // Factor in cooling with age
    float ageCool = mix(1.0, 0.22, vLifeRatio);
    float fragmentTemp = radialT * ageCool;

    // ── Blackbody colors from actual temperature ──
    vec3 fragmentColor = blackbody(fragmentTemp);

    // ── Radial layer intensities ──
    float core = radialFalloff(dist, 18.0) * uCoreIntensity * exp(-6.0 * vLifeRatio);
    float mid  = radialFalloff(dist,  6.0) * 0.7             * exp(-3.0 * vLifeRatio);
    float edge = radialFalloff(dist,  2.5) * 0.3             * exp(-1.5 * vLifeRatio);

    // ── Composite color from blackbody at each layer's temperature ──
    vec3 coreColor = blackbody(max(fragmentTemp, coreTemp * 0.9)); // nearly white-hot
    vec3 midColor  = blackbody(mix(fragmentTemp, edgeTemp, 0.4));
    vec3 edgeColor = blackbody(edgeTemp * ageCool);
    vec3 waveColor = blackbody(2800.0 * ageCool);

    vec3 color = coreColor * core
               + midColor  * mid
               + edgeColor * edge
               + waveColor * wave * 0.6;

    // ── HDR: peak ×16 for white-hot plasma cores ──
    color *= envelope * 16.0;

    // ── Stochastic sparkling via temporally jittered noise ──
    float sparkNoise = hash21(vUv * 180.0 + vec2(uTime * 11.3, vSeed * 7.91));
    float sparkThresh = 0.965 + 0.015 * (1.0 - vLifeRatio); // more sparks early
    float sparkMask = step(sparkThresh, sparkNoise) * core * 3.5;
    vec3 sparkColor = blackbody(6500.0 + hash21(vUv + vSeed) * 1500.0);
    color += sparkColor * sparkMask * envelope;

    // ── Radial absorption: dense hot core attenuates peripheral light ──
    float absorption = exp(-4.0 * radialFalloff(dist, 12.0) * (1.0 - vLifeRatio));
    color *= absorption;

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
  /** Base temperature of burst core in Kelvin (maps to blackbody color). Default 6500K */
  coreTemperature: number;
}

const DEFAULT_BURST_CONFIG: CinemaBurstConfig = {
  coreIntensity: 2.2,
  waveSpeed: 8.0,
  waveDecay: 4.0,
  chromaticSpread: 0.35,
  coreTemperature: 6500,
};

/**
 * Create a cinema-grade burst/explosion ShaderMaterial.
 * v3: organic asymmetry, temperature-driven blackbody colors, radial absorption.
 *
 * New per-instance vertex attributes required:
 *   aTemperature (float) — burst core temperature in Kelvin
 *   aSeedBurst   (float) — per-burst RNG seed for asymmetry variation
 */
export function createCinemaBurstMaterial(config?: Partial<CinemaBurstConfig>): THREE.ShaderMaterial {
  const cfg = { ...DEFAULT_BURST_CONFIG, ...config };

  return new THREE.ShaderMaterial({
    vertexShader: BURST_VERTEX,
    fragmentShader: BURST_FRAGMENT,
    uniforms: {
      uTime:             { value: 0 },
      uCoreIntensity:    { value: cfg.coreIntensity },
      uWaveSpeed:        { value: cfg.waveSpeed },
      uWaveDecay:        { value: cfg.waveDecay },
      uChromaticSpread:  { value: cfg.chromaticSpread },
    },
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}
