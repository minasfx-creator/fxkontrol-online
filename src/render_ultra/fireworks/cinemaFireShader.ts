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

  varying float vLifeRatio;
  varying float vTemperature;
  varying float vSeed;
  varying vec2 vUv;

  // ── Physically-accurate Planckian locus (CIE 1931 fitted) ──
  vec3 blackbody(float tempK) {
    float t = clamp(tempK, 1000.0, 40000.0) / 100.0;

    float r;
    if (t <= 66.0) {
      r = 1.0;
    } else {
      r = 1.292936 * pow(t - 60.0, -0.1332047592);
    }

    float g;
    if (t <= 66.0) {
      g = 0.3900816 * log(t) - 0.6318414;
    } else {
      g = 1.129891 * pow(t - 60.0, -0.0755148492);
    }

    float b;
    if (t <= 19.0) {
      b = 0.0;
    } else if (t <= 66.0) {
      b = 0.5432068 * log(t - 10.0) - 1.19625408;
    } else {
      b = 1.0;
    }

    return clamp(vec3(r, g, b), 0.0, 1.0);
  }

  // ── 7-harmonic organic flicker ──
  float flicker(float time, float seed) {
    float f1 = sin(time * 17.3 + seed * 7.91) * 0.28;
    float f2 = sin(time * 41.7 + seed * 19.3) * 0.15;
    float f3 = sin(time * 7.1  + seed * 3.7)  * 0.20;
    float f4 = sin(time * 97.0 + seed * 53.0) * 0.06;
    float f5 = sin(time * 2.3  + seed * 1.1)  * 0.10;
    float f6 = sin(time * 157.0 + seed * 89.0) * 0.04;
    float f7 = sin(time * 0.7  + seed * 0.3)  * 0.08;
    return 0.80 + uFlickerIntensity * (f1 + f2 + f3 + f4 + f5 + f6 + f7);
  }

  void main() {
    vec2 center = vUv - 0.5;
    float dist = length(center);

    // ── Particle shape: hot core + soft glow halo ──
    float core = exp(-dist * dist * 65.0);
    float inner = exp(-dist * dist * 20.0);
    float outer = exp(-dist * dist * 6.0);
    float shape = core * 0.5 + inner * 0.35 + outer * 0.15;

    // ── Energy: slower decay for longer trails ──
    float expDecay = exp(-2.0 * vLifeRatio);
    float linDecay = 1.0 - vLifeRatio * 0.35;
    float intensity = expDecay * linDecay;

    // ── Temperature evolution: gradual cooling ──
    float temp = mix(vTemperature, 800.0, pow(vLifeRatio, uThermalCoupling));
    vec3 color = blackbody(temp);

    // ── Flicker ──
    float flick = flicker(uTime, vSeed);

    // ── HDR emissive (peak ×10 for bloom threshold 1.2) ──
    vec3 emissive = color * intensity * flick * uHDRMultiplier;

    // ── White-hot core injection (first 20% of life) ──
    float coreWhite = smoothstep(0.20, 0.0, vLifeRatio) * core;
    emissive = mix(emissive, vec3(1.15, 1.08, 0.98) * uHDRMultiplier * 1.3, coreWhite * 0.45);

    // ── Ember tail: onset at 55% life for smoother transition ──
    float emberPhase = smoothstep(0.55, 1.0, vLifeRatio);
    vec3 emberColor = vec3(0.95, 0.3, 0.05) * intensity * 0.6;
    emissive = mix(emissive, emberColor, emberPhase * 0.5);

    // ── Alpha: life-based with soft edge antialiasing ──
    float lifeAlpha = 1.0 - smoothstep(0.7, 1.0, vLifeRatio);
    float edge = 1.0 - smoothstep(0.40, 0.50, dist);

    gl_FragColor = vec4(emissive, shape * lifeAlpha * edge);
  }
`;

export interface CinemaFireConfig {
  hdrMultiplier: number;
  flickerIntensity: number;
  thermalCoupling: number;
}

const DEFAULT_FIRE_CONFIG: CinemaFireConfig = {
  hdrMultiplier: 10.0,          // recalibrated: peak ×10 for bloom threshold 1.2
  flickerIntensity: 0.28,       // slightly higher for 7-harmonic richness
  thermalCoupling: 1.5,         // gradual cooling curve
};

/**
 * Create a cinema-grade fire/spark ShaderMaterial.
 * Requires per-instance attributes: aTemperature, aLife, aMaxLife, aSeed.
 */
export function createCinemaFireMaterial(config?: Partial<CinemaFireConfig>): THREE.ShaderMaterial {
  const cfg = { ...DEFAULT_FIRE_CONFIG, ...config };

  return new THREE.ShaderMaterial({
    vertexShader: FIRE_VERTEX,
    fragmentShader: FIRE_FRAGMENT,
    uniforms: {
      uTime: { value: 0 },
      uHDRMultiplier: { value: cfg.hdrMultiplier },
      uFlickerIntensity: { value: cfg.flickerIntensity },
      uThermalCoupling: { value: cfg.thermalCoupling },
    },
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}
