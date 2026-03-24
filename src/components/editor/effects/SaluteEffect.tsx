import { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { getMaterialType, getRiskDivision, getBurstSmokeDensity, getParticleSize } from '@/lib/pyroPhysics';
import { injectDensity, injectTemperature, type FluidGrid } from '@/render_ultra/fireworks/niagaraFluids';

/**
 * SaluteEffect — Concussive flash + fresnel shockwave + heat distortion + fluid grid injection.
 * Enhanced with HeatHaze particles and NiagaraFluids integration for post-detonation smoke advection.
 */

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
    float fresnel = 1.0 - abs(dot(vNormal, vViewDir));
    fresnel = pow(fresnel, 3.0);
    float ring = smoothstep(0.6, 0.8, fresnel) * 0.5;
    vec3 edgeColor = mix(uColor, vec3(0.8, 0.9, 1.0), fresnel * 0.5);
    float alpha = (fresnel * 0.8 + ring) * uOpacity;
    gl_FragColor = vec4(edgeColor * (1.0 + fresnel * 2.0), alpha);
  }
`;

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
    float ring = smoothstep(0.7, 0.85, dist) * smoothstep(1.0, 0.9, dist);
    float n = hash(centered * 10.0 + vec2(uTime));
    ring *= 0.7 + n * 0.3;
    vec3 col = vec3(0.95, 0.97, 1.0);
    gl_FragColor = vec4(col, ring * uOpacity);
  }
`;

// Heat haze particles shader
const HEAT_HAZE_VERTEX = `
  attribute float aHeatIntensity;
  attribute float aHeatSize;
  varying float vIntensity;
  void main() {
    vIntensity = aHeatIntensity;
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPos;
    gl_PointSize = clamp(aHeatSize * (300.0 / -mvPos.z), 1.0, 80.0);
  }
`;

const HEAT_HAZE_FRAGMENT = `
  uniform float uTime;
  varying float vIntensity;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float circle = 1.0 - smoothstep(0.0, 1.0, d);
    if (circle < 0.01) discard;
    float shimmer = 0.5 + 0.5 * sin(uTime * 10.0 + gl_PointCoord.x * 25.0);
    float alpha = circle * vIntensity * shimmer * 0.05;
    gl_FragColor = vec4(1.0, 0.98, 0.95, alpha);
  }
`;

const HEAT_HAZE_COUNT = 16;

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
  const heatHazeRef = useRef<THREE.Points>(null);
  const { camera } = useThree();
  const shakeOffset = useRef(new THREE.Vector3());
  const fluidInjectedRef = useRef(false);

  const materialType = useMemo(() => getMaterialType('salute'), []);
  const riskDivision = useMemo(() => getRiskDivision(caliber, materialType), [caliber, materialType]);
  const smokeDensity = useMemo(() => getBurstSmokeDensity(caliber), [caliber]);
  
  const isDiv11 = riskDivision === '1.1';
  const flashSize = 2 + caliber * 1.2 * (isDiv11 ? 1.4 : 1.0);
  const flashDuration = isDiv11 ? 0.12 : 0.15;

  const DEBRIS_COUNT = useMemo(() => Math.round(20 + caliber * caliber * 3), [caliber]);

  const debrisPos = useMemo(() => new Float32Array(DEBRIS_COUNT * 3), [DEBRIS_COUNT]);
  const debrisCol = useMemo(() => new Float32Array(DEBRIS_COUNT * 3), [DEBRIS_COUNT]);

  // Heat haze buffers
  const heatPos = useMemo(() => new Float32Array(HEAT_HAZE_COUNT * 3), []);
  const heatIntensity2 = useMemo(() => new Float32Array(HEAT_HAZE_COUNT), []);
  const heatSize = useMemo(() => new Float32Array(HEAT_HAZE_COUNT), []);
  const heatHazeSeeds = useMemo(() => {
    return Array.from({ length: HEAT_HAZE_COUNT }, () => ({
      angle: Math.random() * Math.PI * 2,
      spread: 1 + Math.random() * caliber * 2,
      riseSpeed: 1 + Math.random() * 2,
      phase: Math.random() * Math.PI * 2,
    }));
  }, [caliber]);

  const heatUniforms = useMemo(() => ({ uTime: { value: 0 } }), []);

  const debrisSeeds = useMemo(() => {
    const s: { vx: number; vy: number; vz: number; size: number; spin: number }[] = [];
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

  const shockUniforms = useMemo(() => ({
    uOpacity: { value: 0 },
    uProgress: { value: 0 },
    uColor: { value: new THREE.Color('#FFFAF0') },
  }), []);

  const distortUniforms = useMemo(() => ({
    uOpacity: { value: 0 },
    uTime: { value: 0 },
  }), []);

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();

    // Inject into fluid grid on detonation
    const fluidGrid = (window as any).__niagaraFluidGrid as FluidGrid | undefined;
    if (fluidGrid && progress > 0.01 && progress < 0.1 && !fluidInjectedRef.current) {
      injectDensity(fluidGrid, position[0], position[2], 5.0 * caliber, caliber * 3);
      injectTemperature(fluidGrid, position[0], position[2], 8.0 * caliber, caliber * 2);
      fluidInjectedRef.current = true;
    }
    if (progress <= 0) fluidInjectedRef.current = false;

    // Camera shake
    const shakeMultiplier = isDiv11 ? 1.8 : 1.0;
    if (progress < 0.25 && progress > 0) {
      const shakeMag = 0.025 * intensity * (1 - progress / 0.25) * caliber * 0.5 * shakeMultiplier;
      const freq = 30 + caliber * 5;
      // Compute new desired offset
      const nx = Math.sin(time * freq) * shakeMag;
      const ny = Math.cos(time * freq * 1.3) * shakeMag * 0.7;
      const nz = Math.sin(time * freq * 0.8) * shakeMag * 0.5;
      // Apply delta (new - old)
      camera.position.x += nx - shakeOffset.current.x;
      camera.position.y += ny - shakeOffset.current.y;
      camera.position.z += nz - shakeOffset.current.z;
      shakeOffset.current.set(nx, ny, nz);
    } else if (shakeOffset.current.lengthSq() > 0.0001) {
      camera.position.sub(shakeOffset.current);
      shakeOffset.current.set(0, 0, 0);
    }

    if (shockRef.current) {
      const shockSpeed = isDiv11 ? 5 : 4;
      const shockProgress = Math.min(1, progress * shockSpeed);
      const shockRadius = flashSize * (0.5 + shockProgress * 5);
      shockRef.current.scale.setScalar(shockRadius);
      shockUniforms.uOpacity.value = Math.max(0, 0.35 * (1 - shockProgress) * intensity * (isDiv11 ? 1.5 : 1.0));
      shockUniforms.uProgress.value = shockProgress;
    }

    if (distortionRef.current) {
      const distProgress = Math.min(1, progress * 3);
      const distRadius = flashSize * (1 + distProgress * 8);
      distortionRef.current.scale.set(distRadius, distRadius, 1);
      distortUniforms.uOpacity.value = Math.max(0, 0.2 * (1 - distProgress) * intensity);
      distortUniforms.uTime.value = time;
    }

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

    // Heat haze particles — shimmer above detonation
    if (heatHazeRef.current && progress > 0.05 && progress < 0.8) {
      heatUniforms.uTime.value = time;
      const hazeIntensity = progress < 0.15 ? (progress - 0.05) / 0.1 : Math.max(0, 1 - (progress - 0.15) / 0.65);
      for (let i = 0; i < HEAT_HAZE_COUNT; i++) {
        const seed = heatHazeSeeds[i];
        const age = progress - 0.05;
        heatPos[i * 3] = Math.cos(seed.angle) * seed.spread * 0.3 + Math.sin(time * 2 + seed.phase) * 0.3;
        heatPos[i * 3 + 1] = seed.riseSpeed * age * 3 + 1;
        heatPos[i * 3 + 2] = Math.sin(seed.angle) * seed.spread * 0.3 + Math.cos(time * 1.5 + seed.phase) * 0.25;
        heatIntensity2[i] = hazeIntensity * intensity;
        heatSize[i] = 25 + age * 30;
      }
      const hGeo = heatHazeRef.current.geometry;
      const hPos = hGeo.getAttribute('position') as THREE.BufferAttribute;
      const hInt = hGeo.getAttribute('aHeatIntensity') as THREE.BufferAttribute;
      const hSz = hGeo.getAttribute('aHeatSize') as THREE.BufferAttribute;
      if (hPos) hPos.needsUpdate = true;
      if (hInt) hInt.needsUpdate = true;
      if (hSz) hSz.needsUpdate = true;
    }

    if (smokeCloudRef.current) {
      const smokeProgress = Math.max(0, progress - 0.05);
      const expand = 1 + smokeProgress * caliber * 2.5;
      smokeCloudRef.current.scale.setScalar(expand);
      const mat = smokeCloudRef.current.material as THREE.MeshBasicMaterial;
      const fadeIn = Math.min(1, smokeProgress * 5);
      const fadeOut = Math.max(0, 1 - Math.pow(smokeProgress / 0.8, 1.5));
      mat.opacity = 0.08 * smokeDensity * fadeIn * fadeOut * intensity;
    }

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
      {flashOpacity > 0.01 && (
        <mesh ref={flashRef} scale={flashSize * (1 + progress * 2)}>
          <sphereGeometry args={[1, 16, 16]} />
          <meshBasicMaterial color={isDiv11 ? '#FFFFFF' : '#FFFAF0'} transparent opacity={flashOpacity} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      )}

      {progress < 0.3 && (
        <mesh ref={shockRef}>
          <sphereGeometry args={[1, 32, 32]} />
          <shaderMaterial vertexShader={SHOCKWAVE_VERTEX} fragmentShader={SHOCKWAVE_FRAGMENT} uniforms={shockUniforms} transparent depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
        </mesh>
      )}

      {ringOpacity > 0.01 && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[ringRadius * 0.85, ringRadius, 48]} />
          <meshBasicMaterial color="#FFFFFF" transparent opacity={ringOpacity} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      )}

      {progress < 0.4 && (
        <mesh ref={distortionRef} rotation={[Math.PI / 2, 0, 0]}>
          <planeGeometry args={[2, 2]} />
          <shaderMaterial vertexShader={DISTORTION_VERTEX} fragmentShader={DISTORTION_FRAGMENT} uniforms={distortUniforms} transparent depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Heat haze particles */}
      {progress > 0.05 && progress < 0.8 && (
        <points ref={heatHazeRef} frustumCulled={false} renderOrder={999}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[heatPos, 3]} />
            <bufferAttribute attach="attributes-aHeatIntensity" args={[heatIntensity2, 1]} />
            <bufferAttribute attach="attributes-aHeatSize" args={[heatSize, 1]} />
          </bufferGeometry>
          <shaderMaterial vertexShader={HEAT_HAZE_VERTEX} fragmentShader={HEAT_HAZE_FRAGMENT} uniforms={heatUniforms} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
        </points>
      )}

      <mesh ref={smokeCloudRef} position={[0, caliber * 0.3, 0]}>
        <sphereGeometry args={[1, 12, 12]} />
        <meshBasicMaterial color="#887766" transparent opacity={0} depthWrite={false} />
      </mesh>

      <mesh ref={scorchRef} position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[caliber * (isDiv11 ? 1.2 : 0.9), 24]} />
        <meshBasicMaterial color="#0A0500" transparent opacity={0} depthWrite={false} />
      </mesh>

      {progress > 0 && progress < 0.9 && (
        <points ref={debrisRef} frustumCulled={false}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[debrisPos, 3]} />
            <bufferAttribute attach="attributes-color" args={[debrisCol, 3]} />
          </bufferGeometry>
          <pointsMaterial size={getParticleSize(caliber) * 0.05} vertexColors transparent opacity={0.85} depthWrite={false} sizeAttenuation />
        </points>
      )}

      {progress < 0.3 && (
        <pointLight color={isDiv11 ? '#FFFFFF' : '#FFFAF0'} intensity={caliber * (isDiv11 ? 5.0 : 3.5) * intensity * (1 - progress / 0.3)} distance={50 + caliber * 12} decay={2} />
      )}
    </group>
  );
}
