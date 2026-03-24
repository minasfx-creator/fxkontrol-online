/**
 * FX KONTROL · Volumetric Cloud Layer v2
 * UE5.7-inspired raymarched clouds with Worley noise, temporal smoothing,
 * explosion-reactive lighting, and parallax depth illusion.
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
  uniform float uCoverage;
  uniform float uDensity;
  uniform float uSharpness;
  uniform vec3 uWindDirection;
  uniform float uWindSpeed;
  uniform vec3 uCloudColor;
  uniform vec3 uShadowColor;
  uniform vec3 uSunDirection;
  uniform float uSunIntensity;
  uniform float uCloudHeight;
  uniform float uCloudThickness;
  uniform float uExplosionFlash;
  uniform vec3 uExplosionColor;
  uniform vec3 uExplosionPos;
  uniform float uPrevFlash; // temporal smoothing

  varying vec3 vWorldPos;
  varying vec2 vUv;

  // ─── Hash & Noise ───
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float hash3(vec3 p) {
    return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
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

  // ─── Worley noise (cellular) for natural cloud edges ───
  float worley(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float minDist = 1.0;
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec2 neighbor = vec2(float(x), float(y));
        vec2 point = vec2(hash(i + neighbor), hash(i + neighbor + vec2(31.0, 17.0)));
        float dist = length(neighbor + point - f);
        minDist = min(minDist, dist);
      }
    }
    return minDist;
  }

  // ─── Cloud density ───
  float cloudDensity(vec2 uv) {
    vec2 windOffset = uWindDirection.xz * uWindSpeed * uTime * 0.001;
    vec2 p = uv * 3.0 + windOffset;

    // Multi-layer noise: FBM base + Worley detail
    float base = fbm(p);
    float detail = fbm(p * 3.0 + vec2(uTime * 0.005));
    float worleyDetail = worley(p * 5.0 + windOffset * 0.5);

    // Combine: FBM gives shape, inverted Worley adds billowy edges
    float combined = base * 0.65 + detail * 0.2 + (1.0 - worleyDetail) * 0.15;

    float density = combined - (1.0 - uCoverage);
    density = smoothstep(0.0, uSharpness, density) * uDensity;

    return clamp(density, 0.0, 1.0);
  }

  void main() {
    vec2 cloudUV = vUv;

    // Radial fade
    float dist = length(cloudUV - 0.5) * 2.0;
    float edgeFade = 1.0 - smoothstep(0.6, 1.0, dist);

    float density = cloudDensity(cloudUV) * edgeFade;
    if (density < 0.01) discard;

    // ─── Parallax depth illusion ───
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    vec2 parallaxOffset = viewDir.xz * uCloudThickness * 0.001;
    float topDensity = cloudDensity(cloudUV + parallaxOffset * 0.5);
    float depthFactor = mix(0.7, 1.0, topDensity);

    // ─── Self-shadowing ───
    vec2 sunOffset = normalize(uSunDirection.xz) * 0.03;
    float shadowDensity = cloudDensity(cloudUV + sunOffset);
    float shadow = exp(-shadowDensity * 2.5);

    // Beer-Lambert absorption
    float transmittance = exp(-density * 1.5);

    // ─── Lit color ───
    vec3 litColor = mix(uShadowColor, uCloudColor, shadow * depthFactor);
    litColor *= (0.4 + uSunIntensity * 0.6 * shadow);

    // Silver lining (Mie forward scattering)
    float edgeGlow = pow(1.0 - density, 3.0) * uSunIntensity * 0.35;
    litColor += vec3(edgeGlow);

    // ─── Explosion flash — temporal smoothed ───
    float smoothedFlash = max(uExplosionFlash, uPrevFlash * 0.85);
    if (smoothedFlash > 0.01) {
      // Distance-based attenuation from burst
      float distToBurst = length(vWorldPos.xz - uExplosionPos.xz);
      float burstFalloff = exp(-distToBurst * distToBurst / 200000.0);

      // Clouds lit from below by explosion
      float underlighting = (1.0 - shadow) * 0.6 + 0.4;
      litColor += uExplosionColor * smoothedFlash * underlighting * burstFalloff;
    }

    float alpha = density * 0.7;
    gl_FragColor = vec4(litColor, alpha);
  }
`;

export interface CloudConfig {
  coverage: number;
  density: number;
  sharpness: number;
  windSpeed: number;
  windDirection: [number, number, number];
  cloudColor: THREE.Color;
  shadowColor: THREE.Color;
  height: number;
  thickness: number;       // parallax depth illusion
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
  thickness: 50,
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
      uCloudThickness: { value: cfg.thickness },
      uExplosionFlash: { value: 0 },
      uExplosionColor: { value: new THREE.Color(0, 0, 0) },
      uExplosionPos: { value: new THREE.Vector3(0, 100, 0) },
      uPrevFlash: { value: 0 },
    },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = cfg.height;

  let prevFlashValue = 0;

  return {
    mesh,
    update(time: number) {
      material.uniforms.uTime.value = time;
      // Temporal smoothing for explosion flash
      const currentFlash = material.uniforms.uExplosionFlash.value;
      material.uniforms.uPrevFlash.value = prevFlashValue;
      prevFlashValue = currentFlash;
      // Decay explosion flash
      if (currentFlash > 0.01) {
        material.uniforms.uExplosionFlash.value *= 0.93;
      }
    },
    setCoverage(v: number) { material.uniforms.uCoverage.value = v; },
    setDensity(v: number) { material.uniforms.uDensity.value = v; },
    setWindSpeed(v: number) { material.uniforms.uWindSpeed.value = v; },
    setThickness(v: number) { material.uniforms.uCloudThickness.value = v; },
    setSunDirection(dir: THREE.Vector3) { material.uniforms.uSunDirection.value.copy(dir).normalize(); },
    setSunIntensity(v: number) { material.uniforms.uSunIntensity.value = v; },
    /** Flash clouds with firework explosion light — with position for distance attenuation */
    flashExplosion(color: THREE.Color, intensity: number, position?: THREE.Vector3) {
      material.uniforms.uExplosionColor.value.copy(color);
      material.uniforms.uExplosionFlash.value = Math.min(intensity, 2);
      if (position) {
        material.uniforms.uExplosionPos.value.copy(position);
      }
    },
  };
}

/** Cloud coverage presets for venue atmosphere */
export const CLOUD_PRESETS = {
  clear: { coverage: 0.1, density: 0.5, sharpness: 0.5, thickness: 20 },
  scattered: { coverage: 0.35, density: 0.8, sharpness: 0.3, thickness: 40 },
  overcast: { coverage: 0.75, density: 1.5, sharpness: 0.15, thickness: 80 },
  dramatic: { coverage: 0.55, density: 1.2, sharpness: 0.4, thickness: 60 },
  stormy: { coverage: 0.85, density: 1.8, sharpness: 0.1, thickness: 100 },
  storm: {
    coverage: 0.9, density: 2.0, sharpness: 0.08, thickness: 120,
    cloudColor: new THREE.Color(0.1, 0.1, 0.12),
    shadowColor: new THREE.Color(0.02, 0.02, 0.04),
    height: 180,
  },
} as const;
