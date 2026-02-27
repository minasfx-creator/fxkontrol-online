import { useRef, useState, useCallback } from 'react';
import { useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { useProjectStore, type Position } from '@/store/useProjectStore';
import * as THREE from 'three';

const PYRO_COLOR = '#FF6B35';
const DRONE_COLOR = '#00B4D8';

function Pin({ position }: { position: Position }) {
  const { selectedPositionIds, selectPosition, togglePositionSelection, editorMode, updatePosition } = useProjectStore();
  const isSelected = selectedPositionIds.includes(position.id);
  const color = position.type === 'pyro' ? PYRO_COLOR : (position.color || DRONE_COLOR);
  const meshRef = useRef<THREE.Mesh>(null);
  const [isDragging, setIsDragging] = useState(false);
  const { camera, raycaster, gl } = useThree();
  const dragPlane = useRef(new THREE.Plane());
  const intersection = useRef(new THREE.Vector3());

  const onPointerDown = useCallback((e: any) => {
    if (editorMode !== 'select') return;
    e.stopPropagation();

    if (e.nativeEvent?.shiftKey || e.shiftKey) {
      togglePositionSelection(position.id);
      return;
    }

    selectPosition(position.id);

    // Start dragging - create a horizontal plane at Y=0 for ground dragging
    setIsDragging(true);
    (gl.domElement as HTMLElement).style.cursor = 'grabbing';
    dragPlane.current.setFromNormalAndCoplanarPoint(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(position.x, 0, position.z)
    );
  }, [editorMode, position, selectPosition, togglePositionSelection, gl]);

  const onPointerMove = useCallback((e: any) => {
    if (!isDragging) return;
    e.stopPropagation();

    const rect = gl.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(mouse, camera);
    raycaster.ray.intersectPlane(dragPlane.current, intersection.current);

    updatePosition(position.id, {
      x: Math.round(intersection.current.x * 10) / 10,
      z: Math.round(intersection.current.z * 10) / 10,
    });
  }, [isDragging, position.id, updatePosition, camera, raycaster, gl]);

  const onPointerUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
      (gl.domElement as HTMLElement).style.cursor = '';
    }
  }, [isDragging, gl]);

  return (
    <group position={[position.x, position.y, position.z]}>
      {/* Base disc */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[0.5, 24]} />
        <meshBasicMaterial color={color} transparent opacity={isSelected ? 0.4 : 0.2} />
      </mesh>

      {/* Pin body - draggable */}
      <mesh
        ref={meshRef}
        position={[0, 0.4, 0]}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <cylinderGeometry args={[0.08, 0.15, 0.8, 8]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isDragging ? 0.8 : isSelected ? 0.6 : 0.15}
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
          <meshBasicMaterial color={color} transparent opacity={0.6} />
        </mesh>
      )}

      {/* Glow light */}
      <pointLight color={color} intensity={isSelected ? 3 : 0.8} distance={4} decay={2} position={[0, 0.85, 0]} />

      {/* Direction arrow */}
      <group rotation={[0, -position.heading * (Math.PI / 180), 0]}>
        <mesh position={[0, 0.1, -0.7]} rotation={[-Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.08, 0.25, 4]} />
          <meshBasicMaterial color={color} transparent opacity={0.5} />
        </mesh>
      </group>

      {/* Label */}
      <Html position={[0, 1.2, 0]} center style={{ pointerEvents: 'none' }}>
        <div
          className="px-1.5 py-0.5 rounded-sm text-[9px] font-mono whitespace-nowrap"
          style={{
            backgroundColor: `${color}22`,
            border: `1px solid ${color}44`,
            color: color,
          }}
        >
          {position.name}
          {isDragging && (
            <span className="ml-1 opacity-70">
              ({position.x.toFixed(1)}, {position.z.toFixed(1)})
            </span>
          )}
        </div>
      </Html>
    </group>
  );
}

/** Invisible ground plane for placing new pins */
function GroundClickPlane() {
  const { editorMode, addPosition, setEditorMode, addWaypoint, selectedTrajectoryId, drawHeight } = useProjectStore();

  const handleClick = useCallback((e: THREE.Event & { point: THREE.Vector3 }) => {
    if (editorMode === 'add-pyro' || editorMode === 'add-drone') {
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
        heading: 0, pitch: 0, roll: 0,
        color: type === 'drone-pad' ? '#00B4D8' : '#FF6B35',
      });
      setEditorMode('select');
      return;
    }

    if (editorMode === 'add-waypoint' && selectedTrajectoryId) {
      const store = useProjectStore.getState();
      const traj = store.trajectories.find((t) => t.id === selectedTrajectoryId);
      const sorted = traj ? [...traj.waypoints].sort((a, b) => a.time - b.time) : [];
      const lastWp = sorted[sorted.length - 1];
      const time = lastWp ? lastWp.time + 2 : 2;
      addWaypoint(selectedTrajectoryId, {
        id: `wp-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        position: { x: Math.round(e.point.x * 10) / 10, y: drawHeight, z: Math.round(e.point.z * 10) / 10 },
        time,
      });
    }
  }, [editorMode, addPosition, setEditorMode, addWaypoint, selectedTrajectoryId, drawHeight]);

  if (editorMode !== 'add-pyro' && editorMode !== 'add-drone' && editorMode !== 'add-waypoint') return null;

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} onClick={handleClick}>
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
