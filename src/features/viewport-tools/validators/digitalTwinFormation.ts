/**
 * Digital Twin — Formation Validation Engine
 * ────────────────────────────────────────────────────────────
 * Cross-cutting safety/feasibility report for a generated drone
 * formation. Consolidates checks that the parametric generator alone
 * cannot reason about:
 *
 *   • collision     — pairwise min spacing (already computed by generator)
 *   • clearance     — formation footprint vs project geofence radius
 *   • altitude      — ceiling vs project AGL ceiling and floor vs ground
 *   • density       — drones per m³ (energy / battery feasibility)
 *   • performance   — frame rate hint when drone count is huge
 *
 * The engine is PURE — reads ProjectStore via `getState()` once, returns
 * a typed report. NO mutations, NO IO, NO commands dispatched. Honesty
 * layer: this is a SIMULATION report. Real flight requires hardware
 * sign-off (handled separately by Live Read-Only / handshake layer).
 */

import { useProjectStore } from '@/store/useProjectStore';
import {
  generateDroneFormationDetailed,
  MIN_DRONE_SEPARATION_M,
  type FormationParams,
  type CollisionReport,
  type FormationGeneratorResult,
} from '../generators/droneFormationGenerator';

export type TwinSeverity = 'ok' | 'info' | 'warn' | 'block';

export interface TwinFinding {
  code: string;
  severity: TwinSeverity;
  message: string;
}

export interface DigitalTwinFormationReport {
  /** True iff zero `block` findings AND collision.ok. */
  ready: boolean;
  collision: CollisionReport;
  findings: TwinFinding[];
  metrics: {
    droneCount: number;
    footprintRadiusM: number;
    altCeilingM: number;
    altFloorM: number;
    densityPerKm3: number;
  };
  generator: FormationGeneratorResult;
}

/** Tunables — kept module-local; UI surfaces the values via the report. */
const DEFAULT_AGL_CEILING_M = 120; // FAA Part 107 / ANAC default
const DEFAULT_GEOFENCE_RADIUS_M = 200;
const HUGE_FLEET_THRESHOLD = 500;
const DENSITY_WARN_PER_KM3 = 50_000;

function readProjectLimits(): {
  ceilingM: number;
  geofenceRadiusM: number;
  groundFloorM: number;
} {
  // Best-effort: ProjectStore doesn't yet expose explicit geofence/ceiling
  // — fall back to standards. When ShowSettingsPanel.DigitalTwinSection
  // gains explicit fields we wire them here.
  try {
    const s = useProjectStore.getState() as unknown as {
      project?: {
        ceilingM?: number;
        geofenceRadiusM?: number;
        groundFloorM?: number;
      };
    };
    return {
      ceilingM: s.project?.ceilingM ?? DEFAULT_AGL_CEILING_M,
      geofenceRadiusM: s.project?.geofenceRadiusM ?? DEFAULT_GEOFENCE_RADIUS_M,
      groundFloorM: s.project?.groundFloorM ?? 0,
    };
  } catch {
    return {
      ceilingM: DEFAULT_AGL_CEILING_M,
      geofenceRadiusM: DEFAULT_GEOFENCE_RADIUS_M,
      groundFloorM: 0,
    };
  }
}

/**
 * Run the Digital Twin validation against a formation parameter set.
 * Performs the same generator pass the dialog uses, then layers
 * environmental + density checks on top.
 */
export function runDigitalTwinFormation(
  params: FormationParams,
): DigitalTwinFormationReport {
  const generator = generateDroneFormationDetailed(params);
  const { collision, formation } = generator;
  const limits = readProjectLimits();

  // Footprint radius (max XZ distance from origin among generated points).
  let maxXZ = 0;
  let maxY = 0;
  let minY = Infinity;
  // pointsY is optional; tolerate absence
  const ys = (formation as unknown as { pointsY?: number[] }).pointsY ?? [];
  for (let i = 0; i < formation.points.length; i++) {
    const p = formation.points[i];
    const r = Math.hypot(p.x, p.z);
    if (r > maxXZ) maxXZ = r;
    const y = formation.height + (ys[i] ?? 0);
    if (y > maxY) maxY = y;
    if (y < minY) minY = y;
  }
  if (!Number.isFinite(minY)) minY = formation.height;

  // Density: drones / volume of bounding cylinder (m³ → per km³).
  const volM3 = Math.max(
    1,
    Math.PI * Math.max(0.5, maxXZ) ** 2 * Math.max(0.5, maxY - minY + 1),
  );
  const densityPerKm3 = (formation.droneCount / volM3) * 1_000_000_000;

  const findings: TwinFinding[] = [];

  // Collision (block-level).
  if (!collision.ok) {
    findings.push({
      code: 'TWIN_COLLISION',
      severity: 'block',
      message: `${collision.violations} pair(s) below ${collision.threshold}m (min ${collision.minSpacingM.toFixed(2)}m).`,
    });
  } else if (collision.minSpacingM < MIN_DRONE_SEPARATION_M * 1.25) {
    findings.push({
      code: 'TWIN_COLLISION_TIGHT',
      severity: 'warn',
      message: `Minimum spacing ${collision.minSpacingM.toFixed(2)}m is close to threshold ${collision.threshold}m.`,
    });
  }

  // Altitude ceiling.
  if (maxY > limits.ceilingM) {
    findings.push({
      code: 'TWIN_CEILING',
      severity: 'block',
      message: `Top of formation (${maxY.toFixed(1)}m) exceeds AGL ceiling (${limits.ceilingM}m).`,
    });
  } else if (maxY > limits.ceilingM * 0.9) {
    findings.push({
      code: 'TWIN_CEILING_NEAR',
      severity: 'warn',
      message: `Top altitude ${maxY.toFixed(1)}m within 10% of ceiling ${limits.ceilingM}m.`,
    });
  }

  // Floor / ground.
  if (minY < limits.groundFloorM) {
    findings.push({
      code: 'TWIN_BELOW_FLOOR',
      severity: 'block',
      message: `Lowest drone ${minY.toFixed(1)}m is below ground floor (${limits.groundFloorM}m).`,
    });
  } else if (minY < 5) {
    findings.push({
      code: 'TWIN_LOW_ALTITUDE',
      severity: 'warn',
      message: `Lowest drone ${minY.toFixed(1)}m — ensure crowd separation NFPA-compliant.`,
    });
  }

  // Geofence clearance.
  if (maxXZ > limits.geofenceRadiusM) {
    findings.push({
      code: 'TWIN_GEOFENCE',
      severity: 'block',
      message: `Footprint radius ${maxXZ.toFixed(1)}m exceeds geofence (${limits.geofenceRadiusM}m).`,
    });
  } else if (maxXZ > limits.geofenceRadiusM * 0.85) {
    findings.push({
      code: 'TWIN_GEOFENCE_NEAR',
      severity: 'info',
      message: `Footprint within 15% of geofence boundary.`,
    });
  }

  // Density.
  if (densityPerKm3 > DENSITY_WARN_PER_KM3) {
    findings.push({
      code: 'TWIN_DENSITY',
      severity: 'warn',
      message: `Density ${Math.round(densityPerKm3).toLocaleString()} drones/km³ may stress collision-avoidance and battery margin.`,
    });
  }

  // Fleet size hint.
  if (formation.droneCount >= HUGE_FLEET_THRESHOLD) {
    findings.push({
      code: 'TWIN_HUGE_FLEET',
      severity: 'info',
      message: `Large fleet (${formation.droneCount}). Preview FPS may degrade; export VVIZ in chunks.`,
    });
  }

  // Carry over generator warnings as info.
  for (const w of generator.warnings) {
    if (!w.startsWith('Collision:')) {
      findings.push({ code: 'TWIN_GEN_NOTE', severity: 'info', message: w });
    }
  }

  const blockCount = findings.filter((f) => f.severity === 'block').length;
  const ready = blockCount === 0 && collision.ok;

  return {
    ready,
    collision,
    findings,
    metrics: {
      droneCount: formation.droneCount,
      footprintRadiusM: maxXZ,
      altCeilingM: limits.ceilingM,
      altFloorM: limits.groundFloorM,
      densityPerKm3,
    },
    generator,
  };
}

export function summarizeTwin(report: DigitalTwinFormationReport): string {
  if (report.ready && report.findings.length === 0) return '✓ TWIN READY';
  if (report.ready) return `✓ TWIN READY · ${report.findings.length} note(s)`;
  const blocks = report.findings.filter((f) => f.severity === 'block').length;
  return `⚠ TWIN BLOCKED · ${blocks} blocker(s)`;
}
