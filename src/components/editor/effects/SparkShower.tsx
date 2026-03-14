import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const SPARK_COUNT = 150;

/**
 * SparkShower: Dense shower of tiny bright sparks cascading down.
 * Used as overlay for shells, cakes, waterfalls to add crackling detail.
 */
export default function SparkShower({
  position,
  color,
  progress,
  height = 20,
  spread = 6,
}: {
  position: [number, number, number];
  color: string;
  progress: number;
  height?: number;
  spread?: number;
}) {
  const pointsRef = useRef<THREE.Points>(null);
  const baseColor = useMemo(() => new THREE.Color(color), [color]);

  const seeds = useMemo(() => {
    const s: { angle: number; r: number; vy: number; phase: number; lt: number; speed: number }[] = [];
    for (let i = 0; i < SPARK_COUNT; i++) {
      s.push({
        angle: Math.random() * Math.PI * 2,
        r: Math.random() * spread,
        vy: -2 - Math.random() * 6,
        phase: Math.random() * Math.PI * 2,
        lt: 0.3 + Math.random() * 1.2,
        speed: 0.5 + Math.random() * 2,
      });
    }
    return s;
  }, [spread]);

  useFrame(({ clock }) => {
    if (!pointsRef.current || progress < 0.1 || progress > 0.95) return;
    const posArr = new Float32Array(SPARK_COUNT * 3);
    const colArr = new Float32Array(SPARK_COUNT * 3);
    const time = clock.getElapsedTime();

    for (let i = 0; i < SPARK_COUNT; i++) {
      const seed = seeds[i];
      const cycleTime = ((time * seed.speed + seed.phase) % seed.lt) / seed.lt;
      
      const x = Math.cos(seed.angle) * seed.r * (0.5 + cycleTime * 0.5);
      const y = height * (1 - cycleTime * 0.3) + seed.vy * cycleTime * seed.lt;
      const z = Math.sin(seed.angle) * seed.r * (0.5 + cycleTime * 0.5);

      if (y < 0) {
        posArr[i * 3] = 0; posArr[i * 3 + 1] = -100; posArr[i * 3 + 2] = 0;
        colArr[i * 3] = 0; colArr[i * 3 + 1] = 0; colArr[i * 3 + 2] = 0;
        continue;
      }

      posArr[i * 3] = x;
      posArr[i * 3 + 1] = y;
      posArr[i * 3 + 2] = z;

      const fade = Math.max(0, 1 - cycleTime);
      // Quick bright flash then dim
      const flash = cycleTime < 0.1 ? 1.5 : 1;
      const flicker = 0.6 + Math.sin(i * 23 + time * 50) * 0.4;
      colArr[i * 3] = Math.min(1, baseColor.r * fade * flash * flicker * 1.2);
      colArr[i * 3 + 1] = Math.min(1, baseColor.g * fade * flash * flicker * 0.8);
      colArr[i * 3 + 2] = Math.min(1, baseColor.b * fade * flash * flicker * 0.5);
    }

    const geo = pointsRef.current.geometry;
    geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colArr, 3));
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
  });

  if (progress < 0.1 || progress > 0.95) return null;

  return (
    <group position={position}>
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[new Float32Array(SPARK_COUNT * 3), 3]} />
          <bufferAttribute attach="attributes-color" args={[new Float32Array(SPARK_COUNT * 3), 3]} />
        </bufferGeometry>
        <pointsMaterial
          size={0.04}
          vertexColors
          transparent
          opacity={0.9}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          sizeAttenuation
        />
      </points>
    </group>
  );
}
