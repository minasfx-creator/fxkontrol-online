import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Laser Effect: ILDA-style laser beams with scanning patterns.
 * Supports fan, harp, tunnel, cone, and single beam modes.
 */
export default function LaserEffect({
  position,
  color,
  progress,
  pattern = 'fan',
  beamCount = 8,
}: {
  position: [number, number, number];
  color: string;
  progress: number;
  pattern?: 'fan' | 'harp' | 'tunnel' | 'cone' | 'single';
  beamCount?: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const baseColor = useMemo(() => new THREE.Color(color), [color]);

  const beamGeos = useMemo(() => {
    const geos: { dir: THREE.Vector3; offset: THREE.Vector3 }[] = [];
    for (let i = 0; i < beamCount; i++) {
      geos.push({ dir: new THREE.Vector3(), offset: new THREE.Vector3() });
    }
    return geos;
  }, [beamCount]);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const time = clock.getElapsedTime();
    const intensity = progress < 0.05 ? progress / 0.05 : progress > 0.9 ? (1 - progress) / 0.1 : 1;

    const children = groupRef.current.children;
    for (let i = 0; i < beamCount; i++) {
      const beam = children[i] as THREE.Mesh;
      if (!beam) continue;

      let angle: number, tilt: number, ox = 0;

      switch (pattern) {
        case 'fan':
          angle = ((i / beamCount) - 0.5) * Math.PI * 0.7 + Math.sin(time * 0.3) * 0.1;
          beam.position.set(0, 0, 0);
          beam.rotation.set(0, 0, angle);
          break;
        case 'harp':
          ox = ((i / beamCount) - 0.5) * 6;
          beam.position.set(ox, 0, 0);
          beam.rotation.set(0, 0, 0);
          break;
        case 'tunnel':
          angle = (i / beamCount) * Math.PI * 2 + time * 1.5;
          tilt = 0.25;
          beam.position.set(0, 0, 0);
          beam.rotation.set(Math.cos(angle) * tilt, 0, Math.sin(angle) * tilt);
          break;
        case 'cone':
          angle = (i / beamCount) * Math.PI * 2 + time * 0.5;
          tilt = 0.3 + Math.sin(time * 2 + i) * 0.1;
          beam.position.set(0, 0, 0);
          beam.rotation.set(Math.cos(angle) * tilt, 0, Math.sin(angle) * tilt);
          break;
        default:
          beam.position.set(0, 0, 0);
          beam.rotation.set(Math.sin(time) * 0.2, 0, Math.cos(time * 0.7) * 0.15);
      }

      const mat = beam.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.15 * intensity;
    }
  });

  const beamLength = 80;

  return (
    <group position={position} ref={groupRef}>
      {Array.from({ length: beamCount }).map((_, i) => (
        <mesh key={i}>
          <cylinderGeometry args={[0.008, 0.015, beamLength, 4]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.15}
            blending={THREE.AdditiveBlending}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
      {/* Source glow */}
      <mesh>
        <sphereGeometry args={[0.1, 8, 8]} />
        <meshBasicMaterial color={color} transparent opacity={0.4 * (progress > 0.05 && progress < 0.9 ? 1 : 0)} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
}
