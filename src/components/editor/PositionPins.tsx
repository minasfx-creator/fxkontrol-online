import { useRef, useState, useCallback, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { useProjectStore, type Position, EFFECT_LIBRARY } from '@/store/useProjectStore';
import { useUndoStore } from '@/store/useUndoStore';
import * as THREE from 'three';

const PYRO_COLOR = '#FF6B35';
const DRONE_COLOR = '#00B4D8';
const SNAP_GRID = 0.5;
const SNAP_GUIDE_THRESHOLD = 0.4; // meters — show guide when within this distance

interface SnapGuide {
  axis: 'x' | 'z';
  value: number;
  sourceName: string;
}

function Pin({ position, onRightClick }: { position: Position; onRightClick: (pos: Position, screenPos: { x: number; y: number }) => void }) {
  const { selectedPositionIds, selectPosition, togglePositionSelection, editorMode, updatePosition, timelineItems } = useProjectStore();
  const isSelected = selectedPositionIds.includes(position.id);
  const color = position.type === 'pyro' ? PYRO_COLOR : (position.color || DRONE_COLOR);
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Group>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [snapGuides, setSnapGuides] = useState<SnapGuide[]>([]);
  const { camera, raycaster, gl } = useThree();
  const dragPlane = useRef(new THREE.Plane());
  const intersection = useRef(new THREE.Vector3());
  const dragOffset = useRef(new THREE.Vector3());
  const otherStartPositions = useRef<Map<string, { x: number; z: number }>>(new Map());
  const dragStartPos = useRef<{ x: number; z: number }>({ x: 0, z: 0 });
  const hasSavedCheckpoint = useRef(false);

  const linkedEffects = timelineItems.filter(
    t => t.positionId === position.id || t.positionIds?.includes(position.id)
  ).length;

  useFrame(({ clock }) => {
    if (glowRef.current && isSelected) {
      const pulse = Math.sin(clock.getElapsedTime() * 3) * 0.12 + 0.88;
      glowRef.current.scale.setScalar(pulse);
    }
  });

  // Compute snap guides against other non-selected positions
  const computeSnapGuides = useCallback((x: number, z: number): { guides: SnapGuide[]; snappedX: number; snappedZ: number } => {
    const store = useProjectStore.getState();
    const others = store.positions.filter(p => !store.selectedPositionIds.includes(p.id));
    const guides: SnapGuide[] = [];
    let snappedX = x;
    let snappedZ = z;

    for (const other of others) {
      if (Math.abs(other.x - x) < SNAP_GUIDE_THRESHOLD) {
        guides.push({ axis: 'x', value: other.x, sourceName: other.name });
        snappedX = other.x;
      }
      if (Math.abs(other.z - z) < SNAP_GUIDE_THRESHOLD) {
        guides.push({ axis: 'z', value: other.z, sourceName: other.name });
        snappedZ = other.z;
      }
    }
    return { guides, snappedX, snappedZ };
  }, []);

  const onPointerDown = useCallback((e: any) => {
    if (editorMode !== 'select') return;
    e.stopPropagation();

    if (e.nativeEvent?.button === 2 || e.button === 2) {
      onRightClick(position, { x: e.clientX || e.nativeEvent?.clientX || 0, y: e.clientY || e.nativeEvent?.clientY || 0 });
      window.dispatchEvent(new CustomEvent('position-context-menu', {
        detail: { posId: position.id, x: e.clientX || e.nativeEvent?.clientX || 0, y: e.clientY || e.nativeEvent?.clientY || 0 }
      }));
      return;
    }

    if (e.nativeEvent?.shiftKey || e.shiftKey) {
      togglePositionSelection(position.id);
      return;
    }

    if (!selectedPositionIds.includes(position.id)) {
      selectPosition(position.id);
    }

    setIsDragging(true);
    hasSavedCheckpoint.current = false;
    dragStartPos.current = { x: position.x, z: position.z };
    (gl.domElement as HTMLElement).style.cursor = 'grabbing';

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

    const store = useProjectStore.getState();
    otherStartPositions.current.clear();
    store.selectedPositionIds.forEach(id => {
      if (id !== position.id) {
        const p = store.positions.find(pp => pp.id === id);
        if (p) otherStartPositions.current.set(id, { x: p.x, z: p.z });
      }
    });
  }, [editorMode, position, selectPosition, togglePositionSelection, selectedPositionIds, gl, camera, raycaster, onRightClick]);

  const onPointerMove = useCallback((e: any) => {
    if (!isDragging) return;
    e.stopPropagation();

    // Save undo checkpoint on first move (not click)
    if (!hasSavedCheckpoint.current) {
      useUndoStore.getState().checkpoint();
      hasSavedCheckpoint.current = true;
    }

    const rect = gl.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(mouse, camera);
    raycaster.ray.intersectPlane(dragPlane.current, intersection.current);

    let newX = intersection.current.x + dragOffset.current.x;
    let newZ = intersection.current.z + dragOffset.current.z;

    if (e.ctrlKey || e.metaKey) {
      newX = Math.round(newX / SNAP_GRID) * SNAP_GRID;
      newZ = Math.round(newZ / SNAP_GRID) * SNAP_GRID;
      setSnapGuides([]);
    } else {
      // Smart snap to other positions
      const { guides, snappedX, snappedZ } = computeSnapGuides(
        Math.round(newX * 10) / 10,
        Math.round(newZ * 10) / 10
      );
      newX = snappedX;
      newZ = snappedZ;
      setSnapGuides(guides);
    }

    const store = useProjectStore.getState();
    updatePosition(position.id, { x: newX, z: newZ });

    // Multi-drag
    if (store.selectedPositionIds.length > 1 && store.selectedPositionIds.includes(position.id)) {
      const dx = newX - dragStartPos.current.x;
      const dz = newZ - dragStartPos.current.z;
      otherStartPositions.current.forEach((startPos, id) => {
        updatePosition(id, {
          x: Math.round((startPos.x + dx) * 10) / 10,
          z: Math.round((startPos.z + dz) * 10) / 10,
        });
      });
    }
  }, [isDragging, position.id, updatePosition, camera, raycaster, gl, computeSnapGuides]);

  const onPointerUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
      setSnapGuides([]);
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
    if (!isDragging) (gl.domElement as HTMLElement).style.cursor = '';
  }, [isDragging, gl]);

  // Double-click to open popup editor
  const onDoubleClick = useCallback((e: any) => {
    e.stopPropagation();
    selectPosition(position.id);
    // Dispatch event for popup editor
    window.dispatchEvent(new CustomEvent('position-double-click', { detail: { posId: position.id } }));
  }, [position.id, selectPosition]);

  const emissiveIntensity = isDragging ? 1.0 : isSelected ? 0.7 : isHovered ? 0.4 : 0.15;
  const pinScale = isSelected ? 1.15 : isHovered ? 1.05 : 1;

  return (
    <group position={[position.x, position.y, position.z]} scale={[pinScale, pinScale, pinScale]}>
      {/* Base disc */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[isSelected ? 0.65 : 0.5, 32]} />
        <meshBasicMaterial color={color} transparent opacity={isSelected ? 0.5 : isHovered ? 0.3 : 0.2} />
      </mesh>

      {/* Drag crosshair guides */}
      {isDragging && (
        <>
          <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[200, 0.03]} />
            <meshBasicMaterial color="#ff4444" transparent opacity={0.25} />
          </mesh>
          <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
            <planeGeometry args={[200, 0.03]} />
            <meshBasicMaterial color="#4444ff" transparent opacity={0.25} />
          </mesh>
        </>
      )}

      {/* Snap alignment guides */}
      {snapGuides.map((guide, i) => (
        <mesh key={i} position={[
          guide.axis === 'x' ? 0 : 0,
          0.02,
          guide.axis === 'z' ? 0 : 0,
        ]} rotation={[-Math.PI / 2, 0, guide.axis === 'x' ? Math.PI / 2 : 0]}>
          <planeGeometry args={[300, 0.04]} />
          <meshBasicMaterial color="#00ff88" transparent opacity={0.4} />
        </mesh>
      ))}

      {/* Pin body */}
      <mesh
        ref={meshRef}
        position={[0, 0.4, 0]}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerOver={onPointerOver}
        onPointerOut={onPointerOut}
        onDoubleClick={onDoubleClick}
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

      {/* Pin top */}
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

      {/* Selection ring */}
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

      {/* Glow */}
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
          className="px-2 py-0.5 rounded text-[9px] font-mono whitespace-nowrap flex items-center gap-1.5 backdrop-blur-sm select-none"
          style={{
            backgroundColor: isSelected ? `${color}55` : `${color}22`,
            border: `1px solid ${isSelected ? `${color}99` : `${color}44`}`,
            color,
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
          {snapGuides.length > 0 && (
            <span className="text-[7px] text-green-400 bg-black/40 px-1 rounded">SNAP</span>
          )}
        </div>
      </Html>

      {/* Safety ring for pyro */}
      {isSelected && position.type === 'pyro' && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
          <ringGeometry args={[9.5, 10, 48]} />
          <meshBasicMaterial color="#FF4500" transparent opacity={0.1} />
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
      useUndoStore.getState().checkpoint();
      const type = editorMode === 'add-pyro' ? 'pyro' as const : 'drone-pad' as const;
      const prefix = type === 'pyro' ? 'POS' : 'PAD';
      const count = useProjectStore.getState().positions.filter(p => p.type === type).length + 1;
      const id = `pos-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
      addPosition({
        id,
        name: `${prefix}-${count.toString().padStart(3, '0')}`,
        type,
        x: Math.round(e.point.x * 10) / 10,
        y: 0,
        z: Math.round(e.point.z * 10) / 10,
        heading: 0, pitch: 0, roll: 0,
        color: type === 'drone-pad' ? '#00B4D8' : '#FF6B35',
      });
      useProjectStore.getState().selectPosition(id);
      // Stay in placement mode if Shift is held
      if (!(e as any).nativeEvent?.shiftKey) {
        setEditorMode('select');
      }
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
