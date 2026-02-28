/**
 * Formation Materializer
 * Converts abstract formation definitions into concrete drone pads + trajectories.
 * Each formation auto-generates:
 * 1. Ground-level drone pads in a square grid (launch positions)
 * 2. A trajectory per drone: takeoff → formation point at height → hold
 */
import type { Position, Trajectory, Waypoint, DroneFormation } from '@/store/useProjectStore';

/** Generate a square grid of ground positions centered at origin */
export function generateLaunchGrid(
  count: number,
  spacing: number = 2.5,
): { x: number; z: number }[] {
  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  const offsetX = ((cols - 1) * spacing) / 2;
  const offsetZ = ((rows - 1) * spacing) / 2;
  const points: { x: number; z: number }[] = [];
  for (let r = 0; r < rows && points.length < count; r++) {
    for (let c = 0; c < cols && points.length < count; c++) {
      points.push({
        x: c * spacing - offsetX,
        z: r * spacing - offsetZ,
      });
    }
  }
  return points;
}

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export interface MaterializedFormation {
  positions: Position[];
  trajectories: Trajectory[];
}

/**
 * Materialize a DroneFormation into concrete drone pads and trajectories.
 * @param formation - The formation definition
 * @param formationIndex - Index in the choreography sequence (0 = first)
 * @param existingPadIds - If reusing pads from a previous formation, pass their IDs
 */
export function materializeFormation(
  formation: DroneFormation,
  formationIndex: number = 0,
  existingPadIds?: string[],
): MaterializedFormation {
  const count = formation.droneCount;
  const launchGrid = generateLaunchGrid(count);
  const positions: Position[] = [];
  const trajectories: Trajectory[] = [];

  for (let i = 0; i < count; i++) {
    const padId = existingPadIds?.[i] || `pad-${uid()}-${i}`;
    const formPt = formation.points[i] || { x: 0, z: 0 };
    const groundPt = launchGrid[i] || { x: 0, z: 0 };

    // Create pad if we don't have existing ones
    if (!existingPadIds) {
      positions.push({
        id: padId,
        name: `D${String(i + 1).padStart(3, '0')}`,
        type: 'drone-pad',
        x: groundPt.x,
        y: 0,
        z: groundPt.z,
        heading: 0,
        pitch: 0,
        roll: 0,
        color: formation.color,
      });
    }

    // Create trajectory: ground → formation height
    const trajId = `traj-${uid()}-${i}`;
    const waypoints: Waypoint[] = [
      {
        id: `wp-${uid()}-takeoff`,
        position: { x: groundPt.x, y: 0.1, z: groundPt.z },
        time: formation.startTime,
      },
      {
        id: `wp-${uid()}-form`,
        position: { x: formPt.x, y: formation.height, z: formPt.z },
        time: formation.startTime + formation.transitionDuration,
        // Add smooth Bézier handles for takeoff curve
        controlIn: { x: 0, y: formation.height * 0.3, z: 0 },
        controlOut: { x: 0, y: -formation.height * 0.3, z: 0 },
      },
      {
        id: `wp-${uid()}-hold`,
        position: { x: formPt.x, y: formation.height, z: formPt.z },
        time: formation.startTime + formation.transitionDuration + formation.holdDuration,
      },
    ];

    trajectories.push({
      id: trajId,
      positionId: padId,
      waypoints,
      name: `D${String(i + 1).padStart(3, '0')} Traj`,
    });
  }

  return { positions, trajectories };
}
