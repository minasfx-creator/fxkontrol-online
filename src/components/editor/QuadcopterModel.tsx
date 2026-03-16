import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const ARM_LENGTH = 0.3;

/** Detailed quadcopter with PBR carbon fiber, spinning rotors, navigation LEDs, and RGB top LED */
export default function QuadcopterModel({
  position,
  color = '#00B4D8',
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
    rotorsRef.current.forEach((r) => {
      if (r) r.rotation.y += delta * 35;
    });
    // Subtle hover wobble
    if (groupRef.current) {
      groupRef.current.position.y = position[1] + Math.sin(Date.now() * 0.003 + position[0]) * 0.015;
    }
  });

  const armPositions: [number, number, number][] = [
    [ARM_LENGTH, 0, ARM_LENGTH],
    [-ARM_LENGTH, 0, ARM_LENGTH],
    [-ARM_LENGTH, 0, -ARM_LENGTH],
    [ARM_LENGTH, 0, -ARM_LENGTH],
  ];

  // Nav light colors: front=green, rear=red
  const navColors = ['#00ff44', '#00ff44', '#ff2200', '#ff2200'];

  return (
    <group ref={groupRef} position={position} scale={scale}>
      {/* Central body — carbon fiber PBR */}
      <mesh castShadow>
        <boxGeometry args={[0.22, 0.07, 0.22]} />
        <meshStandardMaterial
          color="#0a0a18"
          metalness={0.92}
          roughness={0.12}
          envMapIntensity={0.6}
        />
      </mesh>

      {/* Battery pack underneath */}
      <mesh position={[0, -0.05, 0]}>
        <boxGeometry args={[0.14, 0.04, 0.08]} />
        <meshStandardMaterial color="#1a1a2e" metalness={0.5} roughness={0.6} />
      </mesh>

      {/* Main RGB LED on top */}
      <mesh position={[0, 0.06, 0]}>
        <sphereGeometry args={[0.04, 12, 12]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.16}
          toneMapped={true}
          metalness={0}
          roughness={0.3}
        />
      </mesh>
      {/* Minimal halo — no additive */}
      <mesh position={[0, 0.06, 0]}>
        <sphereGeometry args={[0.05, 8, 8]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.003}
          depthWrite={false}
        />
      </mesh>
      <pointLight
        color={color}
          intensity={selected ? 0.19 : 0.064}
          distance={selected ? 0.48 : 0.24}
          decay={3}
        position={[0, 0.06, 0]}
      />

      {/* Arms + motors + rotors + nav lights */}
      {armPositions.map((armPos, i) => (
        <group key={i}>
          {/* Arm — carbon tube */}
          <mesh position={[armPos[0] / 2, 0, armPos[2] / 2]} castShadow>
            <boxGeometry args={[
              Math.abs(armPos[0]) > 0 ? ARM_LENGTH + 0.02 : 0.025,
              0.025,
              Math.abs(armPos[2]) > 0 ? ARM_LENGTH + 0.02 : 0.025,
            ]} />
            <meshStandardMaterial color="#1a1a28" metalness={0.8} roughness={0.2} />
          </mesh>

          {/* Motor mount */}
          <mesh position={armPos} castShadow>
            <cylinderGeometry args={[0.035, 0.04, 0.05, 12]} />
            <meshStandardMaterial color="#2a2a3a" metalness={0.85} roughness={0.15} />
          </mesh>

          {/* Motor bell */}
          <mesh position={[armPos[0], 0.035, armPos[2]]}>
            <cylinderGeometry args={[0.032, 0.025, 0.02, 12]} />
            <meshStandardMaterial color="#444" metalness={0.9} roughness={0.1} />
          </mesh>

          {/* Rotor disc (spinning) */}
          <group
            position={[armPos[0], 0.05, armPos[2]]}
            ref={(el) => { if (el) rotorsRef.current[i] = el; }}
          >
            {/* Blade disc — no additive */}
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[0.09, 24]} />
              <meshBasicMaterial
                color="#666666"
                transparent
                opacity={0.03}
                side={THREE.DoubleSide}
                depthWrite={false}
              />
            </mesh>
            {/* Blade tips ring */}
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.085, 0.003, 4, 24]} />
              <meshBasicMaterial color={color} transparent opacity={0.25} />
            </mesh>
          </group>

          {/* Navigation light — small LED at arm tip */}
          <mesh position={[armPos[0], -0.01, armPos[2]]}>
            <sphereGeometry args={[0.012, 6, 6]} />
            <meshBasicMaterial color={navColors[i]} toneMapped={false} />
          </mesh>
          {/* Nav light glow — no additive */}
          <mesh position={[armPos[0], -0.01, armPos[2]]}>
            <sphereGeometry args={[0.025, 6, 6]} />
            <meshBasicMaterial
              color={navColors[i]}
              transparent
              opacity={0.04}
              depthWrite={false}
            />
          </mesh>
        </group>
      ))}

      {/* Landing gear — small feet */}
      {[[-0.1, -0.08, 0.1], [0.1, -0.08, 0.1], [-0.1, -0.08, -0.1], [0.1, -0.08, -0.1]].map((p, i) => (
        <mesh key={`leg-${i}`} position={p as [number, number, number]}>
          <cylinderGeometry args={[0.006, 0.008, 0.06, 6]} />
          <meshStandardMaterial color="#333" metalness={0.6} roughness={0.4} />
        </mesh>
      ))}

      {/* Selection ring — no additive */}
      {selected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.06, 0]}>
          <ringGeometry args={[0.35, 0.5, 32]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.25}
            depthWrite={false}
          />
        </mesh>
      )}
    </group>
  );
}
