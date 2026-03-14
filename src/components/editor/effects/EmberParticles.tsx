import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const EMBER_COUNT = 100;

/**
 * Ember / Falling Spark Particles: Glowing embers that drift down after a burst.
 */
function EmberParticlesInner({
  position,
  color,
  progress,
  spreadRadius = 8,
  startHeight = 15,
}: {
  position: [number, number, number];
  color: string;
  progress: number;
  spreadRadius?: number;
  startHeight?: number;
}) {
  const pointsRef = useRef<THREE.Points>(null);
  const baseColor = useMemo(() => new THREE.Color(color), [color]);

  const seeds = useMemo(() => {
    const s: { x: number; z: number; vy: number; drift: number; lt: number; flicker: number }[] = [];
    for (let i = 0; i < EMBER_COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * spreadRadius;
      s.push({
        x: Math.cos(angle) * r,
        z: Math.sin(angle) * r,
        vy: -1.5 - Math.random() * 4,
        drift: (Math.random() - 0.5) * 0.6,
        lt: 1.5 + Math.random() * 3.5,
        flicker: 15 + Math.random() * 50,
      });
    }
    return s;
  }, [spreadRadius]);

  useFrame(({ clock }) => {
    if (!pointsRef.current || progress < 0.15) return;
    const posArr = new Float32Array(EMBER_COUNT * 3);
    const colArr = new Float32Array(EMBER_COUNT * 3);
    const time = clock.getElapsedTime();
    const emberProgress = (progress - 0.15) / 0.85;

    for (let i = 0; i < EMBER_COUNT; i++) {
      const seed = seeds[i];
      const age = emberProgress * seed.lt;
      if (age <= 0 || age > seed.lt) {
        posArr[i * 3] = 0; posArr[i * 3 + 1] = -100; posArr[i * 3 + 2] = 0;
        continue;
      }

      const y = startHeight + seed.vy * age - 4.9 * age * age * 0.15;
      if (y < 0) {
        posArr[i * 3] = 0; posArr[i * 3 + 1] = -100; posArr[i * 3 + 2] = 0;
        continue;
      }

      posArr[i * 3] = seed.x + seed.drift * age;
      posArr[i * 3 + 1] = y;
      posArr[i * 3 + 2] = seed.z + Math.sin(time * 0.5 + i) * 0.3;

      const fade = Math.max(0, 1 - age / seed.lt);
      const flicker = 0.4 + Math.sin(time * seed.flicker + i * 7) * 0.3 + Math.sin(time * seed.flicker * 0.7 + i * 3) * 0.3;
      const dimFactor = Math.pow(fade, 0.5);
      colArr[i * 3] = baseColor.r * dimFactor * flicker * 0.9;
      colArr[i * 3 + 1] = baseColor.g * dimFactor * flicker * 0.4;
      colArr[i * 3 + 2] = baseColor.b * dimFactor * flicker * 0.15;
    }

    const geo = pointsRef.current.geometry;
    geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colArr, 3));
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
  });

  if (progress < 0.15) return null;

  return (
    <group position={position}>
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[new Float32Array(EMBER_COUNT * 3), 3]} />
          <bufferAttribute attach="attributes-color" args={[new Float32Array(EMBER_COUNT * 3), 3]} />
        </bufferGeometry>
        <pointsMaterial
          size={0.08}
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

export default EmberParticlesInner;
