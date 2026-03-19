import { forwardRef, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const TechnicianCharacter = forwardRef<THREE.Group>(function TechnicianCharacter(_props, ref) {
  const bodyRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (bodyRef.current) {
      // Subtle idle breathing
      bodyRef.current.scale.y = 1 + Math.sin(clock.elapsedTime * 1.5) * 0.015;
      bodyRef.current.position.y = Math.sin(clock.elapsedTime * 1.5) * 0.02;
    }
  });

  return (
    <group ref={ref} position={[5, 0.3, 2]}>
      <group ref={bodyRef}>
        {/* Legs */}
        <mesh position={[-0.12, 0.35, 0]}>
          <boxGeometry args={[0.15, 0.7, 0.15]} />
          <meshStandardMaterial color="#1a1a2e" />
        </mesh>
        <mesh position={[0.12, 0.35, 0]}>
          <boxGeometry args={[0.15, 0.7, 0.15]} />
          <meshStandardMaterial color="#1a1a2e" />
        </mesh>

        {/* Torso (vest) */}
        <mesh position={[0, 0.95, 0]}>
          <boxGeometry args={[0.4, 0.5, 0.25]} />
          <meshStandardMaterial color="#ff6600" />
        </mesh>
        {/* Reflective stripe on vest */}
        <mesh position={[0, 0.95, 0.126]}>
          <boxGeometry args={[0.38, 0.06, 0.005]} />
          <meshStandardMaterial color="#cccc00" emissive="#aaaa00" emissiveIntensity={0.3} />
        </mesh>

        {/* Arms */}
        <mesh position={[-0.28, 0.9, 0]}>
          <boxGeometry args={[0.12, 0.45, 0.12]} />
          <meshStandardMaterial color="#222233" />
        </mesh>
        <mesh position={[0.28, 0.9, 0]}>
          <boxGeometry args={[0.12, 0.45, 0.12]} />
          <meshStandardMaterial color="#222233" />
        </mesh>

        {/* Head */}
        <mesh position={[0, 1.38, 0]}>
          <sphereGeometry args={[0.14, 12, 12]} />
          <meshStandardMaterial color="#dda68a" />
        </mesh>

        {/* Safety helmet */}
        <mesh position={[0, 1.52, 0]}>
          <sphereGeometry args={[0.17, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#ffcc00" />
        </mesh>

        {/* Boots */}
        <mesh position={[-0.12, 0.05, 0.03]}>
          <boxGeometry args={[0.16, 0.1, 0.22]} />
          <meshStandardMaterial color="#333" />
        </mesh>
        <mesh position={[0.12, 0.05, 0.03]}>
          <boxGeometry args={[0.16, 0.1, 0.22]} />
          <meshStandardMaterial color="#333" />
        </mesh>
      </group>
    </group>
  );
});

export default TechnicianCharacter;
