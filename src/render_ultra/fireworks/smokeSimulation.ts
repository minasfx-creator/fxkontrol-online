/**
 * FX KONTROL · Volumetric Smoke Simulation
 * GPU-friendly smoke particle system with soft-particle depth fading
 * and curl noise turbulence (Niagara-grade).
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

// ── Curl Noise ──────────────────────────────────────────────────────

function curlNoise2D(x: number, y: number, z: number, scale: number): [number, number, number] {
  const sx = x * scale, sy = y * scale, sz = z * scale;
  const e = 0.01;

  const n = (px: number, py: number, pz: number) =>
    Math.sin(px * 1.27 + py * 3.41) * Math.cos(pz * 2.63 + px * 0.97) +
    Math.sin(py * 1.89 + pz * 2.17) * Math.cos(px * 0.73 + pz * 1.43) * 0.5;

  const n2 = (px: number, py: number, pz: number) =>
    Math.cos(px * 2.31 + pz * 1.73) * Math.sin(py * 1.47 + px * 3.11) +
    Math.sin(pz * 2.91 + py * 1.13) * Math.cos(px * 1.67) * 0.5;

  const dndy = (n(sx, sy + e, sz) - n(sx, sy - e, sz)) / (2 * e);
  const dndz = (n(sx, sy, sz + e) - n(sx, sy, sz - e)) / (2 * e);
  const dndx = (n(sx + e, sy, sz) - n(sx - e, sy, sz)) / (2 * e);
  const dn2dx = (n2(sx + e, sy, sz) - n2(sx - e, sy, sz)) / (2 * e);
  const dn2dy = (n2(sx, sy + e, sz) - n2(sx, sy - e, sz)) / (2 * e);

  return [dndy - dndz, dndz - dndx, dn2dx - dn2dy];
}

// ── Shaders ─────────────────────────────────────────────────────────

const SMOKE_VERTEX = `
  attribute float aSize;
  attribute float aOpacity;
  attribute vec3 aColor;
  varying float vOpacity;
  varying vec3 vColor;
  varying vec4 vViewPos;
  void main() {
    vOpacity = aOpacity;
    vColor = aColor;
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    vViewPos = mvPos;
    gl_Position = projectionMatrix * mvPos;
    gl_PointSize = aSize * (300.0 / -mvPos.z);
  }
`;

const SMOKE_FRAGMENT = `
  uniform sampler2D uDepthTexture;
  uniform float uSoftRange;
  uniform float uCameraNear;
  uniform float uCameraFar;
  uniform vec2 uResolution;
  uniform bool uUseSoftParticles;

  // ── 6-Way Directional Lighting ──
  uniform bool uUse6WayLighting;
  uniform vec3 uLightDir;          // Normalized dominant light direction
  uniform vec3 uLightColor;        // Light colour (from explosions)
  uniform float uLightIntensity;   // Dynamic intensity (flash → decay)
  uniform vec3 uAmbientColor;      // Base ambient (sky)
  
  varying float vOpacity;
  varying vec3 vColor;
  varying vec4 vViewPos;
  
  float linearizeDepth(float depth) {
    float ndc = depth * 2.0 - 1.0;
    return (2.0 * uCameraNear * uCameraFar) / (uCameraFar + uCameraNear - ndc * (uCameraFar - uCameraNear));
  }

  // 6-way lighting: pre-computed directional response
  // Approximates light penetration through volumetric medium
  vec3 compute6WayLight(vec3 baseColor, vec3 lightDir, vec3 lightCol, float intensity) {
    // Compute response for 6 cardinal directions
    float posX = max(0.0, lightDir.x);
    float negX = max(0.0, -lightDir.x);
    float posY = max(0.0, lightDir.y);
    float negY = max(0.0, -lightDir.y);
    float posZ = max(0.0, lightDir.z);
    float negZ = max(0.0, -lightDir.z);

    // Weighted blend: front-lit faces get more illumination
    float directional = posX * 0.8 + negX * 0.4 + posY * 0.9 + negY * 0.3 + posZ * 0.7 + negZ * 0.5;
    
    // Light rim effect: edges facing the light glow brighter
    float rim = pow(1.0 - abs(dot(normalize(vViewPos.xyz), lightDir)), 2.0) * 0.5;
    
    vec3 litColor = baseColor * uAmbientColor + lightCol * intensity * (directional + rim) * 0.5;
    return litColor;
  }
  
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    // Soft gaussian falloff for volumetric look
    float alpha = exp(-d * d * 2.5) * vOpacity;
    
    // Soft particle depth fading
    if (uUseSoftParticles) {
      vec2 screenUV = gl_FragCoord.xy / uResolution;
      float sceneDepth = linearizeDepth(texture2D(uDepthTexture, screenUV).r);
      float particleDepth = -vViewPos.z;
      float depthDiff = sceneDepth - particleDepth;
      float softFade = smoothstep(0.0, uSoftRange, depthDiff);
      alpha *= softFade;
    }
    
    if (alpha < 0.005) discard;

    vec3 finalColor = vColor;
    if (uUse6WayLighting && uLightIntensity > 0.01) {
      finalColor = compute6WayLight(vColor, uLightDir, uLightColor, uLightIntensity);
    }

    gl_FragColor = vec4(finalColor, alpha);
  }
`;

export class SmokeSystem {
  private particles: SmokeParticle[] = [];
  private geometry: THREE.BufferGeometry;
  private material: THREE.ShaderMaterial;
  public mesh: THREE.Points;
  private maxParticles: number;
  private elapsed = 0;

  constructor(maxParticles = 4096, useSoftParticles = false) {
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
      uniforms: {
        uDepthTexture: { value: null },
        uSoftRange: { value: 1.0 },
        uUseSoftParticles: { value: useSoftParticles },
        uCameraNear: { value: 0.1 },
        uCameraFar: { value: 1000 },
        uResolution: { value: new THREE.Vector2(1920, 1080) },
        // 6-way lighting uniforms
        uUse6WayLighting: { value: false },
        uLightDir: { value: new THREE.Vector3(0, 1, 0) },
        uLightColor: { value: new THREE.Color(1, 0.9, 0.7) },
        uLightIntensity: { value: 0 },
        uAmbientColor: { value: new THREE.Color(0.15, 0.18, 0.25) },
      },
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.NormalBlending,
    });

    this.mesh = new THREE.Points(this.geometry, this.material);
    this.mesh.frustumCulled = false;
  }

  /** Enable/disable soft particle depth fading */
  setSoftParticles(enabled: boolean, depthTexture?: THREE.Texture | null) {
    this.material.uniforms.uUseSoftParticles.value = enabled;
    if (depthTexture !== undefined) {
      this.material.uniforms.uDepthTexture.value = depthTexture;
    }
  }

  /** Update camera uniforms for soft particles */
  updateCamera(camera: THREE.PerspectiveCamera, resolution: THREE.Vector2) {
    this.material.uniforms.uCameraNear.value = camera.near;
    this.material.uniforms.uCameraFar.value = camera.far;
    this.material.uniforms.uResolution.value = resolution;
  }

  /** Enable/disable 6-way directional lighting */
  set6WayLighting(enabled: boolean): void {
    this.material.uniforms.uUse6WayLighting.value = enabled;
  }

  /** Update dynamic light source (call when explosions occur) */
  updateExplosionLight(
    direction: THREE.Vector3,
    color: THREE.Color,
    intensity: number
  ): void {
    this.material.uniforms.uLightDir.value.copy(direction).normalize();
    this.material.uniforms.uLightColor.value.copy(color);
    this.material.uniforms.uLightIntensity.value = intensity;
  }

  /** Set ambient sky colour for 6-way lighting base */
  setAmbientColor(color: THREE.Color): void {
    this.material.uniforms.uAmbientColor.value.copy(color);
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

  update(dt: number, windX = 0, windZ = 0, curlNoiseStrength = 2.0, curlNoiseScale = 0.05) {
    this.elapsed += dt;
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

      // Buoyancy
      p.velocity.y += 0.3 * dt;

      // Curl noise turbulence (replaces random jitter)
      if (curlNoiseStrength > 0) {
        const [cx, cy, cz] = curlNoise2D(
          p.position.x + this.elapsed * 0.5,
          p.position.y,
          p.position.z + this.elapsed * 0.3,
          curlNoiseScale
        );
        p.velocity.x += cx * curlNoiseStrength * p.turbulence * dt;
        p.velocity.y += cy * curlNoiseStrength * p.turbulence * dt * 0.3;
        p.velocity.z += cz * curlNoiseStrength * p.turbulence * dt;
      } else {
        // Fallback random turbulence
        p.velocity.x += (Math.random() - 0.5) * p.turbulence * dt;
        p.velocity.z += (Math.random() - 0.5) * p.turbulence * dt;
      }

      // Wind
      p.velocity.x += windX * dt * 0.5;
      p.velocity.z += windZ * dt * 0.5;

      p.velocity.multiplyScalar(0.98);
      p.position.add(p.velocity.clone().multiplyScalar(dt));
      p.size += dt * 3;
      p.opacity = p.opacity * lifeRatio * lifeRatio;

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

  /**
   * Free GPU buffers and shader program. Detaches the mesh from any
   * parent so the SmokeSystem can be garbage-collected after a scene
   * teardown / show restart.
   */
  dispose(): void {
    this.mesh.parent?.remove(this.mesh);
    this.geometry.dispose();
    this.material.dispose();
    this.particles.length = 0;
  }
}
