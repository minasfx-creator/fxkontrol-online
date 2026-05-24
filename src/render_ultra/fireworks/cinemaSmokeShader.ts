/**
 * FX KONTROL · Cinema Volumetric Smoke Shader — v3 Studio Mode
 *
 * Improvements over v2:
 *   - Full Henyey-Greenstein phase function (g=0.6 forward-scattering)
 *     replacing the simplified pow(scatter,2) approximation
 *   - Curl-noise advection replaces linear wind: organic turbulent swirling
 *   - Multi-scattering approximation: isotropic ambient + single-bounce
 *   - Phase-5 dissipation: emissive → turbulent → cisalhamento → repouso
 *
 * Calibrated for pipeline:
 *   Smoke(NormalBlend, alpha max 0.80) → over Fire(Additive) → HDR → Bloom → ACES
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
  uniform float uHGAnisotropy;   // Henyey-Greenstein g factor (0=isotropic, 0.6=forward)
  uniform vec3 uAmbientColor;    // multi-scatter ambient fill

  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying float vViewDepth;
  varying float vLifeRatio;

  // ── Value noise (quintic interpolation) ──
  float hash(vec3 p) {
    p = fract(p * vec3(0.1031, 0.1030, 0.0973));
    p += dot(p, p.yxz + 33.33);
    return fract((p.x + p.y) * p.z);
  }

  float noise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
    float a = hash(i);             float b = hash(i + vec3(1, 0, 0));
    float c = hash(i + vec3(0,1,0)); float d = hash(i + vec3(1,1,0));
    float e = hash(i + vec3(0,0,1)); float g = hash(i + vec3(1,0,1));
    float h = hash(i + vec3(0,1,1)); float k = hash(i + vec3(1,1,1));
    return mix(
      mix(mix(a,b,f.x), mix(c,d,f.x), f.y),
      mix(mix(e,g,f.x), mix(h,k,f.x), f.y), f.z);
  }

  // ── Curl noise (divergence-free) for organic advection ──
  // Computes curl of a 3-component potential field via finite differences.
  vec3 curlNoise(vec3 p) {
    const float eps = 0.02;
    const float inv2e = 1.0 / (2.0 * eps);
    float fxPy = noise(p + vec3(0, eps, 0));           float fxNy = noise(p - vec3(0, eps, 0));
    float fxPz = noise(p + vec3(0, 0, eps));           float fxNz = noise(p - vec3(0, 0, eps));
    float fyPx = noise(p + vec3(eps,0,0) + vec3(31.7,0,0));
    float fyNx = noise(p - vec3(eps,0,0) + vec3(31.7,0,0));
    float fyPz = noise(p + vec3(0,0,eps) + vec3(31.7,0,0));
    float fyNz = noise(p - vec3(0,0,eps) + vec3(31.7,0,0));
    float fzPx = noise(p + vec3(eps,0,0) + vec3(0,57.3,0));
    float fzNx = noise(p - vec3(eps,0,0) + vec3(0,57.3,0));
    float fzPy = noise(p + vec3(0,eps,0) + vec3(0,57.3,0));
    float fzNy = noise(p - vec3(0,eps,0) + vec3(0,57.3,0));
    return vec3(
      ((fzPy - fzNy) - (fyPz - fyNz)) * inv2e,
      ((fxPz - fxNz) - (fzPx - fzNx)) * inv2e,
      ((fyPx - fyNx) - (fxPy - fxNy)) * inv2e
    );
  }

  // ── Domain-warped FBM — 5 octaves ──
  float fbm(vec3 p) {
    float total = 0.0, freq = 1.0, amp = 0.50, maxAmp = 0.0;
    vec3 warp = vec3(
      noise(p * 0.8 + vec3(1.7, 9.2, 0.0)),
      noise(p * 0.8 + vec3(8.3, 2.8, 0.0)),
      noise(p * 0.8 + vec3(2.1, 5.7, 0.0))
    ) * 0.40;
    p += warp;
    for (int i = 0; i < 5; i++) {
      total += noise(p * freq) * amp;
      maxAmp += amp;
      p = vec3(p.y*1.1+p.z*0.3, p.z*1.1-p.x*0.3, p.x*1.1+p.y*0.3);
      freq *= 2.15; amp *= 0.46;
    }
    return total / maxAmp;
  }

  // ── Full Henyey-Greenstein phase function ──
  // g in (-1,1): g=0 isotropic, g>0 forward-scattering (smoke~0.6)
  float henyeyGreenstein(float cosTheta, float g) {
    float g2 = g * g;
    float denom = 1.0 + g2 - 2.0 * g * cosTheta;
    return (1.0 - g2) / (4.0 * 3.14159265 * pow(max(denom, 1e-4), 1.5));
  }

  void main() {
    // ── Curl-noise advection (divergence-free, organic swirling) ──
    // Phase 1: hot turbulent emission  Phase 2: cool curl dispersion
    float turbPhase = smoothstep(0.0, 0.4, vLifeRatio);   // 0=hot burst, 1=cool drift
    float driftPhase = smoothstep(0.3, 0.8, vLifeRatio);  // cisalhamento wind-shear
    vec3 baseAdvect = vec3(
      uTime * uWindAdvect * 0.15,
      uTime * 0.08 + vLifeRatio * 1.2,
      uTime * 0.05
    );
    vec3 curlSample = vWorldPos * 0.06 + baseAdvect;
    vec3 curl = curlNoise(curlSample) * mix(0.8, 2.0, turbPhase) * uWindAdvect;
    // Wind shear: lateral drift grows with age (cisalhamento phase)
    vec3 shear = vec3(sin(uTime * 0.3 + vWorldPos.y * 0.1), 0.0, cos(uTime * 0.2)) * driftPhase * 0.4;
    vec3 samplePos = vWorldPos * 0.08 + baseAdvect + curl * 0.3 + shear;

    float rawDensity = fbm(samplePos);

    // ── Density: 5-phase dissipation curve ──
    // Phase 1 emit  →  Phase 2 expand  →  Phase 3 drift  →  Phase 4 shear  →  Phase 5 repose
    float dissipation = 1.0 - smoothstep(0.35, 1.0, vLifeRatio);
    float dissipBump = smoothstep(0.0, 0.15, vLifeRatio) * 1.2; // initial puff growth
    float density = rawDensity * uDensityScale * dissipation * max(dissipBump, 1.0);

    // ── Beer-Lambert absorption ──
    float opticalDepth = density * uAbsorption * 3.5;
    float transmittance = exp(-opticalDepth);
    float alpha = (1.0 - transmittance) * 0.80;

    // ── Soft particle depth-fade ──
    float depthFade = smoothstep(0.0, uSoftness, vViewDepth);

    // ── Full Henyey-Greenstein single-scatter ──
    vec3 toLight = normalize(uLightDir);
    vec3 viewDir = normalize(vec3(0.0, 0.0, 1.0)); // approximate view direction
    float cosTheta = dot(toLight, viewDir);
    float hgPhase = henyeyGreenstein(cosTheta, uHGAnisotropy);
    // Normalise to [0,1] range for energy-conserving integration (4π × HG integrates to 1)
    float singleScatter = hgPhase * (1.0 / (4.0 * 3.14159265)) * uScatterStrength;

    // ── Multi-scatter approximation: isotropic ambient bounce ──
    // Simulates light that has scattered multiple times inside the cloud.
    float multiScatter = 0.15 * uScatterStrength;

    // ── Smoke color: 5 thermal phases ──
    // Phase 1: incandescent amber (near fire heat)
    // Phase 5: cool blue-grey (aged, sheared plume)
    vec3 hotSmoke   = vec3(0.38, 0.28, 0.14); // warm amber
    vec3 warmSmoke  = vec3(0.28, 0.22, 0.16); // amber-grey
    vec3 coolSmoke  = vec3(0.16, 0.17, 0.19); // cool grey
    vec3 agedSmoke  = vec3(0.12, 0.13, 0.16); // dark distant plume
    float p1 = smoothstep(0.0, 0.2, vLifeRatio);
    float p2 = smoothstep(0.2, 0.5, vLifeRatio);
    float p3 = smoothstep(0.5, 1.0, vLifeRatio);
    vec3 baseColor = mix(hotSmoke, warmSmoke, p1);
    baseColor = mix(baseColor, coolSmoke, p2);
    baseColor = mix(baseColor, agedSmoke, p3);

    // ── Assemble lighting ──
    // Single scatter: directional HG
    vec3 scatterColor = vec3(0.55, 0.48, 0.36) * singleScatter * density;
    // Multi scatter: ambient fill (bounced light illuminates shadows)
    vec3 ambientFill  = uAmbientColor * multiScatter;

    vec3 color = baseColor * (0.4 + density * 0.6)
               + scatterColor
               + ambientFill;

    // ── Atmospheric perspective ──
    float atmoFade = 1.0 - smoothstep(30.0, 120.0, vViewDepth);
    vec3 skyTint = vec3(0.22, 0.27, 0.35);
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
  /** Henyey-Greenstein anisotropy factor g ∈ (-1,1). 0=isotropic, 0.6=smoke-typical forward. */
  hgAnisotropy: number;
  /** Ambient fill color for multi-scatter approximation */
  ambientColor: [number, number, number];
}

const DEFAULT_SMOKE_CONFIG: CinemaSmokeConfig = {
  densityScale: 1.6,
  softness: 1.5,
  absorption: 0.92,
  scatterStrength: 0.75,
  windAdvect: 1.3,
  lightDir: [0.3, 1.0, 0.5],
  hgAnisotropy: 0.6,                     // forward-scattering smoke
  ambientColor: [0.08, 0.10, 0.14],      // cool night-sky ambient
};

/**
 * Create a cinema-grade volumetric smoke ShaderMaterial.
 * v3: full Henyey-Greenstein phase, curl-noise advection, 5-phase dissipation,
 * multi-scatter ambient fill.
 */
export function createCinemaSmokeMaterial(config?: Partial<CinemaSmokeConfig>): THREE.ShaderMaterial {
  const cfg = { ...DEFAULT_SMOKE_CONFIG, ...config };
  const ld = cfg.lightDir;
  const len = Math.sqrt(ld[0] * ld[0] + ld[1] * ld[1] + ld[2] * ld[2]) || 1;
  const amb = cfg.ambientColor;

  return new THREE.ShaderMaterial({
    vertexShader: SMOKE_VERTEX,
    fragmentShader: SMOKE_FRAGMENT,
    uniforms: {
      uTime:           { value: 0 },
      uDensityScale:   { value: cfg.densityScale },
      uSoftness:       { value: cfg.softness },
      uAbsorption:     { value: cfg.absorption },
      uScatterStrength:{ value: cfg.scatterStrength },
      uWindAdvect:     { value: cfg.windAdvect },
      uLightDir:       { value: new THREE.Vector3(ld[0] / len, ld[1] / len, ld[2] / len) },
      uHGAnisotropy:   { value: cfg.hgAnisotropy },
      uAmbientColor:   { value: new THREE.Vector3(amb[0], amb[1], amb[2]) },
    },
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.NormalBlending,
    side: THREE.DoubleSide,
  });
}
