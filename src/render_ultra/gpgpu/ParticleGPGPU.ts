/**
 * ParticleGPGPU — GPU-driven particle physics via DataTexture ping-pong.
 *
 * Stores position (xyz + life) and velocity (xyz + mass) in two RGBA Float
 * DataTextures. A fullscreen quad fragment shader reads the previous state,
 * applies gravity, drag, wind, and writes the new state via render-to-texture.
 *
 * Supports 1M+ particles with zero CPU physics cost.
 *
 * Usage:
 *   const gpgpu = new ParticleGPGPU(renderer, 512); // 512×512 = 262144 particles
 *   gpgpu.setWind(2, 0, -1);
 *   gpgpu.setGravity(9.81);
 *   // In render loop:
 *   gpgpu.compute(dt);
 *   // Read textures for instanced rendering:
 *   material.uniforms.uPositionTex.value = gpgpu.getPositionTexture();
 *   material.uniforms.uVelocityTex.value = gpgpu.getVelocityTexture();
 */

import * as THREE from 'three';

// ── Compute shader (runs as fullscreen quad fragment) ──

const COMPUTE_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

const POSITION_UPDATE_FRAGMENT = /* glsl */ `
  precision highp float;
  uniform sampler2D uPositionTex; // xyz = position, w = remaining life
  uniform sampler2D uVelocityTex; // xyz = velocity, w = mass
  uniform float uDt;
  varying vec2 vUv;

  void main() {
    vec4 pos = texture2D(uPositionTex, vUv);
    vec4 vel = texture2D(uVelocityTex, vUv);
    
    // Dead particle — don't update
    if (pos.w <= 0.0) {
      gl_FragColor = pos;
      return;
    }
    
    // Integrate position
    pos.xyz += vel.xyz * uDt;
    
    // Decrease life
    pos.w -= uDt;
    
    gl_FragColor = pos;
  }
`;

const VELOCITY_UPDATE_FRAGMENT = /* glsl */ `
  precision highp float;
  uniform sampler2D uPositionTex;
  uniform sampler2D uVelocityTex;
  uniform float uDt;
  uniform float uGravity;
  uniform float uDragCoefficient;
  uniform vec3 uWind;
  varying vec2 vUv;

  void main() {
    vec4 pos = texture2D(uPositionTex, vUv);
    vec4 vel = texture2D(uVelocityTex, vUv);
    
    // Dead particle
    if (pos.w <= 0.0) {
      gl_FragColor = vec4(0.0);
      return;
    }
    
    float mass = max(vel.w, 0.001);
    
    // Gravity
    vel.y -= uGravity * uDt;
    
    // Wind force
    vec3 relVel = vel.xyz - uWind;
    
    // Quadratic drag: F_drag = -0.5 * Cd * |v| * v
    float speed = length(relVel);
    if (speed > 0.001) {
      vec3 dragForce = -uDragCoefficient * speed * relVel;
      vel.xyz += (dragForce / mass) * uDt;
    }
    
    gl_FragColor = vel;
  }
`;

// ── Scratch objects (zero-alloc) ──
const _orthoCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const _quadGeometry = new THREE.PlaneGeometry(2, 2);

export class ParticleGPGPU {
  private renderer: THREE.WebGLRenderer;
  readonly textureSize: number;
  readonly maxParticles: number;

  // Ping-pong render targets
  private positionRT: [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget];
  private velocityRT: [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget];
  private currentIndex = 0;

  // Compute materials
  private positionMaterial: THREE.ShaderMaterial;
  private velocityMaterial: THREE.ShaderMaterial;
  private computeMesh: THREE.Mesh;
  private computeScene: THREE.Scene;

  // Physics params
  private gravity = 9.81;
  private dragCoefficient = 0.47;
  private wind = new THREE.Vector3(0, 0, 0);

  constructor(renderer: THREE.WebGLRenderer, textureSize = 256) {
    this.renderer = renderer;
    this.textureSize = textureSize;
    this.maxParticles = textureSize * textureSize;

    // Create render targets (RGBA Float)
    const rtOptions: THREE.WebGLRenderTargetOptions = {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat,
      type: THREE.FloatType,
      depthBuffer: false,
      stencilBuffer: false,
    };

    this.positionRT = [
      new THREE.WebGLRenderTarget(textureSize, textureSize, rtOptions),
      new THREE.WebGLRenderTarget(textureSize, textureSize, rtOptions),
    ];
    this.velocityRT = [
      new THREE.WebGLRenderTarget(textureSize, textureSize, rtOptions),
      new THREE.WebGLRenderTarget(textureSize, textureSize, rtOptions),
    ];

    // Position update material
    this.positionMaterial = new THREE.ShaderMaterial({
      vertexShader: COMPUTE_VERTEX,
      fragmentShader: POSITION_UPDATE_FRAGMENT,
      uniforms: {
        uPositionTex: { value: null },
        uVelocityTex: { value: null },
        uDt: { value: 0 },
      },
      depthWrite: false,
      depthTest: false,
    });

    // Velocity update material
    this.velocityMaterial = new THREE.ShaderMaterial({
      vertexShader: COMPUTE_VERTEX,
      fragmentShader: VELOCITY_UPDATE_FRAGMENT,
      uniforms: {
        uPositionTex: { value: null },
        uVelocityTex: { value: null },
        uDt: { value: 0 },
        uGravity: { value: this.gravity },
        uDragCoefficient: { value: this.dragCoefficient },
        uWind: { value: this.wind },
      },
      depthWrite: false,
      depthTest: false,
    });

    // Compute mesh (shared quad)
    this.computeMesh = new THREE.Mesh(_quadGeometry, this.positionMaterial);
    this.computeScene = new THREE.Scene();
    this.computeScene.add(this.computeMesh);
  }

  // ── Physics setters ──

  setGravity(g: number): void {
    this.gravity = g;
    this.velocityMaterial.uniforms.uGravity.value = g;
  }

  setDrag(cd: number): void {
    this.dragCoefficient = cd;
    this.velocityMaterial.uniforms.uDragCoefficient.value = cd;
  }

  setWind(x: number, y: number, z: number): void {
    this.wind.set(x, y, z);
  }

  // ── Seed particles from CPU data ──

  seedParticles(
    positions: Float32Array, // [x, y, z, life, ...]
    velocities: Float32Array  // [vx, vy, vz, mass, ...]
  ): void {
    const size = this.textureSize;

    const posData = new Float32Array(size * size * 4);
    const velData = new Float32Array(size * size * 4);

    const count = Math.min(positions.length / 4, this.maxParticles);
    for (let i = 0; i < count; i++) {
      const i4 = i * 4;
      posData[i4] = positions[i4];
      posData[i4 + 1] = positions[i4 + 1];
      posData[i4 + 2] = positions[i4 + 2];
      posData[i4 + 3] = positions[i4 + 3]; // life

      velData[i4] = velocities[i4];
      velData[i4 + 1] = velocities[i4 + 1];
      velData[i4 + 2] = velocities[i4 + 2];
      velData[i4 + 3] = velocities[i4 + 3]; // mass
    }

    const posTex = new THREE.DataTexture(posData, size, size, THREE.RGBAFormat, THREE.FloatType);
    posTex.needsUpdate = true;

    const velTex = new THREE.DataTexture(velData, size, size, THREE.RGBAFormat, THREE.FloatType);
    velTex.needsUpdate = true;

    // Write initial data to both ping-pong buffers
    this._renderToTarget(posTex, this.positionRT[0]);
    this._renderToTarget(posTex, this.positionRT[1]);
    this._renderToTarget(velTex, this.velocityRT[0]);
    this._renderToTarget(velTex, this.velocityRT[1]);

    posTex.dispose();
    velTex.dispose();
  }

  // ── Compute step ──

  compute(dt: number): void {
    const src = this.currentIndex;
    const dst = 1 - this.currentIndex;

    // 1. Update velocities
    this.velocityMaterial.uniforms.uPositionTex.value = this.positionRT[src].texture;
    this.velocityMaterial.uniforms.uVelocityTex.value = this.velocityRT[src].texture;
    this.velocityMaterial.uniforms.uDt.value = dt;

    this.computeMesh.material = this.velocityMaterial;
    this.renderer.setRenderTarget(this.velocityRT[dst]);
    this.renderer.render(this.computeScene, _orthoCamera);

    // 2. Update positions (using NEW velocities)
    this.positionMaterial.uniforms.uPositionTex.value = this.positionRT[src].texture;
    this.positionMaterial.uniforms.uVelocityTex.value = this.velocityRT[dst].texture;
    this.positionMaterial.uniforms.uDt.value = dt;

    this.computeMesh.material = this.positionMaterial;
    this.renderer.setRenderTarget(this.positionRT[dst]);
    this.renderer.render(this.computeScene, _orthoCamera);

    // 3. Restore render target
    this.renderer.setRenderTarget(null);

    // Flip ping-pong
    this.currentIndex = dst;
  }

  // ── Texture accessors (for instanced mesh rendering) ──

  getPositionTexture(): THREE.Texture {
    return this.positionRT[this.currentIndex].texture;
  }

  getVelocityTexture(): THREE.Texture {
    return this.velocityRT[this.currentIndex].texture;
  }

  // ── Stats ──

  getStats() {
    return {
      textureSize: this.textureSize,
      maxParticles: this.maxParticles,
      memoryBytes: this.textureSize * this.textureSize * 4 * 4 * 4, // 4 RTs × RGBA × Float32
    };
  }

  // ── Cleanup ──

  dispose(): void {
    this.positionRT[0].dispose();
    this.positionRT[1].dispose();
    this.velocityRT[0].dispose();
    this.velocityRT[1].dispose();
    this.positionMaterial.dispose();
    this.velocityMaterial.dispose();
  }

  // ── Internal: render a texture to a render target ──

  private _copyMaterial = new THREE.MeshBasicMaterial({ depthWrite: false, depthTest: false });

  private _renderToTarget(texture: THREE.Texture, target: THREE.WebGLRenderTarget): void {
    const mat = new THREE.ShaderMaterial({
      vertexShader: COMPUTE_VERTEX,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform sampler2D uTex;
        varying vec2 vUv;
        void main() { gl_FragColor = texture2D(uTex, vUv); }
      `,
      uniforms: { uTex: { value: texture } },
      depthWrite: false,
      depthTest: false,
    });
    this.computeMesh.material = mat;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.computeScene, _orthoCamera);
    this.renderer.setRenderTarget(null);
    mat.dispose();
  }
}
