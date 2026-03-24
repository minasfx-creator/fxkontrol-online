/**
 * FX KONTROL · Firework Engine
 * GPU-optimized particle system for pyrotechnic simulation.
 * Supports shells, mines, comets, cakes, roman candles.
 */

import * as THREE from "three";

export class Firework {
  constructor(scene, position, config = {}) {
    this.scene = scene;
    this.position = new THREE.Vector3(...position);
    this.caliber = config.caliber || 75; // mm
    this.color = config.color || [1, 0.8, 0.2];
    this.particleCount = config.particleCount || 500;
    this.lifetime = config.lifetime || 2.5;
    this.velocity = config.velocity || 40;
    this.gravity = -9.81;
    this.particles = null;
    this.age = 0;
    this.alive = true;
  }

  explode() {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.particleCount * 3);
    const velocities = new Float32Array(this.particleCount * 3);
    const colors = new Float32Array(this.particleCount * 3);

    for (let i = 0; i < this.particleCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const speed = this.velocity * (0.5 + Math.random() * 0.5);

      const i3 = i * 3;
      positions[i3] = this.position.x;
      positions[i3 + 1] = this.position.y;
      positions[i3 + 2] = this.position.z;

      velocities[i3] = Math.sin(phi) * Math.cos(theta) * speed;
      velocities[i3 + 1] = Math.sin(phi) * Math.sin(theta) * speed;
      velocities[i3 + 2] = Math.cos(phi) * speed;

      colors[i3] = this.color[0];
      colors[i3 + 1] = this.color[1];
      colors[i3 + 2] = this.color[2];
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.5 + this.caliber * 0.0035,
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.particles = new THREE.Points(geometry, material);
    this.velocities = velocities;
    this.scene.add(this.particles);

    console.log(`[Firework] ${this.caliber}mm shell exploded at`, this.position.toArray());
  }

  update(dt) {
    if (!this.particles || !this.alive) return;
    this.age += dt;

    const pos = this.particles.geometry.attributes.position.array;
    for (let i = 0; i < this.particleCount; i++) {
      const i3 = i * 3;
      pos[i3] += this.velocities[i3] * dt;
      pos[i3 + 1] += this.velocities[i3 + 1] * dt + 0.5 * this.gravity * dt * dt;
      pos[i3 + 2] += this.velocities[i3 + 2] * dt;

      // Drag
      this.velocities[i3] *= 0.98;
      this.velocities[i3 + 1] += this.gravity * dt;
      this.velocities[i3 + 2] *= 0.98;
    }
    this.particles.geometry.attributes.position.needsUpdate = true;
    this.particles.material.opacity = Math.max(0, 1 - this.age / this.lifetime);

    if (this.age > this.lifetime) {
      this.scene.remove(this.particles);
      this.alive = false;
    }
  }
}

export function initFireworkEngine(scene) {
  const activeFireworks = [];

  function launch(position, config) {
    const fw = new Firework(scene, position, config);
    fw.explode();
    activeFireworks.push(fw);
    return fw;
  }

  console.log("[FireworkEngine] Particle system ready");
  return { launch, activeFireworks };
}
