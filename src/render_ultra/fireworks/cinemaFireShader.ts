/**
 * FX KONTROL · Cinema Fire/Spark Shader — RECALIBRATED v2 (Camada 9)
 * Physically-accurate Planckian locus blackbody, 7-harmonic organic flicker,
 * slower energy decay for longer trails, gradual thermal coupling.
 *
 * Calibrated for cohesive 7-stage pipeline:
 *   Fire(HDR ×10) → Bloom(threshold 1.2) → ACES → Final
 */

import * as THREE from 'three';

const FIRE_VERTEX = /* glsl */ `
  attribute float aTemperature;
  attribute float aLife;
  attribute float aMaxLife;
  attribute float aSeed;

  uniform float uTime;

  varying float vLifeRatio;
  varying float vTemperature;
  varying float vSeed;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    vLifeRatio = clamp(aLife / max(aMaxLife, 0.001), 0.0, 1.0);
    vTemperature = aTemperature;
    vSeed = aSeed;

    vec4 mvPos = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPos;
  }
`;

const FIRE_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uHDRMultiplier;
  uniform float uFlickerIntensity;
  uniform float uThermalCoupling;
  uniform float uTurbulenceScale;

  varying float vLifeRatio;
  varying float vTemperature;
  varying float vSeed;
  varying vec2 vUv;

  // ── Full Mitchell-Charity blackbody (1000–40000K) ──
  // NOTE: uses if-else (not ternary) to prevent GPU evaluating both branches
  // and hitting pow(negative, non-integer) → NaN → black pixels.
  vec3 blackbody(float tempK) {
    float t = clamp(tempK, 1000.0, 40000.0) / 100.0;
    float r, g, b;
    if (t <= 66.0) {
      r = 1.0;
      g = clamp(0.390082 * log(t) - 0.631841, 0.0, 1.0);
      b = (t <= 19.0) ? 0.0 : clamp(0.543207 * log(max(t - 10.0, 0.001)) - 1.196254, 0.0, 1.0);
    } else {
      r = clamp(1.292936 * pow(t - 60.0, -0.133205), 0.0, 1.0);
      g = clamp(1.129891 * pow(t - 60.0, -0.075515), 0.0, 1.0);
      b = 1.0;
    }
    return vec3(r, g, b);
  }

  // ── 7-harmonic organic flicker ──
  float flicker(float time, float seed) {
    float f1 = sin(time * 17.3  + seed * 7.91)  * 0.28;
    float f2 = sin(time * 41.7  + seed * 19.3)  * 0.15;
    float f3 = sin(time * 7.1   + seed * 3.7)   * 0.20;
    float f4 = sin(time * 97.0  + seed * 53.0)  * 0.06;
    float f5 = sin(time * 2.3   + seed * 1.1)   * 0.10;
    float f6 = sin(time * 157.0 + seed * 89.0)  * 0.04;
    float f7 = sin(time * 0.7   + seed * 0.3)   * 0.08;
    return 0.80 + uFlickerIntensity * (f1 + f2 + f3 + f4 + f5 + f6 + f7);
  }

  // ── Billboard-space 2D turbulence ──
  float hash2(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  float noise2(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash2(i); float b = hash2(i + vec2(1,0));
    float c = hash2(i + vec2(0,1)); float d = hash2(i + vec2(1,1));
    return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
  }
  vec2 billboardTurb(vec2 uv, float time, float seed, float strength) {
    float n1 = noise2(uv * 3.5 + vec2(time * 0.8 + seed, seed * 2.3)) - 0.5;
    float n2 = noise2(uv * 5.9 + vec2(seed, time * 0.5)) - 0.5;
    return vec2(n1, n2) * strength;
  }

  void main() {
    vec2 center = vUv - 0.5;

    // ── Billboard turbulence: organic star edge deformation ──
    float turbStr = uTurbulenceScale * (0.04 + 0.08 * vLifeRatio);
    vec2 warpedCenter = center + billboardTurb(vUv, uTime, vSeed, turbStr);
    float dist     = length(center);
    float turbDist = length(warpedCenter);

    // ── T ∝ r^(-3/4) radial temperature gradient ──
    float tempAtDist = vTemperature * pow(max(1.0 - turbDist * 1.8, 0.001), 0.75);
    float temp = mix(tempAtDist, 800.0, pow(vLifeRatio, uThermalCoupling));
    temp = max(temp, 800.0);

    // ── Particle shape layers ──
    float core  = exp(-dist * dist * 65.0);
    float inner = exp(-dist * dist * 20.0);
    float outer = exp(-dist * dist * 6.0);
    float shape = core * 0.5 + inner * 0.35 + outer * 0.15;

    // ── Energy decay ──
    float expDecay = exp(-2.0 * vLifeRatio);
    float linDecay = 1.0 - vLifeRatio * 0.35;
    float intensity = expDecay * linDecay;

    // ── Flicker ──
    float flick = flicker(uTime, vSeed);

    // ── HDR emissive from blackbody temperature ──
    vec3 emissive = blackbody(temp) * intensity * flick * uHDRMultiplier;

    // ── White-hot core injection (first 20% of life) ──
    float coreWhite = smoothstep(0.20, 0.0, vLifeRatio) * core;
    emissive = mix(emissive, vec3(1.15, 1.08, 0.98) * uHDRMultiplier * 1.3, coreWhite * 0.45);

    // ── Organic ember tail: noise-modulated onset ──
    float emberNoise = noise2(vUv * 4.0 + vec2(uTime * 0.3, vSeed));
    float emberPhase = smoothstep(0.45 + emberNoise * 0.20, 0.90, vLifeRatio);
    float emberTemp = 700.0 + hash2(vec2(vSeed, vLifeRatio)) * 500.0;
    vec3 emberColor = blackbody(emberTemp) * intensity * 0.6;
    emissive = mix(emissive, emberColor, emberPhase * 0.55);

    // ── Alpha ──
    float lifeAlpha = 1.0 - smoothstep(0.7, 1.0, vLifeRatio);
    float edge = 1.0 - smoothstep(0.40, 0.50, dist);

    gl_FragColor = vec4(emissive, shape * lifeAlpha * edge);
  }
`;

export interface CinemaFireConfig {
  hdrMultiplier: number;
  flickerIntensity: number;
  thermalCoupling: number;
  /** Billboard turbulence scale. 0=none (clean sphere), 1=full (organic star). Default 1.0 */
  turbulenceScale: number;
}

const DEFAULT_FIRE_CONFIG: CinemaFireConfig = {
  hdrMultiplier: 10.0,
  flickerIntensity: 0.28,
  thermalCoupling: 1.5,
  turbulenceScale: 1.0,
};

/**
 * Create a cinema-grade fire/spark ShaderMaterial.
 * v3: T∝r^(-3/4) radial gradient, billboard turbulence, organic ember onset,
 * full blackbody extended to 8000K.
 *
 * Requires per-instance attributes: aTemperature, aLife, aMaxLife, aSeed.
 */
export function createCinemaFireMaterial(config?: Partial<CinemaFireConfig>): THREE.ShaderMaterial {
  const cfg = { ...DEFAULT_FIRE_CONFIG, ...config };

  return new THREE.ShaderMaterial({
    vertexShader: FIRE_VERTEX,
    fragmentShader: FIRE_FRAGMENT,
    uniforms: {
      uTime:              { value: 0 },
      uHDRMultiplier:     { value: cfg.hdrMultiplier },
      uFlickerIntensity:  { value: cfg.flickerIntensity },
      uThermalCoupling:   { value: cfg.thermalCoupling },
      uTurbulenceScale:   { value: cfg.turbulenceScale },
    },
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}
