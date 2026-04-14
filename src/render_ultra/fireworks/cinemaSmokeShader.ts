/**
 * FX KONTROL · Cinema Volumetric Smoke Shader
 * Fake-volumetric via 4-octave FBM, soft particle depth-fade,
 * turbulence advection, density-controlled alpha.
 */

import * as THREE from 'three';

const SMOKE_VERTEX = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying float vViewDepth;

  void main() {
    vUv = uv;
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
  uniform float uCameraNear;
  uniform float uCameraFar;

  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying float vViewDepth;

  // ── Hash-based noise (no texture dependency) ──
  float hash(vec3 p) {
    return fract(sin(dot(p, vec3(12.9898, 78.233, 45.164))) * 43758.5453);
  }

  float noise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f); // smoothstep

    return mix(
      mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x),
          mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
      mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
          mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
      f.z
    );
  }

  // ── Fractal Brownian Motion — 4 octaves ──
  float fbm(vec3 p) {
    float total = 0.0;
    float freq = 1.0;
    float amp = 0.5;
    for (int i = 0; i < 4; i++) {
      total += noise(p * freq) * amp;
      freq *= 2.0;
      amp *= 0.5;
    }
    return total;
  }

  void main() {
    // Turbulence advection — time-offset in noise domain
    vec3 samplePos = vWorldPos * 0.1 + vec3(uTime * 0.2, uTime * 0.1, 0.0);

    float density = fbm(samplePos) * uDensityScale;
    float alpha = smoothstep(0.2, 0.7, density);

    // Soft particle depth-fade (avoids hard intersections)
    float depthFade = smoothstep(0.0, uSoftness, vViewDepth);

    // Smoke color — slightly warm-tinted grey
    vec3 color = vec3(0.22, 0.20, 0.19) * (0.5 + density);

    // Atmospheric scattering tint at distance
    float distFade = 1.0 - smoothstep(20.0, 80.0, vViewDepth);
    color = mix(vec3(0.3, 0.35, 0.4), color, distFade);

    // Circular particle shape
    vec2 center = vUv - 0.5;
    float dist = length(center);
    float shape = 1.0 - smoothstep(0.3, 0.5, dist);

    gl_FragColor = vec4(color, alpha * 0.6 * depthFade * shape);
  }
`;

export interface CinemaSmokeConfig {
  densityScale: number;
  softness: number;
}

const DEFAULT_SMOKE_CONFIG: CinemaSmokeConfig = {
  densityScale: 1.0,
  softness: 2.0,
};

/**
 * Create a cinema-grade volumetric smoke ShaderMaterial.
 */
export function createCinemaSmokeMaterial(config?: Partial<CinemaSmokeConfig>): THREE.ShaderMaterial {
  const cfg = { ...DEFAULT_SMOKE_CONFIG, ...config };

  return new THREE.ShaderMaterial({
    vertexShader: SMOKE_VERTEX,
    fragmentShader: SMOKE_FRAGMENT,
    uniforms: {
      uTime: { value: 0 },
      uDensityScale: { value: cfg.densityScale },
      uSoftness: { value: cfg.softness },
      uCameraNear: { value: 0.1 },
      uCameraFar: { value: 1000 },
    },
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.NormalBlending,
    side: THREE.DoubleSide,
  });
}
