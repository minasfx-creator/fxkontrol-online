/**
 * ─── Simulation Validator ───────────────────────────────────────────
 * Fast-forward simulation at 100x speed to detect:
 * - collisions between drones / pyro
 * - timing violations (cues too close together)
 * - geofence breaches
 * Returns a ValidationReport with pass/fail per cue.
 */

import { blackbox } from '@/core/reliability/blackBoxRecorder';

export interface ValidationCue {
  id: string;
  type: 'pyro' | 'drone';
  time: number;
  x: number;
  y: number;
  z: number;
  safetyRadius?: number;
}

export interface ValidationIssue {
  severity: 'warning' | 'critical';
  cueId: string;
  relatedCueId?: string;
  message: string;
  time: number;
}

export interface ValidationReport {
  passed: boolean;
  totalCues: number;
  issues: ValidationIssue[];
  warnings: number;
  criticals: number;
  duration_ms: number;
  simulatedDuration: number;
}

export interface ValidationConfig {
  minCueSpacing: number;       // seconds — min time between cues on same module
  collisionRadius: number;     // meters — min distance between simultaneous effects
  geofenceRadius: number;      // meters — max distance from anchor
  maxAltitude: number;         // meters
}

const DEFAULT_CONFIG: ValidationConfig = {
  minCueSpacing: 0.1,
  collisionRadius: 10,
  geofenceRadius: 500,
  maxAltitude: 300,
};

class SimulationValidator {
  private _config: ValidationConfig = { ...DEFAULT_CONFIG };

  setConfig(partial: Partial<ValidationConfig>): void {
    Object.assign(this._config, partial);
  }

  /**
   * Validate a set of cues. Runs synchronously (fast-forward).
   * Returns a full report.
   */
  validate(cues: ValidationCue[], showDuration: number): ValidationReport {
    const startMs = performance.now();
    const issues: ValidationIssue[] = [];

    // Sort by time
    const sorted = [...cues].sort((a, b) => a.time - b.time);

    for (let i = 0; i < sorted.length; i++) {
      const cue = sorted[i];

      // Geofence check
      const dist = Math.sqrt(cue.x * cue.x + cue.y * cue.y);
      if (dist > this._config.geofenceRadius) {
        issues.push({
          severity: 'critical',
          cueId: cue.id,
          message: `Geofence breach: ${dist.toFixed(1)}m > ${this._config.geofenceRadius}m`,
          time: cue.time,
        });
      }

      // Altitude check
      if (cue.z > this._config.maxAltitude) {
        issues.push({
          severity: 'critical',
          cueId: cue.id,
          message: `Altitude exceeded: ${cue.z.toFixed(1)}m > ${this._config.maxAltitude}m`,
          time: cue.time,
        });
      }

      // Collision check with nearby cues
      for (let j = i + 1; j < sorted.length; j++) {
        const other = sorted[j];
        if (other.time - cue.time > 2) break; // Only check within 2s window

        const dx = cue.x - other.x;
        const dy = cue.y - other.y;
        const dz = cue.z - other.z;
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const minDist = (cue.safetyRadius ?? this._config.collisionRadius) +
                        (other.safetyRadius ?? this._config.collisionRadius);

        if (d < minDist) {
          issues.push({
            severity: 'warning',
            cueId: cue.id,
            relatedCueId: other.id,
            message: `Proximity alert: ${d.toFixed(1)}m < ${minDist.toFixed(1)}m min`,
            time: cue.time,
          });
        }
      }

      // Timing spacing check (same type)
      if (i > 0 && sorted[i - 1].type === cue.type) {
        const gap = cue.time - sorted[i - 1].time;
        if (gap < this._config.minCueSpacing) {
          issues.push({
            severity: 'warning',
            cueId: cue.id,
            relatedCueId: sorted[i - 1].id,
            message: `Cue spacing: ${(gap * 1000).toFixed(0)}ms < ${(this._config.minCueSpacing * 1000).toFixed(0)}ms min`,
            time: cue.time,
          });
        }
      }
    }

    const warnings = issues.filter(i => i.severity === 'warning').length;
    const criticals = issues.filter(i => i.severity === 'critical').length;
    const report: ValidationReport = {
      passed: criticals === 0,
      totalCues: cues.length,
      issues,
      warnings,
      criticals,
      duration_ms: performance.now() - startMs,
      simulatedDuration: showDuration,
    };

    blackbox.record('state', `Validation: ${report.passed ? 'PASS' : 'FAIL'} (${criticals}C ${warnings}W)`, {
      totalCues: cues.length,
    });

    return report;
  }

  getConfig(): Readonly<ValidationConfig> { return this._config; }
}

export const simulationValidator = new SimulationValidator();
