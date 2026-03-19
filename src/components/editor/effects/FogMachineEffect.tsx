import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useProjectStore } from '@/store/useProjectStore';

const FOG_PUFFS = 70;

export default function FogMachineEffect({
  position,
  color = '#8a8a8a',
  progress,
  spread = 12,
  lowFog = false,
}: {
  position: [number, number, number];
  color?: string;
  progress: number;
  spread?: number;
  /** Creeper AQ mode: fog stays on the ground, spreads horizontally */
  lowFog?: boolean;
}) {
  const meshRefs = useRef<(THREE.Mesh | null)[]>([]);

  const puffs = useMemo(() => {
    return Array.from({ length: FOG_PUFFS }, () => ({
      x: (Math.random() - 0.5) * spread,
      z: (Math.random() - 0.5) * spread,
      phase: Math.random() * Math.PI * 2,
      lift: 0.08 + Math.random() * 0.22,
      delay: Math.random() * 0.3,
      scale: 0.9 + Math.random() * 2.2,
      drift: (Math.random() - 0.5) * 0.4,
    }));
  }, [spread]);

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();
    const { wind } = useProjectStore.getState();
    const wr = (wind.direction * Math.PI) / 180;
    const windX = wind.enabled ? Math.sin(wr) * wind.speed * 0.2 : 0;
    const windZ = wind.enabled ? Math.cos(wr) * wind.speed * 0.2 : 0;

    puffs.forEach((puff, i) => {
      const mesh = meshRefs.current[i];
      if (!mesh) return;

      const age = Math.max(0, progress - puff.delay);
      if (age <= 0 || age > 0.98) {
        mesh.visible = false;
        return;
      }

      mesh.visible = true;
      const t = age * 2.6;
      const growth = puff.scale * (1 + t * 2.3);

      mesh.position.set(
        puff.x + windX * t * 2.2 + Math.sin(time * 0.35 + puff.phase) * 0.35,
        puff.lift * t,
        puff.z + windZ * t * 2.2 + Math.cos(time * 0.28 + puff.phase) * 0.3 + puff.drift * t,
      );
      mesh.scale.setScalar(growth);

      const mat = mesh.material as THREE.MeshBasicMaterial;
      const fadeIn = Math.min(1, age * 8);
      const fadeOut = Math.max(0, 1 - Math.pow(age / 0.95, 1.8));
      mat.opacity = 0.09 * fadeIn * fadeOut;
    });
  });

  return (
    <group position={position}>
      {puffs.map((_, i) => (
        <mesh key={i} ref={(el) => { meshRefs.current[i] = el; }} visible={false}>
          <sphereGeometry args={[1, 8, 8]} />
          <meshBasicMaterial color={color} transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}
