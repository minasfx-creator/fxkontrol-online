/**
 * ─── VVIZToShowPlan — .vviz → ShowPlan Drone Paths ──────────────────
 * Normalizes parsed VVIZ data into canonical ShowPlan drone paths.
 * Handles Z-axis inversion (Unreal → standard) and color normalization.
 */

import { showPlanManager } from '@/core/showplan/ShowPlanManager';
import type { DronePath, DroneWaypoint } from '@/core/showplan/ShowPlan';
import { blackbox } from '@/core/reliability/blackBoxRecorder';

export interface VVIZParsedDrone {
  id: string;
  label?: string;
  color?: string;
  waypoints: Array<{
    time: number;
    x: number;
    y: number;
    z: number;
    speed?: number;
  }>;
}

export interface VVIZImportResult {
  dronePaths: DronePath[];
  droneCount: number;
  totalWaypoints: number;
  duration: number;
  errors: string[];
}

/**
 * Convert parsed VVIZ drone data into ShowPlan drone paths and merge into the active ShowPlan.
 * @param drones — parsed drone array from vvizWorker
 * @param options — import options (z-invert, position offset)
 */
export function importVVIZToShowPlan(
  drones: VVIZParsedDrone[],
  options: { invertZ?: boolean; offsetX?: number; offsetY?: number; offsetZ?: number } = {},
): VVIZImportResult {
  const { invertZ = true, offsetX = 0, offsetY = 0, offsetZ = 0 } = options;
  const errors: string[] = [];
  let totalWaypoints = 0;
  let maxTime = 0;

  const dronePaths: DronePath[] = drones.map((drone, idx) => {
    if (drone.waypoints.length === 0) {
      errors.push(`Drone ${drone.label ?? idx}: no waypoints`);
    }

    const waypoints: DroneWaypoint[] = drone.waypoints.map((wp, wpIdx) => {
      const z = invertZ ? -wp.z : wp.z;
      totalWaypoints++;
      if (wp.time > maxTime) maxTime = wp.time;
      return {
        id: `${drone.id}-wp-${wpIdx}`,
        time: wp.time,
        position: { x: wp.x + offsetX, y: wp.y + offsetY, z: z + offsetZ },
        speed: wp.speed ?? 5,
      };
    });

    return {
      id: drone.id,
      droneId: drone.label ?? `Drone-${idx + 1}`,
      padPositionId: drone.id,
      waypoints,
      color: drone.color ?? '#00ffff',
    };
  });

  // Merge into current ShowPlan
  const sp = { ...showPlanManager.current };
  sp.dronePaths = dronePaths;
  sp.metadata = { ...sp.metadata, duration: Math.max(sp.metadata.duration, maxTime), updatedAt: Date.now() };
  showPlanManager.load(sp as any);

  blackbox.record('import', `VVIZToShowPlan: ${drones.length} drones, ${totalWaypoints} waypoints, ${errors.length} errors`);

  return { dronePaths, droneCount: drones.length, totalWaypoints, duration: maxTime, errors };
}
