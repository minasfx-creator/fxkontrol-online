import { useRef, useState, useCallback, useMemo, useEffect, forwardRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import { useProjectStore, type Position } from '@/store/useProjectStore';
import { useUndoStore } from '@/store/useUndoStore';
import { calcWindCompensation } from '@/lib/pyroPhysics';

const ARROW_LENGTH = 3.5;
const PITCH_ARC_RADIUS = 2.2;
const HEADING_ARC_RADIUS = 1.8;
const TRAJECTORY_POINTS = 40;

/* ─── Finale 3D Colors ─── */
const COLORS = {
  arrow: '#4FC3F7',        // Launch direction
  arrowActive: '#81D4FA',
  pitchArc: '#FF8A65',     // Pitch arc orange
  headingArc: '#4FC3F7',   // Heading arc blue
  trajectory: '#FFD54F',   // Predicted trajectory
  handle: '#FFFFFF',
  handleActive: '#FFD54F',
  handleHover: '#81D4FA',
  grid: '#4FC3F7',
  label: '#B0BEC5',
  labelValue: '#FFFFFF',
};

/**
 * PitchArcGizmo: Finale-style pitch arc visualization.
 * Shows a curved arc from vertical (90°) to current pitch angle.
 */
function PitchArc({ heading, pitch }: { heading: number; pitch: number }) {
  const points = useMemo(() => {
    const pts: [number, number, number][] = [];
    const hRad = heading * (Math.PI / 180);
    const startAngle = Math.PI / 2; // 90° vertical
    const endAngle = pitch * (Math.PI / 180);
    const steps = 20;

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const angle = startAngle + (endAngle - startAngle) * t;
      const r = PITCH_ARC_RADIUS;
      pts.push([
        Math.sin(hRad) * Math.cos(angle) * r,
        Math.sin(angle) * r,
        -Math.cos(hRad) * Math.cos(angle) * r,
      ]);
    }
    return pts;
  }, [heading, pitch]);

  if (points.length < 2) return null;

  return (
    <Line
      points={points}
      color={COLORS.pitchArc}
      lineWidth={2}
      transparent
      opacity={0.7}
    />
  );
}

/**
 * HeadingCompassArc: Shows a ground-level arc from North (0°) to heading.
 * Finale 3D style — thin dashed circle with heading tick.
 */
function HeadingCompass({ heading }: { heading: number }) {
  const compassCircle = useMemo(() => {
    const pts: [number, number, number][] = [];
    const r = HEADING_ARC_RADIUS;
    for (let i = 0; i <= 64; i++) {
      const angle = (i / 64) * Math.PI * 2;
      pts.push([Math.sin(angle) * r, 0.02, -Math.cos(angle) * r]);
    }
    return pts;
  }, []);

  const headingTick = useMemo(() => {
    const hRad = heading * (Math.PI / 180);
    const r = HEADING_ARC_RADIUS;
    const inner = r * 0.85;
    const outer = r * 1.15;
    return [
      [Math.sin(hRad) * inner, 0.02, -Math.cos(hRad) * inner] as [number, number, number],
      [Math.sin(hRad) * outer, 0.02, -Math.cos(hRad) * outer] as [number, number, number],
    ];
  }, [heading]);

  // North indicator
  const northTick = useMemo(() => {
    const r = HEADING_ARC_RADIUS;
    return [
      [0, 0.02, -(r * 0.85)] as [number, number, number],
      [0, 0.02, -(r * 1.15)] as [number, number, number],
    ];
  }, []);

  // Heading arc from 0 to heading
  const headingArc = useMemo(() => {
    const pts: [number, number, number][] = [];
    const r = HEADING_ARC_RADIUS * 0.95;
    const hRad = heading * (Math.PI / 180);
    const steps = Math.max(2, Math.abs(Math.round(heading / 5)));
    for (let i = 0; i <= steps; i++) {
      const angle = (i / steps) * hRad;
      pts.push([Math.sin(angle) * r, 0.03, -Math.cos(angle) * r]);
    }
    return pts;
  }, [heading]);

  return (
    <group>
      {/* Full compass circle */}
      <Line points={compassCircle} color={COLORS.grid} lineWidth={0.8} transparent opacity={0.15} />
      {/* North tick */}
      <Line points={northTick} color="#EF5350" lineWidth={2} transparent opacity={0.5} />
      {/* Heading tick */}
      <Line points={headingTick} color={COLORS.headingArc} lineWidth={2.5} transparent opacity={0.8} />
      {/* Arc sweep */}
      {headingArc.length >= 2 && (
        <Line points={headingArc} color={COLORS.headingArc} lineWidth={1.8} transparent opacity={0.5} />
      )}
    </group>
  );
}

/**
 * LaunchAngleGizmo: Finale 3D-style heading/pitch editing.
 * - Direction arrow with conical tip
 * - Pitch arc from 90° to current angle
 * - Heading compass ring on the ground
 * - Draggable tip handle
 * - Professional label: H: xxx° P: xxx°
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

  // Arrow tip position
  const handlePos = useMemo((): [number, number, number] => {
    const r = ARROW_LENGTH;
    return [
      Math.sin(heading) * Math.cos(pitch) * r,
      Math.sin(pitch) * r,
      -Math.cos(heading) * Math.cos(pitch) * r,
    ];
  }, [heading, pitch]);

  // Arrow shaft segments for a tapered look
  const arrowShaftPoints = useMemo((): [number, number, number][] => {
    const pts: [number, number, number][] = [];
    const steps = 8;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      pts.push([
        handlePos[0] * t,
        handlePos[1] * t,
        handlePos[2] * t,
      ]);
    }
    return pts;
  }, [handlePos]);

  // Ballistic trajectory preview
  const trajectoryPoints = useMemo(() => {
    const pts: [number, number, number][] = [];
    const v0 = 35 + (position.pitch || 85) * 0.6;
    const hRad = heading;
    const pRad = pitch;
    const vx = Math.sin(hRad) * Math.cos(pRad) * v0;
    const vy = Math.sin(pRad) * v0;
    const vz = -Math.cos(hRad) * Math.cos(pRad) * v0;

    for (let i = 0; i < TRAJECTORY_POINTS; i++) {
      const t = (i / TRAJECTORY_POINTS) * 3.5;
      const x = vx * t * 0.035;
      const y = Math.max(0, vy * t * 0.035 + 0.5 * -9.81 * t * t * 0.0012);
      const z = vz * t * 0.035;
      pts.push([x, y, z]);
      if (y <= 0 && i > 3) break;
    }
    return pts;
  }, [heading, pitch, position.pitch]);

  // Pointer events
  const onPointerDown = useCallback((e: any) => {
    e.stopPropagation();
    useUndoStore.getState().checkpoint();
    setIsDragging(true);
    dragStartRef.current = { heading: position.heading, pitch: position.pitch || 85 };

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

  const handleColor = isDragging ? COLORS.handleActive : isHovered ? COLORS.handleHover : COLORS.handle;
  const handleSize = isDragging ? 0.22 : isHovered ? 0.2 : 0.15;

  return (
    <group ref={ref} position={[position.x, position.y, position.z]}>
      {/* Heading compass ring on ground */}
      <HeadingCompass heading={position.heading} />

      {/* Pitch arc */}
      <PitchArc heading={position.heading} pitch={position.pitch || 85} />

      {/* Launch direction arrow shaft */}
      <Line points={arrowShaftPoints} color={COLORS.arrow} lineWidth={2.5} transparent opacity={0.85} />

      {/* Ballistic trajectory preview */}
      {trajectoryPoints.length > 1 && (
        <Line
          points={trajectoryPoints}
          color={COLORS.trajectory}
          lineWidth={1}
          dashed
          dashSize={0.25}
          gapSize={0.12}
          transparent
          opacity={0.4}
        />
      )}

      {/* Arrow cone tip */}
      <mesh
        position={handlePos}
        rotation={(() => {
          const dir = new THREE.Vector3(...handlePos).normalize();
          const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
          const e = new THREE.Euler().setFromQuaternion(q);
          return [e.x, e.y, e.z] as [number, number, number];
        })()}
      >
        <coneGeometry args={[0.08, 0.25, 6]} />
        <meshBasicMaterial color={COLORS.arrow} transparent opacity={0.8} />
      </mesh>

      {/* Draggable handle sphere at tip */}
      <mesh
        ref={handleRef}
        position={handlePos}
        onPointerDown={onPointerDown}
        onPointerOver={() => { setIsHovered(true); (gl.domElement as HTMLElement).style.cursor = 'grab'; }}
        onPointerOut={() => { setIsHovered(false); if (!isDragging) (gl.domElement as HTMLElement).style.cursor = ''; }}
      >
        <sphereGeometry args={[handleSize, 12, 12]} />
        <meshBasicMaterial
          color={handleColor}
          transparent
          opacity={isDragging ? 1.0 : 0.7}
        />
      </mesh>

      {/* Outer glow ring on handle when active */}
      {(isDragging || isHovered) && (
        <mesh position={handlePos}>
          <ringGeometry args={[handleSize + 0.05, handleSize + 0.12, 16]} />
          <meshBasicMaterial
            color={COLORS.handleActive}
            transparent
            opacity={0.3}
            side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      )}

      {/* Finale 3D-style label: position name + H/P values */}
      <Html
        position={[handlePos[0] * 1.15 + 0.4, handlePos[1] * 1.15 + 0.5, handlePos[2] * 1.15]}
        center
        occlude
        distanceFactor={10}
      >
        <div
          className="select-none pointer-events-none"
          style={{
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            fontSize: '10px',
            lineHeight: '1.3',
            background: 'rgba(13, 17, 23, 0.92)',
            border: '1px solid rgba(79, 195, 247, 0.3)',
            borderRadius: '3px',
            padding: '3px 6px',
            whiteSpace: 'nowrap',
            color: COLORS.label,
            backdropFilter: 'blur(4px)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
          }}
        >
          <div style={{ fontWeight: 700, color: COLORS.labelValue, fontSize: '9px', marginBottom: '1px' }}>
            {position.name}
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <span>
              <span style={{ color: COLORS.headingArc, fontWeight: 600 }}>H</span>
              <span style={{ color: COLORS.labelValue }}>{Math.round(position.heading)}°</span>
            </span>
            <span>
              <span style={{ color: COLORS.pitchArc, fontWeight: 600 }}>P</span>
              <span style={{ color: COLORS.labelValue }}>{Math.round(position.pitch || 85)}°</span>
            </span>
          </div>
        </div>
      </Html>
    </group>
  );
});
LaunchAngleGizmo.displayName = 'LaunchAngleGizmo';

/**
 * AngleFanArc: Finale-style fan showing heading spread for batch selection.
 * Solid filled wedge instead of just a line.
 */
function AngleFanArc({ positions }: { positions: Position[] }) {
  const arcPoints = useMemo(() => {
    if (positions.length < 2) return null;

    const cx = positions.reduce((s, p) => s + p.x, 0) / positions.length;
    const cz = positions.reduce((s, p) => s + p.z, 0) / positions.length;
    const cy = positions.reduce((s, p) => s + p.y, 0) / positions.length;

    const headings = positions.map(p => p.heading);
    const minH = Math.min(...headings) * (Math.PI / 180);
    const maxH = Math.max(...headings) * (Math.PI / 180);
    const avgPitch = (positions.reduce((s, p) => s + (p.pitch || 85), 0) / positions.length) * (Math.PI / 180);

    const r = 3.5;
    const steps = 32;
    const pts: [number, number, number][] = [[cx, cy + 0.05, cz]];

    for (let i = 0; i <= steps; i++) {
      const angle = minH + (maxH - minH) * (i / steps);
      pts.push([
        cx + Math.sin(angle) * Math.cos(avgPitch) * r,
        cy + Math.sin(avgPitch) * r * 0.3 + 0.05,
        cz - Math.cos(angle) * Math.cos(avgPitch) * r,
      ]);
    }
    pts.push([cx, cy + 0.05, cz]);

    return pts;
  }, [positions]);

  if (!arcPoints) return null;

  return (
    <Line
      points={arcPoints}
      color={COLORS.headingArc}
      lineWidth={1.5}
      transparent
      opacity={0.25}
    />
  );
}

/**
 * BatchAngleLabel: Shows aggregate stats for batch selection.
 */
function BatchAngleLabel({ positions }: { positions: Position[] }) {
  const center = useMemo(() => {
    const cx = positions.reduce((s, p) => s + p.x, 0) / positions.length;
    const cy = positions.reduce((s, p) => s + p.y, 0) / positions.length;
    const cz = positions.reduce((s, p) => s + p.z, 0) / positions.length;
    return [cx, cy + 2, cz] as [number, number, number];
  }, [positions]);

  const stats = useMemo(() => {
    const hs = positions.map(p => p.heading);
    const ps = positions.map(p => p.pitch || 85);
    return {
      hMin: Math.round(Math.min(...hs)),
      hMax: Math.round(Math.max(...hs)),
      pMin: Math.round(Math.min(...ps)),
      pMax: Math.round(Math.max(...ps)),
      count: positions.length,
    };
  }, [positions]);

  return (
    <Html position={center} center distanceFactor={12}>
      <div
        className="select-none pointer-events-none"
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '9px',
          lineHeight: '1.3',
          background: 'rgba(13, 17, 23, 0.95)',
          border: '1px solid rgba(255, 213, 79, 0.4)',
          borderRadius: '3px',
          padding: '3px 6px',
          whiteSpace: 'nowrap',
          color: COLORS.label,
        }}
      >
        <div style={{ fontWeight: 700, color: COLORS.handleActive, fontSize: '8px' }}>
          BATCH × {stats.count}
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          <span style={{ color: COLORS.headingArc }}>H</span>
          <span style={{ color: COLORS.labelValue }}>{stats.hMin}°–{stats.hMax}°</span>
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          <span style={{ color: COLORS.pitchArc }}>P</span>
          <span style={{ color: COLORS.labelValue }}>{stats.pMin}°–{stats.pMax}°</span>
        </div>
      </div>
    </Html>
  );
}

export default function PyroLaunchAngles() {
  const positions = useProjectStore(s => s.positions);
  const selectedIds = useProjectStore(s => s.selectedPositionIds);
  const editorMode = useProjectStore(s => s.editorMode);
  const pyroPositions = positions.filter(p => p.type === 'pyro');

  const isAngleMode = editorMode === 'adjust-angles';

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
      {/* Fan arc + batch label for multi-selection */}
      {isBatch && selectedPyroPositions.length > 1 && (
        <>
          <AngleFanArc positions={selectedPyroPositions} />
          <BatchAngleLabel positions={selectedPyroPositions} />
        </>
      )}
    </>
  );
}
