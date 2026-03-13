import { useRef, useState, useCallback, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { useProjectStore, type Position, EFFECT_LIBRARY } from '@/store/useProjectStore';
import * as THREE from 'three';

const PYRO_COLOR = '#FF6B35';
const DRONE_COLOR = '#00B4D8';

function Pin({ position }: { position: Position }) {
  const { selectedPositionIds, selectPosition, togglePositionSelection, editorMode, updatePosition, timelineItems } = useProjectStore();
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

  // Count linked effects
  const linkedEffects = timelineItems.filter(
    t => t.positionId === position.id || t.positionIds?.includes(position.id)
  ).length;

  // Animated glow pulse for selected pins
  useFrame(({ clock }) => {
    if (glowRef.current && isSelected) {
      const pulse = Math.sin(clock.getElapsedTime() * 3) * 0.15 + 0.85;
      glowRef.current.scale.setScalar(pulse);
    }
  });

  const onPointerDown = useCallback((e: any) => {
    if (editorMode !== 'select') return;
    e.stopPropagation();

    if (e.nativeEvent?.shiftKey || e.shiftKey) {
      togglePositionSelection(position.id);
      return;
    }

    selectPosition(position.id);

    // Start dragging
    setIsDragging(true);
    (gl.domElement as HTMLElement).style.cursor = 'grabbing';

    // Create drag plane at the pin's Y level
    dragPlane.current.setFromNormalAndCoplanarPoint(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(position.x, 0, position.z)
    );

    // Calculate offset so pin doesn't jump to cursor
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
  }, [editorMode, position, selectPosition, togglePositionSelection, gl, camera, raycaster]);

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

    const newX = Math.round((intersection.current.x + dragOffset.current.x) * 10) / 10;
    const newZ = Math.round((intersection.current.z + dragOffset.current.z) * 10) / 10;

    updatePosition(position.id, { x: newX, z: newZ });
  }, [isDragging, position.id, updatePosition, camera, raycaster, gl]);

  const onPointerUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
      (gl.domElement as HTMLElement).style.cursor = '';
    }
  }, [isDragging, gl]);

  const onPointerOver = useCallback(() => setIsHovered(true), []);
  const onPointerOut = useCallback(() => setIsHovered(false), []);

  const emissiveIntensity = isDragging ? 1.0 : isSelected ? 0.7 : isHovered ? 0.4 : 0.15;

  return (
    <group position={[position.x, position.y, position.z]}>
      {/* Base disc with selection state */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[isSelected ? 0.65 : 0.5, 32]} />
        <meshBasicMaterial color={color} transparent opacity={isSelected ? 0.5 : isHovered ? 0.3 : 0.2} />
      </mesh>

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
          {/* Outer selection glow */}
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
          className="px-2 py-0.5 rounded-sm text-[9px] font-mono whitespace-nowrap flex items-center gap-1.5"
          style={{
            backgroundColor: isSelected ? `${color}44` : `${color}22`,
            border: `1px solid ${isSelected ? `${color}88` : `${color}44`}`,
            color: color,
            boxShadow: isSelected ? `0 0 8px ${color}44` : 'none',
          }}
        >
          <span className="font-bold">{position.name}</span>
          {linkedEffects > 0 && (
            <span className="text-[8px] opacity-70">🎆{linkedEffects}</span>
          )}
          {isDragging && (
            <span className="opacity-70">
              ({position.x.toFixed(1)}, {position.z.toFixed(1)})
            </span>
          )}
        </div>
      </Html>

      {/* Safety distance circle for selected pyro positions */}
      {isSelected && position.type === 'pyro' && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
          <ringGeometry args={[9.5, 10, 48]} />
          <meshBasicMaterial color="#FF4500" transparent opacity={0.15} />
        </mesh>
      )}
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
      // Auto-select new position after placing
      const store = useProjectStore.getState();
      store.selectPosition(id);
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

/** Box/lasso selection support — click on empty ground to deselect */
function GroundDeselectPlane() {
  const { editorMode, selectPosition } = useProjectStore();

  const handleClick = useCallback(() => {
    if (editorMode === 'select') {
      selectPosition(null);
    }
  }, [editorMode, selectPosition]);

  if (editorMode !== 'select') return null;

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} onClick={handleClick}>
      <planeGeometry args={[2000, 2000]} />
      <meshBasicMaterial visible={false} />
    </mesh>
  );
}

export default function PositionPins() {
  const { positions } = useProjectStore();

  return (
    <>
      <GroundDeselectPlane />
      <GroundClickPlane />
      {positions.map((pos) => (
        <Pin key={pos.id} position={pos} />
      ))}
    </>
  );
}
