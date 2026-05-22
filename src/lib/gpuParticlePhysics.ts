/**
 * FX KONTROL · GPGPU Particle Physics Shader
 * 
 * Moves ALL particle physics (gravity, wind, drag, ballistic trajectory)
 * to the vertex shader. CPU only uploads startTime + seed per particle.
 * 
 * Physics equation computed on GPU per vertex:
 *   P(t) = P_start + V_start * t + 0.5 * A * t²
 * 
 * This eliminates thousands of per-frame JS position updates,
 * freeing the main thread for DMX/Network/Timeline processing.
 */

import * as THREE from 'three';

// ═══════════════════════════════════════════════════════════════════
// GPGPU Ballistic Vertex Shader
// ═══════════════════════════════════════════════════════════════════

export const GPGPU_BALLISTIC_VERTEX = `
  // Per-instance attributes (set once at spawn, never updated)
  attribute vec3 aStartPos;
  attribute vec3 aStartVel;
  attribute vec3 aColor;
  attribute float aStartTime;
  attribute float aLifetime;
  attribute float aSize;
  attribute float aSeed;

  // Uniforms (updated once per frame)
  uniform float uTime;
  uniform float uGravity;       // -9.81
  uniform vec3  uWind;          // world-space wind force
  uniform float uDrag;          // 0.01 - 0.3
  uniform float uHDRMultiplier; // 1.0 - 8.0

  varying vec3  vColor;
  varying float vOpacity;
  varying float vLifeRatio;

  // Pseudo-random from seed
  float hash(float n) {
    return fract(sin(n) * 43758.5453);
  }

  void main() {
    float t = uTime - aStartTime;
    
    // Dead particle — collapse to zero
    if (t < 0.0 || t > aLifetime) {
      gl_Position = vec4(0.0, 0.0, -999.0, 1.0);
      gl_PointSize = 0.0;
      vOpacity = 0.0;
      vColor = vec3(0.0);
      vLifeRatio = 0.0;
      return;
    }

    float lifeRatio = t / aLifetime;
    vLifeRatio = lifeRatio;

    // ─── Drag-damped velocity ───
    // v(t) = v0 * e^(-drag * t) + (wind / drag) * (1 - e^(-drag * t))
    float dragDecay = exp(-uDrag * t);
    vec3 vel = aStartVel * dragDecay;
    
    // Wind integration with drag
    if (uDrag > 0.001) {
      vel += (uWind / uDrag) * (1.0 - dragDecay);
    }

    // ─── Position: P = P0 + integral of velocity ───
    // Analytical integration of drag-damped motion
    vec3 pos = aStartPos;
    
    if (uDrag > 0.001) {
      // Position from drag-damped velocity integral
      pos += (aStartVel / uDrag) * (1.0 - dragDecay);
      pos += (uWind / (uDrag * uDrag)) * (t - (1.0 - dragDecay) / uDrag);
    } else {
      pos += aStartVel * t + uWind * 0.5 * t * t;
    }

    // Gravity (constant acceleration, not affected by drag for simplicity)
    pos.y += 0.5 * uGravity * t * t;

    // Small turbulence from seed
    float turb = hash(aSeed + t * 3.0) * 0.15;
    pos.x += sin(t * 2.0 + aSeed) * turb;
    pos.z += cos(t * 2.5 + aSeed * 1.3) * turb;

    // ─── Thermal color cycle (white-hot → saturated → ember) ───
    vec3 color = aColor;
    if (lifeRatio < 0.15) {
      // White-hot core phase
      color = mix(vec3(1.0, 1.0, 0.95) * uHDRMultiplier, aColor, lifeRatio / 0.15);
    } else if (lifeRatio > 0.7) {
      // Ember fade
      float emberT = (lifeRatio - 0.7) / 0.3;
      color = mix(aColor, aColor * 0.2, emberT);
    }
    vColor = color;

    // ─── Opacity curve ───
    float fadeIn = smoothstep(0.0, 0.05, lifeRatio);
    float fadeOut = 1.0 - smoothstep(0.7, 1.0, lifeRatio);
    vOpacity = fadeIn * fadeOut;

    // ─── Size with distance attenuation ───
    vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPos;
    
    float distAtten = 300.0 / max(1.0, -mvPos.z);
    float sizeDecay = 1.0 - lifeRatio * 0.3;
    gl_PointSize = max(1.0, aSize * distAtten * sizeDecay);
  }
`;

export const GPGPU_BALLISTIC_FRAGMENT = `
  varying vec3  vColor;
  varying float vOpacity;
  varying float vLifeRatio;

  void main() {
    // Circular soft particle
    vec2 coord = gl_PointCoord - 0.5;
    float dist = length(coord);
    
    float core = exp(-dist * dist * 80.0);
    float glow = exp(-dist * dist * 15.0);
    float alpha = (core * 0.9 + glow * 0.2) * vOpacity;
    
    if (alpha < 0.005) discard;
    
    // Hot core whitening
    vec3 col = mix(vColor, vec3(1.0, 1.0, 0.95), core * 0.35 * (1.0 - vLifeRatio));
    
    gl_FragColor = vec4(col, alpha);
  }
`;

// ═══════════════════════════════════════════════════════════════════
// GPU Particle System — Zero CPU physics per frame
// ═══════════════════════════════════════════════════════════════════

export interface GPUParticleConfig {
  maxParticles: number;
  gravity: number;
  drag: number;
  hdrMultiplier: number;
}

const DEFAULT_GPU_CONFIG: GPUParticleConfig = {
  maxParticles: 8192,
  gravity: -9.81,
  drag: 0.08,
  hdrMultiplier: 4.5,
};

export class GPUParticleSystem {
  readonly points: THREE.Points;
  private material: THREE.ShaderMaterial;
  private maxParticles: number;
  private _spawnCursor = 0;

  // Pre-allocated typed arrays (never reallocated)
  private startPosArr: Float32Array;
  private startVelArr: Float32Array;
  private colorArr: Float32Array;
  private startTimeArr: Float32Array;
  private lifetimeArr: Float32Array;
  private sizeArr: Float32Array;
  private seedArr: Float32Array;

  constructor(config?: Partial<GPUParticleConfig>) {
    const cfg = { ...DEFAULT_GPU_CONFIG, ...config };
    this.maxParticles = cfg.maxParticles;

    const n = cfg.maxParticles;
    this.startPosArr = new Float32Array(n * 3);
    this.startVelArr = new Float32Array(n * 3);
    this.colorArr = new Float32Array(n * 3);
    this.startTimeArr = new Float32Array(n).fill(-999); // All dead initially
    this.lifetimeArr = new Float32Array(n).fill(1);
    this.sizeArr = new Float32Array(n).fill(2);
    this.seedArr = new Float32Array(n);

    // Pre-seed random values
    for (let i = 0; i < n; i++) {
      this.seedArr[i] = Math.random() * 1000;
    }

    const geometry = new THREE.BufferGeometry();
    // Dummy position (shader computes real position)
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    geometry.setAttribute('aStartPos', new THREE.BufferAttribute(this.startPosArr, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('aStartVel', new THREE.BufferAttribute(this.startVelArr, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('aColor', new THREE.BufferAttribute(this.colorArr, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('aStartTime', new THREE.BufferAttribute(this.startTimeArr, 1).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('aLifetime', new THREE.BufferAttribute(this.lifetimeArr, 1).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(this.sizeArr, 1).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(this.seedArr, 1));

    this.material = new THREE.ShaderMaterial({
      vertexShader: GPGPU_BALLISTIC_VERTEX,
      fragmentShader: GPGPU_BALLISTIC_FRAGMENT,
      uniforms: {
        uTime: { value: 0 },
        uGravity: { value: cfg.gravity },
        uWind: { value: new THREE.Vector3(0, 0, 0) },
        uDrag: { value: cfg.drag },
        uHDRMultiplier: { value: cfg.hdrMultiplier },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.points = new THREE.Points(geometry, this.material);
    this.points.frustumCulled = false;
  }

  /**
   * Spawn particles — only writes to attribute buffers, no per-frame cost.
   * @returns number of particles actually spawned
   */
  spawn(
    count: number,
    currentTime: number,
    position: THREE.Vector3,
    velocityMin: THREE.Vector3,
    velocityMax: THREE.Vector3,
    color: THREE.Color,
    lifetime: [number, number],
    size: [number, number],
  ): number {
    const n = Math.min(count, this.maxParticles);
    const geo = this.points.geometry;
    const startPos = geo.getAttribute('aStartPos') as THREE.BufferAttribute;
    const startVel = geo.getAttribute('aStartVel') as THREE.BufferAttribute;
    const colorAttr = geo.getAttribute('aColor') as THREE.BufferAttribute;
    const startTime = geo.getAttribute('aStartTime') as THREE.BufferAttribute;
    const lifetimeAttr = geo.getAttribute('aLifetime') as THREE.BufferAttribute;
    const sizeAttr = geo.getAttribute('aSize') as THREE.BufferAttribute;

    for (let i = 0; i < n; i++) {
      const idx = (this._spawnCursor + i) % this.maxParticles;
      const i3 = idx * 3;

      this.startPosArr[i3] = position.x;
      this.startPosArr[i3 + 1] = position.y;
      this.startPosArr[i3 + 2] = position.z;

      this.startVelArr[i3] = THREE.MathUtils.lerp(velocityMin.x, velocityMax.x, Math.random());
      this.startVelArr[i3 + 1] = THREE.MathUtils.lerp(velocityMin.y, velocityMax.y, Math.random());
      this.startVelArr[i3 + 2] = THREE.MathUtils.lerp(velocityMin.z, velocityMax.z, Math.random());

      this.colorArr[i3] = color.r;
      this.colorArr[i3 + 1] = color.g;
      this.colorArr[i3 + 2] = color.b;

      this.startTimeArr[idx] = currentTime;
      this.lifetimeArr[idx] = THREE.MathUtils.lerp(lifetime[0], lifetime[1], Math.random());
      this.sizeArr[idx] = THREE.MathUtils.lerp(size[0], size[1], Math.random());
    }

    this._spawnCursor = (this._spawnCursor + n) % this.maxParticles;

    startPos.needsUpdate = true;
    startVel.needsUpdate = true;
    colorAttr.needsUpdate = true;
    startTime.needsUpdate = true;
    lifetimeAttr.needsUpdate = true;
    sizeAttr.needsUpdate = true;

    return n;
  }

  /**
   * Per-frame update — ONLY updates the time uniform.
   * Zero CPU physics, zero buffer writes per frame.
   */
  update(time: number, wind?: THREE.Vector3): void {
    this.material.uniforms.uTime.value = time;
    if (wind) {
      this.material.uniforms.uWind.value.copy(wind);
    }
  }

  setGravity(g: number): void {
    this.material.uniforms.uGravity.value = g;
  }

  setDrag(d: number): void {
    this.material.uniforms.uDrag.value = d;
  }

  setHDRMultiplier(m: number): void {
    this.material.uniforms.uHDRMultiplier.value = m;
  }

  dispose(): void {
    this.points.geometry.dispose();
    this.material.dispose();
  }
}

/**
 * Create a preconfigured GPGPU particle system for firework bursts.
 */
export function createGPGPUBurstSystem(maxParticles = 8192): GPUParticleSystem {
  return new GPUParticleSystem({
    maxParticles,
    gravity: -9.81,
    drag: 0.08,
    hdrMultiplier: 4.5,
  });
}

/**
 * Create a GPGPU system for drone LED trail particles.
 */
export function createGPGPUDroneTrailSystem(maxParticles = 4096): GPUParticleSystem {
  return new GPUParticleSystem({
    maxParticles,
    gravity: 0,       // Drone trails float
    drag: 0.3,        // Quick fade
    hdrMultiplier: 2.0,
  });
}
