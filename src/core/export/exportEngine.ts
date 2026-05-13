/**
 * ─── Export Engine — Commercial Output ──────────────────────────────
 * Exports project data as JSON, Finale 3D CSV, FireOne script,
 * or Unreal-ready stream.
 * Triggers browser download or returns data for API consumers.
 */

import { eventBus } from '@/core/system/eventBus';
import type { ShowPlan } from '@/core/showplan/ShowPlan';

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

/**
 * Export ShowPlan as FireOne .fir script format.
 * FireOne format: Module, Channel, Time(ms), Effect, Position, Notes
 */
export function exportFireOneScript(
  plan: ShowPlan,
  filename = 'fxk_show.fir',
): void {
  const lines: string[] = [
    '; FX KONTROL — FireOne Export Script',
    `; Show: ${plan.metadata.name}`,
    `; Venue: ${plan.metadata.venue}`,
    `; Duration: ${plan.metadata.duration.toFixed(1)}s`,
    `; Generated: ${new Date().toISOString()}`,
    `; Cues: ${plan.pyroCues.length}`,
    ';',
    '; Module,Channel,Time(ms),FuseDelay(ms),Effect,Caliber(mm),Elevation,Position,Section',
  ];

  // Sort cues by time
  const sorted = [...plan.pyroCues].sort((a, b) => a.time - b.time);

  for (const cue of sorted) {
    const pos = plan.positions.find(p => p.id === cue.positionId);
    const timeMs = Math.round(cue.time * 1000);
    lines.push([
      cue.module,
      cue.channel,
      timeMs,
      Math.round(cue.fuseDelay),
      cue.effectId,
      cue.caliber,
      cue.elevation.toFixed(1),
      pos?.name ?? cue.positionId,
      cue.section ?? '',
    ].join(','));
  }

  const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
  triggerDownload(blob, filename);
  eventBus.emit('SYSTEM.EXPORT', { format: 'fireone', filename, cueCount: sorted.length });
}

/**
 * Export ShowPlan as Art-Net patch list.
 */
export function exportArtNetPatch(
  plan: ShowPlan,
  filename = 'fxk_artnet_patch.csv',
): void {
  const header = 'Universe,Channel,Value,Time,Duration,Curve,FixtureID\n';
  const rows = plan.dmxCues.map(c =>
    `${c.universe},${c.channel},${c.value},${c.time.toFixed(3)},${c.duration.toFixed(3)},${c.curve},${c.fixtureId ?? ''}`
  ).join('\n');

  const blob = new Blob([header + rows], { type: 'text/csv' });
  triggerDownload(blob, filename);
  eventBus.emit('SYSTEM.EXPORT', { format: 'artnet-patch', filename, cueCount: plan.dmxCues.length });
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
