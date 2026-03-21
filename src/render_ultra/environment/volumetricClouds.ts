/**
 * FX KONTROL · Volumetric Cloud Layer
 * UE5.7-inspired raymarched procedural clouds with density, coverage, and wind.
 * Renders as a dome above the scene with animated FBM noise.
 */

import * as THREE from 'three';

const CLOUD_VERTEX = `
  varying vec3 vWorldPos;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const CLOUD_FRAGMENT = `
  uniform float uTime;
  uniform float uCoverage;       // 0-1 cloud coverage
  uniform float uDensity;        // 0-2 optical density
  uniform float uSharpness;      // edge sharpness
  uniform vec3 uWindDirection;   // wind offset direction
  uniform float uWindSpeed;
  uniform vec3 uCloudColor;      // lit cloud color
  uniform vec3 uShadowColor;     // shadowed underside
  uniform vec3 uSunDirection;
  uniform float uSunIntensity;
  uniform float uCloudHeight;
  uniform float uExplosionFlash; // flash brightness from bursts
  uniform vec3 uExplosionColor;

  varying vec3 vWorldPos;
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
      mix(hash(i), hash(i + vec2(1, 0)), f.x),
      mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x),
      f.y
    );
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 5; i++) {
      v += amp * noise(p);
      p *= 2.03;
      amp *= 0.5;
    }
    return v;
  }

  // ─── Cloud density sampling ───
  float cloudDensity(vec2 uv) {
    vec2 windOffset = uWindDirection.xz * uWindSpeed * uTime * 0.001;
    vec2 p = uv * 3.0 + windOffset;
    
    float base = fbm(p);
    float detail = fbm(p * 3.0 + vec2(uTime * 0.005));
    
    float density = base - (1.0 - uCoverage);
    density += detail * 0.15;
    density = smoothstep(0.0, uSharpness, density) * uDensity;
    
    return clamp(density, 0.0, 1.0);
  }

  void main() {
    // Map UV to cloud sampling space
    vec2 cloudUV = vUv;
    
    // Radial fade at edges
    float dist = length(cloudUV - 0.5) * 2.0;
    float edgeFade = 1.0 - smoothstep(0.6, 1.0, dist);
    
    float density = cloudDensity(cloudUV) * edgeFade;
    if (density < 0.01) discard;
    
    // ─── Lighting ───
    // Self-shadowing: sample density at offset toward sun
    vec2 sunOffset = normalize(uSunDirection.xz) * 0.03;
    float shadowDensity = cloudDensity(cloudUV + sunOffset);
    float shadow = exp(-shadowDensity * 2.0);
    
    // Beer-Lambert absorption
    float transmittance = exp(-density * 1.5);
    
    // Lit color with sun + ambient
    vec3 litColor = mix(uShadowColor, uCloudColor, shadow);
    litColor *= (0.4 + uSunIntensity * 0.6 * shadow);
    
    // Silver lining at edges (Mie forward scattering approx)
    float edgeGlow = pow(1.0 - density, 3.0) * uSunIntensity * 0.3;
    litColor += vec3(edgeGlow);
    
    // Explosion flash — fireworks illuminate clouds from below
    litColor += uExplosionColor * uExplosionFlash * (1.0 - shadow) * 0.5;
    
    float alpha = density * 0.7;
    gl_FragColor = vec4(litColor, alpha);
  }
`;

export interface CloudConfig {
  coverage: number;        // 0-1
  density: number;         // 0-2
  sharpness: number;       // 0.1-1
  windSpeed: number;       // world units/sec
  windDirection: [number, number, number];
  cloudColor: THREE.Color;
  shadowColor: THREE.Color;
  height: number;          // cloud layer altitude
}

const DEFAULT_CLOUD_CONFIG: CloudConfig = {
  coverage: 0.45,
  density: 1.0,
  sharpness: 0.3,
  windSpeed: 8,
  windDirection: [1, 0, 0.3],
  cloudColor: new THREE.Color(0.25, 0.28, 0.35),
  shadowColor: new THREE.Color(0.05, 0.06, 0.1),
  height: 300,
};

export function createVolumetricCloudLayer(config?: Partial<CloudConfig>) {
  const cfg = { ...DEFAULT_CLOUD_CONFIG, ...config };

  const geometry = new THREE.PlaneGeometry(2000, 2000, 1, 1);
  const material = new THREE.ShaderMaterial({
    vertexShader: CLOUD_VERTEX,
    fragmentShader: CLOUD_FRAGMENT,
    uniforms: {
      uTime: { value: 0 },
      uCoverage: { value: cfg.coverage },
      uDensity: { value: cfg.density },
      uSharpness: { value: cfg.sharpness },
      uWindDirection: { value: new THREE.Vector3(...cfg.windDirection).normalize() },
      uWindSpeed: { value: cfg.windSpeed },
      uCloudColor: { value: cfg.cloudColor.clone() },
      uShadowColor: { value: cfg.shadowColor.clone() },
      uSunDirection: { value: new THREE.Vector3(0.3, 0.8, 0.5).normalize() },
      uSunIntensity: { value: 0.3 },
      uCloudHeight: { value: cfg.height },
      uExplosionFlash: { value: 0 },
      uExplosionColor: { value: new THREE.Color(0, 0, 0) },
    },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = cfg.height;

  return {
    mesh,
    update(time: number) {
      material.uniforms.uTime.value = time;
      // Decay explosion flash
      const u = material.uniforms.uExplosionFlash;
      if (u.value > 0.01) u.value *= 0.93;
    },
    setCoverage(v: number) { material.uniforms.uCoverage.value = v; },
    setDensity(v: number) { material.uniforms.uDensity.value = v; },
    setWindSpeed(v: number) { material.uniforms.uWindSpeed.value = v; },
    setSunDirection(dir: THREE.Vector3) { material.uniforms.uSunDirection.value.copy(dir).normalize(); },
    setSunIntensity(v: number) { material.uniforms.uSunIntensity.value = v; },
    /** Flash clouds with firework explosion light */
    flashExplosion(color: THREE.Color, intensity: number) {
      material.uniforms.uExplosionColor.value.copy(color);
      material.uniforms.uExplosionFlash.value = Math.min(intensity, 2);
    },
  };
}

/** Cloud coverage presets for venue atmosphere */
export const CLOUD_PRESETS = {
  clear: { coverage: 0.1, density: 0.5, sharpness: 0.5 },
  scattered: { coverage: 0.35, density: 0.8, sharpness: 0.3 },
  overcast: { coverage: 0.75, density: 1.5, sharpness: 0.15 },
  dramatic: { coverage: 0.55, density: 1.2, sharpness: 0.4 },
  stormy: { coverage: 0.85, density: 1.8, sharpness: 0.1 },
} as const;
