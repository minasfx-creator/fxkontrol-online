import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const DRONE_COLOR = '#00B4D8';
const ARM_LENGTH = 0.3;

/** Simplified quadcopter mesh: body + 4 arms + spinning rotors + LED */
export default function QuadcopterModel({
  position,
  color = DRONE_COLOR,
  selected = false,
  scale = 1,
}: {
  position: [number, number, number];
  color?: string;
  selected?: boolean;
  scale?: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const rotorsRef = useRef<THREE.Group[]>([]);

  useFrame((_, delta) => {
    // Spin rotors
    rotorsRef.current.forEach((r) => {
      if (r) r.rotation.y += delta * 25;
    });
  });

  const armPositions: [number, number, number][] = [
    [ARM_LENGTH, 0, ARM_LENGTH],
    [-ARM_LENGTH, 0, ARM_LENGTH],
    [-ARM_LENGTH, 0, -ARM_LENGTH],
    [ARM_LENGTH, 0, -ARM_LENGTH],
  ];

  return (
    <group ref={groupRef} position={position} scale={scale}>
      {/* Central body */}
      <mesh>
        <boxGeometry args={[0.2, 0.08, 0.2]} />
        <meshStandardMaterial
          color="#1a1a2e"
          metalness={0.8}
          roughness={0.3}
        />
      </mesh>

      {/* LED on top */}
      <mesh position={[0, 0.06, 0]}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <pointLight
        color={color}
        intensity={selected ? 4 : 1.5}
        distance={selected ? 6 : 3}
        decay={2}
        position={[0, 0.06, 0]}
      />

      {/* Arms + rotors */}
      {armPositions.map((armPos, i) => (
        <group key={i}>
          {/* Arm */}
          <mesh position={[armPos[0] / 2, 0, armPos[2] / 2]}>
            <boxGeometry args={[
              Math.abs(armPos[0]) > 0 ? ARM_LENGTH : 0.03,
              0.03,
              Math.abs(armPos[2]) > 0 ? ARM_LENGTH : 0.03,
            ]} />
            <meshStandardMaterial color="#333" metalness={0.6} roughness={0.4} />
          </mesh>

          {/* Motor mount */}
          <mesh position={armPos}>
            <cylinderGeometry args={[0.04, 0.04, 0.04, 8]} />
            <meshStandardMaterial color="#444" metalness={0.7} roughness={0.3} />
          </mesh>

          {/* Rotor (spinning disc) */}
          <group
            position={[armPos[0], 0.04, armPos[2]]}
            ref={(el) => { if (el) rotorsRef.current[i] = el; }}
          >
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.08, 0.005, 4, 16]} />
              <meshBasicMaterial color={color} transparent opacity={0.4} />
            </mesh>
            {/* Blade disc effect */}
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[0.08, 16]} />
              <meshBasicMaterial color={color} transparent opacity={0.08} side={THREE.DoubleSide} />
            </mesh>
          </group>
        </group>
      ))}

      {/* Selection glow ring */}
      {selected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}>
          <ringGeometry args={[0.35, 0.45, 24]} />
          <meshBasicMaterial color={color} transparent opacity={0.5} />
        </mesh>
      )}
    </group>
  );
}
