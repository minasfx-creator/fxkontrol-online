import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Moving Head Light Effect: Beam light with pan/tilt movement.
 * Simulates Sharpy, Spot, Wash lights used in live events.
 */
export default function MovingHeadEffect({
  position,
  color,
  progress,
  beamType = 'spot',
}: {
  position: [number, number, number];
  color: string;
  progress: number;
  beamType?: 'spot' | 'wash' | 'beam';
}) {
  const beamRef = useRef<THREE.Mesh>(null);
  const headRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!headRef.current || !beamRef.current) return;
    const t = clock.getElapsedTime();
    const intensity = progress < 0.05 ? progress / 0.05 : progress > 0.9 ? (1 - progress) / 0.1 : 1;

    // Pan/tilt motion
    const pan = Math.sin(t * 0.8) * 0.6;
    const tilt = Math.sin(t * 0.5 + 1) * 0.3 + 0.3;
    headRef.current.rotation.set(tilt, pan, 0);

    const mat = beamRef.current.material as THREE.MeshBasicMaterial;
    mat.opacity = (beamType === 'beam' ? 0.06 : beamType === 'spot' ? 0.04 : 0.03) * intensity;
  });

  const beamLength = beamType === 'beam' ? 60 : beamType === 'spot' ? 40 : 25;
  const beamWidth = beamType === 'beam' ? 0.1 : beamType === 'spot' ? 0.8 : 2;
  const beamEndWidth = beamType === 'beam' ? 0.3 : beamType === 'spot' ? 3 : 6;

  return (
    <group position={position}>
      {/* Fixture body */}
      <mesh position={[0, -0.15, 0]}>
        <boxGeometry args={[0.3, 0.3, 0.3]} />
        <meshStandardMaterial color="#333333" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Moving head */}
      <group ref={headRef}>
        {/* Lens */}
        <mesh position={[0, 0, 0]}>
          <sphereGeometry args={[0.12, 8, 8]} />
          <meshBasicMaterial color={color} transparent opacity={0.6} blending={THREE.AdditiveBlending} />
        </mesh>
        {/* Beam cone */}
        <mesh ref={beamRef} position={[0, beamLength / 2, 0]}>
          <cylinderGeometry args={[beamWidth, beamEndWidth, beamLength, 8, 1, true]} />
          <meshBasicMaterial color={color} transparent opacity={0.04} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
        </mesh>
      </group>
    </group>
  );
}
