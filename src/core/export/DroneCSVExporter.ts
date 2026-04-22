/**
 * ─── DroneCSVExporter — ShowPlan → Drone Waypoints CSV ─────────────
 * Exports drone path data from ShowPlan as a CSV for external tools.
 * Pre-export gate: runs VerificationEngine.
 */

import { showPlanManager } from '@/core/showplan/ShowPlanManager';
import { verificationEngine } from '@/core/verification/VerificationEngine';
import { blackbox } from '@/core/reliability/blackBoxRecorder';

export interface DroneCSVResult {
  csv: string;
  droneCount: number;
  waypointCount: number;
  verified: boolean;
  errors: string[];
}

export function generateDroneCSV(): DroneCSVResult {
  const sp = showPlanManager.current;
  const vResult = verificationEngine.run();
  const canExport = vResult.level === 'READY_FOR_EXPORT' || vResult.level === 'READY_FOR_FIELD';
  const errors: string[] = [];

  if (!canExport) {
    errors.push(...vResult.issues.filter(i => !i.passed && i.severity === 'error').map(i => `[BLOCKED] ${i.label}: ${i.detail}`));
  }

  const header = 'DroneID,Time,X,Y,Z,Speed\n';
  let waypointCount = 0;

  const rows = sp.dronePaths.flatMap(path =>
    path.waypoints.map(wp => {
      waypointCount++;
      return `${path.droneId},${wp.time.toFixed(3)},${wp.position.x.toFixed(2)},${wp.position.y.toFixed(2)},${wp.position.z.toFixed(2)},${wp.speed.toFixed(1)}`;
    })
  ).join('\n');

  blackbox.record('state', `DroneCSVExporter: ${sp.dronePaths.length} drones, ${waypointCount} waypoints, verified=${canExport}`);
  return { csv: header + rows, droneCount: sp.dronePaths.length, waypointCount, verified: canExport, errors };
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
