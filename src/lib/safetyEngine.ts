import { type Position, type Trajectory, type TimelineItem, EFFECT_LIBRARY } from '@/store/useProjectStore';

// ─── Deconfliction: minimum distance checks between drones ───────────

export interface CollisionWarning {
  type: 'drone-drone' | 'geofence';
  severity: 'warning' | 'critical';
  message: string;
  time: number;
  agentA?: string;
  agentB?: string;
  distance?: number;
}

const MIN_SAFE_DISTANCE = 2.0; // meters between drones
const CRITICAL_DISTANCE = 1.0; // meters — imminent collision

/**
 * Get drone positions at a given time from trajectories + timeline items
 */
function getDronePositionsAtTime(
  time: number,
  trajectories: Trajectory[],
  positions: Position[],
  timelineItems: TimelineItem[],
): { id: string; name: string; x: number; y: number; z: number }[] {
  const agents: { id: string; name: string; x: number; y: number; z: number }[] = [];

  // From trajectories: interpolate between waypoints
  for (const traj of trajectories) {
    const pad = positions.find((p) => p.id === traj.positionId);
    if (!pad) continue;
    const sorted = [...traj.waypoints].sort((a, b) => a.time - b.time);
    if (sorted.length === 0) continue;

    // Before first waypoint or after last → skip (on ground or returned)
    if (time < (sorted[0]?.time ?? 0) - 1 || time > (sorted[sorted.length - 1]?.time ?? 0) + 1) continue;

    let x = pad.x, y = pad.y || 0, z = pad.z;

    for (let i = 0; i < sorted.length - 1; i++) {
      if (time >= sorted[i].time && time <= sorted[i + 1].time) {
        const t = (time - sorted[i].time) / (sorted[i + 1].time - sorted[i].time);
        const s = t * t * (3 - 2 * t); // smoothstep
        x = sorted[i].position.x + (sorted[i + 1].position.x - sorted[i].position.x) * s;
        y = sorted[i].position.y + (sorted[i + 1].position.y - sorted[i].position.y) * s;
        z = sorted[i].position.z + (sorted[i + 1].position.z - sorted[i].position.z) * s;
        break;
      }
    }

    agents.push({ id: traj.id, name: traj.name, x, y, z });
  }

  // From timeline drone items
  const droneItems = timelineItems.filter((item) => {
    const effect = EFFECT_LIBRARY.find((e) => e.id === item.effectId);
    return effect?.type === 'drone';
  });

  for (const item of droneItems) {
    const effect = EFFECT_LIBRARY.find((e) => e.id === item.effectId);
    if (!effect) continue;
    if (time >= item.startTime && time <= item.startTime + effect.duration) {
      agents.push({
        id: item.id,
        name: effect.name,
        x: item.position.x,
        y: item.position.y,
        z: item.position.z,
      });
    }
  }

  return agents;
}

/**
 * Run deconfliction analysis across the show duration
 */
export function runDeconfliction(
  duration: number,
  trajectories: Trajectory[],
  positions: Position[],
  timelineItems: TimelineItem[],
  sampleRate: number = 0.5, // check every 0.5 seconds
): CollisionWarning[] {
  const warnings: CollisionWarning[] = [];
  const seen = new Set<string>(); // deduplicate close-in-time warnings

  for (let t = 0; t <= duration; t += sampleRate) {
    const agents = getDronePositionsAtTime(t, trajectories, positions, timelineItems);

    for (let i = 0; i < agents.length; i++) {
      for (let j = i + 1; j < agents.length; j++) {
        const a = agents[i], b = agents[j];
        const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (dist < MIN_SAFE_DISTANCE) {
          const key = `${a.id}-${b.id}-${Math.floor(t)}`;
          if (seen.has(key)) continue;
          seen.add(key);

          warnings.push({
            type: 'drone-drone',
            severity: dist < CRITICAL_DISTANCE ? 'critical' : 'warning',
            message: `${a.name} ↔ ${b.name}: ${dist.toFixed(2)}m at t=${t.toFixed(1)}s`,
            time: t,
            agentA: a.id,
            agentB: b.id,
            distance: dist,
          });
        }
      }
    }
  }

  return warnings;
}

// ─── Geofence: 3D virtual boundary ──────────────────────────────────

export interface Geofence {
  enabled: boolean;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

export const DEFAULT_GEOFENCE: Geofence = {
  enabled: true,
  minX: -50,
  maxX: 50,
  minY: 0,
  maxY: 60,
  minZ: -50,
  maxZ: 50,
};

/**
 * Check all drone positions against geofence at all times
 */
export function runGeofenceCheck(
  geofence: Geofence,
  duration: number,
  trajectories: Trajectory[],
  positions: Position[],
  timelineItems: TimelineItem[],
  sampleRate: number = 0.5,
): CollisionWarning[] {
  if (!geofence.enabled) return [];

  const warnings: CollisionWarning[] = [];
  const seen = new Set<string>();

  for (let t = 0; t <= duration; t += sampleRate) {
    const agents = getDronePositionsAtTime(t, trajectories, positions, timelineItems);

    for (const agent of agents) {
      const violations: string[] = [];
      if (agent.x < geofence.minX || agent.x > geofence.maxX) violations.push('X');
      if (agent.y < geofence.minY || agent.y > geofence.maxY) violations.push('Y');
      if (agent.z < geofence.minZ || agent.z > geofence.maxZ) violations.push('Z');

      if (violations.length > 0) {
        const key = `${agent.id}-geo-${Math.floor(t)}`;
        if (seen.has(key)) continue;
        seen.add(key);

        warnings.push({
          type: 'geofence',
          severity: 'critical',
          message: `${agent.name} breaches geofence (${violations.join(',')}) at t=${t.toFixed(1)}s`,
          time: t,
          agentA: agent.id,
        });
      }
    }
  }

  return warnings;
}

// ─── Pre-Fire Time (PFT) calculations ───────────────────────────────

/** Caliber-based lift times for pyro sync */
const LIFT_TIMES: Record<number, number> = {
  2: 1.2, 3: 1.8, 4: 2.3, 5: 2.8, 6: 3.2, 8: 3.8, 10: 4.2, 12: 4.8,
};

export function getPreFireTime(effectName: string): number {
  const match = effectName.match(/(\d+)"/);
  if (!match) return 0;
  const inches = parseInt(match[1]);
  return LIFT_TIMES[inches] ?? 2.0;
}

/**
 * Calculate the actual fire time to achieve visual burst at targetBeatTime.
 * fireTime = targetBeatTime - PFT
 */
export function calculateFireTime(effectName: string, targetBeatTime: number): number {
  const pft = getPreFireTime(effectName);
  return Math.max(0, targetBeatTime - pft);
}

/**
 * Get chain duration: total time from fire signal to last visual frame
 * chain = PFT + effect visual duration
 */
export function getChainDuration(effectName: string, effectDuration: number): number {
  return getPreFireTime(effectName) + effectDuration;
}
