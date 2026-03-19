import { forwardRef, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const TechnicianCharacter = forwardRef<THREE.Group>(function TechnicianCharacter(_props, ref) {
  const bodyRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (bodyRef.current) {
      bodyRef.current.scale.y = 1 + Math.sin(clock.elapsedTime * 1.5) * 0.015;
      bodyRef.current.position.y = Math.sin(clock.elapsedTime * 1.5) * 0.02;
    }
  });

  return (
    <group ref={ref} position={[5, 0.3, 2]}>
      <group ref={bodyRef}>
        {/* Legs — cargo pants, dark stained */}
        <mesh position={[-0.12, 0.35, 0]}>
          <boxGeometry args={[0.15, 0.7, 0.15]} />
          <meshStandardMaterial color="#2c2c1e" roughness={0.9} />
        </mesh>
        <mesh position={[0.12, 0.35, 0]}>
          <boxGeometry args={[0.15, 0.7, 0.15]} />
          <meshStandardMaterial color="#2c2c1e" roughness={0.9} />
        </mesh>
        {/* Cargo pockets */}
        <mesh position={[-0.18, 0.35, 0]}>
          <boxGeometry args={[0.04, 0.12, 0.1]} />
          <meshStandardMaterial color="#3a3a28" roughness={0.95} />
        </mesh>
        <mesh position={[0.18, 0.4, 0]}>
          <boxGeometry args={[0.04, 0.12, 0.1]} />
          <meshStandardMaterial color="#3a3a28" roughness={0.95} />
        </mesh>

        {/* Torso — greasy black crew shirt */}
        <mesh position={[0, 0.95, 0]}>
          <boxGeometry args={[0.42, 0.52, 0.26]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.95} />
        </mesh>
        {/* Grease stains on shirt */}
        <mesh position={[0.1, 0.88, 0.135]}>
          <planeGeometry args={[0.12, 0.08]} />
          <meshStandardMaterial color="#2a2a18" transparent opacity={0.7} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[-0.08, 1.0, 0.135]}>
          <planeGeometry args={[0.08, 0.06]} />
          <meshStandardMaterial color="#333320" transparent opacity={0.5} side={THREE.DoubleSide} />
        </mesh>
        {/* "CREW" text area on back (simplified as a lighter rectangle) */}
        <mesh position={[0, 0.98, -0.135]}>
          <planeGeometry args={[0.28, 0.1]} />
          <meshStandardMaterial color="#444" side={THREE.DoubleSide} />
        </mesh>

        {/* Tool belt */}
        <mesh position={[0, 0.7, 0]}>
          <boxGeometry args={[0.44, 0.06, 0.28]} />
          <meshStandardMaterial color="#4a3520" roughness={0.8} metalness={0.2} />
        </mesh>
        {/* Belt buckle */}
        <mesh position={[0, 0.7, 0.145]}>
          <boxGeometry args={[0.06, 0.05, 0.01]} />
          <meshStandardMaterial color="#888" metalness={0.9} roughness={0.2} />
        </mesh>
        {/* Tools on belt */}
        <mesh position={[0.2, 0.65, 0.12]} rotation={[0, 0, -0.3]}>
          <cylinderGeometry args={[0.015, 0.015, 0.18, 6]} />
          <meshStandardMaterial color="#e74c3c" metalness={0.3} />
        </mesh>
        <mesh position={[-0.22, 0.62, 0.08]} rotation={[0.2, 0, 0.4]}>
          <boxGeometry args={[0.03, 0.15, 0.02]} />
          <meshStandardMaterial color="#888" metalness={0.8} roughness={0.3} />
        </mesh>
        {/* Wrench hanging */}
        <mesh position={[-0.22, 0.58, 0.1]}>
          <torusGeometry args={[0.02, 0.006, 6, 12]} />
          <meshStandardMaterial color="#999" metalness={0.9} roughness={0.2} />
        </mesh>

        {/* Arms — muscular, grease-stained */}
        <mesh position={[-0.3, 0.9, 0]}>
          <boxGeometry args={[0.14, 0.45, 0.14]} />
          <meshStandardMaterial color="#c4956a" roughness={0.85} />
        </mesh>
        <mesh position={[0.3, 0.9, 0]}>
          <boxGeometry args={[0.14, 0.45, 0.14]} />
          <meshStandardMaterial color="#c4956a" roughness={0.85} />
        </mesh>
        {/* Work gloves */}
        <mesh position={[-0.3, 0.66, 0]}>
          <boxGeometry args={[0.15, 0.1, 0.15]} />
          <meshStandardMaterial color="#8B7355" roughness={0.9} />
        </mesh>
        <mesh position={[0.3, 0.66, 0]}>
          <boxGeometry args={[0.15, 0.1, 0.15]} />
          <meshStandardMaterial color="#8B7355" roughness={0.9} />
        </mesh>

        {/* Head */}
        <mesh position={[0, 1.38, 0]}>
          <sphereGeometry args={[0.15, 12, 12]} />
          <meshStandardMaterial color="#c4956a" roughness={0.7} />
        </mesh>
        {/* Stubble / shadow */}
        <mesh position={[0, 1.3, 0.08]}>
          <sphereGeometry args={[0.1, 8, 6, 0, Math.PI * 2, Math.PI * 0.4, Math.PI * 0.3]} />
          <meshStandardMaterial color="#8a6e50" transparent opacity={0.4} />
        </mesh>

        {/* Backwards cap */}
        <mesh position={[0, 1.48, 0]}>
          <sphereGeometry args={[0.17, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.9} />
        </mesh>
        {/* Cap brim (backwards) */}
        <mesh position={[0, 1.44, -0.12]} rotation={[0.3, 0, 0]}>
          <boxGeometry args={[0.18, 0.015, 0.12]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.9} />
        </mesh>

        {/* Boots — steel toe */}
        <mesh position={[-0.12, 0.06, 0.03]}>
          <boxGeometry args={[0.17, 0.12, 0.24]} />
          <meshStandardMaterial color="#2a2015" roughness={0.85} />
        </mesh>
        <mesh position={[0.12, 0.06, 0.03]}>
          <boxGeometry args={[0.17, 0.12, 0.24]} />
          <meshStandardMaterial color="#2a2015" roughness={0.85} />
        </mesh>
        {/* Steel toe caps */}
        <mesh position={[-0.12, 0.06, 0.14]}>
          <boxGeometry args={[0.16, 0.08, 0.04]} />
          <meshStandardMaterial color="#666" metalness={0.7} roughness={0.3} />
        </mesh>
        <mesh position={[0.12, 0.06, 0.14]}>
          <boxGeometry args={[0.16, 0.08, 0.04]} />
          <meshStandardMaterial color="#666" metalness={0.7} roughness={0.3} />
        </mesh>

        {/* Radio on shoulder */}
        <mesh position={[-0.25, 1.1, 0.05]}>
          <boxGeometry args={[0.05, 0.1, 0.03]} />
          <meshStandardMaterial color="#222" metalness={0.5} />
        </mesh>
        <mesh position={[-0.25, 1.17, 0.05]}>
          <cylinderGeometry args={[0.005, 0.005, 0.08, 4]} />
          <meshStandardMaterial color="#333" metalness={0.7} />
        </mesh>
      </group>
    </group>
  );
});

export default TechnicianCharacter;
