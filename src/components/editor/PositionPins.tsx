import { useRef, useState, useCallback } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { useProjectStore, type Position, EFFECT_LIBRARY } from '@/store/useProjectStore';
import * as THREE from 'three';

const PYRO_COLOR = '#FF6B35';
const DRONE_COLOR = '#00B4D8';
const SNAP_GRID = 0.5; // 0.5m snap grid

function Pin({ position, onRightClick }: { position: Position; onRightClick: (pos: Position, screenPos: { x: number; y: number }) => void }) {
  const { selectedPositionIds, selectPosition, togglePositionSelection, editorMode, updatePosition, timelineItems, positions } = useProjectStore();
  const isSelected = selectedPositionIds.includes(position.id);
  const color = position.type === 'pyro' ? PYRO_COLOR : (position.color || DRONE_COLOR);
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Group>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const { camera, raycaster, gl } = useThree();
  const dragPlane = useRef(new THREE.Plane());
  const intersection = useRef(new THREE.Vector3());
  const dragOffset = useRef(new THREE.Vector3());
  const dragStartPos = useRef({ x: 0, z: 0 });

  // Count linked effects
  const linkedEffects = timelineItems.filter(
    t => t.positionId === position.id || t.positionIds?.includes(position.id)
  ).length;

  // Animated glow pulse for selected pins
  useFrame(({ clock }) => {
    if (glowRef.current && isSelected) {
      const pulse = Math.sin(clock.getElapsedTime() * 3) * 0.12 + 0.88;
      glowRef.current.scale.setScalar(pulse);
    }
  });

  const onPointerDown = useCallback((e: any) => {
    if (editorMode !== 'select') return;
    e.stopPropagation();

    // Right-click → context menu
    if (e.nativeEvent?.button === 2 || e.button === 2) {
      onRightClick(position, { x: e.clientX || e.nativeEvent?.clientX || 0, y: e.clientY || e.nativeEvent?.clientY || 0 });
      return;
    }

    if (e.nativeEvent?.shiftKey || e.shiftKey) {
      togglePositionSelection(position.id);
      return;
    }

    selectPosition(position.id);

    setIsDragging(true);
    (gl.domElement as HTMLElement).style.cursor = 'grabbing';
    dragStartPos.current = { x: position.x, z: position.z };

    dragPlane.current.setFromNormalAndCoplanarPoint(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(position.x, 0, position.z)
    );

    const rect = gl.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(mouse, camera);
    raycaster.ray.intersectPlane(dragPlane.current, intersection.current);
    dragOffset.current.set(
      position.x - intersection.current.x,
      0,
      position.z - intersection.current.z
    );
  }, [editorMode, position, selectPosition, togglePositionSelection, gl, camera, raycaster, onRightClick]);

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

    let newX = intersection.current.x + dragOffset.current.x;
    let newZ = intersection.current.z + dragOffset.current.z;

    // Snap to grid when Ctrl is held
    if (e.ctrlKey || e.metaKey) {
      newX = Math.round(newX / SNAP_GRID) * SNAP_GRID;
      newZ = Math.round(newZ / SNAP_GRID) * SNAP_GRID;
    } else {
      newX = Math.round(newX * 10) / 10;
      newZ = Math.round(newZ * 10) / 10;
    }

    // Multi-drag: if dragging a selected pin and multiple are selected, move all
    const store = useProjectStore.getState();
    if (store.selectedPositionIds.length > 1 && store.selectedPositionIds.includes(position.id)) {
      const dx = newX - position.x;
      const dz = newZ - position.z;
      store.selectedPositionIds.forEach(id => {
        if (id === position.id) {
          updatePosition(id, { x: newX, z: newZ });
        } else {
          const other = store.positions.find(p => p.id === id);
          if (other) {
            updatePosition(id, {
              x: Math.round((other.x + dx) * 10) / 10,
              z: Math.round((other.z + dz) * 10) / 10,
            });
          }
        }
      });
    } else {
      updatePosition(position.id, { x: newX, z: newZ });
    }
  }, [isDragging, position.id, position.x, position.z, updatePosition, camera, raycaster, gl]);

  const onPointerUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
      (gl.domElement as HTMLElement).style.cursor = '';
    }
  }, [isDragging, gl]);

  const onPointerOver = useCallback(() => {
    if (editorMode === 'select') {
      setIsHovered(true);
      (gl.domElement as HTMLElement).style.cursor = 'grab';
    }
  }, [editorMode, gl]);

  const onPointerOut = useCallback(() => {
    setIsHovered(false);
    if (!isDragging) {
      (gl.domElement as HTMLElement).style.cursor = '';
    }
  }, [isDragging, gl]);

  const emissiveIntensity = isDragging ? 1.0 : isSelected ? 0.7 : isHovered ? 0.4 : 0.15;

  return (
    <group position={[position.x, position.y, position.z]}>
      {/* Base disc */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[isSelected ? 0.65 : 0.5, 32]} />
        <meshBasicMaterial color={color} transparent opacity={isSelected ? 0.5 : isHovered ? 0.3 : 0.2} />
      </mesh>

      {/* Drag guide lines when dragging */}
      {isDragging && (
        <>
          {/* X axis guide */}
          <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[200, 0.03]} />
            <meshBasicMaterial color="#ff4444" transparent opacity={0.3} />
          </mesh>
          {/* Z axis guide */}
          <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
            <planeGeometry args={[200, 0.03]} />
            <meshBasicMaterial color="#4444ff" transparent opacity={0.3} />
          </mesh>
        </>
      )}

      {/* Pin body — draggable */}
      <mesh
        ref={meshRef}
        position={[0, 0.4, 0]}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerOver={onPointerOver}
        onPointerOut={onPointerOut}
      >
        <cylinderGeometry args={[0.08, 0.15, 0.8, 12]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={emissiveIntensity}
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
          emissiveIntensity={isSelected ? 0.9 : isHovered ? 0.5 : 0.3}
        />
      </mesh>

      {/* Selection ring — animated */}
      {isSelected && (
        <group ref={glowRef}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
            <ringGeometry args={[0.6, 0.75, 32]} />
            <meshBasicMaterial color={color} transparent opacity={0.7} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, 0]}>
            <ringGeometry args={[0.75, 1.0, 32]} />
            <meshBasicMaterial color={color} transparent opacity={0.15} blending={THREE.AdditiveBlending} />
          </mesh>
        </group>
      )}

      {/* Hover ring */}
      {isHovered && !isSelected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, 0]}>
          <ringGeometry args={[0.55, 0.65, 24]} />
          <meshBasicMaterial color={color} transparent opacity={0.35} />
        </mesh>
      )}

      {/* Glow light */}
      <pointLight
        color={color}
        intensity={isSelected ? 4 : isHovered ? 2 : 0.8}
        distance={isSelected ? 6 : 4}
        decay={2}
        position={[0, 0.85, 0]}
      />

      {/* Direction arrow */}
      <group rotation={[0, -position.heading * (Math.PI / 180), 0]}>
        <mesh position={[0, 0.1, -0.7]} rotation={[-Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.08, 0.25, 4]} />
          <meshBasicMaterial color={color} transparent opacity={0.5} />
        </mesh>
      </group>

      {/* Label */}
      <Html position={[0, 1.3, 0]} center style={{ pointerEvents: 'none' }}>
        <div
          className="px-2 py-0.5 rounded text-[9px] font-mono whitespace-nowrap flex items-center gap-1.5 backdrop-blur-sm"
          style={{
            backgroundColor: isSelected ? `${color}55` : `${color}22`,
            border: `1px solid ${isSelected ? `${color}99` : `${color}44`}`,
            color: color,
            boxShadow: isSelected ? `0 0 12px ${color}44` : 'none',
          }}
        >
          <span className="font-bold">{position.name}</span>
          {linkedEffects > 0 && (
            <span className="text-[8px] opacity-80 bg-black/30 px-1 rounded">🎆{linkedEffects}</span>
          )}
          {isDragging && (
            <span className="opacity-80 font-mono text-[8px] bg-black/30 px-1 rounded">
              {position.x.toFixed(1)}, {position.z.toFixed(1)}
            </span>
          )}
        </div>
      </Html>

      {/* Safety distance circle for selected pyro positions */}
      {isSelected && position.type === 'pyro' && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
          <ringGeometry args={[9.5, 10, 48]} />
          <meshBasicMaterial color="#FF4500" transparent opacity={0.12} />
        </mesh>
      )}
    </group>
  );
}

/** Ground plane for placing new pins */
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
      useProjectStore.getState().selectPosition(id);
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
      <planeGeometry args={[500, 500]} />
      <meshBasicMaterial visible={false} />
    </mesh>
  );
}

/** Click ground to deselect */
function GroundDeselectPlane() {
  const { editorMode, selectPosition } = useProjectStore();
  const handleClick = useCallback(() => {
    if (editorMode === 'select') selectPosition(null);
  }, [editorMode, selectPosition]);

  if (editorMode !== 'select') return null;
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} onClick={handleClick}>
      <planeGeometry args={[4000, 4000]} />
      <meshBasicMaterial visible={false} />
    </mesh>
  );
}

export default function PositionPins() {
  const { positions } = useProjectStore();
  const [contextMenu, setContextMenu] = useState<{ pos: Position; screen: { x: number; y: number } } | null>(null);

  const handleRightClick = useCallback((pos: Position, screenPos: { x: number; y: number }) => {
    setContextMenu({ pos, screen: screenPos });
  }, []);

  return (
    <>
      <GroundDeselectPlane />
      <GroundClickPlane />
      {positions.map((pos) => (
        <Pin key={pos.id} position={pos} onRightClick={handleRightClick} />
      ))}
    </>
  );
}
