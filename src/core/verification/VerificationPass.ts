/**
 * ─── Verification Pass — Binary System Readiness ────────────────────
 * Aggregates checks from ShowPlan, Safety, Hardware, and Protocol layers.
 * Returns a single binary status: READY_FOR_SIMULATION | READY_FOR_EXPORT |
 * READY_FOR_FIELD | BLOCKED.
 *
 * Pre-export gate: blocks export when critical validation fails.
 */

import { showPlanManager } from '@/core/showplan/ShowPlanManager';
import { safetyStateMachine } from '@/core/safety/SafetyStateMachine';
import { continuityCheckService } from '@/core/safety/ContinuityCheckService';
import { blackbox } from '@/core/reliability/blackBoxRecorder';
import type { VerificationLevel, VerificationCheckResult, VerificationResult, ShowPlan } from '@/core/showplan/ShowPlan';

// ── Helper ──────────────────────────────────────────────────────────

function check(
  id: string,
  label: string,
  passed: boolean,
  severity: 'error' | 'warning' | 'info',
  detail: string,
): VerificationCheckResult {
  return { id, label, passed, severity, detail };
}

// ── Verification Pass ───────────────────────────────────────────────

class VerificationPass {
  /** Run all verification checks and return aggregated result. */
  run(): VerificationResult {
    const sp = showPlanManager.current;
    const checks: VerificationCheckResult[] = [];

    // ── 1. ShowPlan Integrity (delegated) ────────────────────────
    const spResult = showPlanManager.validate();
    checks.push(...spResult.checks);

    // ── 2. Metadata completeness ─────────────────────────────────
    checks.push(...this._checkMetadata(sp));

    // ── 3. Pyro cue validation ───────────────────────────────────
    checks.push(...this._checkPyroCues(sp));

    // ── 4. DMX cue validation ────────────────────────────────────
    checks.push(...this._checkDMXCues(sp));

    // ── 5. Drone path validation ─────────────────────────────────
    checks.push(...this._checkDronePaths(sp));

    // ── 6. Safety interlock state ────────────────────────────────
    const safetyState = safetyStateMachine.state;
    const safetyOk = safetyState !== 'SAFE';
    checks.push(check(
      'safety-interlock', 'Safety interlock', safetyOk, 'error',
      safetyOk ? `Safety state: ${safetyState}` : 'System is in E-STOP (SAFE) state — reset required',
    ));

    // ── 7. Continuity check ──────────────────────────────────────
    if (sp.safetyConstraints.requireContinuityCheck) {
      const report = continuityCheckService.getReport();
      const continuityOk = report.short === 0 && report.unknown === 0;
      checks.push(check(
        'continuity', 'Continuity check', continuityOk,
        report.short > 0 ? 'error' : 'warning',
        `OK: ${report.ok} | Open: ${report.open} | Short: ${report.short} | Unknown: ${report.unknown}`,
      ));
    }

    // ── 8. Hardware modules ──────────────────────────────────────
    const hasHardware = sp.hardwareConfig.modules.length > 0;
    checks.push(check(
      'hardware-modules', 'Hardware modules', hasHardware, 'warning',
      hasHardware ? `${sp.hardwareConfig.modules.length} module(s) registered` : 'No hardware modules configured',
    ));

    // ── 9. Geofence zones ────────────────────────────────────────
    if (sp.pyroCues.length > 0) {
      const hasGeofence = sp.safetyConstraints.geofenceZones.length > 0;
      checks.push(check(
        'geofence', 'Geofence zones', hasGeofence, 'warning',
        hasGeofence ? `${sp.safetyConstraints.geofenceZones.length} zone(s) defined` : 'No geofence zones — recommended for field',
      ));
    }

    // ── 10. Timing consistency ───────────────────────────────────
    checks.push(...this._checkTimingConsistency(sp));

    // ── Determine overall level ──────────────────────────────────
    const hasErrors = checks.some(c => !c.passed && c.severity === 'error');
    const hasWarnings = checks.some(c => !c.passed && c.severity === 'warning');
    const hasContent = sp.pyroCues.length > 0 || sp.dmxCues.length > 0 || sp.dronePaths.length > 0;

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

  /** Check if the verification level allows export. */
  canExport(): boolean {
    const result = this.run();
    return result.level === 'READY_FOR_EXPORT' || result.level === 'READY_FOR_FIELD';
  }

  // ── Private check suites ──────────────────────────────────────

  private _checkMetadata(sp: ShowPlan): VerificationCheckResult[] {
    const checks: VerificationCheckResult[] = [];

    const hasName = sp.metadata.name.trim().length > 0 && sp.metadata.name !== 'Untitled Show';
    checks.push(check(
      'metadata-name', 'Show name defined', hasName, 'warning',
      hasName ? `"${sp.metadata.name}"` : 'Show name is default or empty',
    ));

    const hasVenue = sp.metadata.venue.trim().length > 0;
    checks.push(check(
      'metadata-venue', 'Venue defined', hasVenue, 'info',
      hasVenue ? sp.metadata.venue : 'No venue specified',
    ));

    const durationOk = sp.metadata.duration > 0;
    checks.push(check(
      'metadata-duration', 'Duration > 0', durationOk, 'warning',
      durationOk ? `${sp.metadata.duration.toFixed(1)}s` : 'Show duration is zero',
    ));

    return checks;
  }

  private _checkPyroCues(sp: ShowPlan): VerificationCheckResult[] {
    if (sp.pyroCues.length === 0) return [];
    const checks: VerificationCheckResult[] = [];

    // Negative times
    const negTimes = sp.pyroCues.filter(c => c.time < 0);
    checks.push(check(
      'pyro-negative-time', 'Pyro: no negative times', negTimes.length === 0, 'error',
      negTimes.length === 0 ? 'All pyro cues have valid times' : `${negTimes.length} cue(s) with negative time`,
    ));

    // Invalid caliber range (1–999mm)
    const badCaliber = sp.pyroCues.filter(c => c.caliber <= 0 || c.caliber > 999);
    checks.push(check(
      'pyro-caliber-range', 'Pyro: caliber in range (1–999mm)', badCaliber.length === 0, 'error',
      badCaliber.length === 0 ? 'All calibers valid' : `${badCaliber.length} cue(s) with invalid caliber`,
    ));

    // Elevation range (0–360°)
    const badElev = sp.pyroCues.filter(c => c.elevation < 0 || c.elevation > 360);
    checks.push(check(
      'pyro-elevation-range', 'Pyro: elevation in range (0–360°)', badElev.length === 0, 'warning',
      badElev.length === 0 ? 'All elevations valid' : `${badElev.length} cue(s) with out-of-range elevation`,
    ));

    // Missing effectId
    const noEffect = sp.pyroCues.filter(c => !c.effectId || c.effectId.trim() === '');
    checks.push(check(
      'pyro-effect-id', 'Pyro: all cues have effectId', noEffect.length === 0, 'error',
      noEffect.length === 0 ? 'All cues linked to effects' : `${noEffect.length} cue(s) missing effectId`,
    ));

    // Max caliber safety
    const overCaliber = sp.pyroCues.filter(c => c.caliber > sp.safetyConstraints.maxCaliper);
    checks.push(check(
      'pyro-max-caliber', `Pyro: caliber ≤ ${sp.safetyConstraints.maxCaliper}mm`,
      overCaliber.length === 0, 'error',
      overCaliber.length === 0 ? 'All within safety limit' : `${overCaliber.length} cue(s) exceed max caliber`,
    ));

    // Channel range (0–31)
    const badChannel = sp.pyroCues.filter(c => c.channel < 0 || c.channel > 31);
    checks.push(check(
      'pyro-channel-range', 'Pyro: channels in range (0–31)', badChannel.length === 0, 'error',
      badChannel.length === 0 ? 'All channels valid' : `${badChannel.length} cue(s) with invalid channel`,
    ));

    return checks;
  }

  private _checkDMXCues(sp: ShowPlan): VerificationCheckResult[] {
    if (sp.dmxCues.length === 0) return [];
    const checks: VerificationCheckResult[] = [];

    // Universe range (1–32767 per Art-Net 4)
    const badUniverse = sp.dmxCues.filter(c => c.universe < 1 || c.universe > 32767);
    checks.push(check(
      'dmx-universe-range', 'DMX: universe in range (1–32767)', badUniverse.length === 0, 'error',
      badUniverse.length === 0 ? 'All universes valid' : `${badUniverse.length} cue(s) with invalid universe`,
    ));

    // Channel range (1–512)
    const badChannel = sp.dmxCues.filter(c => c.channel < 1 || c.channel > 512);
    checks.push(check(
      'dmx-channel-range', 'DMX: channel in range (1–512)', badChannel.length === 0, 'error',
      badChannel.length === 0 ? 'All channels valid' : `${badChannel.length} cue(s) with invalid channel`,
    ));

    // Value range (0–255)
    const badValue = sp.dmxCues.filter(c => c.value < 0 || c.value > 255);
    checks.push(check(
      'dmx-value-range', 'DMX: value in range (0–255)', badValue.length === 0, 'error',
      badValue.length === 0 ? 'All values valid' : `${badValue.length} cue(s) with out-of-range value`,
    ));

    // Duration > 0
    const badDuration = sp.dmxCues.filter(c => c.duration <= 0);
    checks.push(check(
      'dmx-duration', 'DMX: duration > 0', badDuration.length === 0, 'warning',
      badDuration.length === 0 ? 'All durations valid' : `${badDuration.length} cue(s) with zero/negative duration`,
    ));

    // Negative times
    const negTimes = sp.dmxCues.filter(c => c.time < 0);
    checks.push(check(
      'dmx-negative-time', 'DMX: no negative times', negTimes.length === 0, 'error',
      negTimes.length === 0 ? 'All DMX cues have valid times' : `${negTimes.length} cue(s) with negative time`,
    ));

    return checks;
  }

  private _checkDronePaths(sp: ShowPlan): VerificationCheckResult[] {
    if (sp.dronePaths.length === 0) return [];
    const checks: VerificationCheckResult[] = [];

    // Empty paths
    const emptyPaths = sp.dronePaths.filter(p => p.waypoints.length === 0);
    checks.push(check(
      'drone-empty-paths', 'Drones: no empty paths', emptyPaths.length === 0, 'error',
      emptyPaths.length === 0 ? 'All paths have waypoints' : `${emptyPaths.length} path(s) with no waypoints`,
    ));

    // Waypoint time ordering (must be non-decreasing)
    let unordered = 0;
    for (const path of sp.dronePaths) {
      for (let i = 1; i < path.waypoints.length; i++) {
        if (path.waypoints[i].time < path.waypoints[i - 1].time) { unordered++; break; }
      }
    }
    checks.push(check(
      'drone-time-order', 'Drones: waypoints time-ordered', unordered === 0, 'error',
      unordered === 0 ? 'All waypoints in chronological order' : `${unordered} path(s) with unordered waypoints`,
    ));

    // Speed limits (0–30 m/s reasonable for show drones)
    let badSpeed = 0;
    for (const path of sp.dronePaths) {
      for (const wp of path.waypoints) {
        if (wp.speed < 0 || wp.speed > 30) { badSpeed++; }
      }
    }
    checks.push(check(
      'drone-speed-range', 'Drones: speed in range (0–30 m/s)', badSpeed === 0, 'warning',
      badSpeed === 0 ? 'All waypoint speeds valid' : `${badSpeed} waypoint(s) with out-of-range speed`,
    ));

    // Altitude check (y > -10 to catch underground waypoints)
    let underground = 0;
    for (const path of sp.dronePaths) {
      for (const wp of path.waypoints) {
        if (wp.position.y < -10) underground++;
      }
    }
    checks.push(check(
      'drone-altitude', 'Drones: no underground waypoints', underground === 0, 'warning',
      underground === 0 ? 'All waypoints above ground' : `${underground} waypoint(s) below -10m altitude`,
    ));

    // Missing padPositionId reference
    const posIds = new Set(sp.positions.map(p => p.id));
    const orphanPads = sp.dronePaths.filter(p => !posIds.has(p.padPositionId));
    checks.push(check(
      'drone-pad-ref', 'Drones: pad positions exist', orphanPads.length === 0, 'warning',
      orphanPads.length === 0 ? 'All pads reference valid positions' : `${orphanPads.length} path(s) reference missing pad positions`,
    ));

    return checks;
  }

  private _checkTimingConsistency(sp: ShowPlan): VerificationCheckResult[] {
    const checks: VerificationCheckResult[] = [];

    // Cues beyond declared duration
    const duration = sp.metadata.duration;
    if (duration > 0) {
      const pyroBeyond = sp.pyroCues.filter(c => c.time > duration);
      const dmxBeyond = sp.dmxCues.filter(c => c.time > duration);
      const droneBeyond = sp.dronePaths.flatMap(p => p.waypoints).filter(w => w.time > duration);
      const total = pyroBeyond.length + dmxBeyond.length + droneBeyond.length;

      checks.push(check(
        'timing-beyond-duration', 'Timing: all events within duration', total === 0, 'warning',
        total === 0
          ? `All events within ${duration.toFixed(1)}s`
          : `${total} event(s) exceed show duration (${duration.toFixed(1)}s)`,
      ));
    }

    // Pyro rapid-fire detection (< 200ms apart on same module:channel)
    const channelSlots = new Map<string, number[]>();
    for (const cue of sp.pyroCues) {
      const key = `${cue.module}:${cue.channel}`;
      if (!channelSlots.has(key)) channelSlots.set(key, []);
      channelSlots.get(key)!.push(cue.time);
    }
    let rapidFire = 0;
    for (const [, times] of channelSlots) {
      times.sort((a, b) => a - b);
      for (let i = 1; i < times.length; i++) {
        if ((times[i] - times[i - 1]) < 0.2) rapidFire++;
      }
    }
    if (sp.pyroCues.length > 0) {
      checks.push(check(
        'timing-rapid-fire', 'Timing: no rapid-fire conflicts (<200ms)', rapidFire === 0, 'error',
        rapidFire === 0 ? 'No rapid-fire conflicts' : `${rapidFire} conflict(s) on same module:channel`,
      ));
    }

    return checks;
  }
}

export const verificationPass = new VerificationPass();
