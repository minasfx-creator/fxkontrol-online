import { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { getMaterialType, getRiskDivision, getBurstSmokeDensity } from '@/lib/pyroPhysics';

/**
 * SaluteEffect — Concussive flash + fresnel shockwave + volumetric sphere + debris.
 * UE5 Niagara-grade: custom fresnel shader, debris physics, air distortion, ground scorch.
 * 
 * Enhanced with Manual de Pirotecnia concepts:
 * - Material type: 'detonante' (materia detonante → trueno/apertura) 
 * - Risk Division 1.1: mass explosion → stronger shockwave, more debris
 * - Quadratic debris scaling: caliber² relationship (larger = exponentially more debris)
 * - Dense post-detonation smoke cloud (SO2 + KCl residue)
 * - Temperature ranges from manual: deflagración 1500-4000°C, detonación 2000-4000°C
 */

// ── Fresnel Shockwave Shader (UE5 Niagara style) ───────────────────
const SHOCKWAVE_VERTEX = `
  varying vec3 vNormal;
  varying vec3 vViewDir;
  
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewDir = normalize(-mvPosition.xyz);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const SHOCKWAVE_FRAGMENT = `
  varying vec3 vNormal;
  varying vec3 vViewDir;
  
  uniform float uOpacity;
  uniform float uProgress;
  uniform vec3 uColor;
  
  void main() {
    // Fresnel: bright at edges, transparent at center (like real shockwave)
    float fresnel = 1.0 - abs(dot(vNormal, vViewDir));
    fresnel = pow(fresnel, 3.0);
    
    // Inner ring shimmer
    float ring = smoothstep(0.6, 0.8, fresnel) * 0.5;
    
    // Chromatic edge shift
    vec3 edgeColor = mix(uColor, vec3(0.8, 0.9, 1.0), fresnel * 0.5);
    
    float alpha = (fresnel * 0.8 + ring) * uOpacity;
    gl_FragColor = vec4(edgeColor * (1.0 + fresnel * 2.0), alpha);
  }
`;

// ── Air Distortion Ring Shader ──────────────────────────────────────
const DISTORTION_VERTEX = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const DISTORTION_FRAGMENT = `
  varying vec2 vUv;
  uniform float uOpacity;
  uniform float uTime;
  
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  
  void main() {
    vec2 centered = (vUv - 0.5) * 2.0;
    float dist = length(centered);
    
    // Ring shape
    float ring = smoothstep(0.7, 0.85, dist) * smoothstep(1.0, 0.9, dist);
    
    // Noise disturbance
    float n = hash(centered * 10.0 + vec2(uTime));
    ring *= 0.7 + n * 0.3;
    
    // Refraction-like tint (slight color shift)
    vec3 col = vec3(0.95, 0.97, 1.0);
    
    gl_FragColor = vec4(col, ring * uOpacity);
  }
`;

interface SaluteEffectProps {
  position: [number, number, number];
  progress: number;
  caliber?: number;
  intensity?: number;
}

export default function SaluteEffect({
  position,
  progress,
  caliber = 4,
  intensity = 1,
}: SaluteEffectProps) {
  const flashRef = useRef<THREE.Mesh>(null);
  const shockRef = useRef<THREE.Mesh>(null);
  const distortionRef = useRef<THREE.Mesh>(null);
  const debrisRef = useRef<THREE.Points>(null);
  const scorchRef = useRef<THREE.Mesh>(null);
  const smokeCloudRef = useRef<THREE.Mesh>(null);
  const { camera } = useThree();
  const shakeOffset = useRef(new THREE.Vector3());

  // Manual-derived classification
  const materialType = useMemo(() => getMaterialType('salute'), []);
  const riskDivision = useMemo(() => getRiskDivision(caliber, materialType), [caliber, materialType]);
  const smokeDensity = useMemo(() => getBurstSmokeDensity(caliber), [caliber]);
  
  // Division 1.1 = mass explosion risk → more violent
  const isDiv11 = riskDivision === '1.1';
  const flashSize = 2 + caliber * 1.2 * (isDiv11 ? 1.4 : 1.0);
  const flashDuration = isDiv11 ? 0.12 : 0.15;

  // Quadratic debris scaling (manual: detonation → more projectiles with larger calibers)
  const DEBRIS_COUNT = useMemo(() => Math.round(20 + caliber * caliber * 3), [caliber]);

  // Pre-allocate debris buffers
  const debrisPos = useMemo(() => new Float32Array(DEBRIS_COUNT * 3), [DEBRIS_COUNT]);
  const debrisCol = useMemo(() => new Float32Array(DEBRIS_COUNT * 3), [DEBRIS_COUNT]);

  const debrisSeeds = useMemo(() => {
    const s: { vx: number; vy: number; vz: number; size: number; spin: number }[] = [];
    // Division 1.1: higher velocity fragments (manual: "altísimas presiones locales")
    const speedMult = isDiv11 ? 1.5 : 1.0;
    for (let i = 0; i < DEBRIS_COUNT; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const speed = (4 + Math.random() * 10) * speedMult;
      s.push({
        vx: Math.sin(phi) * Math.cos(theta) * speed,
        vy: Math.cos(phi) * speed * 0.6 + 3,
        vz: Math.sin(phi) * Math.sin(theta) * speed,
        size: 0.5 + Math.random(),
        spin: (Math.random() - 0.5) * 10,
      });
    }
    return s;
  }, [DEBRIS_COUNT, isDiv11]);

  // Fresnel shockwave uniforms
  const shockUniforms = useMemo(() => ({
    uOpacity: { value: 0 },
    uProgress: { value: 0 },
    uColor: { value: new THREE.Color('#FFFAF0') },
  }), []);

  // Distortion ring uniforms
  const distortUniforms = useMemo(() => ({
    uOpacity: { value: 0 },
    uTime: { value: 0 },
  }), []);

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();

    // Camera shake — stronger for Division 1.1 (manual: "efectos de onda de choque")
    const shakeMultiplier = isDiv11 ? 1.8 : 1.0;
    if (progress < 0.25 && progress > 0) {
      const shakeMag = 0.025 * intensity * (1 - progress / 0.25) * caliber * 0.5 * shakeMultiplier;
      const freq = 30 + caliber * 5;
      const newOffset = new THREE.Vector3(
        Math.sin(time * freq) * shakeMag,
        Math.cos(time * freq * 1.3) * shakeMag * 0.7,
        Math.sin(time * freq * 0.8) * shakeMag * 0.5
      );
      camera.position.add(newOffset.sub(shakeOffset.current));
      shakeOffset.current.copy(newOffset);
    } else if (shakeOffset.current.lengthSq() > 0.0001) {
      camera.position.sub(shakeOffset.current);
      shakeOffset.current.set(0, 0, 0);
    }

    // Update fresnel shockwave — expands faster for detonante
    if (shockRef.current) {
      const shockSpeed = isDiv11 ? 5 : 4;
      const shockProgress = Math.min(1, progress * shockSpeed);
      const shockRadius = flashSize * (0.5 + shockProgress * 5);
      shockRef.current.scale.setScalar(shockRadius);
      shockUniforms.uOpacity.value = Math.max(0, 0.35 * (1 - shockProgress) * intensity * (isDiv11 ? 1.5 : 1.0));
      shockUniforms.uProgress.value = shockProgress;
    }

    // Update distortion ring
    if (distortionRef.current) {
      const distProgress = Math.min(1, progress * 3);
      const distRadius = flashSize * (1 + distProgress * 8);
      distortionRef.current.scale.set(distRadius, distRadius, 1);
      distortUniforms.uOpacity.value = Math.max(0, 0.2 * (1 - distProgress) * intensity);
      distortUniforms.uTime.value = time;
    }

    // Update debris particles
    if (debrisRef.current && progress > 0 && progress < 0.9) {
      const GRAVITY = -9.81;
      for (let i = 0; i < DEBRIS_COUNT; i++) {
        const seed = debrisSeeds[i];
        const t = progress * 3.5;
        const drag = Math.exp(-0.12 * t);
        debrisPos[i * 3] = seed.vx * t * drag;
        debrisPos[i * 3 + 1] = Math.max(0, seed.vy * t * drag + 0.5 * GRAVITY * t * t * 0.25);
        debrisPos[i * 3 + 2] = seed.vz * t * drag;
        
        const fade = Math.max(0, 1 - progress * 1.3) * 0.8;
        // Charred debris: dark with orange hot spots
        const hotspot = Math.sin(time * seed.spin + i) > 0.7 ? 0.4 : 0;
        debrisCol[i * 3] = (0.12 + hotspot) * fade;
        debrisCol[i * 3 + 1] = (0.06 + hotspot * 0.3) * fade;
        debrisCol[i * 3 + 2] = 0.03 * fade;
      }
      const geo = debrisRef.current.geometry;
      const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
      const colAttr = geo.getAttribute('color') as THREE.BufferAttribute;
      if (posAttr) posAttr.needsUpdate = true;
      if (colAttr) colAttr.needsUpdate = true;
    }

    // Dense post-detonation smoke cloud (manual: detonation produces significant smoke)
    if (smokeCloudRef.current) {
      const smokeProgress = Math.max(0, progress - 0.05);
      const expand = 1 + smokeProgress * caliber * 2.5;
      smokeCloudRef.current.scale.setScalar(expand);
      const mat = smokeCloudRef.current.material as THREE.MeshBasicMaterial;
      const fadeIn = Math.min(1, smokeProgress * 5);
      const fadeOut = Math.max(0, 1 - Math.pow(smokeProgress / 0.8, 1.5));
      mat.opacity = 0.08 * smokeDensity * fadeIn * fadeOut * intensity;
    }

    // Ground scorch fade — larger for detonante (manual: "destrucción del local")
    if (scorchRef.current) {
      const mat = scorchRef.current.material as THREE.MeshBasicMaterial;
      const scorchScale = isDiv11 ? 1.4 : 1.0;
      mat.opacity = progress < 0.4 
        ? Math.min(0.22 * scorchScale, progress * 2.5) 
        : Math.max(0, 0.22 * scorchScale * (1 - (progress - 0.4) * 1.67));
    }
  });

  if (progress < 0 || progress > 1) return null;

  const flashOpacity = progress < flashDuration
    ? intensity * (1 - progress / flashDuration) * (isDiv11 ? 1.2 : 0.9)
    : 0;

  const ringProgress = Math.min(1, progress * 3);
  const ringRadius = flashSize * (1 + ringProgress * 6);
  const ringOpacity = Math.max(0, 0.5 * (1 - ringProgress) * intensity);

  return (
    <group position={position}>
      {/* Central flash sphere — brighter for detonante */}
      {flashOpacity > 0.01 && (
        <mesh ref={flashRef} scale={flashSize * (1 + progress * 2)}>
          <sphereGeometry args={[1, 16, 16]} />
          <meshBasicMaterial
            color={isDiv11 ? '#FFFFFF' : '#FFFAF0'}
            transparent
            opacity={flashOpacity}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* Fresnel shockwave sphere — bright at edges */}
      {progress < 0.3 && (
        <mesh ref={shockRef}>
          <sphereGeometry args={[1, 32, 32]} />
          <shaderMaterial
            vertexShader={SHOCKWAVE_VERTEX}
            fragmentShader={SHOCKWAVE_FRAGMENT}
            uniforms={shockUniforms}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {/* Expanding primary shockwave ring */}
      {ringOpacity > 0.01 && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[ringRadius * 0.85, ringRadius, 48]} />
          <meshBasicMaterial
            color="#FFFFFF"
            transparent
            opacity={ringOpacity}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {/* Air distortion ring — refraction-like shader */}
      {progress < 0.4 && (
        <mesh ref={distortionRef} rotation={[Math.PI / 2, 0, 0]}>
          <planeGeometry args={[2, 2]} />
          <shaderMaterial
            vertexShader={DISTORTION_VERTEX}
            fragmentShader={DISTORTION_FRAGMENT}
            uniforms={distortUniforms}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {/* Dense post-detonation smoke cloud */}
      <mesh ref={smokeCloudRef} position={[0, caliber * 0.3, 0]}>
        <sphereGeometry args={[1, 12, 12]} />
        <meshBasicMaterial
          color="#887766"
          transparent
          opacity={0}
          depthWrite={false}
        />
      </mesh>

      {/* Ground scorch mark — proportional to caliber and risk division */}
      <mesh ref={scorchRef} position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[caliber * (isDiv11 ? 1.2 : 0.9), 24]} />
        <meshBasicMaterial
          color="#0A0500"
          transparent
          opacity={0}
          depthWrite={false}
        />
      </mesh>

      {/* Debris fragments — quadratic scaling */}
      {progress > 0 && progress < 0.9 && (
        <points ref={debrisRef} frustumCulled={false}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[debrisPos, 3]} />
            <bufferAttribute attach="attributes-color" args={[debrisCol, 3]} />
          </bufferGeometry>
          <pointsMaterial
            size={0.1 + caliber * 0.02}
            vertexColors
            transparent
            opacity={0.85}
            depthWrite={false}
            sizeAttenuation
          />
        </points>
      )}

      {/* Ground flash illumination — stronger for detonante */}
      {progress < 0.3 && (
        <pointLight
          color={isDiv11 ? '#FFFFFF' : '#FFFAF0'}
          intensity={caliber * (isDiv11 ? 5.0 : 3.5) * intensity * (1 - progress / 0.3)}
          distance={50 + caliber * 12}
          decay={2}
        />
      )}
    </group>
  );
}
