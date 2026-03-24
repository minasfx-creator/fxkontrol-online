/**
 * PostExplosionSmokeManager — Object-pooled volumetric smoke emitters
 * that auto-spawn at firework burst endpoints.
 *
 * Architecture:
 * - Pre-allocated pool of smoke emitters (no dynamic alloc during show)
 * - Inherits position, scale (from caliber), and residual color from burst
 * - Each emitter runs independently via useFrame, no React state in loop
 */
import { useRef, useMemo, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getWindForce } from '../skycanvas/sharedState';

// ═══ Pool Config ═══
const MAX_SMOKE_EMITTERS = 16;
const PARTICLES_PER_EMITTER = 300;
const TOTAL_PARTICLES = MAX_SMOKE_EMITTERS * PARTICLES_PER_EMITTER;

// ═══ Emitter slot state (no React state — pure refs) ═══
interface SmokeSlot {
  active: boolean;
  startTime: number;
  duration: number;
  origin: [number, number, number];
  scale: number;       // from caliber
  residualColor: THREE.Color;
  particleOffset: number; // index into shared buffer
}

// ═══ Smoke shaders ═══
const SMOKE_VERT = /* glsl */ `
attribute vec3 aVelocity;
attribute float aLife;
attribute float aMaxLife;
attribute float aSize;
attribute vec3 aResidualColor;
attribute float aSlotActive;

uniform float uTime;
uniform vec3 uWind;

varying float vAlpha;
varying vec3 vColor;

float hash31(vec3 p) {
  p = fract(p * vec3(443.897, 441.423, 437.195));
  p += dot(p, p.yzx + 19.19);
  return fract((p.x + p.y) * p.z);
}

void main() {
  if (aSlotActive < 0.5 || aLife <= 0.0) {
    gl_Position = vec4(0.0, 0.0, -9999.0, 1.0);
    gl_PointSize = 0.0;
    vAlpha = 0.0;
    vColor = vec3(0.0);
    return;
  }
  
  float age = 1.0 - aLife / aMaxLife;
  
  // Buoyancy + wind advection
  vec3 vel = aVelocity;
  float buoyancy = 2.0 * aLife / aMaxLife;
  vel.y += buoyancy;
  vel += uWind * 0.5;
  
  // Turbulence
  float t = uTime;
  float turbX = (hash31(position * 0.08 + t * 0.2) - 0.5) * 1.5;
  float turbZ = (hash31(position * 0.08 + t * 0.2 + 100.0) - 0.5) * 1.5;
  vel.x += turbX;
  vel.z += turbZ;
  
  // Drag
  vel *= 0.97;
  
  vec3 pos = position + vel * age * aMaxLife;
  
  // Expand over time
  float expand = 1.0 + age * 4.0;
  
  vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mvPos;
  gl_PointSize = aSize * expand * (300.0 / -mvPos.z);
  gl_PointSize = clamp(gl_PointSize, 1.0, 100.0);
  
  // Residual color fades to grey smoke
  vec3 smokeGrey = vec3(0.12, 0.11, 0.1);
  float colorFade = smoothstep(0.0, 0.4, age);
  vColor = mix(aResidualColor * 0.4, smokeGrey, colorFade);
  
  // Alpha: rise then fade
  float fadeIn = smoothstep(0.0, 0.1, 1.0 - age);
  float fadeOut = smoothstep(0.0, 0.3, aLife / aMaxLife);
  vAlpha = fadeIn * fadeOut * 0.35;
}
`;

const SMOKE_FRAG = /* glsl */ `
varying float vAlpha;
varying vec3 vColor;

void main() {
  if (vAlpha < 0.001) discard;
  
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  if (d > 0.5) discard;
  
  float soft = 1.0 - smoothstep(0.15, 0.5, d);
  gl_FragColor = vec4(vColor, vAlpha * soft);
}
`;

// ═══ Global smoke spawn function (callable from anywhere) ═══
type SmokeSpawnFn = (
  origin: [number, number, number],
  caliber: number,
  color: string,
) => void;

let _globalSmokeSpawn: SmokeSpawnFn | null = null;

export function spawnPostExplosionSmoke(
  origin: [number, number, number],
  caliber: number,
  color: string,
) {
  _globalSmokeSpawn?.(origin, caliber, color);
}

// ═══ Component ═══
export default function PostExplosionSmokeManager() {
  const pointsRef = useRef<THREE.Points>(null);

  // Pre-allocate all buffers and slot state
  const { slots, positions, velocities, lifetimes, maxLifetimes, sizes, residualColors, slotActives, geometry, material } = useMemo(() => {
    const slots: SmokeSlot[] = [];
    for (let i = 0; i < MAX_SMOKE_EMITTERS; i++) {
      slots.push({
        active: false,
        startTime: 0,
        duration: 5,
        origin: [0, 0, 0],
        scale: 1,
        residualColor: new THREE.Color(0.15, 0.12, 0.1),
        particleOffset: i * PARTICLES_PER_EMITTER,
      });
    }

    const positions = new Float32Array(TOTAL_PARTICLES * 3);
    const velocities = new Float32Array(TOTAL_PARTICLES * 3);
    const lifetimes = new Float32Array(TOTAL_PARTICLES);
    const maxLifetimes = new Float32Array(TOTAL_PARTICLES);
    const sizes = new Float32Array(TOTAL_PARTICLES);
    const residualColors = new Float32Array(TOTAL_PARTICLES * 3);
    const slotActives = new Float32Array(TOTAL_PARTICLES);

    // Initialize dead
    for (let i = 0; i < TOTAL_PARTICLES; i++) {
      positions[i * 3 + 1] = -9999;
      lifetimes[i] = 0;
      slotActives[i] = 0;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aVelocity', new THREE.BufferAttribute(velocities, 3));
    geometry.setAttribute('aLife', new THREE.BufferAttribute(lifetimes, 1));
    geometry.setAttribute('aMaxLife', new THREE.BufferAttribute(maxLifetimes, 1));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('aResidualColor', new THREE.BufferAttribute(residualColors, 3));
    geometry.setAttribute('aSlotActive', new THREE.BufferAttribute(slotActives, 1));

    const material = new THREE.ShaderMaterial({
      vertexShader: SMOKE_VERT,
      fragmentShader: SMOKE_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      uniforms: {
        uTime: { value: 0 },
        uWind: { value: new THREE.Vector3(0, 0, 0) },
      },
    });

    return { slots, positions, velocities, lifetimes, maxLifetimes, sizes, residualColors, slotActives, geometry, material };
  }, []);

  // Spawn function: find free slot, populate particles
  const spawn = useCallback((origin: [number, number, number], caliber: number, color: string) => {
    // Find free slot
    let slotIdx = -1;
    for (let i = 0; i < MAX_SMOKE_EMITTERS; i++) {
      if (!slots[i].active) { slotIdx = i; break; }
    }
    if (slotIdx === -1) {
      // Recycle oldest
      let oldest = Infinity;
      for (let i = 0; i < MAX_SMOKE_EMITTERS; i++) {
        if (slots[i].startTime < oldest) { oldest = slots[i].startTime; slotIdx = i; }
      }
    }

    const slot = slots[slotIdx];
    slot.active = true;
    slot.startTime = performance.now() / 1000;
    slot.origin = origin;
    slot.scale = Math.max(0.5, caliber / 100);
    slot.duration = 3 + (caliber / 100) * 2; // bigger = longer smoke
    slot.residualColor.set(color);

    const offset = slot.particleOffset;
    const burstRadius = 5 + caliber * 0.08;

    for (let i = 0; i < PARTICLES_PER_EMITTER; i++) {
      const idx = offset + i;
      // Random position within burst sphere
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = burstRadius * Math.pow(Math.random(), 0.5);

      positions[idx * 3] = origin[0] + r * Math.sin(phi) * Math.cos(theta);
      positions[idx * 3 + 1] = origin[1] + r * Math.cos(phi);
      positions[idx * 3 + 2] = origin[2] + r * Math.sin(phi) * Math.sin(theta);

      // Slow upward + outward velocity
      velocities[idx * 3] = (Math.random() - 0.5) * 0.5;
      velocities[idx * 3 + 1] = 0.5 + Math.random() * 1.5;
      velocities[idx * 3 + 2] = (Math.random() - 0.5) * 0.5;

      const pLife = slot.duration * (0.6 + Math.random() * 0.4);
      lifetimes[idx] = pLife;
      maxLifetimes[idx] = pLife;
      sizes[idx] = (4 + Math.random() * 4) * slot.scale;
      slotActives[idx] = 1;

      // Residual color (dimmed burst color)
      residualColors[idx * 3] = slot.residualColor.r;
      residualColors[idx * 3 + 1] = slot.residualColor.g;
      residualColors[idx * 3 + 2] = slot.residualColor.b;
    }

    // Flag buffer updates
    (geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (geometry.getAttribute('aVelocity') as THREE.BufferAttribute).needsUpdate = true;
    (geometry.getAttribute('aLife') as THREE.BufferAttribute).needsUpdate = true;
    (geometry.getAttribute('aMaxLife') as THREE.BufferAttribute).needsUpdate = true;
    (geometry.getAttribute('aSize') as THREE.BufferAttribute).needsUpdate = true;
    (geometry.getAttribute('aResidualColor') as THREE.BufferAttribute).needsUpdate = true;
    (geometry.getAttribute('aSlotActive') as THREE.BufferAttribute).needsUpdate = true;
  }, [slots, positions, velocities, lifetimes, maxLifetimes, sizes, residualColors, slotActives, geometry]);

  // Register global spawn function
  _globalSmokeSpawn = spawn;

  // Per-frame: decay lifetimes, deactivate expired slots
  useFrame(({ clock }) => {
    const dt = 1 / 60;
    const now = clock.elapsedTime;
    let needsUpdate = false;

    const wind = getWindForce();
    material.uniforms.uTime.value = now;
    material.uniforms.uWind.value.set(wind[0], wind[1], wind[2]);

    for (let s = 0; s < MAX_SMOKE_EMITTERS; s++) {
      const slot = slots[s];
      if (!slot.active) continue;

      const elapsed = now - slot.startTime;
      if (elapsed > slot.duration * 1.5) {
        // Deactivate slot
        slot.active = false;
        for (let i = 0; i < PARTICLES_PER_EMITTER; i++) {
          const idx = slot.particleOffset + i;
          slotActives[idx] = 0;
          lifetimes[idx] = 0;
        }
        needsUpdate = true;
        continue;
      }

      // Decay particle lifetimes
      for (let i = 0; i < PARTICLES_PER_EMITTER; i++) {
        const idx = slot.particleOffset + i;
        if (lifetimes[idx] > 0) {
          lifetimes[idx] -= dt;
          if (lifetimes[idx] <= 0) {
            lifetimes[idx] = 0;
            slotActives[idx] = 0;
          }
          needsUpdate = true;
        }
      }
    }

    if (needsUpdate) {
      (geometry.getAttribute('aLife') as THREE.BufferAttribute).needsUpdate = true;
      (geometry.getAttribute('aSlotActive') as THREE.BufferAttribute).needsUpdate = true;
    }
  });

  return (
    <points ref={pointsRef} geometry={geometry} material={material} frustumCulled={false} />
  );
}
