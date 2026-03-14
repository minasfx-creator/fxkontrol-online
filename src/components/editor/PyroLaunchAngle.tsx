import { useRef, useState, useCallback, useMemo } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useProjectStore, type Position } from '@/store/useProjectStore';

const ARROW_LENGTH = 4;
const TRAJECTORY_POINTS = 30;

/**
 * PyroLaunchAngle: Editable launch angle visualizer for pyro positions.
 * Shows a draggable arc handle to set heading and pitch (tilt angle).
 * Renders a predicted trajectory arc based on the angle.
 */
function LaunchAngleGizmo({ position }: { position: Position }) {
  const { updatePosition, selectedPositionIds } = useProjectStore();
  const isSelected = selectedPositionIds.includes(position.id);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const handleRef = useRef<THREE.Mesh>(null);
  const { camera, raycaster, gl } = useThree();

  const heading = position.heading * (Math.PI / 180);
  const pitch = Math.max(5, Math.min(85, position.pitch || 85)) * (Math.PI / 180);

  // Calculate handle position on the arc
  const handlePos = useMemo((): [number, number, number] => {
    const r = ARROW_LENGTH;
    return [
      Math.sin(heading) * Math.cos(pitch) * r,
      Math.sin(pitch) * r,
      -Math.cos(heading) * Math.cos(pitch) * r,
    ];
  }, [heading, pitch]);

  // Trajectory prediction arc
  const trajectoryPoints = useMemo(() => {
    const pts: THREE.Vector3[] = [];
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
      pts.push(new THREE.Vector3(x, y, z));
      if (y <= 0 && i > 2) break;
    }
    return pts;
  }, [heading, pitch, position.pitch]);

  const onPointerDown = useCallback((e: any) => {
    e.stopPropagation();
    setIsDragging(true);
    (gl.domElement as HTMLElement).style.cursor = 'grabbing';
  }, [gl]);

  // Drag to change angle
  const dragPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 0, 1), 0));

  React.useEffect(() => {
    if (!isDragging) return;

    const handleMove = (e: PointerEvent) => {
      const rect = gl.domElement.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      raycaster.setFromCamera(mouse, camera);

      // Project onto a sphere around the position
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

  const lineGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(trajectoryPoints.length * 3);
    trajectoryPoints.forEach((pt, i) => {
      positions[i * 3] = pt.x;
      positions[i * 3 + 1] = pt.y;
      positions[i * 3 + 2] = pt.z;
    });
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geo;
  }, [trajectoryPoints]);

  return (
    <group position={[position.x, position.y, position.z]}>
      {/* Launch direction line */}
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[new Float32Array([0, 0, 0, ...handlePos]), 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#FF6B35" opacity={0.7} transparent linewidth={2} />
      </line>

      {/* Trajectory arc (dashed) */}
      <line geometry={lineGeometry}>
        <lineDashedMaterial color="#FF9955" dashSize={0.3} gapSize={0.15} opacity={0.5} transparent />
      </line>

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
        <div className="px-1.5 py-0.5 rounded text-[8px] font-mono bg-black/70 text-orange-400 border border-orange-500/40 whitespace-nowrap select-none"
          style={{ pointerEvents: 'none' }}
        >
          {Math.round(position.pitch || 85)}° / {Math.round(position.heading)}°
        </div>
      </Html>
    </group>
  );
}

import React from 'react';

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
