/**
 * FX KONTROL · Cinema Volumetric Smoke Shader — RECALIBRATED v2 (Camada 9)
 * 5-octave FBM with domain warping, Beer-Lambert absorption (0.92),
 * enhanced scattering, amber-tinted near-fire color.
 *
 * Calibrated for pipeline:
 *   Smoke(NormalBlend, alpha max 0.75) → over Fire(Additive) → HDR → Bloom → ACES
 */

import * as THREE from 'three';

const SMOKE_VERTEX = /* glsl */ `
  attribute float aLife;
  attribute float aMaxLife;

  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying float vViewDepth;
  varying float vLifeRatio;

  void main() {
    vUv = uv;
    vLifeRatio = clamp(aLife / max(aMaxLife, 0.001), 0.0, 1.0);

    vec4 worldPos = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;

    vec4 mvPos = viewMatrix * worldPos;
    vViewDepth = -mvPos.z;

    gl_Position = projectionMatrix * mvPos;
  }
`;

const SMOKE_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uDensityScale;
  uniform float uSoftness;
  uniform float uAbsorption;
  uniform float uScatterStrength;
  uniform float uWindAdvect;
  uniform vec3 uLightDir;

  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying float vViewDepth;
  varying float vLifeRatio;

  // ── Improved value noise with quintic interpolation ──
  float hash(vec3 p) {
    p = fract(p * vec3(0.1031, 0.1030, 0.0973));
    p += dot(p, p.yxz + 33.33);
    return fract((p.x + p.y) * p.z);
  }

  float noise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);

    float a = hash(i);
    float b = hash(i + vec3(1, 0, 0));
    float c = hash(i + vec3(0, 1, 0));
    float d = hash(i + vec3(1, 1, 0));
    float e = hash(i + vec3(0, 0, 1));
    float g = hash(i + vec3(1, 0, 1));
    float h = hash(i + vec3(0, 1, 1));
    float k = hash(i + vec3(1, 1, 1));

    return mix(
      mix(mix(a, b, f.x), mix(c, d, f.x), f.y),
      mix(mix(e, g, f.x), mix(h, k, f.x), f.y),
      f.z
    );
  }

  // ── Domain-warped FBM — 5 octaves with rotation per octave ──
  float fbm(vec3 p) {
    float total = 0.0;
    float freq = 1.0;
    float amp = 0.50;
    float maxAmp = 0.0;

    // Domain warp
    vec3 warp = vec3(
      noise(p * 0.8 + vec3(1.7, 9.2, 0.0)),
      noise(p * 0.8 + vec3(8.3, 2.8, 0.0)),
      noise(p * 0.8 + vec3(2.1, 5.7, 0.0))
    ) * 0.40;

    p += warp;

    for (int i = 0; i < 5; i++) {
      total += noise(p * freq) * amp;
      maxAmp += amp;
      p = vec3(p.y * 1.1 + p.z * 0.3, p.z * 1.1 - p.x * 0.3, p.x * 1.1 + p.y * 0.3);
      freq *= 2.15;
      amp *= 0.46;
    }
    return total / maxAmp;
  }

  void main() {
    // ── Advection ──
    vec3 advect = vec3(
      uTime * uWindAdvect * 0.15,
      uTime * 0.08 + vLifeRatio * 1.2,
      uTime * 0.05
    );
    vec3 samplePos = vWorldPos * 0.08 + advect;

    float rawDensity = fbm(samplePos);

    // ── Density modulation by life ──
    float dissipation = 1.0 - smoothstep(0.4, 1.0, vLifeRatio);
    float density = rawDensity * uDensityScale * dissipation;

    // ── Beer-Lambert absorption ──
    float opticalDepth = density * uAbsorption * 3.5;
    float transmittance = exp(-opticalDepth);
    float alpha = (1.0 - transmittance) * 0.75;

    // ── Soft particle depth-fade ──
    float depthFade = smoothstep(0.0, uSoftness, vViewDepth);

    // ── Internal scattering (Henyey-Greenstein lite) ──
    vec3 toLight = normalize(uLightDir);
    float scatter = max(0.0, dot(normalize(vWorldPos), toLight)) * uScatterStrength;
    float rimLight = pow(scatter, 2.0) * 0.40;

    // ── Smoke color: amber near fire, cool-grey at distance ──
    vec3 warmSmoke = vec3(0.32, 0.24, 0.16);
    vec3 coolSmoke = vec3(0.15, 0.16, 0.18);
    float tempFade = smoothstep(0.0, 0.5, vLifeRatio);
    vec3 baseColor = mix(warmSmoke, coolSmoke, tempFade);

    // Scattering contribution
    vec3 scatterColor = vec3(0.45, 0.38, 0.30) * rimLight;
    vec3 color = (baseColor * (0.5 + density * 0.5)) + scatterColor;

    // ── Atmospheric perspective ──
    float atmoFade = 1.0 - smoothstep(30.0, 120.0, vViewDepth);
    vec3 skyTint = vec3(0.25, 0.30, 0.38);
    color = mix(skyTint, color, atmoFade);

    // ── Particle shape ──
    vec2 center = vUv - 0.5;
    float dist = length(center);
    float shape = 1.0 - smoothstep(0.25, 0.50, dist);

    gl_FragColor = vec4(color, alpha * depthFade * shape);
  }
`;

export interface CinemaSmokeConfig {
  densityScale: number;
  softness: number;
  absorption: number;
  scatterStrength: number;
  windAdvect: number;
  lightDir: [number, number, number];
}

const DEFAULT_SMOKE_CONFIG: CinemaSmokeConfig = {
  densityScale: 1.6,            // recalibrated: more voluminous
  softness: 1.5,
  absorption: 0.92,             // recalibrated: stronger Beer-Lambert
  scatterStrength: 0.75,        // recalibrated: more pronounced rim
  windAdvect: 1.3,              // recalibrated: more responsive
  lightDir: [0.3, 1.0, 0.5],
};

/**
 * Create a cinema-grade volumetric smoke ShaderMaterial.
 */
export function createCinemaSmokeMaterial(config?: Partial<CinemaSmokeConfig>): THREE.ShaderMaterial {
  const cfg = { ...DEFAULT_SMOKE_CONFIG, ...config };
  const ld = cfg.lightDir;
  const len = Math.sqrt(ld[0] * ld[0] + ld[1] * ld[1] + ld[2] * ld[2]) || 1;

  return new THREE.ShaderMaterial({
    vertexShader: SMOKE_VERTEX,
    fragmentShader: SMOKE_FRAGMENT,
    uniforms: {
      uTime: { value: 0 },
      uDensityScale: { value: cfg.densityScale },
      uSoftness: { value: cfg.softness },
      uAbsorption: { value: cfg.absorption },
      uScatterStrength: { value: cfg.scatterStrength },
      uWindAdvect: { value: cfg.windAdvect },
      uLightDir: { value: new THREE.Vector3(ld[0] / len, ld[1] / len, ld[2] / len) },
    },
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.NormalBlending,
    side: THREE.DoubleSide,
  });
}
