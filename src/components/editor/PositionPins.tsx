import { useRef, useState, useCallback } from 'react';
import { useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { useProjectStore, type Position } from '@/store/useProjectStore';
import * as THREE from 'three';

const PYRO_COLOR = '#FF6B35';
const DRONE_COLOR = '#00B4D8';

function Pin({ position }: { position: Position }) {
  const { selectedPositionId, selectPosition, editorMode } = useProjectStore();
  const isSelected = selectedPositionId === position.id;
  const color = position.type === 'pyro' ? PYRO_COLOR : DRONE_COLOR;
  const meshRef = useRef<THREE.Mesh>(null);

  return (
    <group position={[position.x, position.y, position.z]}>
      {/* Base disc */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.02, 0]}
      >
        <circleGeometry args={[0.5, 24]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={isSelected ? 0.4 : 0.2}
        />
      </mesh>

      {/* Pin body */}
      <mesh
        ref={meshRef}
        position={[0, 0.4, 0]}
        onClick={(e) => {
          if (editorMode !== 'select') return; // Don't intercept clicks in placement modes
          e.stopPropagation();
          selectPosition(position.id);
        }}
      >
        <cylinderGeometry args={[0.08, 0.15, 0.8, 8]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isSelected ? 0.6 : 0.15}
          metalness={0.7}
          roughness={0.3}
        />
      </mesh>

      {/* Pin top marker */}
      <mesh position={[0, 0.85, 0]}>
        {position.type === 'pyro' ? (
          <coneGeometry args={[0.12, 0.2, 6]} />
        ) : (
          <sphereGeometry args={[0.12, 12, 12]} />
        )}
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isSelected ? 0.8 : 0.3}
        />
      </mesh>

      {/* Selection ring */}
      {isSelected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
          <ringGeometry args={[0.55, 0.65, 24]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.6}
          />
        </mesh>
      )}

      {/* Glow light */}
      <pointLight
        color={color}
        intensity={isSelected ? 3 : 0.8}
        distance={4}
        decay={2}
        position={[0, 0.85, 0]}
      />

      {/* Direction arrow showing heading */}
      <group rotation={[0, -position.heading * (Math.PI / 180), 0]}>
        <mesh position={[0, 0.1, -0.7]} rotation={[-Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.08, 0.25, 4]} />
          <meshBasicMaterial color={color} transparent opacity={0.5} />
        </mesh>
      </group>

      {/* Label */}
      <Html
        position={[0, 1.2, 0]}
        center
        style={{ pointerEvents: 'none' }}
      >
        <div
          className="px-1.5 py-0.5 rounded-sm text-[9px] font-mono whitespace-nowrap"
          style={{
            backgroundColor: `${color}22`,
            border: `1px solid ${color}44`,
            color: color,
          }}
        >
          {position.name}
        </div>
      </Html>
    </group>
  );
}

/** Invisible ground plane that captures clicks for placing new pins */
function GroundClickPlane() {
  const { editorMode, addPosition, setEditorMode } = useProjectStore();
  const { camera, raycaster } = useThree();

  const handleClick = useCallback((e: THREE.Event & { point: THREE.Vector3 }) => {
    if (editorMode !== 'add-pyro' && editorMode !== 'add-drone') return;

    const type = editorMode === 'add-pyro' ? 'pyro' as const : 'drone-pad' as const;
    const prefix = type === 'pyro' ? 'POS' : 'PAD';
    const id = `pos-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;

    addPosition({
      id,
      name: `${prefix}-${Math.floor(Math.random() * 900 + 100)}`,
      type,
      x: Math.round(e.point.x * 10) / 10,
      y: 0,
      z: Math.round(e.point.z * 10) / 10,
      heading: 0,
      pitch: 0,
      roll: 0,
    });

    setEditorMode('select');
  }, [editorMode, addPosition, setEditorMode]);

  if (editorMode !== 'add-pyro' && editorMode !== 'add-drone') return null;

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0.01, 0]}
      onClick={handleClick}
    >
      <planeGeometry args={[200, 200]} />
      <meshBasicMaterial visible={false} />
    </mesh>
  );
}

export default function PositionPins() {
  const { positions } = useProjectStore();

  return (
    <>
      <GroundClickPlane />
      {positions.map((pos) => (
        <Pin key={pos.id} position={pos} />
      ))}
    </>
  );
}
