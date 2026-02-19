import { useMemo, useCallback } from 'react';
import { useProjectStore } from '@/store/useProjectStore';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

const PATH_COLOR = '#7B68EE';
const WAYPOINT_COLOR = '#FFD700';

function WaypointSphere({
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
  const { selectTrajectory, editorMode } = useProjectStore();

  return (
    <group position={position}>
      <mesh
        onClick={(e) => {
          e.stopPropagation();
          selectTrajectory(trajectoryId);
        }}
      >
        <sphereGeometry args={[0.15, 12, 12]} />
        <meshStandardMaterial
          color={WAYPOINT_COLOR}
          emissive={WAYPOINT_COLOR}
          emissiveIntensity={isSelected ? 0.8 : 0.2}
          metalness={0.5}
          roughness={0.3}
        />
      </mesh>
      <pointLight color={WAYPOINT_COLOR} intensity={isSelected ? 2 : 0.5} distance={3} decay={2} />
      <Html position={[0, 0.3, 0]} center style={{ pointerEvents: 'none' }}>
        <div
          className="px-1 py-0.5 rounded-sm text-[8px] font-mono whitespace-nowrap"
          style={{
            backgroundColor: `${WAYPOINT_COLOR}22`,
            border: `1px solid ${WAYPOINT_COLOR}44`,
            color: WAYPOINT_COLOR,
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
    const g = new THREE.BufferGeometry().setFromPoints(points);
    return g;
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
  const { editorMode, selectedTrajectoryId, addWaypoint, setEditorMode, trajectories } = useProjectStore();

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
      time: (waypointCount + 1) * 2, // auto-increment 2s per waypoint
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

export default function TrajectoryPaths() {
  const { trajectories, positions, showTrajectories, selectedTrajectoryId } = useProjectStore();

  if (!showTrajectories) return null;

  return (
    <>
      <WaypointClickPlane />
      {trajectories.map((traj) => {
        const startPos = positions.find((p) => p.id === traj.positionId);
        if (!startPos) return null;

        const isSelected = selectedTrajectoryId === traj.id;

        // Build path: start position → waypoints
        const allPoints: THREE.Vector3[] = [
          new THREE.Vector3(startPos.x, startPos.y || 0.1, startPos.z),
          ...traj.waypoints
            .sort((a, b) => a.time - b.time)
            .map((wp) => new THREE.Vector3(wp.position.x, wp.position.y, wp.position.z)),
        ];

        return (
          <group key={traj.id}>
            {allPoints.length > 1 && <TrajectoryLine points={allPoints} />}
            {traj.waypoints
              .sort((a, b) => a.time - b.time)
              .map((wp, i) => (
                <WaypointSphere
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
