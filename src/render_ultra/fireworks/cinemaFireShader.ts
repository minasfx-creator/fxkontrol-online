/**
 * FX KONTROL · Cinema Fire/Spark Shader
 * Blackbody temperature→color, exponential energy decay, temporal flicker.
 * HDR emissive output (×10) feeds bloom pipeline.
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

    // Billboard — instance matrix handles position + orientation
    vec4 mvPos = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPos;
  }
`;

const FIRE_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uHDRMultiplier;
  uniform float uFlickerIntensity;

  varying float vLifeRatio;
  varying float vTemperature;
  varying float vSeed;
  varying vec2 vUv;

  // ── Blackbody temperature → RGB (Planckian locus approximation) ──
  vec3 blackbody(float temp) {
    float t = temp / 1000.0;
    float r = 1.0;
    float g = clamp(1.0 - exp(-0.8 * t), 0.0, 1.0);
    float b = clamp(1.0 - exp(-1.5 * t), 0.0, 1.0);
    return vec3(r, g, b);
  }

  // ── Organic flicker with multi-frequency modulation ──
  float flicker(float time, float seed) {
    float base = sin(time * 20.0 + seed * 10.0);
    float detail = sin(time * 47.0 + seed * 23.7) * 0.3;
    float slow = sin(time * 5.3 + seed * 3.1) * 0.15;
    return 0.8 + uFlickerIntensity * (base + detail + slow);
  }

  void main() {
    // Soft circular particle shape
    vec2 center = vUv - 0.5;
    float dist = length(center);
    float core = exp(-dist * dist * 50.0);
    float glow = exp(-dist * dist * 12.0);
    float shape = core * 0.8 + glow * 0.3;

    // Energy decay — exponential falloff over lifetime
    float intensity = exp(-2.0 * vLifeRatio);

    // Dynamic temperature — cools as particle ages
    float temp = mix(vTemperature, 1500.0, vLifeRatio);
    vec3 color = blackbody(temp);

    // Flicker modulation
    float flick = flicker(uTime, vSeed);

    // HDR emissive output
    vec3 emissive = color * intensity * flick * uHDRMultiplier;

    // Hot-core whitening
    emissive = mix(emissive, vec3(1.1, 1.05, 0.95) * intensity * uHDRMultiplier, core * 0.3);

    float alpha = shape * (1.0 - vLifeRatio);
    float edge = 1.0 - smoothstep(0.42, 0.5, dist);

    gl_FragColor = vec4(emissive, alpha * edge);
  }
`;

export interface CinemaFireConfig {
  hdrMultiplier: number;
  flickerIntensity: number;
}

const DEFAULT_FIRE_CONFIG: CinemaFireConfig = {
  hdrMultiplier: 10.0,
  flickerIntensity: 0.2,
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
    },
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}
