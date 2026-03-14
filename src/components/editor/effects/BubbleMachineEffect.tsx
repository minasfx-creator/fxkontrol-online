import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useProjectStore } from '@/store/useProjectStore';

const BUBBLE_COUNT = 90;

export default function BubbleMachineEffect({
  position,
  progress,
  color = '#bfe7ff',
  spread = 6,
}: {
  position: [number, number, number];
  progress: number;
  color?: string;
  spread?: number;
}) {
  const groupRef = useRef<THREE.Group>(null);

  const bubbles = useMemo(() => {
    return Array.from({ length: BUBBLE_COUNT }, () => ({
      x: (Math.random() - 0.5) * spread,
      z: (Math.random() - 0.5) * spread,
      phase: Math.random() * Math.PI * 2,
      rise: 0.6 + Math.random() * 1.2,
      size: 0.06 + Math.random() * 0.16,
      delay: Math.random() * 0.35,
      wobble: 0.08 + Math.random() * 0.2,
    }));
  }, [spread]);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const time = clock.getElapsedTime();
    const { wind } = useProjectStore.getState();
    const wr = (wind.direction * Math.PI) / 180;
    const windX = wind.enabled ? Math.sin(wr) * wind.speed * 0.03 : 0;
    const windZ = wind.enabled ? Math.cos(wr) * wind.speed * 0.03 : 0;

    const envelope = progress < 0.06 ? progress / 0.06 : progress > 0.9 ? (1 - progress) / 0.1 : 1;

    groupRef.current.children.forEach((child, i) => {
      const bubble = bubbles[i];
      if (!bubble) return;

      const mesh = child as THREE.Mesh;
      const age = Math.max(0, progress - bubble.delay);
      if (age <= 0 || age >= 0.98) {
        mesh.visible = false;
        return;
      }

      mesh.visible = true;
      const life = (time * bubble.rise + bubble.phase) % 3.8;
      const y = life * 0.9;

      mesh.position.set(
        bubble.x + Math.sin(time * 1.2 + bubble.phase) * bubble.wobble + windX * y * 3,
        y,
        bubble.z + Math.cos(time * 1.05 + bubble.phase) * bubble.wobble + windZ * y * 3,
      );
      mesh.scale.setScalar(bubble.size * (1 + Math.sin(time * 2.2 + bubble.phase) * 0.08));

      const material = mesh.material as THREE.MeshPhysicalMaterial;
      material.opacity = (0.28 + Math.sin(time * 3.8 + bubble.phase) * 0.06) * Math.max(0, envelope);
    });
  });

  return (
    <group position={position} ref={groupRef}>
      {bubbles.map((bubble, i) => (
        <mesh key={i} visible={false}>
          <sphereGeometry args={[1, 12, 12]} />
          <meshPhysicalMaterial
            color={color}
            transparent
            opacity={0.2}
            roughness={0.06}
            metalness={0}
            transmission={0.92}
            ior={1.33}
            thickness={0.1}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}
