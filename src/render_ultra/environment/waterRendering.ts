/**
 * FX KONTROL · Water Rendering System
 * UE5.7-inspired reflective water with Gerstner waves, Fresnel,
 * specular highlights, and firework explosion reflections.
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
    return vec3(
      q * amp * dir.x * c,
      amp * s,
      q * amp * dir.y * c
    );
  }

  void main() {
    vUv = uv;
    vec3 pos = position;
    
    // Sum multiple Gerstner waves for natural water surface
    vec3 wave1 = gerstnerWave(pos, uWaveAmplitude, uWaveFrequency, 1.2, normalize(uWindDir), 0.5);
    vec3 wave2 = gerstnerWave(pos, uWaveAmplitude * 0.5, uWaveFrequency * 1.8, 0.8, normalize(uWindDir + vec2(0.3, 0.2)), 0.3);
    vec3 wave3 = gerstnerWave(pos, uWaveAmplitude * 0.25, uWaveFrequency * 3.1, 1.5, normalize(uWindDir + vec2(-0.5, 0.7)), 0.2);
    
    pos += wave1 + wave2 + wave3;
    vWaveHeight = pos.y;
    
    // Approximate normal from wave derivatives
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
  
  // Explosion reflections
  uniform vec3 uExplosionColor;
  uniform float uExplosionIntensity;
  uniform vec3 uExplosionPos;  // world position of burst
  
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
    // Depth-based color blend
    float depthFade = smoothstep(0.0, 50.0, length(vWorldPos.xz));
    vec3 waterCol = mix(uWaterColor, uDeepColor, depthFade);
    
    // ─── Specular (sun reflection) ───
    vec3 halfDir = normalize(uSunDirection + viewDir);
    float spec = pow(max(dot(normal, halfDir), 0.0), 128.0) * uSpecularIntensity;
    vec3 specular = uSpecularColor * spec;
    
    // ─── Explosion reflections ───
    vec3 explosionRefl = vec3(0.0);
    if (uExplosionIntensity > 0.01) {
      vec3 toExplosion = normalize(uExplosionPos - vWorldPos);
      // Mirror the explosion direction about the normal
      vec3 reflDir = reflect(-toExplosion, vec3(0.0, 1.0, 0.0));
      float reflFactor = max(dot(viewDir, reflDir), 0.0);
      reflFactor = pow(reflFactor, 2.0);
      
      // Distance falloff from explosion
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
      // Decay explosion reflection
      const u = material.uniforms.uExplosionIntensity;
      if (u.value > 0.01) u.value *= 0.95;
    },
    /** Flash water reflections from firework burst */
    flashExplosion(position: THREE.Vector3, color: THREE.Color, intensity: number) {
      material.uniforms.uExplosionPos.value.copy(position);
      material.uniforms.uExplosionColor.value.copy(color);
      material.uniforms.uExplosionIntensity.value = Math.min(intensity, 3);
    },
    setWaveAmplitude(v: number) { material.uniforms.uWaveAmplitude.value = v; },
    setWindDirection(x: number, z: number) { material.uniforms.uWindDir.value.set(x, z); },
    setSunDirection(dir: THREE.Vector3) { material.uniforms.uSunDirection.value.copy(dir).normalize(); },
    setOpacity(v: number) { material.uniforms.uOpacity.value = v; },
  };
}

/** Water presets for venue types */
export const WATER_PRESETS = {
  lake: { waveAmplitude: 0.2, waveFrequency: 0.1, opacity: 0.9 },
  river: { waveAmplitude: 0.5, waveFrequency: 0.25, opacity: 0.8, windDirection: [1, 0] as [number, number] },
  ocean: { waveAmplitude: 1.2, waveFrequency: 0.08, opacity: 0.95 },
  puddle: { waveAmplitude: 0.05, waveFrequency: 0.5, opacity: 0.7, size: 30 },
} as const;
