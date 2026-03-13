/**
 * HCA (Hybrid Command Authority) Safety Layer
 * Implements cross-validation drone↔pyro, failsafe escalation,
 * risk volumes, and spatial occupancy analysis.
 *
 * Based on HCA Technical Architecture Dossier.
 */

import { type Position, type Trajectory, type TimelineItem, type DroneFormation, EFFECT_LIBRARY } from '@/store/useProjectStore';

// ─── Failsafe Escalation Levels ──────────────────────────────────────

export type EscalationLevel = 'nominal' | 'advisory' | 'caution' | 'warning' | 'abort';

export interface HCAStatus {
  level: EscalationLevel;
  message: string;
  timestamp: number;
  subsystem: 'drone' | 'pyro' | 'hybrid' | 'geofence';
}

export interface RiskVolume {
  id: string;
  label: string;
  type: 'pyro-exclusion' | 'drone-corridor' | 'audience-safety' | 'overlap-zone';
  center: { x: number; y: number; z: number };
  radius: number;
  height: number;
  active: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface CrossValidationResult {
  valid: boolean;
  escalation: EscalationLevel;
  violations: HCAStatus[];
  riskVolumes: RiskVolume[];
  spatialOccupancy: Map<string, number>; // grid cell → agent count
}

// ─── Risk Volume Generation ──────────────────────────────────────────

const PYRO_EXCLUSION_RADIUS = 8;   // meters around pyro positions
const PYRO_EXCLUSION_HEIGHT = 15;  // meters above pyro
const DRONE_SAFETY_BUFFER = 3;     // meters around drone corridors
const AUDIENCE_SAFE_DISTANCE = 25; // meters from any effect

/**
 * Generate risk volumes from pyro positions and drone formations.
 */
export function generateRiskVolumes(
  positions: Position[],
  droneFormations: DroneFormation[],
): RiskVolume[] {
  const volumes: RiskVolume[] = [];

  // Pyro exclusion zones
  const pyroPositions = positions.filter(p => p.type === 'pyro');
  for (const pos of pyroPositions) {
    volumes.push({
      id: `pyro-excl-${pos.id}`,
      label: `Pyro Zone: ${pos.name}`,
      type: 'pyro-exclusion',
      center: { x: pos.x, y: pos.y + PYRO_EXCLUSION_HEIGHT / 2, z: pos.z },
      radius: PYRO_EXCLUSION_RADIUS,
      height: PYRO_EXCLUSION_HEIGHT,
      active: true,
      severity: 'critical',
    });
  }

  // Drone corridor volumes from formations
  for (const f of droneFormations) {
    const cx = f.points.reduce((s, p) => s + p.x, 0) / Math.max(1, f.points.length);
    const cz = f.points.reduce((s, p) => s + p.z, 0) / Math.max(1, f.points.length);
    const maxR = Math.max(...f.points.map(p => Math.sqrt((p.x - cx) ** 2 + (p.z - cz) ** 2))) + DRONE_SAFETY_BUFFER;

    volumes.push({
      id: `drone-corr-${f.id}`,
      label: `Drone Corridor: ${f.formationType}`,
      type: 'drone-corridor',
      center: { x: cx, y: f.height, z: cz },
      radius: maxR,
      height: 10,
      active: true,
      severity: 'medium',
    });
  }

  // Detect overlapping zones (pyro exclusion ∩ drone corridor)
  for (const pyroVol of volumes.filter(v => v.type === 'pyro-exclusion')) {
    for (const droneVol of volumes.filter(v => v.type === 'drone-corridor')) {
      const dist = Math.sqrt(
        (pyroVol.center.x - droneVol.center.x) ** 2 +
        (pyroVol.center.z - droneVol.center.z) ** 2,
      );
      const yOverlap = Math.abs(pyroVol.center.y - droneVol.center.y) < (pyroVol.height / 2 + droneVol.height / 2);

      if (dist < pyroVol.radius + droneVol.radius && yOverlap) {
        const midX = (pyroVol.center.x + droneVol.center.x) / 2;
        const midY = (pyroVol.center.y + droneVol.center.y) / 2;
        const midZ = (pyroVol.center.z + droneVol.center.z) / 2;

        volumes.push({
          id: `overlap-${pyroVol.id}-${droneVol.id}`,
          label: 'DANGER: Pyro↔Drone Overlap',
          type: 'overlap-zone',
          center: { x: midX, y: midY, z: midZ },
          radius: Math.min(pyroVol.radius, droneVol.radius),
          height: 8,
          active: true,
          severity: 'critical',
        });
      }
    }
  }

  return volumes;
}

// ─── Cross-Validation Engine ─────────────────────────────────────────

/**
 * Cross-validate drone and pyro subsystems.
 * Checks temporal overlap (pyro firing while drones are in exclusion zone)
 * and spatial occupancy conflicts.
 */
export function crossValidate(
  duration: number,
  positions: Position[],
  trajectories: Trajectory[],
  timelineItems: TimelineItem[],
  droneFormations: DroneFormation[],
  sampleRate = 1.0,
): CrossValidationResult {
  const violations: HCAStatus[] = [];
  const riskVolumes = generateRiskVolumes(positions, droneFormations);
  const spatialOccupancy = new Map<string, number>();

  const pyroPositions = positions.filter(p => p.type === 'pyro');
  const pyroItems = timelineItems.filter(item => {
    const effect = EFFECT_LIBRARY.find(e => e.id === item.effectId);
    return effect?.type === 'firework';
  });

  // Check each time step
  for (let t = 0; t <= duration; t += sampleRate) {
    // Get active drone positions at time t from formations
    for (const f of droneFormations) {
      const holdEnd = f.startTime + f.transitionDuration + f.holdDuration;
      if (t < f.startTime || t > holdEnd) continue;

      for (let d = 0; d < f.droneCount; d++) {
        const pt = f.points[d];
        if (!pt) continue;

        // Grid cell for spatial occupancy (5m grid)
        const cellKey = `${Math.floor(pt.x / 5)},${Math.floor(f.height / 5)},${Math.floor(pt.z / 5)}`;
        spatialOccupancy.set(cellKey, (spatialOccupancy.get(cellKey) || 0) + 1);

        // Check drone against pyro exclusion zones
        for (const pyro of pyroPositions) {
          const dist = Math.sqrt((pt.x - pyro.x) ** 2 + (pt.z - pyro.z) ** 2);
          const yDist = Math.abs(f.height - pyro.y);

          if (dist < PYRO_EXCLUSION_RADIUS && yDist < PYRO_EXCLUSION_HEIGHT) {
            // Is there an active pyro at this time?
            for (const pi of pyroItems) {
              const effect = EFFECT_LIBRARY.find(e => e.id === pi.effectId);
              if (!effect) continue;
              const pyroEnd = pi.startTime + effect.duration;
              // Check temporal overlap with buffer
              const buffer = 2; // 2s safety buffer
              if (t >= pi.startTime - buffer && t <= pyroEnd + buffer) {
                violations.push({
                  level: 'abort',
                  message: `Drone ${d + 1} inside pyro exclusion zone of "${pyro.name}" at t=${t.toFixed(1)}s (dist=${dist.toFixed(1)}m)`,
                  timestamp: t,
                  subsystem: 'hybrid',
                });
              }
            }
          }
        }
      }
    }
  }

  // Determine overall escalation level
  const hasAbort = violations.some(v => v.level === 'abort');
  const hasWarning = violations.some(v => v.level === 'warning');
  const hasCaution = violations.some(v => v.level === 'caution');
  const overlapZones = riskVolumes.filter(v => v.type === 'overlap-zone');

  let escalation: EscalationLevel = 'nominal';
  if (hasAbort || overlapZones.length > 0) escalation = 'abort';
  else if (hasWarning) escalation = 'warning';
  else if (hasCaution) escalation = 'caution';
  else if (violations.length > 0) escalation = 'advisory';

  // Add overlap zone violations
  for (const oz of overlapZones) {
    violations.push({
      level: 'abort',
      message: `${oz.label} at (${oz.center.x.toFixed(0)}, ${oz.center.y.toFixed(0)}, ${oz.center.z.toFixed(0)})`,
      timestamp: 0,
      subsystem: 'hybrid',
    });
  }

  return {
    valid: escalation === 'nominal' || escalation === 'advisory',
    escalation,
    violations: violations.sort((a, b) => a.timestamp - b.timestamp),
    riskVolumes,
    spatialOccupancy,
  };
}

// ─── Failsafe Response Actions ───────────────────────────────────────

export interface FailsafeAction {
  level: EscalationLevel;
  label: string;
  description: string;
  automatic: boolean;
}

export const FAILSAFE_ACTIONS: FailsafeAction[] = [
  { level: 'nominal', label: 'Normal Operation', description: 'All systems nominal, show proceeds as planned.', automatic: true },
  { level: 'advisory', label: 'Advisory', description: 'Minor deviations detected. Invisible adjustments applied to timing/spacing.', automatic: true },
  { level: 'caution', label: 'Caution', description: 'Significant deviation. Auto-adjusting drone trajectories, pyro timing shifted.', automatic: true },
  { level: 'warning', label: 'Warning', description: 'Safety margins compromised. Partial system hold — operator confirmation required.', automatic: false },
  { level: 'abort', label: 'Hybrid Abort', description: 'Critical safety violation. All pyro firing suspended, drones enter RTH mode.', automatic: false },
];

export function getFailsafeAction(level: EscalationLevel): FailsafeAction {
  return FAILSAFE_ACTIONS.find(a => a.level === level) || FAILSAFE_ACTIONS[0];
}
