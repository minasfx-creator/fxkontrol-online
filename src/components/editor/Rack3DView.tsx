import { useMemo } from 'react';
import * as THREE from 'three';
import { useRackStore, RACK_TYPE_INFO, type Rack } from '@/store/useRackStore';
import { useProjectStore } from '@/store/useProjectStore';

function RackTube3D({ x, z, caliber, angle, heading, status, hasEffect }: {
  x: number; z: number; caliber: number; angle: number; heading: number;
  status: string; hasEffect: boolean;
}) {
  const radius = caliber * 0.025;
  const tubeHeight = 0.15 + caliber * 0.04;

  const color = hasEffect ? '#3b82f6' : status === 'loaded' ? '#22c55e' : status === 'fired' ? '#f97316' : status === 'dud' ? '#ef4444' : '#555555';

  const rotation = useMemo(() => {
    const euler = new THREE.Euler(
      -(angle * Math.PI / 180),
      heading * Math.PI / 180,
      0,
      'YXZ'
    );
    return euler;
  }, [angle, heading]);

  return (
    <group position={[x, tubeHeight / 2, z]} rotation={rotation}>
      <mesh castShadow>
        <cylinderGeometry args={[radius, radius * 1.1, tubeHeight, 8]} />
        <meshStandardMaterial color={color} metalness={0.4} roughness={0.5} />
      </mesh>
      {/* Opening rim */}
      <mesh position={[0, tubeHeight / 2, 0]}>
        <torusGeometry args={[radius, radius * 0.12, 6, 12]} />
        <meshStandardMaterial color="#888" metalness={0.6} roughness={0.3} />
      </mesh>
    </group>
  );
}

function SingleRack3D({ rack, posX, posZ }: { rack: Rack; posX: number; posZ: number }) {
  const { selectedRackId, selectRack } = useRackStore();
  const isSelected = selectedRackId === rack.id;
  const rotRad = (rack.rotation * Math.PI) / 180;

  const tubePositions = useMemo(() => {
    const count = rack.tubes.length;
    const spacing = 0.15;

    if (rack.type === 'circle') {
      const r = (rack.circleRadius ?? 1.5) * 0.3;
      return rack.tubes.map((tube, i) => {
        const a = ((360 / count) * i) * Math.PI / 180;
        return { tube, x: Math.cos(a) * r, z: Math.sin(a) * r };
      });
    }

    if (rack.type === 'fan') {
      const startA = (rack.fanAngleStart ?? -45) * Math.PI / 180;
      const endA = (rack.fanAngleEnd ?? 45) * Math.PI / 180;
      return rack.tubes.map((tube, i) => {
        const t = count > 1 ? i / (count - 1) : 0.5;
        const a = startA + (endA - startA) * t;
        const dist = 0.3;
        return { tube, x: Math.sin(a) * dist, z: -Math.cos(a) * dist * 0.3 };
      });
    }

    // Grid
    const cols = rack.cols || Math.ceil(Math.sqrt(count));
    return rack.tubes.map((tube) => ({
      tube,
      x: (tube.col - (cols - 1) / 2) * spacing,
      z: (tube.row - ((rack.rows || 1) - 1) / 2) * spacing,
    }));
  }, [rack]);

  // Base plate dimensions
  const baseW = rack.type === 'circle' ? 0.8 : Math.max(0.3, rack.cols * 0.15 + 0.1);
  const baseD = rack.type === 'circle' ? 0.8 : Math.max(0.2, (rack.rows || 1) * 0.15 + 0.1);

  return (
    <group position={[posX, 0.01, posZ]} rotation={[0, rotRad, 0]} onClick={(e) => { e.stopPropagation(); selectRack(rack.id); }}>
      {/* Base plate */}
      <mesh receiveShadow position={[0, 0.01, 0]}>
        <boxGeometry args={[baseW, 0.02, baseD]} />
        <meshStandardMaterial
          color={rack.color}
          metalness={0.3}
          roughness={0.6}
          opacity={isSelected ? 1 : 0.7}
          transparent
        />
      </mesh>

      {/* Selection indicator */}
      {isSelected && (
        <mesh position={[0, 0.005, 0]}>
          <boxGeometry args={[baseW + 0.06, 0.005, baseD + 0.06]} />
          <meshBasicMaterial color="#3b82f6" transparent opacity={0.3} />
        </mesh>
      )}

      {/* Tubes */}
      {tubePositions.map(({ tube, x, z }) => (
        <RackTube3D
          key={tube.id}
          x={x} z={z}
          caliber={tube.caliber}
          angle={tube.angle}
          heading={tube.heading}
          status={tube.status}
          hasEffect={!!tube.effectId}
        />
      ))}

      {/* Rack label */}
      {/* Using a small plane with text would need troika-text; skip for perf */}
    </group>
  );
}

export default function Rack3DView() {
  const racks = useRackStore(s => s.racks);
  const showRack3D = useRackStore(s => s.showRack3D);
  const positions = useProjectStore(s => s.positions);

  if (!showRack3D || racks.length === 0) return null;

  return (
    <group>
      {racks.map(rack => {
        const pos = positions.find(p => p.id === rack.positionId);
        if (!pos) return null;
        return <SingleRack3D key={rack.id} rack={rack} posX={pos.x} posZ={pos.z} />;
      })}
    </group>
  );
}
