/**
 * FX KONTROL · Heat Distortion / Haze Effect
 * Post-burst heat shimmer using animated noise-based UV distortion.
 * Niagara-style distortion material for shockwaves and thermal effects.
 */

import * as THREE from 'three';

// ── Distortion Shader ───────────────────────────────────────────────

const DISTORTION_VERTEX = `
  attribute float aSize;
  attribute float aIntensity;
  
  varying float vIntensity;
  varying vec4 vScreenPos;
  
  void main() {
    vIntensity = aIntensity;
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPos;
    vScreenPos = gl_Position;
    gl_PointSize = aSize * (300.0 / -mvPos.z);
  }
`;

const DISTORTION_FRAGMENT = `
  uniform sampler2D uSceneTexture;
  uniform float uDistortionStrength;
  uniform float uNoiseScale;
  uniform float uTime;
  uniform vec2 uResolution;
  
  varying float vIntensity;
  varying vec4 vScreenPos;
  
  // Simplex-style noise for distortion
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }
  
  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 4; i++) {
      value += amplitude * noise(p);
      p *= 2.0;
      amplitude *= 0.5;
    }
    return value;
  }
  
  void main() {
    // Distance from center for circular falloff
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float circleFade = 1.0 - smoothstep(0.0, 1.0, d);
    
    if (circleFade < 0.01) discard;
    
    // Screen-space UV
    vec2 screenUV = gl_FragCoord.xy / uResolution;
    
    // Animated noise distortion
    vec2 noiseCoord = gl_PointCoord * uNoiseScale + uTime * vec2(0.3, 0.7);
    float n1 = fbm(noiseCoord) - 0.5;
    float n2 = fbm(noiseCoord + vec2(5.2, 1.3)) - 0.5;
    
    // Apply distortion to scene UVs
    vec2 distortion = vec2(n1, n2) * uDistortionStrength * vIntensity * circleFade;
    vec2 distortedUV = screenUV + distortion;
    
    // Sample scene with distorted UVs
    vec4 sceneColor = texture2D(uSceneTexture, distortedUV);
    
    // Output with slight alpha to blend
    gl_FragColor = vec4(sceneColor.rgb, circleFade * vIntensity * 0.95);
  }
`;

// ── Shockwave Ring Shader ───────────────────────────────────────────

const SHOCKWAVE_VERTEX = `
  varying vec2 vUV;
  void main() {
    vUV = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SHOCKWAVE_FRAGMENT = `
  uniform sampler2D uSceneTexture;
  uniform float uProgress; // 0..1
  uniform float uDistortionStrength;
  uniform float uRingWidth;
  uniform vec2 uCenter; // screen-space center
  uniform vec2 uResolution;
  
  varying vec2 vUV;
  
  void main() {
    vec2 screenUV = gl_FragCoord.xy / uResolution;
    vec2 toCenter = screenUV - uCenter;
    float dist = length(toCenter);
    
    // Ring shape
    float ringRadius = uProgress * 0.5;
    float ringDist = abs(dist - ringRadius);
    float ringFade = 1.0 - smoothstep(0.0, uRingWidth, ringDist);
    
    // Distortion along radial direction
    vec2 distortion = normalize(toCenter) * ringFade * uDistortionStrength * (1.0 - uProgress);
    vec2 distortedUV = screenUV + distortion;
    
    vec4 sceneColor = texture2D(uSceneTexture, distortedUV);
    gl_FragColor = sceneColor;
  }
`;

// ── Heat Haze Emitter ───────────────────────────────────────────────

export interface HeatHazeParticle {
  position: THREE.Vector3;
  size: number;
  intensity: number;
  life: number;
  maxLife: number;
}

export class HeatHazeEmitter {
  private particles: HeatHazeParticle[] = [];
  private geometry: THREE.BufferGeometry;
  private material: THREE.ShaderMaterial;
  public mesh: THREE.Points;
  private maxParticles: number;
  private elapsed = 0;

  constructor(maxParticles = 64) {
    this.maxParticles = maxParticles;
    this.geometry = new THREE.BufferGeometry();

    const positions = new Float32Array(maxParticles * 3);
    const sizes = new Float32Array(maxParticles);
    const intensities = new Float32Array(maxParticles);

    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('aIntensity', new THREE.BufferAttribute(intensities, 1).setUsage(THREE.DynamicDrawUsage));

    this.material = new THREE.ShaderMaterial({
      vertexShader: DISTORTION_VERTEX,
      fragmentShader: DISTORTION_FRAGMENT,
      uniforms: {
        uSceneTexture: { value: null },
        uDistortionStrength: { value: 0.02 },
        uNoiseScale: { value: 8.0 },
        uTime: { value: 0 },
        uResolution: { value: new THREE.Vector2(1920, 1080) },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });

    this.mesh = new THREE.Points(this.geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 999; // Render after everything else
  }

  setSceneTexture(texture: THREE.Texture) {
    this.material.uniforms.uSceneTexture.value = texture;
  }

  setResolution(width: number, height: number) {
    this.material.uniforms.uResolution.value.set(width, height);
  }

  emit(origin: THREE.Vector3, count = 8, spread = 10, duration = 3) {
    for (let i = 0; i < count && this.particles.length < this.maxParticles; i++) {
      this.particles.push({
        position: origin.clone().add(new THREE.Vector3(
          (Math.random() - 0.5) * spread,
          Math.random() * spread * 0.3 + 2,
          (Math.random() - 0.5) * spread
        )),
        size: 30 + Math.random() * 40,
        intensity: 0.5 + Math.random() * 0.5,
        life: duration + Math.random() * duration * 0.5,
        maxLife: duration + Math.random() * duration * 0.5,
      });
    }
  }

  update(dt: number) {
    this.elapsed += dt;
    this.material.uniforms.uTime.value = this.elapsed;

    const pos = this.geometry.attributes.position.array as Float32Array;
    const sizes = this.geometry.attributes.aSize.array as Float32Array;
    const intensities = this.geometry.attributes.aIntensity.array as Float32Array;

    this.particles = this.particles.filter(p => p.life > 0);

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      p.life -= dt;
      const lifeRatio = Math.max(0, p.life / p.maxLife);

      // Drift upward
      p.position.y += dt * 1.5;
      p.size += dt * 5;

      const i3 = i * 3;
      pos[i3] = p.position.x;
      pos[i3 + 1] = p.position.y;
      pos[i3 + 2] = p.position.z;
      sizes[i] = p.size;
      intensities[i] = p.intensity * lifeRatio * lifeRatio;
    }

    for (let i = this.particles.length; i < this.maxParticles; i++) {
      intensities[i] = 0;
      pos[i * 3 + 1] = -1000;
    }

    this.geometry.attributes.position.needsUpdate = true;
    (this.geometry.attributes.aSize as THREE.BufferAttribute).needsUpdate = true;
    (this.geometry.attributes.aIntensity as THREE.BufferAttribute).needsUpdate = true;
    this.geometry.setDrawRange(0, this.particles.length);
  }

  get particleCount() { return this.particles.length; }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}

// ── Material Factories ──────────────────────────────────────────────

export function createDistortionMaterial(options: {
  distortionStrength?: number;
  noiseScale?: number;
  sceneTexture?: THREE.Texture | null;
} = {}): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: DISTORTION_VERTEX,
    fragmentShader: DISTORTION_FRAGMENT,
    uniforms: {
      uSceneTexture: { value: options.sceneTexture || null },
      uDistortionStrength: { value: options.distortionStrength || 0.02 },
      uNoiseScale: { value: options.noiseScale || 8.0 },
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(1920, 1080) },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
  });
}

export function createShockwaveMaterial(sceneTexture?: THREE.Texture): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: SHOCKWAVE_VERTEX,
    fragmentShader: SHOCKWAVE_FRAGMENT,
    uniforms: {
      uSceneTexture: { value: sceneTexture || null },
      uProgress: { value: 0 },
      uDistortionStrength: { value: 0.05 },
      uRingWidth: { value: 0.03 },
      uCenter: { value: new THREE.Vector2(0.5, 0.5) },
      uResolution: { value: new THREE.Vector2(1920, 1080) },
    },
    transparent: true,
    depthWrite: false,
  });
}
