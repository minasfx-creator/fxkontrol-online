import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const PARTICLE_COUNT = 120;

/**
 * Flame Projector Effect: Realistic LPG flame columns.
 * Supports Flamaniac, G-Flame, Wave Flamer style systems.
 */
export default function FlameEffect({
  position,
  color,
  progress,
  height = 8,
}: {
  position: [number, number, number];
  color: string;
  progress: number;
  height?: number;
}) {
  const pointsRef = useRef<THREE.Points>(null);

  const seeds = useMemo(() => {
    const s: { angle: number; speed: number; spread: number; lt: number; phase: number }[] = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      s.push({
        angle: Math.random() * Math.PI * 2,
        speed: height * (0.4 + Math.random() * 0.6),
        spread: 0.08 + Math.random() * 0.15,
        lt: 0.2 + Math.random() * 0.35,
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

    const intensity = progress < 0.1 ? progress / 0.1 : progress > 0.85 ? (1 - progress) / 0.15 : 1;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const seed = seeds[i];
      const cycleTime = ((time * 3 + seed.phase) % seed.lt) / seed.lt;

      if (cycleTime > intensity) {
        posArr[i * 3] = 0; posArr[i * 3 + 1] = -100; posArr[i * 3 + 2] = 0;
        colArr[i * 3] = 0; colArr[i * 3 + 1] = 0; colArr[i * 3 + 2] = 0;
        continue;
      }

      const t = cycleTime * seed.lt;
      posArr[i * 3] = Math.cos(seed.angle) * seed.spread * t * height * 0.5;
      posArr[i * 3 + 1] = seed.speed * t + Math.sin(time * 5 + i) * 0.2 * t;
      posArr[i * 3 + 2] = Math.sin(seed.angle) * seed.spread * t * height * 0.5;

      const fade = Math.max(0, 1 - cycleTime) * intensity;
      // Flame gradient: blue base → white → yellow → orange → red tip
      const h = cycleTime;
      if (h < 0.2) {
        // Blue base
        colArr[i * 3] = 0.2 * fade; colArr[i * 3 + 1] = 0.4 * fade; colArr[i * 3 + 2] = 1.0 * fade;
      } else if (h < 0.4) {
        // White-hot core
        colArr[i * 3] = 1.0 * fade; colArr[i * 3 + 1] = 0.95 * fade; colArr[i * 3 + 2] = 0.8 * fade;
      } else if (h < 0.7) {
        // Yellow-orange
        colArr[i * 3] = 1.0 * fade; colArr[i * 3 + 1] = 0.6 * fade; colArr[i * 3 + 2] = 0.1 * fade;
      } else {
        // Red tip fading
        colArr[i * 3] = 0.8 * fade; colArr[i * 3 + 1] = 0.15 * fade; colArr[i * 3 + 2] = 0.02 * fade;
      }
    }

    const geo = pointsRef.current.geometry;
    geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colArr, 3));
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
  });

  return (
    <group position={position}>
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[new Float32Array(PARTICLE_COUNT * 3), 3]} />
          <bufferAttribute attach="attributes-color" args={[new Float32Array(PARTICLE_COUNT * 3), 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.25} vertexColors transparent opacity={0.85} depthWrite={false} blending={THREE.AdditiveBlending} sizeAttenuation />
      </points>
      {/* Core glow column */}
      {progress > 0.05 && progress < 0.9 && (
        <mesh position={[0, height * 0.3, 0]}>
          <cylinderGeometry args={[0.15, 0.4, height * 0.6, 8]} />
          <meshBasicMaterial color="#FF6600" transparent opacity={0.08} blending={THREE.AdditiveBlending} />
        </mesh>
      )}
    </group>
  );
}
