import { useRef, useState, useCallback, useMemo, useEffect, forwardRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import { useProjectStore, type Position } from '@/store/useProjectStore';
import { useUndoStore } from '@/store/useUndoStore';

const ARROW_LENGTH = 4;
const TRAJECTORY_POINTS = 30;

/**
 * LaunchAngleGizmo: Draggable arc handle for heading/pitch.
 * In batch mode, dragging one handle applies the same delta to all selected positions.
 */
const LaunchAngleGizmo = forwardRef<THREE.Group, {
  position: Position;
  batchMode?: boolean;
  selectedIds?: string[];
}>(({ position, batchMode, selectedIds }, ref) => {
  const { updatePosition } = useProjectStore();
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const dragStartRef = useRef<{ heading: number; pitch: number } | null>(null);
  const batchStartRef = useRef<Map<string, { heading: number; pitch: number }>>(new Map());
  const handleRef = useRef<THREE.Mesh>(null);
  const { camera, raycaster, gl } = useThree();

  const heading = position.heading * (Math.PI / 180);
  const pitch = Math.max(5, Math.min(85, position.pitch || 85)) * (Math.PI / 180);

  const handlePos = useMemo((): [number, number, number] => {
    const r = ARROW_LENGTH;
    return [
      Math.sin(heading) * Math.cos(pitch) * r,
      Math.sin(pitch) * r,
      -Math.cos(heading) * Math.cos(pitch) * r,
    ];
  }, [heading, pitch]);

  const trajectoryPoints = useMemo(() => {
    const pts: [number, number, number][] = [];
    const v0 = 40 + (position.pitch || 85) * 0.5;
    const hRad = heading;
    const pRad = pitch;
    const vx = Math.sin(hRad) * Math.cos(pRad) * v0;
    const vy = Math.sin(pRad) * v0;
    const vz = -Math.cos(hRad) * Math.cos(pRad) * v0;

    for (let i = 0; i < TRAJECTORY_POINTS; i++) {
      const t = (i / TRAJECTORY_POINTS) * 3;
      const x = vx * t * 0.04;
      const y = Math.max(0, vy * t * 0.04 + 0.5 * -9.81 * t * t * 0.0016);
      const z = vz * t * 0.04;
      pts.push([x, y, z]);
      if (y <= 0 && i > 2) break;
    }
    return pts;
  }, [heading, pitch, position.pitch]);

  const dirLinePoints = useMemo((): [number, number, number][] => {
    return [[0, 0, 0], handlePos];
  }, [handlePos]);

  const onPointerDown = useCallback((e: any) => {
    e.stopPropagation();
    useUndoStore.getState().checkpoint();
    setIsDragging(true);
    dragStartRef.current = { heading: position.heading, pitch: position.pitch || 85 };

    // Store batch start angles
    if (batchMode && selectedIds) {
      const store = useProjectStore.getState();
      const map = new Map<string, { heading: number; pitch: number }>();
      selectedIds.forEach(id => {
        const p = store.positions.find(pos => pos.id === id);
        if (p) map.set(id, { heading: p.heading, pitch: p.pitch || 85 });
      });
      batchStartRef.current = map;
    }

    (gl.domElement as HTMLElement).style.cursor = 'grabbing';
  }, [gl, position, batchMode, selectedIds]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMove = (e: PointerEvent) => {
      const rect = gl.domElement.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      raycaster.setFromCamera(mouse, camera);

      const origin = new THREE.Vector3(position.x, position.y, position.z);
      const ray = raycaster.ray;
      const closest = new THREE.Vector3();
      ray.closestPointToPoint(origin, closest);
      const dir = closest.sub(origin).normalize();

      const newHeading = Math.atan2(dir.x, -dir.z) * (180 / Math.PI);
      const newPitch = Math.max(5, Math.min(85, Math.asin(Math.max(0, dir.y)) * (180 / Math.PI)));

      if (batchMode && selectedIds && dragStartRef.current) {
        // Apply delta to all selected positions
        const dHeading = newHeading - dragStartRef.current.heading;
        const dPitch = newPitch - dragStartRef.current.pitch;

        selectedIds.forEach(id => {
          const start = batchStartRef.current.get(id);
          if (start) {
            const h = start.heading + dHeading;
            const p = Math.max(5, Math.min(85, start.pitch + dPitch));
            updatePosition(id, { heading: h, pitch: p });
          }
        });
      } else {
        updatePosition(position.id, { heading: newHeading, pitch: newPitch });
      }
    };

    const handleUp = () => {
      setIsDragging(false);
      dragStartRef.current = null;
      batchStartRef.current.clear();
      (gl.domElement as HTMLElement).style.cursor = '';
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [isDragging, position, updatePosition, camera, raycaster, gl, batchMode, selectedIds]);

  return (
    <group ref={ref} position={[position.x, position.y, position.z]}>
      {/* Launch direction line */}
      <Line points={dirLinePoints} color="#FF6B35" lineWidth={2} transparent opacity={0.7} />

      {/* Trajectory arc */}
      {trajectoryPoints.length > 1 && (
        <Line points={trajectoryPoints} color="#FF9955" lineWidth={1} dashed dashSize={0.3} gapSize={0.15} transparent opacity={0.5} />
      )}

      {/* Draggable handle sphere */}
      <mesh
        ref={handleRef}
        position={handlePos}
        onPointerDown={onPointerDown}
        onPointerOver={() => { setIsHovered(true); (gl.domElement as HTMLElement).style.cursor = 'grab'; }}
        onPointerOut={() => { setIsHovered(false); if (!isDragging) (gl.domElement as HTMLElement).style.cursor = ''; }}
      >
        <sphereGeometry args={[isHovered || isDragging ? 0.25 : 0.18, 12, 12]} />
        <meshBasicMaterial
          color={isDragging ? '#FFAA44' : '#FF6B35'}
          transparent
          opacity={0.9}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Angle label */}
      <Html position={[handlePos[0] + 0.3, handlePos[1] + 0.3, handlePos[2]]} center>
        <div className="px-1.5 py-0.5 rounded text-[8px] font-mono whitespace-nowrap select-none"
          style={{
            backgroundColor: 'rgba(0,0,0,0.7)',
            color: '#FF9955',
            border: '1px solid rgba(255,153,85,0.4)',
            pointerEvents: 'none',
          }}
        >
          {Math.round(position.pitch || 85)}° / {Math.round(position.heading)}°
        </div>
      </Html>
    </group>
  );
});
LaunchAngleGizmo.displayName = 'LaunchAngleGizmo';

/**
 * AngleFanArc: Visual arc showing the heading spread of selected positions.
 */
function AngleFanArc({ positions }: { positions: Position[] }) {
  const arcPoints = useMemo(() => {
    if (positions.length < 2) return null;

    // Find centroid
    const cx = positions.reduce((s, p) => s + p.x, 0) / positions.length;
    const cz = positions.reduce((s, p) => s + p.z, 0) / positions.length;
    const cy = positions.reduce((s, p) => s + p.y, 0) / positions.length;

    const headings = positions.map(p => p.heading);
    const minH = Math.min(...headings) * (Math.PI / 180);
    const maxH = Math.max(...headings) * (Math.PI / 180);
    const avgPitch = (positions.reduce((s, p) => s + (p.pitch || 85), 0) / positions.length) * (Math.PI / 180);

    const r = 3;
    const steps = 24;
    const pts: [number, number, number][] = [[cx, cy, cz]];

    for (let i = 0; i <= steps; i++) {
      const angle = minH + (maxH - minH) * (i / steps);
      pts.push([
        cx + Math.sin(angle) * Math.cos(avgPitch) * r,
        cy + Math.sin(avgPitch) * r * 0.5,
        cz - Math.cos(angle) * Math.cos(avgPitch) * r,
      ]);
    }
    pts.push([cx, cy, cz]);

    return pts;
  }, [positions]);

  if (!arcPoints) return null;

  return (
    <Line
      points={arcPoints}
      color="#FF6B35"
      lineWidth={1.5}
      transparent
      opacity={0.3}
    />
  );
}

export default function PyroLaunchAngles() {
  const positions = useProjectStore(s => s.positions);
  const selectedIds = useProjectStore(s => s.selectedPositionIds);
  const editorMode = useProjectStore(s => s.editorMode);
  const pyroPositions = positions.filter(p => p.type === 'pyro');

  const isAngleMode = editorMode === 'adjust-angles';

  // In adjust-angles mode: show gizmos for ALL selected positions
  // In normal mode: show gizmo only for individually selected positions
  const visiblePositions = isAngleMode
    ? (selectedIds.length > 0 ? pyroPositions.filter(p => selectedIds.includes(p.id)) : pyroPositions)
    : pyroPositions.filter(p => selectedIds.includes(p.id));

  const selectedPyroPositions = pyroPositions.filter(p => selectedIds.includes(p.id));
  const isBatch = selectedIds.length > 1;

  // Keyboard shortcut: A to toggle adjust-angles mode
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'a' || e.key === 'A') {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
        const store = useProjectStore.getState();
        store.setEditorMode(store.editorMode === 'adjust-angles' ? 'select' : 'adjust-angles');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <>
      {visiblePositions.map(pos => (
        <LaunchAngleGizmo
          key={pos.id}
          position={pos}
          batchMode={isBatch}
          selectedIds={selectedIds}
        />
      ))}
      {/* Fan arc showing heading spread for batch selection */}
      {isBatch && selectedPyroPositions.length > 1 && (
        <AngleFanArc positions={selectedPyroPositions} />
      )}
    </>
  );
}
