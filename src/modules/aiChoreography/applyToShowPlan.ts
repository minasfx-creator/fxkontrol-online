/**
 * Bridge: ExpandedShow → project store DroneFormation cues.
 *
 * Strategy: convert each macro formation timestamp into a single project
 * `DroneFormation` cue using its keyframe positions. We keep transitions
 * implicit (the existing engine will tween between cues by holdDuration).
 */
import type { ExpandedShow } from './types';
import type { MacroChoreography } from './types';
import type { DroneFormation as ProjectDroneFormation } from '@/types/projectTypes';

export interface ShowPlanBridge {
  addDroneFormation: (formation: ProjectDroneFormation) => void;
  materializeFormation: (formation: ProjectDroneFormation) => void;
  recalculateFormationTimings?: () => void;
}

function uid(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function applyAIChoreographyToShowPlan(
  macro: MacroChoreography,
  show: ExpandedShow,
  bridge: ShowPlanBridge,
  opts?: { color?: string; transitionDuration?: number; holdDuration?: number },
): { cuesCreated: number; droneCount: number } {
  const fps = macro.metadata.fps ?? 10;
  const sortedF = [...macro.formations].sort((a, b) => a.timestamp - b.timestamp);
  const transitionDuration = opts?.transitionDuration ?? 4;
  const holdDuration = opts?.holdDuration ?? 4;
  const color = opts?.color ?? '#00B4D8';

  let cues = 0;
  for (const f of sortedF) {
    const lastIdx = (show.drones[0]?.frames.length ?? 1) - 1;
    const frameIdx = Math.min(lastIdx, Math.max(0, Math.round(f.timestamp * fps)));
    const points = show.drones.map(d => {
      const fr = d.frames[frameIdx];
      return { x: fr.x, z: fr.z };
    });
    if (points.length === 0) continue;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    let avgY = 0;
    for (let i = 0; i < show.drones.length; i++) {
      const fr = show.drones[i].frames[frameIdx];
      if (fr.x < minX) minX = fr.x; if (fr.x > maxX) maxX = fr.x;
      if (fr.z < minZ) minZ = fr.z; if (fr.z > maxZ) maxZ = fr.z;
      avgY += fr.y;
    }
    avgY /= show.drones.length;
    const radius = 0.5 * Math.max(maxX - minX, maxZ - minZ);

    const cue: ProjectDroneFormation = {
      id: uid('aichoreo'),
      formationType: 'custom',
      droneCount: points.length,
      height: Number.isFinite(avgY) ? avgY : 50,
      radius: Number.isFinite(radius) ? radius : 0,
      spacing: 2,
      rotation: 0,
      startTime: f.timestamp,
      transitionDuration,
      holdDuration,
      color,
      colorTransition: 'instant',
      points,
    };
    bridge.addDroneFormation(cue);
    bridge.materializeFormation(cue);
    cues++;
  }
  bridge.recalculateFormationTimings?.();
  return { cuesCreated: cues, droneCount: show.drones.length };
}
