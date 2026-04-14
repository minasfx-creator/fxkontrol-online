/**
 * FX KONTROL · Cinema Burst/Explosion Shader
 * Multi-layer core + shockwave, radial falloff, HDR glow.
 */

import * as THREE from 'three';

const BURST_VERTEX = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    vec4 mvPos = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPos;
  }
`;

const BURST_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uCoreIntensity;
  uniform float uWaveSpeed;

  varying vec2 vUv;

  // ── Radial energy falloff ──
  float radialFalloff(float r) {
    return exp(-3.0 * r);
  }

  void main() {
    vec2 center = vec2(0.5);
    float dist = distance(vUv, center);

    // Shockwave ring
    float wave = sin(dist * 20.0 - uTime * uWaveSpeed);

    // Core intensity with falloff
    float core = radialFalloff(dist) * uCoreIntensity;
    float glow = core + wave * 0.2;

    // Multi-layer color: white-hot core → orange → red edge
    vec3 coreColor = vec3(1.1, 1.0, 0.9);
    vec3 midColor = vec3(1.0, 0.7, 0.3);
    vec3 edgeColor = vec3(0.8, 0.2, 0.05);

    float coreBlend = smoothstep(0.3, 0.0, dist);
    float midBlend = smoothstep(0.5, 0.15, dist);

    vec3 color = mix(edgeColor, midColor, midBlend);
    color = mix(color, coreColor, coreBlend);

    // HDR glow output
    color *= glow * 5.0;

    float alpha = smoothstep(0.8, 0.0, dist);

    gl_FragColor = vec4(color, alpha);
  }
`;

export interface CinemaBurstConfig {
  coreIntensity: number;
  waveSpeed: number;
}

const DEFAULT_BURST_CONFIG: CinemaBurstConfig = {
  coreIntensity: 1.0,
  waveSpeed: 10.0,
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
    },
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}
