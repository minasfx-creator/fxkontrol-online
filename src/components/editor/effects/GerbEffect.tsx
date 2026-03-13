import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const PARTICLE_COUNT = 150;

/**
 * Gerb / Fountain Effect: Continuous upward spray of sparks from ground level.
 * Cold spark fountains, silver/gold gerbs — continuous device.
 */
export default function GerbEffect({
  position,
  color,
  progress,
  height = 5,
}: {
  position: [number, number, number];
  color: string;
  progress: number;
  height?: number;
}) {
  const pointsRef = useRef<THREE.Points>(null);
  const baseColor = useMemo(() => new THREE.Color(color), [color]);

  const seeds = useMemo(() => {
    const s: { angle: number; speed: number; spread: number; lt: number; phase: number }[] = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      s.push({
        angle: Math.random() * Math.PI * 2,
        speed: height * (0.6 + Math.random() * 0.8),
        spread: 0.1 + Math.random() * 0.2,
        lt: 0.6 + Math.random() * 0.8,
        phase: Math.random() * Math.PI * 2,
      });
    }
    return s;
  }, [height]);

  useFrame(({ clock }) => {
    if (!pointsRef.current) return;
    const posArr = new Float32Array(PARTICLE_COUNT * 3);
    const colArr = new Float32Array(PARTICLE_COUNT * 3);
    const time = clock.getElapsedTime();
    const GRAVITY = -9.81;
    
    const intensity = progress < 0.05 ? progress / 0.05 : progress > 0.9 ? (1 - progress) / 0.1 : 1;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const seed = seeds[i];
      const cycleTime = ((time * 1.5 + seed.phase) % seed.lt) / seed.lt;
      
      if (cycleTime > intensity) {
        posArr[i * 3] = 0; posArr[i * 3 + 1] = -100; posArr[i * 3 + 2] = 0;
        colArr[i * 3] = 0; colArr[i * 3 + 1] = 0; colArr[i * 3 + 2] = 0;
        continue;
      }

      const t = cycleTime * seed.lt;
      posArr[i * 3] = Math.cos(seed.angle) * seed.spread * height * t;
      posArr[i * 3 + 1] = Math.max(0, seed.speed * t + 0.5 * GRAVITY * t * t);
      posArr[i * 3 + 2] = Math.sin(seed.angle) * seed.spread * height * t;

      const fade = Math.max(0, 1 - cycleTime * 0.8) * intensity;
      // Sparks: white-hot at base, colored at top
      const heightFactor = cycleTime;
      colArr[i * 3] = THREE.MathUtils.lerp(1, baseColor.r, heightFactor) * fade;
      colArr[i * 3 + 1] = THREE.MathUtils.lerp(0.9, baseColor.g, heightFactor) * fade;
      colArr[i * 3 + 2] = THREE.MathUtils.lerp(0.5, baseColor.b, heightFactor) * fade;
    }

    const geo = pointsRef.current.geometry;
    geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colArr, 3));
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
  });

  return (
    <group position={position}>
      {/* Base glow */}
      <mesh position={[0, 0.1, 0]}>
        <sphereGeometry args={[0.3, 8, 8]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.2 * (progress > 0.05 && progress < 0.9 ? 1 : 0)}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[new Float32Array(PARTICLE_COUNT * 3), 3]} />
          <bufferAttribute attach="attributes-color" args={[new Float32Array(PARTICLE_COUNT * 3), 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.1} vertexColors transparent opacity={0.95} depthWrite={false} blending={THREE.AdditiveBlending} sizeAttenuation />
      </points>
    </group>
  );
}
