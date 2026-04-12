/**
 * ─── DroneCSVExporter — ShowPlan → Drone Waypoints CSV ─────────────
 * Exports drone path data from ShowPlan as a CSV for external tools.
 */

import { showPlanManager } from '@/core/showplan/ShowPlanManager';
import { blackbox } from '@/core/reliability/blackBoxRecorder';

export interface DroneCSVResult {
  csv: string;
  droneCount: number;
  waypointCount: number;
}

export function generateDroneCSV(): DroneCSVResult {
  const sp = showPlanManager.current;
  const header = 'DroneID,Time,X,Y,Z,Speed\n';
  let waypointCount = 0;

  const rows = sp.dronePaths.flatMap(path =>
    path.waypoints.map(wp => {
      waypointCount++;
      return `${path.droneId},${wp.time.toFixed(3)},${wp.position.x.toFixed(2)},${wp.position.y.toFixed(2)},${wp.position.z.toFixed(2)},${wp.speed.toFixed(1)}`;
    })
  ).join('\n');

  blackbox.record('export', `DroneCSVExporter: ${sp.dronePaths.length} drones, ${waypointCount} waypoints`);
  return { csv: header + rows, droneCount: sp.dronePaths.length, waypointCount };
}

export function downloadDroneCSV(filename = 'fxk_drone_paths.csv'): void {
  const result = generateDroneCSV();
  const blob = new Blob([result.csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
