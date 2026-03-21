import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const FLAME_PARTICLES = 60;
const SMOKE_PARTICLES = 30;

/**
 * BengalEffect — Intense monochromatic ground flare (bengala).
 * Manual de Pirotecnia: Sr=crimson, Ba=green, Cu=blue, Na=yellow.
 * Pure colored flame without sparks, long burn duration, tinted smoke column.
 */
export default function BengalEffect({
  position,
  color,
  progress,
  intensity = 1,
}: {
  position: [number, number, number];
  color: string;
  progress: number;
  intensity?: number;
}) {
  const flameRef = useRef<THREE.Points>(null);
  const smokeRef = useRef<THREE.Points>(null);
  const baseColor = useMemo(() => new THREE.Color(color), [color]);

  const flamePos = useMemo(() => new Float32Array(FLAME_PARTICLES * 3), []);
  const flameCol = useMemo(() => new Float32Array(FLAME_PARTICLES * 3), []);
  const smokePos = useMemo(() => new Float32Array(SMOKE_PARTICLES * 3), []);
  const smokeCol = useMemo(() => new Float32Array(SMOKE_PARTICLES * 3), []);

  const seeds = useMemo(() => {
    const s: { phase: number; speed: number; spread: number; lt: number }[] = [];
    for (let i = 0; i < FLAME_PARTICLES; i++) {
      s.push({
        phase: Math.random() * Math.PI * 2,
        speed: 0.5 + Math.random() * 1.5,
        spread: Math.random() * 0.15,
        lt: 0.3 + Math.random() * 0.5,
      });
    }
    return s;
  }, []);

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();
    const active = progress > 0.02 && progress < 0.95;
    const fadeIn = Math.min(1, progress * 10);
    const fadeOut = Math.min(1, (1 - progress) * 10);
    const envelope = fadeIn * fadeOut * intensity;

    // Flame particles — pure colored flame rising
    if (flameRef.current && active) {
      for (let i = 0; i < FLAME_PARTICLES; i++) {
        const seed = seeds[i];
        const cycle = ((time * 3 + seed.phase) % seed.lt) / seed.lt;
        const t = cycle * seed.lt;

        flamePos[i * 3] = Math.sin(time * 2 + seed.phase) * seed.spread * 0.3;
        flamePos[i * 3 + 1] = seed.speed * t * 0.8;
        flamePos[i * 3 + 2] = Math.cos(time * 1.5 + seed.phase) * seed.spread * 0.3;

        const fade = (1 - cycle) * envelope;
        const thermal = 1 - cycle * 0.6;
        // White-hot core transitioning to compound color
        flameCol[i * 3] = THREE.MathUtils.lerp(1.0, baseColor.r * 1.4, cycle * 0.7) * fade;
        flameCol[i * 3 + 1] = THREE.MathUtils.lerp(0.95, baseColor.g * 1.4, cycle * 0.8) * fade;
        flameCol[i * 3 + 2] = THREE.MathUtils.lerp(0.7, baseColor.b * 1.4, cycle * 0.85) * fade;
      }
      const geo = flameRef.current.geometry;
      (geo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
      (geo.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
    }

    // Tinted smoke column
    if (smokeRef.current && active) {
      for (let i = 0; i < SMOKE_PARTICLES; i++) {
        const age = ((time * 0.5 + i * 0.3) % 3) / 3;
        smokePos[i * 3] = Math.sin(time * 0.3 + i) * 0.2 * age;
        smokePos[i * 3 + 1] = 0.5 + age * 4;
        smokePos[i * 3 + 2] = Math.cos(time * 0.25 + i) * 0.15 * age;

        const smokeFade = Math.max(0, (1 - age) * 0.3) * envelope;
        // Tinted by compound color (per manual: bengal smoke carries color tint)
        smokeCol[i * 3] = (0.3 + baseColor.r * 0.15) * smokeFade;
        smokeCol[i * 3 + 1] = (0.28 + baseColor.g * 0.15) * smokeFade;
        smokeCol[i * 3 + 2] = (0.25 + baseColor.b * 0.15) * smokeFade;
      }
      const geo = smokeRef.current.geometry;
      (geo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
      (geo.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
    }
  });

  if (progress <= 0 || progress > 1) return null;

  return (
    <group position={position}>
      {/* Central bright flame glow */}
      <mesh position={[0, 0.15, 0]}>
        <sphereGeometry args={[0.12, 8, 8]} />
        <meshBasicMaterial color={color} transparent opacity={0.7 * intensity} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0.2, 0]}>
        <sphereGeometry args={[0.06, 6, 6]} />
        <meshBasicMaterial color="#FFFFF0" transparent opacity={0.5 * intensity} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>

      {/* Ground illumination */}
      <pointLight color={color} intensity={2 * intensity} distance={15} decay={2} position={[0, 0.3, 0]} />

      {/* Flame particles */}
      <points ref={flameRef} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[flamePos, 3]} />
          <bufferAttribute attach="attributes-color" args={[flameCol, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.1} vertexColors transparent opacity={0.85} depthWrite={false} blending={THREE.AdditiveBlending} sizeAttenuation />
      </points>

      {/* Smoke column */}
      <points ref={smokeRef} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[smokePos, 3]} />
          <bufferAttribute attach="attributes-color" args={[smokeCol, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.4} vertexColors transparent opacity={0.3} depthWrite={false} sizeAttenuation />
      </points>
    </group>
  );
}
