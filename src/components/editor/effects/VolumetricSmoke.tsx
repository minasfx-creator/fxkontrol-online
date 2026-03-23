/**
 * VolumetricSmoke — GPU-based fluid simulation smoke with DMX light absorption.
 * Uses advection + thermal dissipation on a 3D grid via custom shaders.
 * Absorbs color from nearby DMX light sources (moving heads, pyro bursts).
 * Zero-GC: all buffers pre-allocated, no dynamic objects in render loop.
 */
import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// ═══ Pre-allocated math objects ═══
const _tempColor = new THREE.Color();
const _tempVec = new THREE.Vector3();

// ═══ Smoke Vertex Shader ═══
const smokeVertexShader = /* glsl */ `
attribute float aLife;
attribute float aSize;
attribute vec3 aVelocity;
attribute vec3 aAbsorbedColor;
attribute float aThermal;

uniform float uTime;
uniform float uGravity;
uniform float uDrag;
uniform vec3 uWind;
uniform float uBuoyancy;
uniform float uDissipation;
uniform float uTurbulence;

varying float vLife;
varying float vAlpha;
varying vec3 vColor;
varying float vThermal;

// Simplex-style hash for turbulence
float hash(vec3 p) {
  p = fract(p * vec3(443.897, 441.423, 437.195));
  p += dot(p, p.yzx + 19.19);
  return fract((p.x + p.y) * p.z);
}

void main() {
  vLife = aLife;
  vThermal = aThermal;
  
  if (aLife <= 0.0) {
    gl_Position = vec4(0.0, 0.0, -9999.0, 1.0);
    gl_PointSize = 0.0;
    vAlpha = 0.0;
    vColor = vec3(0.0);
    return;
  }
  
  // Advection: integrate velocity with buoyancy, gravity, drag, wind, turbulence
  float age = 1.0 - aLife;
  vec3 pos = position;
  
  // Thermal buoyancy (hot smoke rises faster)
  float buoyancyForce = uBuoyancy * aThermal;
  
  // Turbulence noise
  float turbX = (hash(pos * 0.1 + uTime * 0.3) - 0.5) * uTurbulence;
  float turbY = (hash(pos * 0.1 + uTime * 0.3 + 100.0) - 0.5) * uTurbulence * 0.5;
  float turbZ = (hash(pos * 0.1 + uTime * 0.3 + 200.0) - 0.5) * uTurbulence;
  
  vec3 vel = aVelocity;
  vel.y += buoyancyForce + uGravity * 0.1; // smoke floats up
  vel += uWind;
  vel += vec3(turbX, turbY, turbZ);
  vel *= (1.0 - uDrag);
  
  pos += vel * 0.016; // ~60fps dt
  
  // Thermal dissipation (cools over time)
  float thermalDecay = max(aThermal - uDissipation * 0.016, 0.0);
  
  // Absorbed color from DMX lights
  vColor = aAbsorbedColor;
  
  // Base smoke color (grey) mixed with absorbed light
  float colorMix = length(aAbsorbedColor);
  if (colorMix < 0.01) {
    // No light absorption — neutral grey smoke
    vColor = vec3(0.15 + thermalDecay * 0.3, 0.13 + thermalDecay * 0.25, 0.12 + thermalDecay * 0.2);
  } else {
    // Blend absorbed color with smoke base
    vec3 smokeBase = vec3(0.2, 0.18, 0.16);
    vColor = mix(smokeBase, aAbsorbedColor, min(colorMix * 2.0, 0.7));
  }
  
  // Alpha: dense at start, fade with age and dissipation
  vAlpha = smoothstep(0.0, 0.1, aLife) * smoothstep(0.0, 0.3, 1.0 - age);
  vAlpha *= (0.3 + thermalDecay * 0.4);
  
  // Size: expands as smoke dissipates
  float expandedSize = aSize * (1.0 + age * 3.0);
  
  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  gl_PointSize = expandedSize * (300.0 / -mvPosition.z);
  gl_PointSize = clamp(gl_PointSize, 1.0, 128.0);
}
`;

// ═══ Smoke Fragment Shader ═══
const smokeFragmentShader = /* glsl */ `
varying float vLife;
varying float vAlpha;
varying vec3 vColor;
varying float vThermal;

void main() {
  if (vAlpha < 0.001) discard;
  
  // Soft circular particle
  vec2 center = gl_PointCoord - vec2(0.5);
  float dist = length(center);
  if (dist > 0.5) discard;
  
  // Soft edges with volumetric falloff
  float edge = 1.0 - smoothstep(0.2, 0.5, dist);
  float core = exp(-dist * dist * 8.0);
  
  // Combine for volumetric look
  float alpha = mix(edge * 0.6, core, vThermal * 0.5) * vAlpha;
  
  // Hot core glows slightly
  vec3 color = vColor;
  if (vThermal > 0.5) {
    color += vec3(0.3, 0.15, 0.05) * (vThermal - 0.5) * 2.0;
  }
  
  gl_FragColor = vec4(color, alpha);
}
`;

// ═══ Smoke Config ═══
interface VolumetricSmokeProps {
  position?: [number, number, number];
  maxParticles?: number;
  emissionRate?: number;
  lifetime?: number;
  buoyancy?: number;
  drag?: number;
  turbulence?: number;
  dissipation?: number;
  windForce?: [number, number, number];
  initialVelocity?: number;
  particleSize?: number;
  /** Nearby light sources for color absorption */
  lightSources?: Array<{ position: [number, number, number]; color: string; intensity: number; range: number }>;
  enabled?: boolean;
}

export default function VolumetricSmoke({
  position = [0, 0, 0],
  maxParticles = 2000,
  emissionRate = 30,
  lifetime = 4.0,
  buoyancy = 2.5,
  drag = 0.02,
  turbulence = 1.5,
  dissipation = 0.3,
  windForce = [0.5, 0, 0],
  initialVelocity = 3.0,
  particleSize = 8.0,
  lightSources = [],
  enabled = true,
}: VolumetricSmokeProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const emitCounterRef = useRef(0);
  const nextEmitRef = useRef(0);

  // Pre-allocate all buffers
  const { positions, velocities, lifetimes, sizes, thermals, absorbedColors, geometry, material } = useMemo(() => {
    const positions = new Float32Array(maxParticles * 3);
    const velocities = new Float32Array(maxParticles * 3);
    const lifetimes = new Float32Array(maxParticles);
    const sizes = new Float32Array(maxParticles);
    const thermals = new Float32Array(maxParticles);
    const absorbedColors = new Float32Array(maxParticles * 3);

    // Initialize as dead particles
    for (let i = 0; i < maxParticles; i++) {
      lifetimes[i] = 0;
      positions[i * 3] = 0;
      positions[i * 3 + 1] = -9999;
      positions[i * 3 + 2] = 0;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aVelocity', new THREE.BufferAttribute(velocities, 3));
    geometry.setAttribute('aLife', new THREE.BufferAttribute(lifetimes, 1));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('aThermal', new THREE.BufferAttribute(thermals, 1));
    geometry.setAttribute('aAbsorbedColor', new THREE.BufferAttribute(absorbedColors, 3));

    const material = new THREE.ShaderMaterial({
      vertexShader: smokeVertexShader,
      fragmentShader: smokeFragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      uniforms: {
        uTime: { value: 0 },
        uGravity: { value: -0.5 },
        uDrag: { value: drag },
        uWind: { value: new THREE.Vector3(...windForce) },
        uBuoyancy: { value: buoyancy },
        uDissipation: { value: dissipation },
        uTurbulence: { value: turbulence },
      },
    });

    return { positions, velocities, lifetimes, sizes, thermals, absorbedColors, geometry, material };
  }, [maxParticles]);

  // Per-frame: emit new particles, update physics on CPU (positions feed shader)
  useFrame(({ clock }) => {
    if (!enabled || !pointsRef.current) return;
    const dt = 1 / 60;
    const time = clock.elapsedTime;

    material.uniforms.uTime.value = time;
    material.uniforms.uDrag.value = drag;
    material.uniforms.uWind.value.set(windForce[0], windForce[1], windForce[2]);
    material.uniforms.uBuoyancy.value = buoyancy;
    material.uniforms.uDissipation.value = dissipation;
    material.uniforms.uTurbulence.value = turbulence;

    // Emit particles
    emitCounterRef.current += emissionRate * dt;
    const toEmit = Math.floor(emitCounterRef.current);
    emitCounterRef.current -= toEmit;

    for (let e = 0; e < toEmit; e++) {
      // Find dead particle
      const idx = nextEmitRef.current % maxParticles;
      nextEmitRef.current++;

      // Random initial velocity (upward + spread)
      const angle = Math.random() * Math.PI * 2;
      const spread = Math.random() * 1.5;
      velocities[idx * 3] = Math.cos(angle) * spread;
      velocities[idx * 3 + 1] = initialVelocity + Math.random() * 2;
      velocities[idx * 3 + 2] = Math.sin(angle) * spread;

      positions[idx * 3] = position[0] + (Math.random() - 0.5) * 2;
      positions[idx * 3 + 1] = position[1];
      positions[idx * 3 + 2] = position[2] + (Math.random() - 0.5) * 2;

      lifetimes[idx] = 1.0; // full life
      sizes[idx] = particleSize * (0.8 + Math.random() * 0.4);
      thermals[idx] = 0.8 + Math.random() * 0.2; // hot at birth
      absorbedColors[idx * 3] = 0;
      absorbedColors[idx * 3 + 1] = 0;
      absorbedColors[idx * 3 + 2] = 0;
    }

    // Update all particles
    for (let i = 0; i < maxParticles; i++) {
      if (lifetimes[i] <= 0) continue;

      // Decay life
      lifetimes[i] -= dt / lifetime;

      // Thermal decay
      thermals[i] = Math.max(thermals[i] - dissipation * dt, 0);

      // Simple advection (GPU does the final positioning in shader)
      const buoyancyF = buoyancy * thermals[i];
      velocities[i * 3] += windForce[0] * dt;
      velocities[i * 3 + 1] += (buoyancyF - 0.5) * dt;
      velocities[i * 3 + 2] += windForce[2] * dt;

      // Drag
      velocities[i * 3] *= (1 - drag);
      velocities[i * 3 + 1] *= (1 - drag);
      velocities[i * 3 + 2] *= (1 - drag);

      // Integrate position
      positions[i * 3] += velocities[i * 3] * dt;
      positions[i * 3 + 1] += velocities[i * 3 + 1] * dt;
      positions[i * 3 + 2] += velocities[i * 3 + 2] * dt;

      // Light absorption: check nearby light sources
      _tempVec.set(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
      for (const light of lightSources) {
        const dx = _tempVec.x - light.position[0];
        const dy = _tempVec.y - light.position[1];
        const dz = _tempVec.z - light.position[2];
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist < light.range) {
          const falloff = 1 - (dist / light.range);
          const absorption = falloff * falloff * light.intensity * 0.02;
          _tempColor.set(light.color);
          absorbedColors[i * 3] += _tempColor.r * absorption;
          absorbedColors[i * 3 + 1] += _tempColor.g * absorption;
          absorbedColors[i * 3 + 2] += _tempColor.b * absorption;
        }
      }
    }

    // Upload to GPU
    const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute;
    const velAttr = geometry.getAttribute('aVelocity') as THREE.BufferAttribute;
    const lifeAttr = geometry.getAttribute('aLife') as THREE.BufferAttribute;
    const sizeAttr = geometry.getAttribute('aSize') as THREE.BufferAttribute;
    const thermAttr = geometry.getAttribute('aThermal') as THREE.BufferAttribute;
    const colorAttr = geometry.getAttribute('aAbsorbedColor') as THREE.BufferAttribute;

    posAttr.needsUpdate = true;
    velAttr.needsUpdate = true;
    lifeAttr.needsUpdate = true;
    sizeAttr.needsUpdate = true;
    thermAttr.needsUpdate = true;
    colorAttr.needsUpdate = true;
  });

  if (!enabled) return null;

  return (
    <points ref={pointsRef} geometry={geometry} material={material} frustumCulled={false} />
  );
}
