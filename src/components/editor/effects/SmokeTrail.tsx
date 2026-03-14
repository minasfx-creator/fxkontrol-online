import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const SMOKE_COUNT = 80;

/**
 * Finale-grade Smoke Trail: Persistent volumetric smoke puffs that
 * accumulate at the burst location, expand, rise slowly, and drift with wind.
 * Matches Finale 3D "Smoke Thickness: Thick" render setting.
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
    const p: { x: number; z: number; vy: number; scale: number; phase: number; delay: number; drift: number }[] = [];
    for (let i = 0; i < SMOKE_COUNT; i++) {
      p.push({
        x: (Math.random() - 0.5) * 3.5,
        z: (Math.random() - 0.5) * 3.5,
        vy: 0.3 + Math.random() * 1.5,
        scale: 0.6 + Math.random() * 1.8,
        phase: Math.random() * Math.PI * 2,
        delay: Math.random() * 0.35,
        drift: (Math.random() - 0.5) * 0.3,
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
      if (age <= 0 || progress > 0.95) {
        mesh.visible = false;
        return;
      }
      mesh.visible = true;
      const t = age * 2.5;
      // Smoke expands and rises, Finale's volumetric accumulation
      const expand = puff.scale * (1 + t * 3.0);
      mesh.position.set(
        puff.x + Math.sin(time * 0.2 + puff.phase) * 0.6 * t + puff.drift * t * 2,
        puff.vy * t * 0.6,
        puff.z + Math.cos(time * 0.15 + puff.phase) * 0.5 * t
      );
      mesh.scale.setScalar(expand);
      const mat = mesh.material as THREE.MeshBasicMaterial;
      // Persistent opacity — smoke lingers longer (Finale thick smoke)
      const fadeIn = Math.min(1, age * 8);
      const fadeOut = Math.max(0, 1 - Math.pow(age / 0.85, 2));
      mat.opacity = Math.max(0, 0.06 * intensity * fadeIn * fadeOut);
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
          <sphereGeometry args={[1, 8, 8]} />
          <meshBasicMaterial color={color} transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

export default SmokeTrailInner;
