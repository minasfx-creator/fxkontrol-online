import { forwardRef, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { SnapPoint, PlacedItem } from './types';

interface SnapPointsProps {
  points: SnapPoint[];
  placedItems: PlacedItem[];
  selectedEquipment: string | null;
  onSnapClick: (snapPoint: SnapPoint) => void;
}

const PulsingSnapPoint = ({
  point,
  isAvailable,
  isCompatible,
  onClick,
}: {
  point: SnapPoint;
  isAvailable: boolean;
  isCompatible: boolean;
  onClick: () => void;
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!isAvailable) return;
    const t = clock.elapsedTime;
    const pulse = 1 + Math.sin(t * 3) * 0.2;
    if (meshRef.current) meshRef.current.scale.setScalar(pulse);
    if (glowRef.current) {
      glowRef.current.scale.setScalar(pulse * 1.8);
      (glowRef.current.material as THREE.MeshStandardMaterial).opacity = 0.15 + Math.sin(t * 3) * 0.1;
    }
  });

  if (!isAvailable) return null;

  const color = isCompatible ? '#44ff88' : '#6666aa';
  const emissive = isCompatible ? '#22ff66' : '#4444aa';

  return (
    <group position={point.position}>
      {/* Core sphere */}
      <mesh ref={meshRef} onClick={onClick}>
        <sphereGeometry args={[0.12, 12, 12]} />
        <meshStandardMaterial
          color={color}
          emissive={emissive}
          emissiveIntensity={isCompatible ? 1.5 : 0.4}
          transparent
          opacity={0.7}
        />
      </mesh>
      {/* Outer glow */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[0.12, 12, 12]} />
        <meshStandardMaterial
          color={color}
          transparent
          opacity={0.15}
          depthWrite={false}
        />
      </mesh>
      {/* Invisible hitbox for easier clicking */}
      <mesh onClick={onClick} visible={false}>
        <sphereGeometry args={[0.4, 8, 8]} />
        <meshBasicMaterial />
      </mesh>
    </group>
  );
};

const SnapPoints = forwardRef<THREE.Group, SnapPointsProps>(function SnapPoints(
  { points, placedItems, selectedEquipment, onSnapClick },
  ref
) {
  const placedIds = new Set(placedItems.map((p) => p.snapPointId));

  return (
    <group ref={ref}>
      {points.map((point) => {
        const isAvailable = !placedIds.has(point.id);
        const isCompatible = selectedEquipment === point.equipmentType;
        return (
          <PulsingSnapPoint
            key={point.id}
            point={point}
            isAvailable={isAvailable}
            isCompatible={isCompatible}
            onClick={() => onSnapClick(point)}
          />
        );
      })}
    </group>
  );
});

export default SnapPoints;
