/**
 * FX KONTROL · GPU Instanced Particle Renderer
 * UE5.7 Niagara-style instanced rendering for high particle budgets.
 * Uses THREE.InstancedMesh with per-instance color + velocity stretching.
 */

import * as THREE from 'three';
import { createCinemaFireMaterial } from './cinemaFireShader';
import { createCinemaSmokeMaterial } from './cinemaSmokeShader';
import { createCinemaBurstMaterial } from './cinemaBurstShader';

export type ShaderMode = 'default' | 'cinema-fire' | 'cinema-smoke' | 'cinema-burst';

const INSTANCED_VERTEX = `
  attribute vec3 instanceColor;
  attribute float instanceOpacity;
  attribute float instanceScale;
  attribute vec3 instanceVelocity;

  uniform float uVelocityStretch;
  uniform float uTime;

  varying vec3 vColor;
  varying float vOpacity;
  varying vec2 vUv;

  void main() {
    vColor = instanceColor;
    vOpacity = instanceOpacity;
    vUv = uv;

    vec3 pos = position;

    // ─── Velocity stretching ───
    if (uVelocityStretch > 0.0) {
      float speed = length(instanceVelocity);
      if (speed > 0.1) {
        vec3 velDir = instanceVelocity / speed;
        // Stretch along velocity direction in local space
        float stretchFactor = 1.0 + speed * uVelocityStretch * 0.05;
        // Project position onto velocity direction and stretch
        float proj = dot(pos, velDir);
        pos += velDir * proj * (stretchFactor - 1.0);
      }
    }

    // Apply instance scale
    pos *= instanceScale;

    // Instance transform
    vec4 mvPos = modelViewMatrix * instanceMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPos;
  }
`;

const INSTANCED_FRAGMENT = `
  varying vec3 vColor;
  varying float vOpacity;
  varying vec2 vUv;

  void main() {
    vec2 center = vUv - 0.5;
    float dist = length(center);

    // Multi-layer falloff: tight core + mid glow + soft halo
    float core = exp(-dist * dist * 65.0);
    float mid = exp(-dist * dist * 18.0);
    float outer = exp(-dist * dist * 5.0);
    float alpha = (core * 0.5 + mid * 0.35 + outer * 0.15) * vOpacity;

    // Hot-core whitening (calibrated for bloom threshold 1.2)
    vec3 col = mix(vColor, vec3(1.15, 1.08, 0.98), core * 0.35);
    // Warm mid-glow tint
    col = mix(col, vColor * 1.1, mid * 0.2);

    float edge = 1.0 - smoothstep(0.42, 0.50, dist);
    gl_FragColor = vec4(col, alpha * edge);
  }
`;

export interface InstancedParticleConfig {
  maxParticles: number;
  velocityStretch: boolean;
  stretchScale: number;
  blendMode: 'additive' | 'normal';
}

const DEFAULT_CONFIG: InstancedParticleConfig = {
  maxParticles: 4096,
  velocityStretch: true,
  stretchScale: 0.4,
  blendMode: 'additive',
};

export class InstancedParticleRenderer {
  readonly mesh: THREE.InstancedMesh;
  private colorAttr: THREE.InstancedBufferAttribute;
  private opacityAttr: THREE.InstancedBufferAttribute;
  private scaleAttr: THREE.InstancedBufferAttribute;
  private velocityAttr: THREE.InstancedBufferAttribute;
  private material: THREE.ShaderMaterial;
  private maxParticles: number;
  private _dummy = new THREE.Object3D();
  private _activeCount = 0;
  private _shaderMode: ShaderMode = 'default';
  private _cinemaAttrs: Map<string, THREE.InstancedBufferAttribute> = new Map();
  
  constructor(config?: Partial<InstancedParticleConfig>) {
    const cfg = { ...DEFAULT_CONFIG, ...config };
    this.maxParticles = cfg.maxParticles;

    // Billboard quad geometry
    const baseGeo = new THREE.PlaneGeometry(1, 1);

    // Create shader material
    this.material = new THREE.ShaderMaterial({
      vertexShader: INSTANCED_VERTEX,
      fragmentShader: INSTANCED_FRAGMENT,
      uniforms: {
        uVelocityStretch: { value: cfg.velocityStretch ? cfg.stretchScale : 0 },
        uTime: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: cfg.blendMode === 'additive' ? THREE.AdditiveBlending : THREE.NormalBlending,
      side: THREE.DoubleSide,
    });

    // Create instanced mesh
    this.mesh = new THREE.InstancedMesh(baseGeo, this.material, cfg.maxParticles);
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    // Per-instance attributes
    const colorData = new Float32Array(cfg.maxParticles * 3);
    const opacityData = new Float32Array(cfg.maxParticles);
    const scaleData = new Float32Array(cfg.maxParticles);
    const velocityData = new Float32Array(cfg.maxParticles * 3);

    this.colorAttr = new THREE.InstancedBufferAttribute(colorData, 3);
    this.opacityAttr = new THREE.InstancedBufferAttribute(opacityData, 1);
    this.scaleAttr = new THREE.InstancedBufferAttribute(scaleData, 1);
    this.velocityAttr = new THREE.InstancedBufferAttribute(velocityData, 3);

    this.colorAttr.setUsage(THREE.DynamicDrawUsage);
    this.opacityAttr.setUsage(THREE.DynamicDrawUsage);
    this.scaleAttr.setUsage(THREE.DynamicDrawUsage);
    this.velocityAttr.setUsage(THREE.DynamicDrawUsage);

    baseGeo.setAttribute('instanceColor', this.colorAttr);
    baseGeo.setAttribute('instanceOpacity', this.opacityAttr);
    baseGeo.setAttribute('instanceScale', this.scaleAttr);
    baseGeo.setAttribute('instanceVelocity', this.velocityAttr);

    // Initially hide all instances
    this.mesh.count = 0;
  }

  get activeCount() { return this._activeCount; }

  /**
   * Write particle data to instance buffers.
   * @param particles Array of { position, velocity, color, size, opacity }
   * @param camera Camera for billboard orientation
   */
  writeParticles(
    particles: Array<{
      position: THREE.Vector3;
      velocity: THREE.Vector3;
      color: THREE.Color;
      size: number;
      opacity: number;
    }>,
    camera?: THREE.Camera,
  ) {
    const count = Math.min(particles.length, this.maxParticles);
    this._activeCount = count;

    for (let i = 0; i < count; i++) {
      const p = particles[i];

      // Set instance matrix (position + billboard orientation)
      this._dummy.position.copy(p.position);
      if (camera) {
        this._dummy.quaternion.copy(camera.quaternion);
      }
      this._dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this._dummy.matrix);

      // Per-instance attributes
      this.colorAttr.setXYZ(i, p.color.r, p.color.g, p.color.b);
      this.opacityAttr.setX(i, p.opacity);
      this.scaleAttr.setX(i, p.size);
      this.velocityAttr.setXYZ(i, p.velocity.x, p.velocity.y, p.velocity.z);
    }

    this.mesh.count = count;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.colorAttr.needsUpdate = true;
    this.opacityAttr.needsUpdate = true;
    this.scaleAttr.needsUpdate = true;
    this.velocityAttr.needsUpdate = true;
  }

  update(time: number) {
    this.material.uniforms.uTime.value = time;
  }

  /**
   * Switch to a cinema-grade shader mode.
   * When switching to cinema-fire, extra per-instance attributes are injected.
   */
  setShaderMode(mode: ShaderMode) {
    if (mode === this._shaderMode) return;
    this._shaderMode = mode;

    // Dispose old material
    this.material.dispose();

    switch (mode) {
      case 'cinema-fire':
        this.material = createCinemaFireMaterial();
        this._ensureCinemaFireAttrs();
        break;
      case 'cinema-smoke':
        this.material = createCinemaSmokeMaterial();
        break;
      case 'cinema-burst':
        this.material = createCinemaBurstMaterial();
        break;
      default:
        this.material = this._createDefaultMaterial();
        break;
    }

    this.mesh.material = this.material;
  }

  get shaderMode(): ShaderMode { return this._shaderMode; }

  /** Write cinema-fire per-instance data (temperature, life, maxLife, seed). */
  writeCinemaFireData(data: Array<{ temperature: number; life: number; maxLife: number; seed: number }>) {
    const tempAttr = this._cinemaAttrs.get('aTemperature');
    const lifeAttr = this._cinemaAttrs.get('aLife');
    const maxLifeAttr = this._cinemaAttrs.get('aMaxLife');
    const seedAttr = this._cinemaAttrs.get('aSeed');
    if (!tempAttr || !lifeAttr || !maxLifeAttr || !seedAttr) return;

    const count = Math.min(data.length, this.maxParticles);
    for (let i = 0; i < count; i++) {
      tempAttr.setX(i, data[i].temperature);
      lifeAttr.setX(i, data[i].life);
      maxLifeAttr.setX(i, data[i].maxLife);
      seedAttr.setX(i, data[i].seed);
    }
    tempAttr.needsUpdate = true;
    lifeAttr.needsUpdate = true;
    maxLifeAttr.needsUpdate = true;
    seedAttr.needsUpdate = true;
  }

  /** Write cinema-smoke per-instance data (life, maxLife). */
  writeCinemaSmokeData(data: Array<{ life: number; maxLife: number }>) {
    this._ensureCinemaSmokeAttrs();
    const lifeAttr = this._cinemaAttrs.get('aLife');
    const maxLifeAttr = this._cinemaAttrs.get('aMaxLife');
    if (!lifeAttr || !maxLifeAttr) return;

    const count = Math.min(data.length, this.maxParticles);
    for (let i = 0; i < count; i++) {
      lifeAttr.setX(i, data[i].life);
      maxLifeAttr.setX(i, data[i].maxLife);
    }
    lifeAttr.needsUpdate = true;
    maxLifeAttr.needsUpdate = true;
  }

  /** Write cinema-burst per-instance data (life, maxLife, energy). */
  writeCinemaBurstData(data: Array<{ life: number; maxLife: number; energy: number }>) {
    this._ensureCinemaBurstAttrs();
    const lifeAttr = this._cinemaAttrs.get('aLife');
    const maxLifeAttr = this._cinemaAttrs.get('aMaxLife');
    const energyAttr = this._cinemaAttrs.get('aEnergy');
    if (!lifeAttr || !maxLifeAttr || !energyAttr) return;

    const count = Math.min(data.length, this.maxParticles);
    for (let i = 0; i < count; i++) {
      lifeAttr.setX(i, data[i].life);
      maxLifeAttr.setX(i, data[i].maxLife);
      energyAttr.setX(i, data[i].energy);
    }
    lifeAttr.needsUpdate = true;
    maxLifeAttr.needsUpdate = true;
    energyAttr.needsUpdate = true;
  }

  /**
   * Bridge: write directly from GPUComputeParticleSystem SoA data.
   * Reads position, velocity, color (from temperature), size, opacity, and
   * cinema-specific attributes from the SoA buffers.
   */
  writeFromComputeData(
    cpuData: {
      posX: Float32Array; posY: Float32Array; posZ: Float32Array;
      age: Float32Array;
      velX: Float32Array; velY: Float32Array; velZ: Float32Array;
      life: Float32Array;
      colorR: Float32Array; colorG: Float32Array; colorB: Float32Array;
      brightness: Float32Array;
      temperature: Float32Array;
      size: Float32Array;
      smoke: Float32Array;
      particleType: Float32Array;
    },
    activeCount: number,
    camera?: THREE.Camera,
  ) {
    const count = Math.min(activeCount, this.maxParticles);
    this._activeCount = count;

    for (let i = 0; i < count; i++) {
      // Position + billboard
      this._dummy.position.set(cpuData.posX[i], cpuData.posY[i], cpuData.posZ[i]);
      if (camera) this._dummy.quaternion.copy(camera.quaternion);
      this._dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this._dummy.matrix);

      // Color directly from compute data
      this.colorAttr.setXYZ(i, cpuData.colorR[i], cpuData.colorG[i], cpuData.colorB[i]);

      // Opacity from age/life ratio * brightness
      const lr = cpuData.age[i] / Math.max(cpuData.life[i], 0.001);
      this.opacityAttr.setX(i, Math.max(0, (1 - lr)) * cpuData.brightness[i]);
      this.scaleAttr.setX(i, cpuData.size[i]);
      this.velocityAttr.setXYZ(i, cpuData.velX[i], cpuData.velY[i], cpuData.velZ[i]);
    }

    this.mesh.count = count;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.colorAttr.needsUpdate = true;
    this.opacityAttr.needsUpdate = true;
    this.scaleAttr.needsUpdate = true;
    this.velocityAttr.needsUpdate = true;
  }

  private _ensureCinemaFireAttrs() {
    const geo = this.mesh.geometry;
    const names = ['aTemperature', 'aLife', 'aMaxLife', 'aSeed'];
    for (const name of names) {
      if (!this._cinemaAttrs.has(name)) {
        const arr = new Float32Array(this.maxParticles);
        const attr = new THREE.InstancedBufferAttribute(arr, 1);
        attr.setUsage(THREE.DynamicDrawUsage);
        this._cinemaAttrs.set(name, attr);
      }
      geo.setAttribute(name, this._cinemaAttrs.get(name)!);
    }
  }

  private _ensureCinemaSmokeAttrs() {
    const geo = this.mesh.geometry;
    const names = ['aLife', 'aMaxLife'];
    for (const name of names) {
      if (!this._cinemaAttrs.has(name)) {
        const arr = new Float32Array(this.maxParticles);
        const attr = new THREE.InstancedBufferAttribute(arr, 1);
        attr.setUsage(THREE.DynamicDrawUsage);
        this._cinemaAttrs.set(name, attr);
      }
      geo.setAttribute(name, this._cinemaAttrs.get(name)!);
    }
  }

  private _ensureCinemaBurstAttrs() {
    const geo = this.mesh.geometry;
    const names = ['aLife', 'aMaxLife', 'aEnergy'];
    for (const name of names) {
      if (!this._cinemaAttrs.has(name)) {
        const arr = new Float32Array(this.maxParticles);
        const attr = new THREE.InstancedBufferAttribute(arr, 1);
        attr.setUsage(THREE.DynamicDrawUsage);
        this._cinemaAttrs.set(name, attr);
      }
      geo.setAttribute(name, this._cinemaAttrs.get(name)!);
    }
  }

  private _createDefaultMaterial(): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      vertexShader: INSTANCED_VERTEX,
      fragmentShader: INSTANCED_FRAGMENT,
      uniforms: {
        uVelocityStretch: { value: 0.4 },
        uTime: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
  }

  dispose() {
    // Detach instanced mesh from any parent so it can be GC'd.
    this.mesh.parent?.remove(this.mesh);
    // Remove cinema per-instance attribute references — the buffers are
    // owned by the geometry and freed by geometry.dispose() below, but
    // the Map itself must be cleared so the renderer instance is collectable.
    this._cinemaAttrs.clear();
    // Geometry frees all attached BufferAttributes (including instanced ones).
    this.mesh.geometry.dispose();
    // Active material (may be the latest one set via setShaderMode).
    this.material.dispose();
  }
}

/**
 * Create a preconfigured instanced renderer for spark/ember particles.
 */
export function createSparkInstancedRenderer(maxParticles = 4096) {
  return new InstancedParticleRenderer({
    maxParticles,
    velocityStretch: true,
    stretchScale: 0.4,
    blendMode: 'additive',
  });
}

/**
 * Create a preconfigured instanced renderer for smoke particles.
 */
export function createSmokeInstancedRenderer(maxParticles = 2048) {
  return new InstancedParticleRenderer({
    maxParticles,
    velocityStretch: false,
    stretchScale: 0,
    blendMode: 'normal',
  });
}
