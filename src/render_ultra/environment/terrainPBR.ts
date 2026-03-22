/**
 * FX KONTROL · Terrain PBR v2 — UE5.7 Landscape Material
 * Triplanar UV projection, procedural detail normals, slope-based multi-layer blending,
 * animated wetness puddles with ripple noise.
 */

import * as THREE from 'three';

export interface TerrainConfig {
  color: THREE.Color;
  roughness: number;
  metalness: number;
  wetness: number;
  normalScale: number;
  /** Secondary detail layer color (gravel/moss) */
  detailColor: THREE.Color;
  /** Slope threshold for detail layer blend (0-1) */
  slopeBlend: number;
  /** Detail texture tiling scale */
  detailTiling: number;
}

const TERRAIN_PRESETS: Record<string, TerrainConfig> = {
  'grass-field': {
    color: new THREE.Color(0.04, 0.08, 0.03),
    roughness: 0.85, metalness: 0.0, wetness: 0.2, normalScale: 0.8,
    detailColor: new THREE.Color(0.06, 0.04, 0.02),
    slopeBlend: 0.6, detailTiling: 12,
  },
  'concrete': {
    color: new THREE.Color(0.12, 0.12, 0.11),
    roughness: 0.7, metalness: 0.05, wetness: 0.0, normalScale: 1.0,
    detailColor: new THREE.Color(0.08, 0.08, 0.07),
    slopeBlend: 0.8, detailTiling: 8,
  },
  'wet-asphalt': {
    color: new THREE.Color(0.05, 0.05, 0.06),
    roughness: 0.2, metalness: 0.15, wetness: 0.9, normalScale: 0.5,
    detailColor: new THREE.Color(0.03, 0.03, 0.04),
    slopeBlend: 0.9, detailTiling: 10,
  },
  'dirt': {
    color: new THREE.Color(0.08, 0.06, 0.04),
    roughness: 0.9, metalness: 0.0, wetness: 0.1, normalScale: 1.2,
    detailColor: new THREE.Color(0.1, 0.07, 0.03),
    slopeBlend: 0.5, detailTiling: 15,
  },
  'beach-sand': {
    color: new THREE.Color(0.18, 0.15, 0.1),
    roughness: 0.95, metalness: 0.0, wetness: 0.3, normalScale: 0.6,
    detailColor: new THREE.Color(0.14, 0.12, 0.08),
    slopeBlend: 0.4, detailTiling: 20,
  },
  'gravel': {
    color: new THREE.Color(0.1, 0.09, 0.08),
    roughness: 0.8, metalness: 0.02, wetness: 0.0, normalScale: 1.5,
    detailColor: new THREE.Color(0.07, 0.06, 0.05),
    slopeBlend: 0.3, detailTiling: 18,
  },
  'snow': {
    color: new THREE.Color(0.7, 0.72, 0.78),
    roughness: 0.4, metalness: 0.0, wetness: 0.1, normalScale: 0.3,
    detailColor: new THREE.Color(0.5, 0.52, 0.58),
    slopeBlend: 0.7, detailTiling: 6,
  },
  'mud': {
    color: new THREE.Color(0.06, 0.04, 0.03),
    roughness: 0.5, metalness: 0.05, wetness: 0.7, normalScale: 1.0,
    detailColor: new THREE.Color(0.04, 0.03, 0.02),
    slopeBlend: 0.4, detailTiling: 14,
  },
  'rocky': {
    color: new THREE.Color(0.09, 0.08, 0.07),
    roughness: 0.75, metalness: 0.08, wetness: 0.0, normalScale: 1.8,
    detailColor: new THREE.Color(0.12, 0.1, 0.08),
    slopeBlend: 0.2, detailTiling: 10,
  },
  'festival-ground': {
    color: new THREE.Color(0.07, 0.06, 0.04),
    roughness: 0.7, metalness: 0.02, wetness: 0.15, normalScale: 1.0,
    detailColor: new THREE.Color(0.05, 0.04, 0.03),
    slopeBlend: 0.5, detailTiling: 12,
  },
};

// ── Triplanar Terrain Shader ─────────────────────────────────────

const TERRAIN_VERTEX = `
  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const TERRAIN_FRAGMENT = `
  uniform vec3 uBaseColor;
  uniform vec3 uDetailColor;
  uniform float uRoughness;
  uniform float uMetalness;
  uniform float uWetness;
  uniform float uNormalScale;
  uniform float uSlopeBlend;
  uniform float uDetailTiling;
  uniform float uTime;
  uniform vec3 uSunDirection;

  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;
  varying vec2 vUv;

  // ─── Noise functions ───
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1,0)), f.x),
      mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x),
      f.y
    );
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 4; i++) {
      v += amp * noise(p);
      p *= 2.03;
      amp *= 0.5;
    }
    return v;
  }

  // ─── Triplanar blending weights ───
  vec3 triplanarWeights(vec3 normal) {
    vec3 w = abs(normal);
    w = pow(w, vec3(4.0)); // sharpen blending
    return w / (w.x + w.y + w.z);
  }

  // ─── Procedural detail normal ───
  vec3 proceduralNormal(vec2 uv, float scale) {
    float eps = 0.01;
    float h0 = fbm(uv * scale);
    float hx = fbm((uv + vec2(eps, 0.0)) * scale);
    float hy = fbm((uv + vec2(0.0, eps)) * scale);
    vec3 n = normalize(vec3(h0 - hx, eps * 2.0, h0 - hy));
    return n;
  }

  // ─── Wetness puddle with animated ripples ───
  float puddleMask(vec2 uv) {
    float n = fbm(uv * 3.0);
    return smoothstep(1.0 - uWetness, 1.0 - uWetness + 0.15, n);
  }

  float rippleNoise(vec2 uv) {
    float n1 = sin(uv.x * 40.0 + uTime * 2.0) * 0.5 + 0.5;
    float n2 = sin(uv.y * 35.0 + uTime * 1.7) * 0.5 + 0.5;
    return n1 * n2;
  }

  void main() {
    vec3 N = normalize(vWorldNormal);
    vec3 triW = triplanarWeights(N);

    // ─── Triplanar UVs ───
    vec2 uvXY = vWorldPos.xy * 0.05;
    vec2 uvXZ = vWorldPos.xz * 0.05;
    vec2 uvYZ = vWorldPos.yz * 0.05;

    // ─── Base color via triplanar ───
    float nXY = fbm(uvXY * 4.0);
    float nXZ = fbm(uvXZ * 4.0);
    float nYZ = fbm(uvYZ * 4.0);
    float triNoise = triW.z * nXY + triW.y * nXZ + triW.x * nYZ;
    vec3 baseColor = mix(uBaseColor, uBaseColor * 1.3, triNoise * 0.5);

    // ─── Slope-based detail layer ───
    float slope = 1.0 - N.y; // 0 = flat, 1 = vertical
    float slopeFactor = smoothstep(uSlopeBlend - 0.1, uSlopeBlend + 0.1, slope);
    float detailNoise = fbm(vWorldPos.xz * uDetailTiling * 0.01);
    vec3 detailCol = mix(uDetailColor * 0.8, uDetailColor * 1.2, detailNoise);
    baseColor = mix(baseColor, detailCol, slopeFactor);

    // ─── Procedural detail normals (micro-bumps) ───
    vec3 detNorm = proceduralNormal(vWorldPos.xz * 0.02, uNormalScale * 10.0);
    vec3 finalNormal = normalize(N + (detNorm - vec3(0, 1, 0)) * uNormalScale * 0.3);

    // ─── Wetness & puddles ───
    float puddle = puddleMask(vWorldPos.xz * 0.01);
    float wetFactor = uWetness * 0.6 + puddle * 0.4;
    float finalRoughness = uRoughness * (1.0 - wetFactor * 0.7);
    float finalMetalness = uMetalness + wetFactor * 0.12;

    // Puddle ripples affect normal
    if (puddle > 0.1) {
      float ripple = rippleNoise(vWorldPos.xz * 0.03) * puddle;
      finalNormal.x += ripple * 0.15;
      finalNormal.z += ripple * 0.15;
      finalNormal = normalize(finalNormal);
      // Darken puddle areas
      baseColor *= 0.7;
    }

    // ─── Lighting (Lambertian + specular) ───
    vec3 sunDir = normalize(uSunDirection);
    float NdotL = max(dot(finalNormal, sunDir), 0.0);
    float ambient = 0.08;
    vec3 diffuse = baseColor * (ambient + NdotL * 0.5);

    // Specular for wet surfaces
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    vec3 halfDir = normalize(sunDir + viewDir);
    float spec = pow(max(dot(finalNormal, halfDir), 0.0), mix(16.0, 128.0, wetFactor));
    vec3 specColor = vec3(spec * wetFactor * 0.4);

    // ─── Env map approximation (sky reflection in puddles) ───
    vec3 envRefl = vec3(0.0);
    if (puddle > 0.3) {
      vec3 reflDir = reflect(-viewDir, finalNormal);
      float skyGrad = max(reflDir.y, 0.0);
      envRefl = mix(vec3(0.02, 0.03, 0.06), vec3(0.05, 0.08, 0.15), skyGrad) * puddle * 0.5;
    }

    vec3 finalColor = diffuse + specColor + envRefl;

    // Edge fade
    float edge = length(vUv - 0.5) * 2.0;
    float edgeFade = 1.0 - smoothstep(0.85, 1.0, edge);

    gl_FragColor = vec4(finalColor, edgeFade);
  }
`;

/**
 * Create a UE5.7 Landscape-style triplanar PBR terrain material.
 */
export function createTerrainMaterial(preset: string = 'grass-field'): THREE.ShaderMaterial {
  const cfg = TERRAIN_PRESETS[preset] || TERRAIN_PRESETS['grass-field'];

  return new THREE.ShaderMaterial({
    vertexShader: TERRAIN_VERTEX,
    fragmentShader: TERRAIN_FRAGMENT,
    uniforms: {
      uBaseColor: { value: cfg.color.clone() },
      uDetailColor: { value: cfg.detailColor.clone() },
      uRoughness: { value: cfg.roughness },
      uMetalness: { value: cfg.metalness },
      uWetness: { value: cfg.wetness },
      uNormalScale: { value: cfg.normalScale },
      uSlopeBlend: { value: cfg.slopeBlend },
      uDetailTiling: { value: cfg.detailTiling },
      uTime: { value: 0 },
      uSunDirection: { value: new THREE.Vector3(0.3, 0.8, 0.5).normalize() },
    },
    transparent: true,
    side: THREE.DoubleSide,
  });
}

/**
 * Create a ground plane with triplanar PBR material.
 */
export function createTerrainPlane(size = 500, preset = 'grass-field') {
  const geometry = new THREE.PlaneGeometry(size, size, 64, 64);
  const material = createTerrainMaterial(preset);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.receiveShadow = true;

  return {
    mesh,
    material,
    update(time: number) {
      material.uniforms.uTime.value = time;
    },
    setWetness(v: number) { material.uniforms.uWetness.value = v; },
    setSunDirection(dir: THREE.Vector3) { material.uniforms.uSunDirection.value.copy(dir).normalize(); },
  };
}

export function getTerrainPresets() {
  return Object.keys(TERRAIN_PRESETS);
}
