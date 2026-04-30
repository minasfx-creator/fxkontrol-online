/**
 * MAVLink Drone Exporter — viewport-tools wrapper
 * ────────────────────────────────────────────────────────────
 * Adapts the canonical lib/mavlinkFlightPlanExporter to the
 * viewport-tools / DRONES segment. Pulls drone-pad positions from
 * ShowPlan, treats them as the takeoff sequence, and emits a QGC
 * WPL 110 .waypoints file alongside a JSON manifest.
 *
 * Local coords convention (NEU): X = North, Y = East, Z = Up.
 * Drone pads in ShowPlan use (x, y=altitude, z=horizontal). We map them
 * to MAVLink LocalPosition as { x: pad.z (north), y: pad.x (east), z: pad.y (alt) }.
 */

import { useProjectStore } from '@/store/useProjectStore';
import {
  exportFlightPlan,
  toWaypointFileFormat,
  toJSONFormat,
  validateFlightPlan,
  DEFAULT_FLIGHT_CONFIG,
  type FlightPlan,
  type FlightPlanConfig,
} from '@/lib/mavlinkFlightPlanExporter';

export interface MavlinkExportResult {
  filename: string;
  waypointsText: string;
  jsonText: string;
  plan: FlightPlan;
  validation: ReturnType<typeof validateFlightPlan>;
  droneCount: number;
}

export function exportDronesMavlink(
  configOverride: Partial<FlightPlanConfig> = {},
): MavlinkExportResult {
  const positions = useProjectStore.getState().positions;
  const pads = positions.filter((p) => p.type === 'drone-pad');

  if (pads.length === 0) {
    throw new Error('No drone-pad positions in ShowPlan.');
  }

  const localWaypoints = pads.map((p) => ({
    x: p.z, // north
    y: p.x, // east
    z: Math.max(p.y, 0), // up (clamp negative)
  }));

  const cfg: Partial<FlightPlanConfig> = {
    ...configOverride,
    droneName: configOverride.droneName ?? 'FXK Swarm Lead',
    droneId: configOverride.droneId ?? 'fxk-swarm-1',
  };

  const plan = exportFlightPlan(localWaypoints, cfg);
  const waypointsText = toWaypointFileFormat(plan);
  const jsonText = toJSONFormat(plan);
  const validation = validateFlightPlan(plan);

  return {
    filename: `${plan.droneName.replace(/\s+/g, '_')}_${new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/[:T]/g, '-')}.waypoints`,
    waypointsText,
    jsonText,
    plan,
    validation,
    droneCount: pads.length,
  };
}

export function downloadMavlink(result: MavlinkExportResult, format: 'waypoints' | 'json' = 'waypoints'): void {
  const content = format === 'waypoints' ? result.waypointsText : result.jsonText;
  const ext = format === 'waypoints' ? 'waypoints' : 'json';
  const mime = format === 'waypoints' ? 'text/plain' : 'application/json';
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = result.filename.replace(/\.waypoints$/, `.${ext}`);
  a.click();
  URL.revokeObjectURL(url);
}

export { DEFAULT_FLIGHT_CONFIG };
