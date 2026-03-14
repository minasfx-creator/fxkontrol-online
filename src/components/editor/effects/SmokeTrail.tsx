import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const SMOKE_COUNT = 50;

/**
 * Smoke Trail: Billowing smoke puffs after a pyro burst.
 */
function SmokeTrailInner({
  position,
  progress,
  intensity = 1,
  color = '#887766',
}: {
  position: [number, number, number];
  progress: number;
  intensity?: number;
  color?: string;
}) {
  const meshRefs = useRef<(THREE.Mesh | null)[]>([]);

  const puffs = useMemo(() => {
    const p: { x: number; z: number; vy: number; scale: number; phase: number; delay: number }[] = [];
    for (let i = 0; i < SMOKE_COUNT; i++) {
      p.push({
        x: (Math.random() - 0.5) * 2,
        z: (Math.random() - 0.5) * 2,
        vy: 0.5 + Math.random() * 2,
        scale: 0.4 + Math.random() * 1.0,
        phase: Math.random() * Math.PI * 2,
        delay: Math.random() * 0.25,
      });
    }
    return p;
  }, []);

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();
    puffs.forEach((puff, i) => {
      const mesh = meshRefs.current[i];
      if (!mesh) return;
      const age = Math.max(0, progress - puff.delay);
      if (age <= 0 || progress > 0.85) {
        mesh.visible = false;
        return;
      }
      mesh.visible = true;
      const t = age * 3;
      const expand = puff.scale * (1 + t * 2.5);
      mesh.position.set(
        puff.x + Math.sin(time * 0.3 + puff.phase) * 0.4 * t,
        puff.vy * t * 0.8,
        puff.z + Math.cos(time * 0.2 + puff.phase) * 0.3 * t
      );
      mesh.scale.setScalar(expand);
      const mat = mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, 0.05 * intensity * (1 - age / 0.75));
    });
  });

  if (progress <= 0) return null;

  return (
    <group position={position}>
      {puffs.map((_, i) => (
        <mesh
          key={i}
          ref={el => { meshRefs.current[i] = el; }}
          visible={false}
        >
          <sphereGeometry args={[1, 6, 6]} />
          <meshBasicMaterial color={color} transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

export default SmokeTrailInner;
