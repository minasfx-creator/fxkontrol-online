/**
 * RealisticFirework — 100% GPU-driven particle system.
 * 
 * ALL physics (gravity, drag, wind) computed in Vertex Shader.
 * ALL color lifecycle (white-hot → effect color → ember → fade) in Fragment Shader.
 * ZERO React state mutations in animation loop.
 * 
 * Architecture: BufferGeometry + ShaderMaterial + useFrame (ref-only mutation)
 * Inspired by UE5 Niagara GPU particles and Finale 3D rendering.
 */

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { spawnPostExplosionSmoke } from './PostExplosionSmokeManager';

// ═══════════════════════════════════════════════════════════════════════
// GPU Vertex Shader — computes position from initial velocity + time
// Physics: ballistic trajectory with exponential drag + gravity + wind
// ═══════════════════════════════════════════════════════════════════════
const REALISTIC_VERTEX = `
  attribute vec3 aVelocity;
  attribute float aLifetime;
  attribute float aRandom;
  attribute float aSize;
  
  uniform float uTime;        // seconds since explosion
  uniform float uGravity;     // -9.81
  uniform float uDrag;        // air resistance coefficient
  uniform vec3  uWind;        // wind force vector
  uniform float uSpreadScale; // burst radius multiplier
  
  varying float vAge;         // normalized age [0..1]
  varying float vRandom;
  varying vec3  vVelocity;
  varying float vSpeed;
  
  void main() {
    float t = uTime;
    float life = aLifetime;
    vAge = clamp(t / life, 0.0, 1.0);
    vRandom = aRandom;
    
    // ── Exponential drag model ──
    // position = v0 * (1 - e^(-k*t)) / k
    // This naturally decelerates particles without CPU iteration
    float k = uDrag;
    float dragFactor = (1.0 - exp(-k * t)) / max(k, 0.001);
    
    vec3 vel = aVelocity * uSpreadScale;
    vVelocity = vel;
    vSpeed = length(vel);
    
    // Position: drag-integrated velocity + gravitational free-fall + wind
    vec3 pos = vel * dragFactor;
    pos.y += 0.5 * uGravity * t * t;            // gravity pull
    pos += uWind * t * t * 0.3;                   // wind drift (quadratic accumulation)
    
    // Slight turbulence from random seed
    float turb = sin(aRandom * 6283.0 + t * 3.0) * 0.15 * (1.0 - vAge);
    pos.x += turb;
    pos.z += turb * 0.7;
    
    vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
    
    // Size: starts big (flash), sustains, then shrinks
    float sizeOverLife = vAge < 0.05 
      ? 0.6 + vAge * 8.0  // flash ignition
      : vAge < 0.4 
        ? 1.0              // sustained
        : 1.0 - (vAge - 0.4) / 0.6 * 0.8; // fade shrink
    
    float finalSize = aSize * max(0.1, sizeOverLife);
    
    // Perspective size attenuation
    gl_PointSize = finalSize * (10000.0 / -mvPos.z);
    gl_PointSize = clamp(gl_PointSize, 0.5, 180.0);
    
    // Hide dead particles
    if (vAge >= 1.0) gl_PointSize = 0.0;
    
    gl_Position = projectionMatrix * mvPos;
  }
`;

// ═══════════════════════════════════════════════════════════════════════
// GPU Fragment Shader — color lifecycle
// Phase 1 (0-5%):  White-hot ignition flash
// Phase 2 (5-50%): Full color with sparkle
// Phase 3 (50-80%): Color → ember (orange/red)
// Phase 4 (80-100%): Ember → transparent (fade out)
// ═══════════════════════════════════════════════════════════════════════
const REALISTIC_FRAGMENT = `
  uniform vec3  uColor;         // effect base color
  uniform vec3  uSecondaryColor;// secondary color (optional)
  uniform float uHDRMultiplier; // bloom intensity scale
  uniform float uTime;
  
  varying float vAge;
  varying float vRandom;
  varying vec3  vVelocity;
  varying float vSpeed;
  
  void main() {
    // Circular point sprite with soft falloff
    vec2 uv = gl_PointCoord - 0.5;
    float dist = length(uv);
    
    // Triple-layer glow: core + inner + outer
    float core  = exp(-dist * dist * 100.0);   // sharp bright center
    float inner = exp(-dist * dist * 30.0);    // warm inner glow
    float outer = exp(-dist * dist * 8.0);     // soft halo
    
    float alpha = core * 1.0 + inner * 0.6 + outer * 0.12;
    
    // ── Color lifecycle ──
    vec3 whiteHot = vec3(1.3, 1.15, 0.85);     // incandescent flash
    vec3 ember    = vec3(0.95, 0.25, 0.02);     // dying ember
    vec3 smoke    = vec3(0.08, 0.06, 0.04);     // final smoke trace
    
    vec3 effectColor = uColor;
    
    // Optional secondary color blend based on random seed
    float secondaryMix = step(0.5, vRandom) * 0.8;
    effectColor = mix(effectColor, uSecondaryColor, secondaryMix * step(0.01, length(uSecondaryColor)));
    
    vec3 col;
    if (vAge < 0.05) {
      // Phase 1: White-hot ignition
      float flash = 1.0 - vAge / 0.05;
      col = mix(effectColor * 1.5, whiteHot * 2.0, flash * flash);
    } else if (vAge < 0.5) {
      // Phase 2: Full color with sparkle
      float sparkle = sin(vRandom * 6283.0 + uTime * 12.0) * 0.15 + 0.85;
      col = effectColor * sparkle * 1.2;
      // Hot core white boost
      col = mix(col, whiteHot, core * 0.3);
    } else if (vAge < 0.8) {
      // Phase 3: Color → ember transition
      float emberMix = (vAge - 0.5) / 0.3;
      col = mix(effectColor * 0.8, ember, emberMix * emberMix);
    } else {
      // Phase 4: Ember → smoke/transparent
      float smokeMix = (vAge - 0.8) / 0.2;
      col = mix(ember * 0.5, smoke, smokeMix);
    }
    
    // HDR boost for bloom pickup
    col *= uHDRMultiplier;
    
    // Alpha: sustain then rapid fade
    float lifeFade = vAge < 0.6 ? 1.0 : 1.0 - pow((vAge - 0.6) / 0.4, 1.5);
    alpha *= lifeFade;
    
    // Edge clip
    float edge = 1.0 - smoothstep(0.42, 0.5, dist);
    alpha *= edge;
    
    gl_FragColor = vec4(col, alpha);
  }
`;

// ═══════════════════════════════════════════════════════════════════════
// Shared material singleton — avoid creating new materials per explosion
// ═══════════════════════════════════════════════════════════════════════
let _gpuMaterialInstance: THREE.ShaderMaterial | null = null;
function getGPUFireworkMaterial(): THREE.ShaderMaterial {
  if (!_gpuMaterialInstance) {
    _gpuMaterialInstance = new THREE.ShaderMaterial({
      vertexShader: REALISTIC_VERTEX,
      fragmentShader: REALISTIC_FRAGMENT,
      uniforms: {
        uTime: { value: 0 },
        uGravity: { value: -9.81 },
        uDrag: { value: 0.045 },
        uWind: { value: new THREE.Vector3(0, 0, 0) },
        uSpreadScale: { value: 1.0 },
        uColor: { value: new THREE.Color(1, 0.5, 0.1) },
        uSecondaryColor: { value: new THREE.Color(0, 0, 0) },
        uHDRMultiplier: { value: 3.5 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }
  return _gpuMaterialInstance;
}

// ═══════════════════════════════════════════════════════════════════════
// Object Pool — reuse geometries and attribute buffers
// ═══════════════════════════════════════════════════════════════════════
interface PooledFireworkGeo {
  geometry: THREE.BufferGeometry;
  maxParticles: number;
  inUse: boolean;
}
const _geoPool: PooledFireworkGeo[] = [];
const MAX_POOL = 20;

function acquireGeometry(particleCount: number): THREE.BufferGeometry {
  // Try to find a pooled geometry with enough capacity
  for (const entry of _geoPool) {
    if (!entry.inUse && entry.maxParticles >= particleCount) {
      entry.inUse = true;
      return entry.geometry;
    }
  }
  // Create new
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3); // origin-relative, always (0,0,0)
  const velocities = new Float32Array(particleCount * 3);
  const lifetimes = new Float32Array(particleCount);
  const randoms = new Float32Array(particleCount);
  const sizes = new Float32Array(particleCount);

  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aVelocity', new THREE.BufferAttribute(velocities, 3));
  geo.setAttribute('aLifetime', new THREE.BufferAttribute(lifetimes, 1));
  geo.setAttribute('aRandom', new THREE.BufferAttribute(randoms, 1));
  geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));

  if (_geoPool.length < MAX_POOL) {
    _geoPool.push({ geometry: geo, maxParticles: particleCount, inUse: true });
  }
  return geo;
}

function releaseGeometry(geo: THREE.BufferGeometry) {
  for (const entry of _geoPool) {
    if (entry.geometry === geo) {
      entry.inUse = false;
      return;
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Component: Single GPU-driven explosion
// ═══════════════════════════════════════════════════════════════════════
export interface RealisticFireworkProps {
  position: [number, number, number];
  color: string;
  secondaryColor?: string;
  caliber?: number;       // mm shell size (75-300)
  pattern?: string;       // peony, chrysanthemum, willow, etc.
  startTime: number;      // clock time when explosion starts
  particleCount?: number; // override particle count
  onComplete?: () => void;
}

export default function RealisticFirework({
  position,
  color,
  secondaryColor,
  caliber = 100,
  pattern = 'peony',
  startTime,
  particleCount: customCount,
  onComplete,
}: RealisticFireworkProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const completedRef = useRef(false);
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);

  // Calculate particle count from caliber (more = bigger shell)
  const PARTICLE_COUNT = useMemo(() => {
    if (customCount) return customCount;
    const base = Math.floor(200 + (caliber / 25) * 300);
    return Math.min(base, 4000); // cap at 4000 per burst
  }, [caliber, customCount]);

  // Compute lifetime based on caliber and pattern
  const lifetime = useMemo(() => {
    let base = 1.5 + caliber * 0.012;
    if (pattern === 'willow' || pattern === 'kamuro') base *= 2.0;
    if (pattern === 'palm') base *= 1.5;
    if (pattern === 'chrysanthemum') base *= 1.2;
    if (pattern === 'dahlia') base *= 0.6;
    return base;
  }, [caliber, pattern]);

  // Break speed from caliber
  const breakSpeed = useMemo(() => {
    return 8 + caliber * 0.12;
  }, [caliber]);

  // Setup geometry with randomized velocities (once)
  const geometry = useMemo(() => {
    const geo = acquireGeometry(PARTICLE_COUNT);
    const velAttr = geo.getAttribute('aVelocity') as THREE.BufferAttribute;
    const lifeAttr = geo.getAttribute('aLifetime') as THREE.BufferAttribute;
    const randAttr = geo.getAttribute('aRandom') as THREE.BufferAttribute;
    const sizeAttr = geo.getAttribute('aSize') as THREE.BufferAttribute;
    const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;

    const vel = velAttr.array as Float32Array;
    const life = lifeAttr.array as Float32Array;
    const rand = randAttr.array as Float32Array;
    const size = sizeAttr.array as Float32Array;
    const pos = posAttr.array as Float32Array;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      // Spherical distribution with organic variance
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      // Non-uniform speed: pow distribution creates natural clustering
      const speedVar = Math.pow(0.3 + Math.random() * 0.7, 0.6);
      const speed = breakSpeed * speedVar;

      const sx = Math.sin(phi) * Math.cos(theta);
      const sy = Math.cos(phi);
      const sz = Math.sin(phi) * Math.sin(theta);

      // Pattern-specific velocity shaping
      let vx = sx * speed, vy = sy * speed, vz = sz * speed;
      
      switch (pattern) {
        case 'willow':
          vx *= 0.45; vy *= 0.45; vz *= 0.45; break;
        case 'palm':
          vx *= 0.55; vy = Math.abs(vy) * 0.85 + speed * 0.4; vz *= 0.55; break;
        case 'chrysanthemum':
          vy *= 0.93; break;
        case 'kamuro':
          vx *= 0.38; vy = vy * 0.38 + 1.5; vz *= 0.38; break;
        case 'ring':
          vx = Math.cos(theta) * speed; vy = (Math.random() - 0.5) * speed * 0.08; vz = Math.sin(theta) * speed; break;
        case 'dahlia':
          vx *= 1.3; vy *= 1.2; vz *= 1.3; break;
      }

      vel[i * 3] = vx;
      vel[i * 3 + 1] = vy;
      vel[i * 3 + 2] = vz;

      // All particles start at origin (group position handles world placement)
      pos[i * 3] = 0;
      pos[i * 3 + 1] = 0;
      pos[i * 3 + 2] = 0;

      // Per-particle lifetime variance (organic look)
      life[i] = lifetime * (0.5 + Math.random() * 0.5);
      rand[i] = Math.random();
      size[i] = 0.4 + (caliber / 100) * 0.8 + Math.random() * 0.3;
    }

    velAttr.needsUpdate = true;
    lifeAttr.needsUpdate = true;
    randAttr.needsUpdate = true;
    sizeAttr.needsUpdate = true;
    posAttr.needsUpdate = true;

    return geo;
  }, [PARTICLE_COUNT, breakSpeed, lifetime, pattern, caliber]);

  // Create per-instance material (clone from singleton to allow unique uniforms)
  const material = useMemo(() => {
    const base = getGPUFireworkMaterial();
    const mat = base.clone();
    mat.uniforms = {
      uTime: { value: 0 },
      uGravity: { value: -9.81 },
      uDrag: { value: caliber <= 75 ? 0.065 : caliber <= 150 ? 0.045 : 0.03 },
      uWind: { value: new THREE.Vector3(0, 0, 0) },
      uSpreadScale: { value: 1.0 },
      uColor: { value: new THREE.Color(color) },
      uSecondaryColor: { value: secondaryColor ? new THREE.Color(secondaryColor) : new THREE.Color(0, 0, 0) },
      uHDRMultiplier: { value: 3.5 },
    };
    materialRef.current = mat;
    return mat;
  }, [color, secondaryColor, caliber]);

  // Animation: ONLY mutate uniform refs — zero React state
  useFrame(({ clock }) => {
    if (!materialRef.current) return;

    const elapsed = clock.getElapsedTime() - startTime;
    if (elapsed < 0) return;

    materialRef.current.uniforms.uTime.value = elapsed;

    // Auto-complete after lifetime expires
    if (elapsed > lifetime * 1.2 && !completedRef.current) {
      completedRef.current = true;
      if (pointsRef.current) pointsRef.current.visible = false;
      releaseGeometry(geometry);
      onComplete?.();
    }
  });

  return (
    <points ref={pointsRef} position={position} frustumCulled={false}>
      <primitive object={geometry} attach="geometry" />
      <primitive object={material} attach="material" />
    </points>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Stress Test Manager — launches N simultaneous GPU fireworks
// ═══════════════════════════════════════════════════════════════════════
export interface StressTestFirework {
  id: string;
  position: [number, number, number];
  color: string;
  caliber: number;
  startTime: number;
}

export function useFireworkStressTest() {
  const fireworksRef = useRef<StressTestFirework[]>([]);
  const counterRef = useRef(0);

  const launch = (count: number = 10) => {
    const now = performance.now() / 1000; // approximate clock time
    const newFireworks: StressTestFirework[] = [];

    const colors = ['#ff3030', '#30ff30', '#3060ff', '#ffff30', '#ff30ff', '#30ffff', '#ff8020', '#ffffff', '#ff6090', '#80ff40'];
    const calibers = [75, 100, 125, 150, 100, 75, 200, 125, 100, 150];

    for (let i = 0; i < count; i++) {
      counterRef.current++;
      newFireworks.push({
        id: `stress-${counterRef.current}`,
        position: [
          (Math.random() - 0.5) * 200,  // spread X
          80 + Math.random() * 150,       // altitude Y
          (Math.random() - 0.5) * 200,   // spread Z
        ],
        color: colors[i % colors.length],
        caliber: calibers[i % calibers.length],
        startTime: now + i * 0.15, // staggered launch
      });
    }

    fireworksRef.current = [...fireworksRef.current, ...newFireworks];
    return newFireworks;
  };

  const remove = (id: string) => {
    fireworksRef.current = fireworksRef.current.filter(f => f.id !== id);
  };

  const clear = () => {
    fireworksRef.current = [];
  };

  return { fireworksRef, launch, remove, clear };
}
