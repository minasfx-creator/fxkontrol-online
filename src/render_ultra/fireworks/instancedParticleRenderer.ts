/**
 * FX KONTROL · GPU Instanced Particle Renderer
 * UE5.7 Niagara-style instanced rendering for high particle budgets.
 * Uses THREE.InstancedMesh with per-instance color + velocity stretching.
 */

import * as THREE from 'three';

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
    // Soft circular falloff
    vec2 center = vUv - 0.5;
    float dist = length(center);
    float core = exp(-dist * dist * 50.0);
    float glow = exp(-dist * dist * 12.0);
    float alpha = (core * 0.8 + glow * 0.3) * vOpacity;

    // Hot-core effect
    vec3 col = mix(vColor, vec3(1.1, 1.0, 0.9), core * 0.25);

    float edge = 1.0 - smoothstep(0.42, 0.5, dist);
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

  dispose() {
    this.mesh.geometry.dispose();
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
