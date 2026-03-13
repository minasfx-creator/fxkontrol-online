import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const PARTICLE_COUNT = 100;

/**
 * CO2 Cryo Jet Effect: Vertical or horizontal CO2 blast.
 * White fog column with expansion and dissipation.
 */
export default function CryoJetEffect({
  position,
  color = '#FFFFFF',
  progress,
  height = 6,
  horizontal = false,
}: {
  position: [number, number, number];
  color?: string;
  progress: number;
  height?: number;
  horizontal?: boolean;
}) {
  const pointsRef = useRef<THREE.Points>(null);

  const seeds = useMemo(() => {
    const s: { angle: number; speed: number; spread: number; lt: number; phase: number }[] = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      s.push({
        angle: Math.random() * Math.PI * 2,
        speed: height * (0.5 + Math.random() * 1.0),
        spread: 0.15 + Math.random() * 0.3,
        lt: 0.3 + Math.random() * 0.5,
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
    const intensity = progress < 0.1 ? progress / 0.1 : progress > 0.8 ? (1 - progress) / 0.2 : 1;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const seed = seeds[i];
      const cycleTime = ((time * 2 + seed.phase) % seed.lt) / seed.lt;

      if (cycleTime > intensity) {
        posArr[i * 3] = 0; posArr[i * 3 + 1] = -100; posArr[i * 3 + 2] = 0;
        colArr[i * 3] = 0; colArr[i * 3 + 1] = 0; colArr[i * 3 + 2] = 0;
        continue;
      }

      const t = cycleTime * seed.lt;
      const expansion = 1 + cycleTime * 2;
      
      if (horizontal) {
        posArr[i * 3] = seed.speed * t;
        posArr[i * 3 + 1] = Math.cos(seed.angle) * seed.spread * t * expansion;
        posArr[i * 3 + 2] = Math.sin(seed.angle) * seed.spread * t * expansion;
      } else {
        posArr[i * 3] = Math.cos(seed.angle) * seed.spread * t * expansion;
        posArr[i * 3 + 1] = seed.speed * t;
        posArr[i * 3 + 2] = Math.sin(seed.angle) * seed.spread * t * expansion;
      }

      const fade = Math.max(0, 1 - cycleTime * 0.7) * intensity;
      // White fog with slight blue tint
      colArr[i * 3] = 0.9 * fade;
      colArr[i * 3 + 1] = 0.95 * fade;
      colArr[i * 3 + 2] = 1.0 * fade;
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
        <pointsMaterial size={0.35} vertexColors transparent opacity={0.5} depthWrite={false} blending={THREE.AdditiveBlending} sizeAttenuation />
      </points>
    </group>
  );
}
