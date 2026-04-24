/**
 * SwarmGPT → ProjectStore adapter
 *
 * Bridges a `FormationPlan` (output of `planFormationFromAsset`) into the
 * project store as a real `DroneFormation` cue, automatically materializing
 * the launch pads + trajectories so the existing VVIZ exporter
 * (`exportVVIZ`) emits correct per-drone X,Y,Z,Heading streams.
 *
 * Pure adapter — no React, no UI. Receives the store actions via parameters
 * so it stays testable and decoupled.
 */
import type { FormationPlan } from '../core/pipeline/planFormationFromAsset';
import type { DroneFormation as ProjectDroneFormation } from '@/types/projectTypes';

export interface ApplyPlanOptions {
  /** Wall-clock cue start time in seconds. Default 0. */
  startTime?: number;
  /** Air time in seconds. Default 4. */
  transitionDuration?: number;
  /** How long the formation stays in the air. Default 8. */
  holdDuration?: number;
  /** Flight altitude in meters. Default 50. */
  height?: number;
  /** Hex color for pads + drones. Default '#00B4D8'. */
  color?: string;
  /** Human-readable label, e.g. the source filename. */
  sourceLabel?: string;
}

export interface ProjectStoreBridge {
  addDroneFormation: (formation: ProjectDroneFormation) => void;
  materializeFormation: (formation: ProjectDroneFormation) => void;
  recalculateFormationTimings?: () => void;
}

function uid(): string {
  return `form-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Convert a SwarmGPT FormationPlan into the project store schema and inject
 * it via the provided bridge. Returns the created formation id so callers
 * can select / scroll to it.
 */
export function applyPlanToProjectStore(
  plan: FormationPlan,
  store: ProjectStoreBridge,
  options: ApplyPlanOptions = {},
): { formationId: string; droneCount: number } {
  const points = plan.formation.points;
  const droneCount = points.length;

  // Bounding box on the XZ plane → derive radius for legacy fields.
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
    if (p.z < minZ) minZ = p.z; if (p.z > maxZ) maxZ = p.z;
  }
  const radius = droneCount > 0
    ? 0.5 * Math.max(maxX - minX, maxZ - minZ)
    : 0;

  const formation: ProjectDroneFormation = {
    id: uid(),
    formationType: 'custom',
    droneCount,
    height: options.height ?? 50,
    radius: Number.isFinite(radius) ? radius : 0,
    spacing: 2,
    rotation: 0,
    startTime: options.startTime ?? plan.snappedTime ?? 0,
    transitionDuration: options.transitionDuration ?? 4,
    holdDuration: options.holdDuration ?? 8,
    color: options.color ?? '#00B4D8',
    colorTransition: 'instant',
    points: points.map((p) => ({ x: p.x, z: p.z })),
  };

  store.addDroneFormation(formation);
  store.materializeFormation(formation);
  store.recalculateFormationTimings?.();

  return { formationId: formation.id, droneCount };
}
