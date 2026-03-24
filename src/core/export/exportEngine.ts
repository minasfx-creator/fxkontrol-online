/**
 * ─── Export Engine — Commercial Output ──────────────────────────────
 * Exports project data as JSON, Finale 3D CSV, or Unreal-ready stream.
 * Triggers browser download or returns data for API consumers.
 */

import { eventBus } from '@/core/system/eventBus';

/** Download a JSON project file */
export function exportProjectJSON(project: Record<string, unknown>, filename = 'fxk_project.json'): void {
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
  triggerDownload(blob, filename);
  eventBus.emit('SYSTEM.EXPORT', { format: 'json', filename });
}

/** Export timeline cues as CSV (Finale 3D compatible) */
export function exportTimelineCSV(
  cues: { time: number; x: number; y: number; z: number; effectId: string; position?: string }[],
  filename = 'fxk_timeline.csv',
): void {
  const header = 'Time,X,Y,Z,EffectID,Position\n';
  const rows = cues.map(c =>
    `${c.time.toFixed(3)},${c.x.toFixed(2)},${c.y.toFixed(2)},${c.z.toFixed(2)},${c.effectId},${c.position ?? ''}`
  ).join('\n');

  const blob = new Blob([header + rows], { type: 'text/csv' });
  triggerDownload(blob, filename);
  eventBus.emit('SYSTEM.EXPORT', { format: 'csv', filename, cueCount: cues.length });
}

/** Build Unreal-ready camera + timeline payload */
export function buildUnrealPayload(
  camera: { px: number; py: number; pz: number; rx: number; ry: number; rz: number; fov: number },
  timeline: { time: number; playing: boolean; speed: number },
  events: Record<string, unknown>[] = [],
): string {
  return JSON.stringify({ camera, timeline, events, ts: Date.now() });
}

/** Export drone waypoints as CSV */
export function exportDroneWaypointsCSV(
  waypoints: { droneId: string; time: number; x: number; y: number; z: number }[],
  filename = 'fxk_drone_waypoints.csv',
): void {
  const header = 'DroneID,Time,X,Y,Z\n';
  const rows = waypoints.map(w =>
    `${w.droneId},${w.time.toFixed(3)},${w.x.toFixed(2)},${w.y.toFixed(2)},${w.z.toFixed(2)}`
  ).join('\n');

  const blob = new Blob([header + rows], { type: 'text/csv' });
  triggerDownload(blob, filename);
  eventBus.emit('SYSTEM.EXPORT', { format: 'csv', filename, waypointCount: waypoints.length });
}

// ── Helper ──────────────────────────────────────────────────────────

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
