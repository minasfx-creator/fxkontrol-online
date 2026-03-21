import { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * SaluteEffect — Concussive flash + expanding shockwave + volumetric sphere + debris.
 * Niagara-grade: fresnel shockwave, debris particles, ground scorch.
 */

const DEBRIS_COUNT = 30;

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
  const ringRef = useRef<THREE.Mesh>(null);
  const shockSphereRef = useRef<THREE.Mesh>(null);
  const debrisRef = useRef<THREE.Points>(null);
  const { camera } = useThree();
  const shakeOffset = useRef(new THREE.Vector3());

  const flashSize = 2 + caliber * 1.2;
  const flashDuration = 0.15;

  // Pre-allocate debris buffers
  const debrisPos = useMemo(() => new Float32Array(DEBRIS_COUNT * 3), []);
  const debrisCol = useMemo(() => new Float32Array(DEBRIS_COUNT * 3), []);

  // Debris seeds
  const debrisSeeds = useMemo(() => {
    const s: { vx: number; vy: number; vz: number }[] = [];
    for (let i = 0; i < DEBRIS_COUNT; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const speed = 3 + Math.random() * 8;
      s.push({
        vx: Math.sin(phi) * Math.cos(theta) * speed,
        vy: Math.cos(phi) * speed * 0.6 + 2,
        vz: Math.sin(phi) * Math.sin(theta) * speed,
      });
    }
    return s;
  }, []);

  // Camera shake
  useFrame(() => {
    if (progress < 0.2 && progress > 0) {
      const shakeMag = 0.02 * intensity * (1 - progress / 0.2) * caliber * 0.5;
      const newOffset = new THREE.Vector3(
        (Math.random() - 0.5) * shakeMag,
        (Math.random() - 0.5) * shakeMag,
        (Math.random() - 0.5) * shakeMag
      );
      camera.position.add(newOffset.sub(shakeOffset.current));
      shakeOffset.current.copy(newOffset);
    } else if (shakeOffset.current.lengthSq() > 0.0001) {
      camera.position.sub(shakeOffset.current);
      shakeOffset.current.set(0, 0, 0);
    }

    // Update debris particles
    if (debrisRef.current && progress > 0 && progress < 0.8) {
      const GRAVITY = -9.81;
      for (let i = 0; i < DEBRIS_COUNT; i++) {
        const seed = debrisSeeds[i];
        const t = progress * 3;
        const drag = Math.exp(-0.1 * t);
        debrisPos[i * 3] = seed.vx * t * drag;
        debrisPos[i * 3 + 1] = Math.max(0, seed.vy * t * drag + 0.5 * GRAVITY * t * t * 0.3);
        debrisPos[i * 3 + 2] = seed.vz * t * drag;
        
        const fade = Math.max(0, 1 - progress * 1.5) * 0.7;
        debrisCol[i * 3] = 0.15 * fade;
        debrisCol[i * 3 + 1] = 0.08 * fade;
        debrisCol[i * 3 + 2] = 0.04 * fade;
      }
      const geo = debrisRef.current.geometry;
      const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
      const colAttr = geo.getAttribute('color') as THREE.BufferAttribute;
      if (posAttr) posAttr.needsUpdate = true;
      if (colAttr) colAttr.needsUpdate = true;
    }
  });

  if (progress < 0 || progress > 1) return null;

  const flashOpacity = progress < flashDuration
    ? intensity * (1 - progress / flashDuration) * 0.9
    : 0;

  const ringProgress = Math.min(1, progress * 3);
  const ringRadius = flashSize * (1 + ringProgress * 6);
  const ringOpacity = Math.max(0, 0.5 * (1 - ringProgress) * intensity);

  // Volumetric shockwave sphere
  const shockProgress = Math.min(1, progress * 4);
  const shockRadius = flashSize * (0.5 + shockProgress * 4);
  const shockOpacity = Math.max(0, 0.25 * (1 - shockProgress) * intensity);

  // Ground scorch
  const scorchOpacity = progress < 0.5 
    ? Math.min(0.15, progress * 2) 
    : Math.max(0, 0.15 * (1 - (progress - 0.5) * 2));

  return (
    <group position={position}>
      {/* Central flash sphere */}
      {flashOpacity > 0.01 && (
        <mesh ref={flashRef} scale={flashSize * (1 + progress * 2)}>
          <sphereGeometry args={[1, 16, 16]} />
          <meshBasicMaterial
            color="#FFFAF0"
            transparent
            opacity={flashOpacity}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* Volumetric shockwave sphere — fresnel-like edge glow */}
      {shockOpacity > 0.01 && (
        <mesh ref={shockSphereRef} scale={shockRadius}>
          <sphereGeometry args={[1, 24, 24]} />
          <meshBasicMaterial
            color="#FFFAF0"
            transparent
            opacity={shockOpacity * 0.3}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            side={THREE.BackSide}
          />
        </mesh>
      )}

      {/* Expanding shockwave ring */}
      {ringOpacity > 0.01 && (
        <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
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

      {/* Second air distortion ring — wider, dimmer */}
      {ringOpacity > 0.01 && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[ringRadius * 1.2, ringRadius * 1.35, 48]} />
          <meshBasicMaterial
            color="#CCDDFF"
            transparent
            opacity={ringOpacity * 0.25}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {/* Ground scorch mark */}
      {scorchOpacity > 0.005 && (
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[caliber * 0.8, 24]} />
          <meshBasicMaterial
            color="#0A0500"
            transparent
            opacity={scorchOpacity}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* Debris fragments */}
      {progress > 0 && progress < 0.8 && (
        <points ref={debrisRef} frustumCulled={false}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[debrisPos, 3]} />
            <bufferAttribute attach="attributes-color" args={[debrisCol, 3]} />
          </bufferGeometry>
          <pointsMaterial
            size={0.12}
            vertexColors
            transparent
            opacity={0.8}
            depthWrite={false}
            sizeAttenuation
          />
        </points>
      )}

      {/* Ground flash illumination */}
      {progress < 0.3 && (
        <pointLight
          color="#FFFAF0"
          intensity={caliber * 3 * intensity * (1 - progress / 0.3)}
          distance={50 + caliber * 10}
          decay={2}
        />
      )}
    </group>
  );
}
