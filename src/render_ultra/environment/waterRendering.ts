/**
 * FX KONTROL · Water Rendering System v2
 * UE5.7-inspired: Gerstner waves, Fresnel, specular, explosion reflections,
 * subsurface scattering approximation, and caustic patterns.
 */

import * as THREE from 'three';

const WATER_VERTEX = `
  uniform float uTime;
  uniform float uWaveAmplitude;
  uniform float uWaveFrequency;
  uniform vec2 uWindDir;

  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying float vWaveHeight;

  // ─── Gerstner wave ───
  vec3 gerstnerWave(vec3 pos, float amp, float freq, float speed, vec2 dir, float steepness) {
    float phase = freq * dot(dir, pos.xz) + uTime * speed;
    float s = sin(phase);
    float c = cos(phase);
    float q = steepness / (freq * amp);
    return vec3(q * amp * dir.x * c, amp * s, q * amp * dir.y * c);
  }

  void main() {
    vUv = uv;
    vec3 pos = position;

    vec3 wave1 = gerstnerWave(pos, uWaveAmplitude, uWaveFrequency, 1.2, normalize(uWindDir), 0.5);
    vec3 wave2 = gerstnerWave(pos, uWaveAmplitude * 0.5, uWaveFrequency * 1.8, 0.8, normalize(uWindDir + vec2(0.3, 0.2)), 0.3);
    vec3 wave3 = gerstnerWave(pos, uWaveAmplitude * 0.25, uWaveFrequency * 3.1, 1.5, normalize(uWindDir + vec2(-0.5, 0.7)), 0.2);

    pos += wave1 + wave2 + wave3;
    vWaveHeight = pos.y;

    vec3 tangent = vec3(1.0, wave1.y * uWaveFrequency * cos(uTime), 0.0);
    vec3 bitangent = vec3(0.0, wave2.y * uWaveFrequency * 0.8, 1.0);
    vNormal = normalize(cross(bitangent, tangent));

    vec4 wp = modelMatrix * vec4(pos, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const WATER_FRAGMENT = `
  uniform float uTime;
  uniform vec3 uWaterColor;
  uniform vec3 uDeepColor;
  uniform float uOpacity;
  uniform float uFresnelPower;
  uniform vec3 uSpecularColor;
  uniform float uSpecularIntensity;
  uniform vec3 uSunDirection;
  uniform float uDistortionScale;
  uniform float uSSS;            // subsurface scattering intensity
  uniform vec3 uSSSColor;        // subsurface scattering color
  uniform float uCausticIntensity;

  // Explosion reflections
  uniform vec3 uExplosionColor;
  uniform float uExplosionIntensity;
  uniform vec3 uExplosionPos;

  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying float vWaveHeight;

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

  // ─── Caustic pattern ───
  float caustic(vec2 uv) {
    float c = 0.0;
    float scale = 1.0;
    for (int i = 0; i < 3; i++) {
      vec2 p = uv * scale + vec2(uTime * 0.03 * scale, uTime * 0.02 * scale);
      float n = noise(p * 8.0);
      // Sharp caustic lines
      c += pow(abs(sin(n * 6.28318 + uTime * 0.5)), 8.0) / scale;
      scale *= 2.0;
    }
    return c * 0.33;
  }

  void main() {
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    vec3 normal = normalize(vNormal);

    // Small-scale noise distortion (ripples)
    vec2 distortion = vec2(
      noise(vUv * uDistortionScale + uTime * 0.05),
      noise(vUv * uDistortionScale * 1.3 + uTime * 0.03 + 100.0)
    ) * 0.02 - 0.01;
    normal.xz += distortion;
    normal = normalize(normal);

    // ─── Fresnel ───
    float fresnel = pow(1.0 - max(dot(viewDir, normal), 0.0), uFresnelPower);
    fresnel = clamp(fresnel, 0.02, 0.98);

    // ─── Water color ───
    float depthFade = smoothstep(0.0, 50.0, length(vWorldPos.xz));
    vec3 waterCol = mix(uWaterColor, uDeepColor, depthFade);

    // ─── Subsurface Scattering approximation ───
    if (uSSS > 0.0) {
      float sssAmount = pow(max(dot(viewDir, -normalize(uSunDirection)), 0.0), 3.0);
      sssAmount *= (1.0 - fresnel) * uSSS;
      // Thin water areas let light through (wave peaks)
      float thinness = smoothstep(-0.2, 0.5, vWaveHeight);
      waterCol += uSSSColor * sssAmount * thinness;
    }

    // ─── Caustic pattern overlay ───
    if (uCausticIntensity > 0.0) {
      float c = caustic(vWorldPos.xz * 0.01);
      waterCol += vec3(c) * uCausticIntensity * (1.0 - fresnel) * 0.3;
    }

    // ─── Specular (sun reflection) ───
    vec3 halfDir = normalize(uSunDirection + viewDir);
    float spec = pow(max(dot(normal, halfDir), 0.0), 128.0) * uSpecularIntensity;
    vec3 specular = uSpecularColor * spec;

    // ─── Explosion reflections ───
    vec3 explosionRefl = vec3(0.0);
    if (uExplosionIntensity > 0.01) {
      vec3 toExplosion = normalize(uExplosionPos - vWorldPos);
      vec3 reflDir = reflect(-toExplosion, vec3(0.0, 1.0, 0.0));
      float reflFactor = pow(max(dot(viewDir, reflDir), 0.0), 2.0);
      float dist = length(vWorldPos.xz - uExplosionPos.xz);
      float distFade2 = exp(-dist * dist / 50000.0);
      explosionRefl = uExplosionColor * uExplosionIntensity * reflFactor * distFade2 * fresnel;
    }

    // ─── Composite ───
    vec3 finalColor = waterCol * (1.0 - fresnel) + specular + explosionRefl;

    // Edge distance fade
    float edge = length(vUv - 0.5) * 2.0;
    float edgeFade = 1.0 - smoothstep(0.7, 1.0, edge);

    gl_FragColor = vec4(finalColor, uOpacity * edgeFade);
  }
`;

export interface WaterConfig {
  size: number;
  waterColor: THREE.Color;
  deepColor: THREE.Color;
  opacity: number;
  waveAmplitude: number;
  waveFrequency: number;
  windDirection: [number, number];
  fresnelPower: number;
  specularIntensity: number;
  distortionScale: number;
  segments: number;
  sssIntensity: number;        // subsurface scattering
  sssColor: THREE.Color;
  causticIntensity: number;    // caustic pattern
}

const DEFAULT_WATER: WaterConfig = {
  size: 500,
  waterColor: new THREE.Color(0.02, 0.06, 0.1),
  deepColor: new THREE.Color(0.005, 0.015, 0.04),
  opacity: 0.85,
  waveAmplitude: 0.3,
  waveFrequency: 0.15,
  windDirection: [1, 0.3],
  fresnelPower: 3.0,
  specularIntensity: 0.8,
  distortionScale: 20,
  segments: 64,
  sssIntensity: 0.4,
  sssColor: new THREE.Color(0.0, 0.15, 0.12),
  causticIntensity: 0.5,
};

export function createWaterSystem(config?: Partial<WaterConfig>) {
  const cfg = { ...DEFAULT_WATER, ...config };

  const geometry = new THREE.PlaneGeometry(cfg.size, cfg.size, cfg.segments, cfg.segments);
  const material = new THREE.ShaderMaterial({
    vertexShader: WATER_VERTEX,
    fragmentShader: WATER_FRAGMENT,
    uniforms: {
      uTime: { value: 0 },
      uWaterColor: { value: cfg.waterColor.clone() },
      uDeepColor: { value: cfg.deepColor.clone() },
      uOpacity: { value: cfg.opacity },
      uWaveAmplitude: { value: cfg.waveAmplitude },
      uWaveFrequency: { value: cfg.waveFrequency },
      uWindDir: { value: new THREE.Vector2(...cfg.windDirection) },
      uFresnelPower: { value: cfg.fresnelPower },
      uSpecularColor: { value: new THREE.Color(1, 1, 1) },
      uSpecularIntensity: { value: cfg.specularIntensity },
      uSunDirection: { value: new THREE.Vector3(0.3, 0.8, 0.5).normalize() },
      uDistortionScale: { value: cfg.distortionScale },
      uSSS: { value: cfg.sssIntensity },
      uSSSColor: { value: cfg.sssColor.clone() },
      uCausticIntensity: { value: cfg.causticIntensity },
      uExplosionColor: { value: new THREE.Color(0, 0, 0) },
      uExplosionIntensity: { value: 0 },
      uExplosionPos: { value: new THREE.Vector3(0, 100, 0) },
    },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = -0.5;

  return {
    mesh,
    update(time: number) {
      material.uniforms.uTime.value = time;
      const u = material.uniforms.uExplosionIntensity;
      if (u.value > 0.01) u.value *= 0.95;
    },
    flashExplosion(position: THREE.Vector3, color: THREE.Color, intensity: number) {
      material.uniforms.uExplosionPos.value.copy(position);
      material.uniforms.uExplosionColor.value.copy(color);
      material.uniforms.uExplosionIntensity.value = Math.min(intensity, 3);
    },
    setWaveAmplitude(v: number) { material.uniforms.uWaveAmplitude.value = v; },
    setWindDirection(x: number, z: number) { material.uniforms.uWindDir.value.set(x, z); },
    setSunDirection(dir: THREE.Vector3) { material.uniforms.uSunDirection.value.copy(dir).normalize(); },
    setOpacity(v: number) { material.uniforms.uOpacity.value = v; },
    setSSS(v: number) { material.uniforms.uSSS.value = v; },
    setCausticIntensity(v: number) { material.uniforms.uCausticIntensity.value = v; },
    /** Fountain light phase sync — modulates caustics and SSS rhythmically */
    setFountainPhase(phase: number) {
      material.uniforms.uCausticIntensity.value = 0.3 + Math.sin(phase * Math.PI * 2) * 0.35 + 0.35;
      material.uniforms.uSSS.value = 0.1 + Math.sin(phase * Math.PI * 2 + 0.5) * 0.2 + 0.2;
    },
    /** DMX-driven water tint color change */
    setWaterTint(color: THREE.Color) {
      material.uniforms.uWaterColor.value.copy(color);
    },
    /** Toggle between calm pool and active fountain */
    setFountainActive(active: boolean) {
      material.uniforms.uWaveAmplitude.value = active ? 0.8 : 0.03;
      material.uniforms.uWaveFrequency.value = active ? 0.25 : 0.6;
    },
  };
}

/** Water presets for venue types */
export const WATER_PRESETS = {
  lake: { waveAmplitude: 0.2, waveFrequency: 0.1, opacity: 0.9, sssIntensity: 0.3, causticIntensity: 0.4 },
  river: { waveAmplitude: 0.5, waveFrequency: 0.25, opacity: 0.8, windDirection: [1, 0] as [number, number], sssIntensity: 0.5, causticIntensity: 0.6 },
  ocean: { waveAmplitude: 1.2, waveFrequency: 0.08, opacity: 0.95, sssIntensity: 0.6, causticIntensity: 0.3 },
  puddle: { waveAmplitude: 0.05, waveFrequency: 0.5, opacity: 0.7, size: 30, sssIntensity: 0.1, causticIntensity: 0.8 },
  pool: {
    waveAmplitude: 0.03,
    waveFrequency: 0.6,
    opacity: 0.75,
    size: 80,
    sssIntensity: 0.15,
    causticIntensity: 1.0,
    waterColor: new THREE.Color(0.01, 0.08, 0.1),
    deepColor: new THREE.Color(0.005, 0.04, 0.06),
    sssColor: new THREE.Color(0.0, 0.1, 0.12),
  },
} as const;
