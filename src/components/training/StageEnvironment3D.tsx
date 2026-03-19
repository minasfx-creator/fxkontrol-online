import { forwardRef, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const TrussPillar = ({ position }: { position: [number, number, number] }) => (
  <group position={position}>
    {/* Main vertical tube */}
    <mesh position={[0, 2, 0]}>
      <cylinderGeometry args={[0.06, 0.06, 4, 8]} />
      <meshStandardMaterial color="#888" metalness={0.8} roughness={0.3} />
    </mesh>
    {/* Cross braces */}
    {[0.5, 1.5, 2.5, 3.5].map((y) => (
      <mesh key={y} position={[0, y, 0]} rotation={[0, 0, Math.PI / 4]}>
        <boxGeometry args={[0.02, 0.25, 0.02]} />
        <meshStandardMaterial color="#777" metalness={0.7} roughness={0.4} />
      </mesh>
    ))}
    {/* Base plate */}
    <mesh position={[0, 0.01, 0]}>
      <boxGeometry args={[0.4, 0.02, 0.4]} />
      <meshStandardMaterial color="#555" metalness={0.9} roughness={0.2} />
    </mesh>
  </group>
);

const HorizontalTruss = ({ start, end }: { start: [number, number, number]; end: [number, number, number] }) => {
  const mid: [number, number, number] = [
    (start[0] + end[0]) / 2,
    (start[1] + end[1]) / 2,
    (start[2] + end[2]) / 2,
  ];
  const length = Math.sqrt(
    (end[0] - start[0]) ** 2 + (end[1] - start[1]) ** 2 + (end[2] - start[2]) ** 2
  );
  const dir = new THREE.Vector3(end[0] - start[0], end[1] - start[1], end[2] - start[2]).normalize();
  const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);

  return (
    <group position={mid} quaternion={quat}>
      <mesh>
        <cylinderGeometry args={[0.05, 0.05, length, 8]} />
        <meshStandardMaterial color="#999" metalness={0.8} roughness={0.3} />
      </mesh>
    </group>
  );
};

const StageEnvironment3D = forwardRef<THREE.Group>(function StageEnvironment3D(_props, ref) {
  const gridRef = useRef<THREE.GridHelper>(null);

  return (
    <group ref={ref}>
      {/* Ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial color="#111118" roughness={0.95} />
      </mesh>

      {/* Grid */}
      <gridHelper ref={gridRef} args={[60, 60, '#1a1a2e', '#14141e']} />

      {/* Stage platform */}
      <mesh position={[0, 0.15, 0]} receiveShadow castShadow>
        <boxGeometry args={[8, 0.3, 4]} />
        <meshStandardMaterial color="#1a1a24" metalness={0.4} roughness={0.6} />
      </mesh>
      {/* Stage edge strip */}
      <mesh position={[0, 0.31, 2]}>
        <boxGeometry args={[8, 0.02, 0.05]} />
        <meshStandardMaterial color="#ff6633" emissive="#ff4400" emissiveIntensity={0.5} />
      </mesh>

      {/* Truss pillars at 4 corners */}
      <TrussPillar position={[-3.5, 0.3, -1.8]} />
      <TrussPillar position={[3.5, 0.3, -1.8]} />
      <TrussPillar position={[-3.5, 0.3, 1.8]} />
      <TrussPillar position={[3.5, 0.3, 1.8]} />

      {/* Horizontal truss bars (top) */}
      <HorizontalTruss start={[-3.5, 4.3, -1.8]} end={[3.5, 4.3, -1.8]} />
      <HorizontalTruss start={[-3.5, 4.3, 1.8]} end={[3.5, 4.3, 1.8]} />
      <HorizontalTruss start={[-3.5, 4.3, -1.8]} end={[-3.5, 4.3, 1.8]} />
      <HorizontalTruss start={[3.5, 4.3, -1.8]} end={[3.5, 4.3, 1.8]} />

      {/* Backdrop */}
      <mesh position={[0, 2.3, -1.95]}>
        <planeGeometry args={[7, 4]} />
        <meshStandardMaterial color="#0a0a12" side={THREE.DoubleSide} />
      </mesh>

      {/* Stage lights (decorative point lights) */}
      <pointLight position={[-2, 4.5, 0]} color="#ff4444" intensity={2} distance={8} />
      <pointLight position={[2, 4.5, 0]} color="#4444ff" intensity={2} distance={8} />
      <pointLight position={[0, 4.5, 0]} color="#ffffff" intensity={1.5} distance={10} />
    </group>
  );
});

export default StageEnvironment3D;
