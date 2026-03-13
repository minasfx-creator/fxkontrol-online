import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const PARTICLE_COUNT = 200;

/**
 * Waterfall / Cascade Effect: Sparks falling from an elevated line.
 * Simulates silver/gold waterfall curtains used in stage pyro.
 */
export default function WaterfallEffect({
  position,
  color,
  progress,
  width = 5,
}: {
  position: [number, number, number];
  color: string;
  progress: number;
  width?: number;
}) {
  const pointsRef = useRef<THREE.Points>(null);
  const baseColor = useMemo(() => new THREE.Color(color), [color]);

  const seeds = useMemo(() => {
    const s: { x: number; vy: number; vx: number; lt: number; phase: number }[] = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      s.push({
        x: (Math.random() - 0.5) * width,
        vy: -1 - Math.random() * 3,
        vx: (Math.random() - 0.5) * 0.5,
        lt: 1.5 + Math.random() * 2,
        phase: Math.random() * Math.PI * 2,
      });
    }
    return s;
  }, [width]);

  useFrame(({ clock }) => {
    if (!pointsRef.current) return;
    const posArr = new Float32Array(PARTICLE_COUNT * 3);
    const colArr = new Float32Array(PARTICLE_COUNT * 3);
    const time = clock.getElapsedTime();

    // Waterfall active based on progress (continuous effect)
    const intensity = progress < 0.05 ? progress / 0.05 : progress > 0.9 ? (1 - progress) / 0.1 : 1;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const seed = seeds[i];
      // Each particle cycles continuously during the effect
      const cycleTime = ((time * 0.5 + seed.phase) % seed.lt) / seed.lt;
      
      if (cycleTime > intensity) {
        posArr[i * 3] = 0; posArr[i * 3 + 1] = -100; posArr[i * 3 + 2] = 0;
        colArr[i * 3] = 0; colArr[i * 3 + 1] = 0; colArr[i * 3 + 2] = 0;
        continue;
      }

      const t = cycleTime * seed.lt;
      posArr[i * 3] = seed.x + seed.vx * t + Math.sin(time + seed.phase) * 0.1;
      posArr[i * 3 + 1] = seed.vy * t - 4.9 * t * t; // gravity
      posArr[i * 3 + 2] = Math.sin(seed.phase + time * 0.5) * 0.2;

      const fade = Math.max(0, 1 - cycleTime) * intensity;
      const sparkle = 0.6 + Math.sin(i * 7 + time * 30) * 0.4;
      colArr[i * 3] = baseColor.r * fade * sparkle;
      colArr[i * 3 + 1] = baseColor.g * fade * sparkle * 0.9;
      colArr[i * 3 + 2] = baseColor.b * fade * sparkle * 0.7;
    }

    const geo = pointsRef.current.geometry;
    geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colArr, 3));
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
  });

  return (
    <group position={position}>
      {/* Top emission line glow */}
      <mesh position={[0, 0.1, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.05, 0.05, width, 8]} />
        <meshBasicMaterial color={color} transparent opacity={0.15 * (progress < 0.9 ? 1 : (1 - progress) / 0.1)} blending={THREE.AdditiveBlending} />
      </mesh>
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[new Float32Array(PARTICLE_COUNT * 3), 3]} />
          <bufferAttribute attach="attributes-color" args={[new Float32Array(PARTICLE_COUNT * 3), 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.12} vertexColors transparent opacity={0.9} depthWrite={false} blending={THREE.AdditiveBlending} sizeAttenuation />
      </points>
    </group>
  );
}
