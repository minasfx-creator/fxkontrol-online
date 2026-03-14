import { useRef, useState, useCallback, useMemo, useEffect, forwardRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import { useProjectStore, type Position } from '@/store/useProjectStore';

const ARROW_LENGTH = 4;
const TRAJECTORY_POINTS = 30;

/**
 * PyroLaunchAngle: Editable launch angle visualizer for pyro positions.
 * Shows a draggable arc handle to set heading and pitch (tilt angle).
 */
const LaunchAngleGizmo = forwardRef<THREE.Group, { position: Position }>(({ position }, ref) => {
  const { updatePosition, selectedPositionIds } = useProjectStore();
  const isSelected = selectedPositionIds.includes(position.id);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
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
    setIsDragging(true);
    (gl.domElement as HTMLElement).style.cursor = 'grabbing';
  }, [gl]);

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

      updatePosition(position.id, { heading: newHeading, pitch: newPitch });
    };

    const handleUp = () => {
      setIsDragging(false);
      (gl.domElement as HTMLElement).style.cursor = '';
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [isDragging, position, updatePosition, camera, raycaster, gl]);

  if (!isSelected) return null;

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

export default function PyroLaunchAngles() {
  const positions = useProjectStore(s => s.positions);
  const pyroPositions = positions.filter(p => p.type === 'pyro');

  return (
    <>
      {pyroPositions.map(pos => (
        <LaunchAngleGizmo key={pos.id} position={pos} />
      ))}
    </>
  );
}
