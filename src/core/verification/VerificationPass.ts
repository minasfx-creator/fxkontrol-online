/**
 * ─── Verification Pass — Binary System Readiness ────────────────────
 * Aggregates checks from ShowPlan, Safety, Hardware, and Protocol layers.
 * Returns a single binary status: READY_FOR_SIMULATION | READY_FOR_EXPORT |
 * READY_FOR_FIELD | BLOCKED.
 */

import { showPlanManager } from '@/core/showplan/ShowPlanManager';
import { safetyStateMachine } from '@/core/safety/SafetyStateMachine';
import { continuityCheckService } from '@/core/safety/ContinuityCheckService';
import { blackbox } from '@/core/reliability/blackBoxRecorder';
import type { VerificationLevel, VerificationCheckResult, VerificationResult } from '@/core/showplan/ShowPlan';

class VerificationPass {
  /** Run all verification checks and return aggregated result. */
  run(): VerificationResult {
    const checks: VerificationCheckResult[] = [];

    // 1. ShowPlan integrity
    const spResult = showPlanManager.validate();
    checks.push(...spResult.checks);

    // 2. Safety interlock state
    const safetyState = safetyStateMachine.state;
    const safetyOk = safetyState !== 'SAFE'; // SAFE = e-stopped, must reset
    checks.push({
      id: 'safety-interlock',
      label: 'Safety interlock',
      passed: safetyOk,
      severity: 'error',
      detail: safetyOk
        ? `Safety state: ${safetyState}`
        : 'System is in E-STOP (SAFE) state — reset required',
    });

    // 3. Continuity check (if required by constraints)
    const sp = showPlanManager.current;
    if (sp.safetyConstraints.requireContinuityCheck) {
      const report = continuityCheckService.getReport();
      const continuityOk = report.short === 0 && report.unknown === 0;
      checks.push({
        id: 'continuity',
        label: 'Continuity check',
        passed: continuityOk,
        severity: report.short > 0 ? 'error' : 'warning',
        detail: `OK: ${report.ok} | Open: ${report.open} | Short: ${report.short} | Unknown: ${report.unknown}`,
      });
    }

    // 4. Hardware modules registered
    const hasHardware = sp.hardwareConfig.modules.length > 0;
    checks.push({
      id: 'hardware-modules',
      label: 'Hardware modules',
      passed: hasHardware,
      severity: 'warning',
      detail: hasHardware
        ? `${sp.hardwareConfig.modules.length} module(s) registered`
        : 'No hardware modules configured',
    });

    // 5. Geofence defined (if cues exist)
    if (sp.pyroCues.length > 0) {
      const hasGeofence = sp.safetyConstraints.geofenceZones.length > 0;
      checks.push({
        id: 'geofence',
        label: 'Geofence zones',
        passed: hasGeofence,
        severity: 'warning',
        detail: hasGeofence
          ? `${sp.safetyConstraints.geofenceZones.length} zone(s) defined`
          : 'No geofence zones — recommended for field',
      });
    }

    // Determine overall level
    const hasErrors = checks.some(c => !c.passed && c.severity === 'error');
    const hasWarnings = checks.some(c => !c.passed && c.severity === 'warning');
    const hasPyroCues = sp.pyroCues.length > 0;
    const hasDrones = sp.dronePaths.length > 0;
    const hasContent = hasPyroCues || sp.dmxCues.length > 0 || hasDrones;

    let level: VerificationLevel;
    if (hasErrors || !hasContent) {
      level = 'BLOCKED';
    } else if (hasWarnings) {
      level = hasHardware ? 'READY_FOR_EXPORT' : 'READY_FOR_SIMULATION';
    } else {
      level = 'READY_FOR_FIELD';
    }

    const result: VerificationResult = { level, checks, timestamp: Date.now() };
    blackbox.record('state', `VerificationPass: ${level} (${checks.filter(c => c.passed).length}/${checks.length} passed)`);
    return result;
  }
}

export const verificationPass = new VerificationPass();
