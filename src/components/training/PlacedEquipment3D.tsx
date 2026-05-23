import { forwardRef, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { PlacedItem } from './types';

const SparkularModel = ({ position }: { position: [number, number, number] }) => {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.children[1].position.y = 0.35 + Math.sin(clock.elapsedTime * 3) * 0.02;
  });
  return (
    <group ref={ref} position={position}>
      <mesh><cylinderGeometry args={[0.06, 0.08, 0.3, 8]} /><meshStandardMaterial color="#333" metalness={0.8} roughness={0.3} /></mesh>
      <mesh position={[0, 0.35, 0]}><coneGeometry args={[0.04, 0.15, 6]} /><meshStandardMaterial color="#00cccc" emissive="#00ffff" emissiveIntensity={1.5} /></mesh>
    </group>
  );
};

const FlamerModel = ({ position }: { position: [number, number, number] }) => (
  <group position={position}>
    <mesh><cylinderGeometry args={[0.08, 0.1, 0.25, 8]} /><meshStandardMaterial color="#444" metalness={0.7} roughness={0.4} /></mesh>
    <mesh position={[0, 0.2, 0]}><torusGeometry args={[0.06, 0.02, 8, 12]} /><meshStandardMaterial color="#ff4400" emissive="#ff6600" emissiveIntensity={2} /></mesh>
  </group>
);

const MovingHeadModel = ({ position }: { position: [number, number, number] }) => (
  <group position={position}>
    <mesh><boxGeometry args={[0.15, 0.1, 0.15]} /><meshStandardMaterial color="#222" metalness={0.6} roughness={0.4} /></mesh>
    <mesh position={[0, 0.12, 0]}><cylinderGeometry args={[0.04, 0.04, 0.15, 8]} /><meshStandardMaterial color="#333" metalness={0.8} roughness={0.3} /></mesh>
    <mesh position={[0, 0.22, 0]}><sphereGeometry args={[0.06, 8, 8]} /><meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.8} /></mesh>
  </group>
);

const TrussModel = ({ position }: { position: [number, number, number] }) => (
  <group position={position}>
    <mesh><boxGeometry args={[0.8, 0.12, 0.12]} /><meshStandardMaterial color="#999" metalness={0.9} roughness={0.2} /></mesh>
  </group>
);

const CryoModel = ({ position }: { position: [number, number, number] }) => (
  <group position={position}>
    <mesh><cylinderGeometry args={[0.1, 0.1, 0.35, 10]} /><meshStandardMaterial color="#aaddee" emissive="#88ccff" emissiveIntensity={0.6} metalness={0.5} roughness={0.3} /></mesh>
    <mesh position={[0, 0.22, 0]}><coneGeometry args={[0.05, 0.1, 6]} /><meshStandardMaterial color="#ccf0ff" emissive="#aaeeff" emissiveIntensity={0.4} /></mesh>
  </group>
);

const MortarModel = ({ position }: { position: [number, number, number] }) => (
  <group position={position}>
    <mesh><cylinderGeometry args={[0.06, 0.08, 0.3, 8]} /><meshStandardMaterial color="#554433" roughness={0.8} /></mesh>
    <mesh position={[0, 0.18, 0]}><sphereGeometry args={[0.05, 8, 8]} /><meshStandardMaterial color="#ff2200" emissive="#ff4400" emissiveIntensity={0.5} /></mesh>
  </group>
);

const ParCanModel = ({ position }: { position: [number, number, number] }) => (
  <group position={position}>
    <mesh><cylinderGeometry args={[0.08, 0.06, 0.18, 10]} /><meshStandardMaterial color="#222" metalness={0.7} roughness={0.4} /></mesh>
    <mesh position={[0, -0.1, 0]}><circleGeometry args={[0.07, 12]} /><meshStandardMaterial color="#44ff44" emissive="#22ff22" emissiveIntensity={1} side={THREE.DoubleSide} /></mesh>
  </group>
);

const EQUIPMENT_MODELS: Record<string, React.FC<{ position: [number, number, number] }>> = {
  'sparkular': SparkularModel,
  'flamer': FlamerModel,
  'moving-head': MovingHeadModel,
  'truss-straight': TrussModel,
  'truss-corner': TrussModel,
  'cryo': CryoModel,
  'mortar': MortarModel,
  'par-can': ParCanModel,
  'fog': CryoModel,
  'roman-candle': MortarModel,
};

const PlacedEquipment3D = forwardRef<THREE.Group, { items: PlacedItem[] }>(function PlacedEquipment3D({ items }, ref) {
  return (
    <group ref={ref}>
      {items.map((item) => {
        const Model = EQUIPMENT_MODELS[item.equipmentId];
        if (!Model) return null;
        return <Model key={item.snapPointId} position={item.position} />;
      })}
    </group>
  );
});

export default PlacedEquipment3D;
