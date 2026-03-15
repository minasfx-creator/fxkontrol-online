/**
 * FX KONTROL · Volumetric Smoke Simulation
 * GPU-friendly smoke particle system for afterglow haze and burst smoke clouds.
 */

import * as THREE from 'three';

export interface SmokeParticle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  size: number;
  opacity: number;
  color: THREE.Color;
  turbulence: number;
}

const SMOKE_VERTEX = `
  attribute float aSize;
  attribute float aOpacity;
  attribute vec3 aColor;
  varying float vOpacity;
  varying vec3 vColor;
  void main() {
    vOpacity = aOpacity;
    vColor = aColor;
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPos;
    gl_PointSize = aSize * (300.0 / -mvPos.z);
  }
`;

const SMOKE_FRAGMENT = `
  varying float vOpacity;
  varying vec3 vColor;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    // Soft gaussian falloff for volumetric look
    float alpha = exp(-d * d * 2.5) * vOpacity;
    if (alpha < 0.005) discard;
    gl_FragColor = vec4(vColor, alpha);
  }
`;

export class SmokeSystem {
  private particles: SmokeParticle[] = [];
  private geometry: THREE.BufferGeometry;
  private material: THREE.ShaderMaterial;
  public mesh: THREE.Points;
  private maxParticles: number;

  constructor(maxParticles = 4096) {
    this.maxParticles = maxParticles;
    this.geometry = new THREE.BufferGeometry();

    const positions = new Float32Array(maxParticles * 3);
    const sizes = new Float32Array(maxParticles);
    const opacities = new Float32Array(maxParticles);
    const colors = new Float32Array(maxParticles * 3);

    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('aOpacity', new THREE.BufferAttribute(opacities, 1).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3).setUsage(THREE.DynamicDrawUsage));

    this.material = new THREE.ShaderMaterial({
      vertexShader: SMOKE_VERTEX,
      fragmentShader: SMOKE_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });

    this.mesh = new THREE.Points(this.geometry, this.material);
    this.mesh.frustumCulled = false;
  }

  emit(origin: THREE.Vector3, count: number, smokeColor: THREE.Color, spread = 15) {
    for (let i = 0; i < count && this.particles.length < this.maxParticles; i++) {
      this.particles.push({
        position: origin.clone().add(new THREE.Vector3(
          (Math.random() - 0.5) * spread,
          Math.random() * spread * 0.5,
          (Math.random() - 0.5) * spread
        )),
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 2,
          1.5 + Math.random() * 2,
          (Math.random() - 0.5) * 2
        ),
        life: 4 + Math.random() * 4,
        maxLife: 4 + Math.random() * 4,
        size: 15 + Math.random() * 25,
        opacity: 0.15 + Math.random() * 0.15,
        color: smokeColor.clone(),
        turbulence: 0.5 + Math.random(),
      });
    }
  }

  update(dt: number, windX = 0, windZ = 0) {
    const pos = this.geometry.attributes.position.array as Float32Array;
    const sizes = this.geometry.attributes.aSize.array as Float32Array;
    const opacities = this.geometry.attributes.aOpacity.array as Float32Array;
    const cols = this.geometry.attributes.aColor.array as Float32Array;

    // Remove dead particles
    this.particles = this.particles.filter(p => p.life > 0);

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      p.life -= dt;
      const lifeRatio = Math.max(0, p.life / p.maxLife);

      // Buoyancy + turbulence
      p.velocity.y += 0.3 * dt;
      p.velocity.x += (Math.random() - 0.5) * p.turbulence * dt + windX * dt * 0.5;
      p.velocity.z += (Math.random() - 0.5) * p.turbulence * dt + windZ * dt * 0.5;
      p.velocity.multiplyScalar(0.98);

      p.position.add(p.velocity.clone().multiplyScalar(dt));
      p.size += dt * 3; // expand over time
      p.opacity = p.opacity * lifeRatio * lifeRatio; // quadratic fade

      const i3 = i * 3;
      pos[i3] = p.position.x;
      pos[i3 + 1] = p.position.y;
      pos[i3 + 2] = p.position.z;
      sizes[i] = p.size;
      opacities[i] = Math.max(0, p.opacity);
      cols[i3] = p.color.r;
      cols[i3 + 1] = p.color.g;
      cols[i3 + 2] = p.color.b;
    }

    // Zero out unused
    for (let i = this.particles.length; i < this.maxParticles; i++) {
      opacities[i] = 0;
      const i3 = i * 3;
      pos[i3 + 1] = -1000;
    }

    this.geometry.attributes.position.needsUpdate = true;
    (this.geometry.attributes.aSize as THREE.BufferAttribute).needsUpdate = true;
    (this.geometry.attributes.aOpacity as THREE.BufferAttribute).needsUpdate = true;
    (this.geometry.attributes.aColor as THREE.BufferAttribute).needsUpdate = true;
    this.geometry.setDrawRange(0, this.particles.length);
  }

  get particleCount() { return this.particles.length; }
}
