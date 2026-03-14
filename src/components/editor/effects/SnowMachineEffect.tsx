import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useProjectStore } from '@/store/useProjectStore';

const FLAKES = 260;

export default function SnowMachineEffect({
  position,
  progress,
  width = 9,
  height = 8,
}: {
  position: [number, number, number];
  progress: number;
  width?: number;
  height?: number;
}) {
  const pointsRef = useRef<THREE.Points>(null);
  const posRef = useRef(new Float32Array(FLAKES * 3));

  const seeds = useMemo(() => {
    return Array.from({ length: FLAKES }, () => ({
      x: (Math.random() - 0.5) * width,
      y: Math.random() * height,
      z: (Math.random() - 0.5) * width,
      fall: 0.35 + Math.random() * 0.7,
      swing: 0.2 + Math.random() * 0.8,
      phase: Math.random() * Math.PI * 2,
    }));
  }, [width, height]);

  useFrame(({ clock }) => {
    if (!pointsRef.current) return;
    const t = clock.getElapsedTime();
    const pos = posRef.current;
    const { wind } = useProjectStore.getState();
    const wr = (wind.direction * Math.PI) / 180;
    const windX = wind.enabled ? Math.sin(wr) * wind.speed * 0.06 : 0;
    const windZ = wind.enabled ? Math.cos(wr) * wind.speed * 0.06 : 0;

    const envelope = progress < 0.08 ? progress / 0.08 : progress > 0.92 ? (1 - progress) / 0.08 : 1;

    for (let i = 0; i < FLAKES; i++) {
      const s = seeds[i];
      const idx = i * 3;
      const fallY = (s.y - (t * s.fall) % (height + 1));
      pos[idx] = s.x + Math.sin(t * s.swing + s.phase) * 0.45 + windX * t * 5;
      pos[idx + 1] = fallY < -0.2 ? height : fallY;
      pos[idx + 2] = s.z + Math.cos(t * s.swing * 0.85 + s.phase) * 0.35 + windZ * t * 5;
    }

    const material = pointsRef.current.material as THREE.PointsMaterial;
    material.opacity = 0.72 * Math.max(0, envelope);

    const geometry = pointsRef.current.geometry;
    geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geometry.attributes.position.needsUpdate = true;
  });

  return (
    <group position={position}>
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[new Float32Array(FLAKES * 3), 3]} />
        </bufferGeometry>
        <pointsMaterial
          color="#f4f7ff"
          size={0.14}
          transparent
          opacity={0.7}
          depthWrite={false}
          blending={THREE.NormalBlending}
          sizeAttenuation
        />
      </points>
    </group>
  );
}
