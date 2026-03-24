/**
 * PyroSafetyZones — 3D geofence volumes + ballistic trajectory prediction
 * Renders exclusion zones as semi-transparent primitives.
 * Computes shell parabolas and detects intersections with safety volumes.
 */
import { useRef, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Line } from '@react-three/drei';
import { useProjectStore, type TimelineItem } from '@/store/useProjectStore';
import { getMortarVelocity, getBreakHeight, GRAVITY, AIR_DRAG } from '@/lib/pyroPhysics';

// ═══ Types ═══
export interface SafetyVolume {
  id: string;
  label: string;
  type: 'cylinder' | 'box';
  position: [number, number, number];
  // Cylinder: [radius, height], Box: [width, height, depth]
  dimensions: [number, number] | [number, number, number];
  color: string;
}

// ═══ Ballistic trajectory calculator ═══
export function calculateBallisticTrajectory(
  origin: THREE.Vector3,
  velocity: THREE.Vector3,
  lifetime: number,
  steps: number = 60,
  drag: number = AIR_DRAG,
): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  const pos = origin.clone();
  const vel = velocity.clone();
  const dt = lifetime / steps;

  for (let i = 0; i <= steps; i++) {
    points.push(pos.clone());
    // Physics: gravity + exponential drag
    vel.y += GRAVITY * dt;
    vel.multiplyScalar(1 - drag * dt);
    pos.add(vel.clone().multiplyScalar(dt));
    if (pos.y < 0) break;
  }
  return points;
}

// ═══ Intersection test: point inside volume ═══
function isInsideVolume(point: THREE.Vector3, volume: SafetyVolume): boolean {
  const [px, py, pz] = volume.position;
  if (volume.type === 'cylinder') {
    const [radius, height] = volume.dimensions;
    const dx = point.x - px;
    const dz = point.z - pz;
    const distSq = dx * dx + dz * dz;
    return distSq <= radius * radius && point.y >= py && point.y <= py + height;
  } else {
    const [w, h, d] = volume.dimensions as [number, number, number];
    return (
      point.x >= px - w / 2 && point.x <= px + w / 2 &&
      point.y >= py && point.y <= py + h &&
      point.z >= pz - d / 2 && point.z <= pz + d / 2
    );
  }
}

// ═══ Check trajectory against all volumes ═══
export function checkTrajectoryViolations(
  trajectory: THREE.Vector3[],
  volumes: SafetyVolume[],
): { violated: boolean; violatedVolumeIds: Set<string>; firstViolationIdx: number } {
  const violatedVolumeIds = new Set<string>();
  let firstViolationIdx = -1;

  for (let i = 0; i < trajectory.length; i++) {
    for (const vol of volumes) {
      if (isInsideVolume(trajectory[i], vol)) {
        violatedVolumeIds.add(vol.id);
        if (firstViolationIdx === -1) firstViolationIdx = i;
      }
    }
  }

  return { violated: violatedVolumeIds.size > 0, violatedVolumeIds, firstViolationIdx };
}

// ═══ Default safety volumes ═══
const DEFAULT_VOLUMES: SafetyVolume[] = [
  {
    id: 'audience-zone',
    label: 'Zona do Público',
    type: 'box',
    position: [0, 0, 40],
    dimensions: [100, 5, 30],
    color: 'hsl(200, 70%, 50%)',
  },
  {
    id: 'drone-airspace',
    label: 'Espaço Aéreo Drones',
    type: 'cylinder',
    position: [0, 60, 0],
    dimensions: [35, 100],
    color: 'hsl(270, 60%, 55%)',
  },
];

// ═══ Single volume mesh ═══
function SafetyVolumeMesh({
  volume,
  isViolated,
}: {
  volume: SafetyVolume;
  isViolated: boolean;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const baseColor = useMemo(() => new THREE.Color(volume.color), [volume.color]);
  const violationColor = useMemo(() => new THREE.Color('hsl(0, 85%, 50%)'), []);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const mat = meshRef.current.material as THREE.MeshBasicMaterial;
    if (isViolated) {
      const pulse = 0.12 + Math.sin(clock.elapsedTime * 6) * 0.08;
      mat.opacity = pulse;
      mat.color.copy(violationColor);
    } else {
      mat.opacity = 0.08;
      mat.color.copy(baseColor);
    }
  });

  const [px, py, pz] = volume.position;

  if (volume.type === 'cylinder') {
    const [radius, height] = volume.dimensions;
    return (
      <mesh ref={meshRef} position={[px, py + height / 2, pz]}>
        <cylinderGeometry args={[radius, radius, height, 32, 1, true]} />
        <meshBasicMaterial
          transparent
          opacity={0.08}
          depthWrite={false}
          side={THREE.DoubleSide}
          color={baseColor}
        />
      </mesh>
    );
  }

  const [w, h, d] = volume.dimensions as [number, number, number];
  return (
    <mesh ref={meshRef} position={[px, py + h / 2, pz]}>
      <boxGeometry args={[w, h, d]} />
      <meshBasicMaterial
        transparent
        opacity={0.08}
        depthWrite={false}
        side={THREE.DoubleSide}
        color={baseColor}
      />
    </mesh>
  );
}

// ═══ Trajectory line for a single cue ═══
function TrajectoryLine({
  trajectory,
  isViolated,
}: {
  trajectory: THREE.Vector3[];
  isViolated: boolean;
}) {
  const points = useMemo(
    () => trajectory.map(p => [p.x, p.y, p.z] as [number, number, number]),
    [trajectory],
  );

  if (points.length < 2) return null;

  return (
    <Line
      points={points}
      color={isViolated ? '#ff3333' : '#44ff44'}
      lineWidth={isViolated ? 2 : 1}
      dashed={!isViolated}
      dashSize={isViolated ? 0 : 0.5}
      gapSize={isViolated ? 0 : 0.3}
      opacity={isViolated ? 0.9 : 0.4}
      transparent
    />
  );
}

// ═══ Main component ═══
export default function PyroSafetyZones() {
  const timelineItems = useProjectStore(s => s.timelineItems);
  const positions = useProjectStore(s => s.positions);
  const [volumes] = useState<SafetyVolume[]>(DEFAULT_VOLUMES);

  // Compute trajectories for all pyro cues with heading/pitch
  const trajectoryData = useMemo(() => {
    const results: {
      cueId: string;
      trajectory: THREE.Vector3[];
      violated: boolean;
      violatedVolumeIds: Set<string>;
    }[] = [];

    for (const item of timelineItems) {
      const heading = (item as any).cueHeading ?? 0;
      const pitch = (item as any).cuePitch ?? 0;
      if (heading === 0 && pitch === 0) continue; // Skip straight-up default shots

      // Find position
      const pos = positions.find(p => p.id === item.positionId);
      const origin = new THREE.Vector3(
        pos?.x ?? item.pos_x ?? 0,
        0,
        pos?.z ?? item.pos_z ?? 0,
      );

      // Estimate caliber from effect name (basic heuristic)
      const caliberMatch = (item.notes || '').match(/(\d+)mm/);
      const caliberInches = caliberMatch ? parseInt(caliberMatch[1]) / 25.4 : 3;
      const mortarVel = getMortarVelocity(caliberInches);

      // Build launch velocity vector with heading/pitch rotation
      const vel = new THREE.Vector3(0, mortarVel, 0);
      vel.applyAxisAngle(new THREE.Vector3(1, 0, 0), THREE.MathUtils.degToRad(pitch));
      vel.applyAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(heading));

      const lifetime = (getBreakHeight(caliberInches) / mortarVel) * 2.5;
      const trajectory = calculateBallisticTrajectory(origin, vel, lifetime);
      const check = checkTrajectoryViolations(trajectory, volumes);

      results.push({
        cueId: item.id,
        trajectory,
        violated: check.violated,
        violatedVolumeIds: check.violatedVolumeIds,
      });
    }

    return results;
  }, [timelineItems, positions, volumes]);

  // Which volumes are violated?
  const violatedVolumeIds = useMemo(() => {
    const ids = new Set<string>();
    for (const t of trajectoryData) {
      t.violatedVolumeIds.forEach(id => ids.add(id));
    }
    return ids;
  }, [trajectoryData]);

  const violationCount = trajectoryData.filter(t => t.violated).length;

  return (
    <group name="pyro-safety-zones">
      {/* Safety volumes */}
      {volumes.map(vol => (
        <SafetyVolumeMesh
          key={vol.id}
          volume={vol}
          isViolated={violatedVolumeIds.has(vol.id)}
        />
      ))}

      {/* Trajectory prediction lines */}
      {trajectoryData.map(t => (
        <TrajectoryLine
          key={t.cueId}
          trajectory={t.trajectory}
          isViolated={t.violated}
        />
      ))}

      {/* Violation count HUD marker */}
      {violationCount > 0 && (
        <mesh position={[0, 5, 0]}>
          <sphereGeometry args={[0.5, 8, 8]} />
          <meshBasicMaterial color="#ff0000" />
        </mesh>
      )}
    </group>
  );
}
