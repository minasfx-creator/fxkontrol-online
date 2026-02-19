import { useMemo, useCallback, useRef, useState } from 'react';
import { useProjectStore } from '@/store/useProjectStore';
import { useThree, useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import QuadcopterModel from './QuadcopterModel';

const PATH_COLOR = '#7B68EE';
const WAYPOINT_COLOR = '#FFD700';

/** Draggable waypoint sphere */
function DraggableWaypoint({
  position,
  waypointId,
  trajectoryId,
  index,
  isSelected,
}: {
  position: [number, number, number];
  waypointId: string;
  trajectoryId: string;
  index: number;
  isSelected: boolean;
}) {
  const { selectTrajectory, updateWaypoint } = useProjectStore();
  const meshRef = useRef<THREE.Mesh>(null);
  const [isDragging, setIsDragging] = useState(false);
  const { camera, raycaster, gl } = useThree();
  const dragPlane = useRef(new THREE.Plane());
  const intersection = useRef(new THREE.Vector3());

  const onPointerDown = useCallback((e: any) => {
    e.stopPropagation();
    selectTrajectory(trajectoryId);
    setIsDragging(true);
    (gl.domElement as HTMLElement).style.cursor = 'grabbing';

    // Create a drag plane facing the camera through the waypoint
    const camDir = new THREE.Vector3();
    camera.getWorldDirection(camDir);
    dragPlane.current.setFromNormalAndCoplanarPoint(camDir, new THREE.Vector3(...position));

    // Capture pointer
    (e.target as any)?.setPointerCapture?.(e.pointerId);
  }, [trajectoryId, selectTrajectory, camera, gl, position]);

  const onPointerMove = useCallback((e: any) => {
    if (!isDragging) return;
    e.stopPropagation();

    // Cast ray from pointer to drag plane
    const rect = gl.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(mouse, camera);
    raycaster.ray.intersectPlane(dragPlane.current, intersection.current);

    const newPos = intersection.current;
    updateWaypoint(trajectoryId, waypointId, {
      position: {
        x: Math.round(newPos.x * 10) / 10,
        y: Math.max(0.1, Math.round(newPos.y * 10) / 10),
        z: Math.round(newPos.z * 10) / 10,
      },
    });
  }, [isDragging, trajectoryId, waypointId, updateWaypoint, camera, raycaster, gl]);

  const onPointerUp = useCallback((e: any) => {
    setIsDragging(false);
    (gl.domElement as HTMLElement).style.cursor = '';
  }, [gl]);

  return (
    <group position={position}>
      <mesh
        ref={meshRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <sphereGeometry args={[isDragging ? 0.22 : 0.15, 12, 12]} />
        <meshStandardMaterial
          color={isDragging ? '#FFFFFF' : WAYPOINT_COLOR}
          emissive={WAYPOINT_COLOR}
          emissiveIntensity={isDragging ? 1.2 : isSelected ? 0.8 : 0.2}
          metalness={0.5}
          roughness={0.3}
        />
      </mesh>
      <pointLight color={WAYPOINT_COLOR} intensity={isDragging ? 4 : isSelected ? 2 : 0.5} distance={3} decay={2} />
      <Html position={[0, 0.3, 0]} center style={{ pointerEvents: 'none' }}>
        <div
          className="px-1 py-0.5 rounded-sm text-[8px] font-mono whitespace-nowrap"
          style={{
            backgroundColor: `${WAYPOINT_COLOR}22`,
            border: `1px solid ${isDragging ? '#FFFFFF' : WAYPOINT_COLOR}44`,
            color: isDragging ? '#FFFFFF' : WAYPOINT_COLOR,
          }}
        >
          WP{index + 1}
        </div>
      </Html>
    </group>
  );
}

function TrajectoryLine({ points }: { points: THREE.Vector3[] }) {
  const geometry = useMemo(() => {
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [points]);

  return (
    <line>
      <primitive object={geometry} attach="geometry" />
      <lineBasicMaterial color={PATH_COLOR} transparent opacity={0.6} linewidth={2} />
    </line>
  );
}

/** Click plane to add waypoints when in add-waypoint mode */
function WaypointClickPlane() {
  const { editorMode, selectedTrajectoryId, addWaypoint, trajectories } = useProjectStore();

  const handleClick = useCallback((e: any) => {
    if (editorMode !== 'add-waypoint' || !selectedTrajectoryId) return;
    e.stopPropagation();

    const traj = trajectories.find((t) => t.id === selectedTrajectoryId);
    const waypointCount = traj?.waypoints.length ?? 0;

    addWaypoint(selectedTrajectoryId, {
      id: `wp-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      position: {
        x: Math.round(e.point.x * 10) / 10,
        y: Math.round(e.point.y * 10) / 10 || 5,
        z: Math.round(e.point.z * 10) / 10,
      },
      time: (waypointCount + 1) * 2,
    });
  }, [editorMode, selectedTrajectoryId, addWaypoint, trajectories]);

  if (editorMode !== 'add-waypoint') return null;

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} onClick={handleClick}>
      <planeGeometry args={[200, 200]} />
      <meshBasicMaterial visible={false} />
    </mesh>
  );
}

/** Lerp between two Vector3s */
function lerpVec3(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }, t: number) {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
  };
}

/** Animated drones following trajectories during playback */
function TrajectoryDrones() {
  const { trajectories, positions, currentTime, isPlaying } = useProjectStore();

  return (
    <>
      {trajectories.map((traj) => {
        const startPos = positions.find((p) => p.id === traj.positionId);
        if (!startPos || traj.waypoints.length === 0) return null;

        const sortedWps = [...traj.waypoints].sort((a, b) => a.time - b.time);
        const droneColor = startPos.color || '#00B4D8';

        // Build timeline: start at time=0 at pad position, then waypoints
        const pathPoints = [
          { time: 0, position: { x: startPos.x, y: startPos.y || 0.1, z: startPos.z } },
          ...sortedWps.map((wp) => ({ time: wp.time, position: wp.position })),
        ];

        // Find current segment
        let dronePos = pathPoints[0].position;
        if (currentTime <= pathPoints[0].time) {
          dronePos = pathPoints[0].position;
        } else if (currentTime >= pathPoints[pathPoints.length - 1].time) {
          dronePos = pathPoints[pathPoints.length - 1].position;
        } else {
          for (let i = 0; i < pathPoints.length - 1; i++) {
            const a = pathPoints[i];
            const b = pathPoints[i + 1];
            if (currentTime >= a.time && currentTime <= b.time) {
              const t = (currentTime - a.time) / (b.time - a.time);
              const smoothT = t * t * (3 - 2 * t);
              dronePos = lerpVec3(a.position, b.position, smoothT);
              break;
            }
          }
        }

        return (
          <QuadcopterModel
            key={`traj-drone-${traj.id}`}
            position={[dronePos.x, dronePos.y, dronePos.z]}
            color={droneColor}
            scale={0.8}
          />
        );
      })}
    </>
  );
}

export default function TrajectoryPaths() {
  const { trajectories, positions, showTrajectories, selectedTrajectoryId } = useProjectStore();

  if (!showTrajectories) return null;

  return (
    <>
      <WaypointClickPlane />
      <TrajectoryDrones />
      {trajectories.map((traj) => {
        const startPos = positions.find((p) => p.id === traj.positionId);
        if (!startPos) return null;

        const isSelected = selectedTrajectoryId === traj.id;
        const sortedWps = [...traj.waypoints].sort((a, b) => a.time - b.time);

        // Build path: start position → waypoints
        const allPoints: THREE.Vector3[] = [
          new THREE.Vector3(startPos.x, startPos.y || 0.1, startPos.z),
          ...sortedWps.map((wp) => new THREE.Vector3(wp.position.x, wp.position.y, wp.position.z)),
        ];

        return (
          <group key={traj.id}>
            {allPoints.length > 1 && <TrajectoryLine points={allPoints} />}
            {sortedWps.map((wp, i) => (
              <DraggableWaypoint
                key={wp.id}
                position={[wp.position.x, wp.position.y, wp.position.z]}
                waypointId={wp.id}
                trajectoryId={traj.id}
                index={i}
                isSelected={isSelected}
              />
            ))}
          </group>
        );
      })}
    </>
  );
}
