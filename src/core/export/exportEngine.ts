/**
 * ─── Export Engine — Commercial Output ──────────────────────────────
 * Exports project data as JSON, Finale 3D CSV, FireOne script,
 * or Unreal-ready stream.
 * Triggers browser download or returns data for API consumers.
 *
 * rev9: every channel now carries Mine/Cake-shot preset metadata
 * resolved via {@link resolveCuePresetMetadata} — single source
 * of truth for renderer + exporter wiring.
 */

import { eventBus } from '@/core/system/eventBus';
import type { ShowPlan, PyroCue } from '@/core/showplan/ShowPlan';
import {
  resolveCuePresetMetadata,
  hasPresetMetadata,
  csvCell,
  type CuePresetMetadata,
} from '@/core/export/cuePresetMetadata';

/** Resolve preset metadata for a PyroCue (effectId → notes → section). */
function pyroCuePresetMetadata(cue: PyroCue): CuePresetMetadata {
  return resolveCuePresetMetadata([cue.effectId, cue.notes, cue.section]);
}

/** Download a JSON project file. ShowPlan callers get preset metadata folded in. */
export function exportProjectJSON(project: Record<string, unknown>, filename = 'fxk_project.json'): void {
  const enriched = enrichProjectWithPresets(project);
  const blob = new Blob([JSON.stringify(enriched, null, 2)], { type: 'application/json' });
  triggerDownload(blob, filename);
  eventBus.emit('SYSTEM.EXPORT', { format: 'json', filename });
}

/**
 * If `project` looks like a ShowPlan (has pyroCues[]), annotate every cue
 * with `presetMetadata` (Mine/Cake) without mutating the input.
 * Non-ShowPlan payloads pass through unchanged.
 */
export function enrichProjectWithPresets(
  project: Record<string, unknown>,
): Record<string, unknown> {
  const cues = (project as { pyroCues?: unknown }).pyroCues;
  if (!Array.isArray(cues)) return project;
  const annotated = cues.map((c) => {
    const cue = c as PyroCue;
    const meta = pyroCuePresetMetadata(cue);
    return hasPresetMetadata(meta) ? { ...cue, presetMetadata: meta } : cue;
  });
  return { ...project, pyroCues: annotated };
}

/** Export timeline cues as CSV (Finale 3D compatible) */
export function exportTimelineCSV(
  cues: { time: number; x: number; y: number; z: number; effectId: string; position?: string; notes?: string }[],
  filename = 'fxk_timeline.csv',
): void {
  const header =
    'Time,X,Y,Z,EffectID,Position,MinePresetId,CakePresetId,BodyColor,TrailColor,StrobeHz,InnerCount,InnerSpeedMS\n';
  const rows = cues.map(c => {
    const meta = resolveCuePresetMetadata([c.effectId, c.notes]);
    return [
      c.time.toFixed(3),
      c.x.toFixed(2),
      c.y.toFixed(2),
      c.z.toFixed(2),
      csvCell(c.effectId),
      csvCell(c.position ?? ''),
      csvCell(meta.minePresetId),
      csvCell(meta.cakePresetId),
      csvCell(meta.bodyColorHex),
      csvCell(meta.trailColorHex),
      meta.strobeHz != null ? meta.strobeHz.toFixed(2) : '',
      meta.innerCount != null ? String(meta.innerCount) : '',
      meta.innerSpeedMS != null ? meta.innerSpeedMS.toFixed(2) : '',
    ].join(',');
  }).join('\n');

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
 * rev9: appends MinePreset/CakePreset/BodyColor/StrobeHz columns when applicable.
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
    '; Module,Channel,Time(ms),FuseDelay(ms),Effect,Caliber(mm),Elevation,Position,Section,MinePreset,CakePreset,BodyColor,TrailColor,StrobeHz',
  ];

  // Sort cues by time
  const sorted = [...plan.pyroCues].sort((a, b) => a.time - b.time);

  for (const cue of sorted) {
    const pos = plan.positions.find(p => p.id === cue.positionId);
    const timeMs = Math.round(cue.time * 1000);
    const meta = pyroCuePresetMetadata(cue);
    lines.push([
      cue.module,
      cue.channel,
      timeMs,
      Math.round(cue.fuseDelay),
      csvCell(cue.effectId),
      cue.caliber,
      cue.elevation.toFixed(1),
      csvCell(pos?.name ?? cue.positionId),
      csvCell(cue.section ?? ''),
      csvCell(meta.minePresetId),
      csvCell(meta.cakePresetId),
      csvCell(meta.bodyColorHex),
      csvCell(meta.trailColorHex),
      meta.strobeHz != null ? meta.strobeHz.toFixed(2) : '',
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

// ── Pure builders (test-friendly, no DOM/eventBus side effects) ────

/** Pure builder for the timeline CSV body — used by tests + downloads. */
export function buildTimelineCSV(
  cues: { time: number; x: number; y: number; z: number; effectId: string; position?: string; notes?: string }[],
): string {
  const header =
    'Time,X,Y,Z,EffectID,Position,MinePresetId,CakePresetId,BodyColor,TrailColor,StrobeHz,InnerCount,InnerSpeedMS';
  const rows = cues.map(c => {
    const meta = resolveCuePresetMetadata([c.effectId, c.notes]);
    return [
      c.time.toFixed(3),
      c.x.toFixed(2),
      c.y.toFixed(2),
      c.z.toFixed(2),
      csvCell(c.effectId),
      csvCell(c.position ?? ''),
      csvCell(meta.minePresetId),
      csvCell(meta.cakePresetId),
      csvCell(meta.bodyColorHex),
      csvCell(meta.trailColorHex),
      meta.strobeHz != null ? meta.strobeHz.toFixed(2) : '',
      meta.innerCount != null ? String(meta.innerCount) : '',
      meta.innerSpeedMS != null ? meta.innerSpeedMS.toFixed(2) : '',
    ].join(',');
  });
  return [header, ...rows].join('\n');
}

/** Pure builder for the FireOne .fir body — used by tests + downloads. */
export function buildFireOneScript(plan: ShowPlan): string {
  const lines: string[] = [
    '; FX KONTROL — FireOne Export Script',
    `; Show: ${plan.metadata.name}`,
    `; Venue: ${plan.metadata.venue}`,
    `; Duration: ${plan.metadata.duration.toFixed(1)}s`,
    `; Cues: ${plan.pyroCues.length}`,
    ';',
    '; Module,Channel,Time(ms),FuseDelay(ms),Effect,Caliber(mm),Elevation,Position,Section,MinePreset,CakePreset,BodyColor,TrailColor,StrobeHz',
  ];
  const sorted = [...plan.pyroCues].sort((a, b) => a.time - b.time);
  for (const cue of sorted) {
    const pos = plan.positions.find(p => p.id === cue.positionId);
    const meta = pyroCuePresetMetadata(cue);
    lines.push([
      cue.module,
      cue.channel,
      Math.round(cue.time * 1000),
      Math.round(cue.fuseDelay),
      csvCell(cue.effectId),
      cue.caliber,
      cue.elevation.toFixed(1),
      csvCell(pos?.name ?? cue.positionId),
      csvCell(cue.section ?? ''),
      csvCell(meta.minePresetId),
      csvCell(meta.cakePresetId),
      csvCell(meta.bodyColorHex),
      csvCell(meta.trailColorHex),
      meta.strobeHz != null ? meta.strobeHz.toFixed(2) : '',
    ].join(','));
  }
  return lines.join('\n');
}
