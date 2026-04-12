/**
 * ─── VerificationEngine — Centralized ShowPlan Validation ───────────
 * Single entry point for all verification checks.
 * Consumes ShowPlan + Safety + Hardware state.
 * Returns VerificationResult with categorized issues.
 */

import { showPlanManager } from '@/core/showplan/ShowPlanManager';
import { safetyStateMachine } from '@/core/safety/SafetyStateMachine';
import { continuityCheckService } from '@/core/safety/ContinuityCheckService';
import { blackbox } from '@/core/reliability/blackBoxRecorder';
import type { ShowPlan } from '@/core/showplan/ShowPlan';
import type { VerificationIssue, VerificationResult, VerificationStatus, IssueSeverity } from './types';

function issue(
  id: string, label: string, passed: boolean,
  severity: IssueSeverity, detail: string,
  category: VerificationIssue['category'],
): VerificationIssue {
  return { id, label, passed, severity, detail, category };
}

class VerificationEngine {
  /** Run full verification suite against current ShowPlan. */
  run(plan?: ShowPlan): VerificationResult {
    const sp = plan ?? showPlanManager.current;
    const issues: VerificationIssue[] = [];

    issues.push(...this.checkMetadata(sp));
    issues.push(...this.checkIntegrity(sp));
    issues.push(...this.checkPyro(sp));
    issues.push(...this.checkDMX(sp));
    issues.push(...this.checkDrone(sp));
    issues.push(...this.checkTiming(sp));
    issues.push(...this.checkSafety(sp));
    issues.push(...this.checkHardware(sp));

    const errors = issues.filter(i => !i.passed && i.severity === 'error').length;
    const warnings = issues.filter(i => !i.passed && i.severity === 'warning').length;
    const passed = issues.filter(i => i.passed).length;
    const hasContent = sp.pyroCues.length > 0 || sp.dmxCues.length > 0 || sp.dronePaths.length > 0;

    let level: VerificationStatus;
    if (errors > 0 || !hasContent) {
      level = 'BLOCKED';
    } else if (warnings > 0) {
      level = sp.hardwareConfig.modules.length > 0 ? 'READY_FOR_EXPORT' : 'READY_FOR_SIMULATION';
    } else {
      level = 'READY_FOR_FIELD';
    }

    const result: VerificationResult = {
      level,
      issues,
      timestamp: Date.now(),
      summary: { total: issues.length, passed, errors, warnings },
    };

    blackbox.record('state', `VerificationEngine: ${level} (${passed}/${issues.length} passed, ${errors}E ${warnings}W)`);
    return result;
  }

  /** Quick check: can we export? */
  canExport(plan?: ShowPlan): boolean {
    const r = this.run(plan);
    return r.level === 'READY_FOR_EXPORT' || r.level === 'READY_FOR_FIELD';
  }

  // ── Metadata ──────────────────────────────────────────────────
  private checkMetadata(sp: ShowPlan): VerificationIssue[] {
    const out: VerificationIssue[] = [];
    const cat = 'metadata' as const;

    const hasName = sp.metadata.name.trim().length > 0 && sp.metadata.name !== 'Untitled Show';
    out.push(issue('meta-name', 'Show name defined', hasName, 'warning', hasName ? `"${sp.metadata.name}"` : 'Default or empty name', cat));

    const hasVenue = sp.metadata.venue.trim().length > 0;
    out.push(issue('meta-venue', 'Venue defined', hasVenue, 'info', hasVenue ? sp.metadata.venue : 'No venue', cat));

    out.push(issue('meta-duration', 'Duration > 0', sp.metadata.duration > 0, 'warning',
      sp.metadata.duration > 0 ? `${sp.metadata.duration.toFixed(1)}s` : 'Zero duration', cat));

    out.push(issue('meta-author', 'Author defined', (sp.metadata.author?.trim().length ?? 0) > 0, 'info',
      sp.metadata.author || 'No author', cat));

    const hasExportProfiles = sp.exportProfiles.length > 0;
    out.push(issue('meta-export-profiles', 'Export profiles present', hasExportProfiles, 'warning',
      hasExportProfiles ? `${sp.exportProfiles.length} profile(s)` : 'No export profiles', cat));

    return out;
  }

  // ── Integrity ─────────────────────────────────────────────────
  private checkIntegrity(sp: ShowPlan): VerificationIssue[] {
    const out: VerificationIssue[] = [];
    const cat = 'integrity' as const;

    const hasContent = sp.pyroCues.length > 0 || sp.dmxCues.length > 0 || sp.dronePaths.length > 0;
    out.push(issue('int-has-content', 'Show has content', hasContent, 'warning',
      hasContent ? `${sp.pyroCues.length} pyro + ${sp.dmxCues.length} DMX + ${sp.dronePaths.length} drone` : 'Empty show', cat));

    // Cues with missing IDs
    const noIdPyro = sp.pyroCues.filter(c => !c.id || c.id.trim() === '');
    const noIdDmx = sp.dmxCues.filter(c => !c.id || c.id.trim() === '');
    const totalNoId = noIdPyro.length + noIdDmx.length;
    out.push(issue('int-cue-ids', 'All cues have IDs', totalNoId === 0, 'error',
      totalNoId === 0 ? 'All cues identified' : `${totalNoId} cue(s) missing ID`, cat));

    // Orphan pyro cues (no matching position)
    const posIds = new Set(sp.positions.map(p => p.id));
    const orphans = sp.pyroCues.filter(c => !posIds.has(c.positionId));
    out.push(issue('int-orphan-cues', 'Pyro cues have valid positions', orphans.length === 0, 'error',
      orphans.length === 0 ? 'All cues mapped' : `${orphans.length} orphan cue(s)`, cat));

    // Safety constraints present
    const hasSafety = sp.safetyConstraints.nfpaMinDistance > 0;
    out.push(issue('int-safety', 'Safety constraints defined', hasSafety, 'warning',
      `NFPA min: ${sp.safetyConstraints.nfpaMinDistance}m`, cat));

    return out;
  }

  // ── Pyro ──────────────────────────────────────────────────────
  private checkPyro(sp: ShowPlan): VerificationIssue[] {
    if (sp.pyroCues.length === 0) return [];
    const out: VerificationIssue[] = [];
    const cat = 'pyro' as const;

    const negTimes = sp.pyroCues.filter(c => c.time < 0);
    out.push(issue('pyro-neg-time', 'No negative times', negTimes.length === 0, 'error',
      negTimes.length === 0 ? 'OK' : `${negTimes.length} negative`, cat));

    const noTime = sp.pyroCues.filter(c => c.time === undefined || c.time === null);
    out.push(issue('pyro-has-time', 'All cues have time', noTime.length === 0, 'error',
      noTime.length === 0 ? 'OK' : `${noTime.length} missing time`, cat));

    const badCh = sp.pyroCues.filter(c => c.channel < 0 || c.channel > 31);
    out.push(issue('pyro-channel', 'Channels 0–31', badCh.length === 0, 'error',
      badCh.length === 0 ? 'OK' : `${badCh.length} out of range`, cat));

    const noModule = sp.pyroCues.filter(c => c.module === undefined || c.module === null || c.module < 0);
    out.push(issue('pyro-module', 'Valid module assignment', noModule.length === 0, 'error',
      noModule.length === 0 ? 'OK' : `${noModule.length} missing/invalid module`, cat));

    const badCal = sp.pyroCues.filter(c => c.caliber <= 0 || c.caliber > 999);
    out.push(issue('pyro-caliber', 'Caliber 1–999mm', badCal.length === 0, 'error',
      badCal.length === 0 ? 'OK' : `${badCal.length} invalid`, cat));

    const badElev = sp.pyroCues.filter(c => c.elevation < 0 || c.elevation > 360);
    out.push(issue('pyro-elevation', 'Elevation 0–360°', badElev.length === 0, 'warning',
      badElev.length === 0 ? 'OK' : `${badElev.length} out of range`, cat));

    const noEffect = sp.pyroCues.filter(c => !c.effectId || c.effectId.trim() === '');
    out.push(issue('pyro-effect', 'All have effectId', noEffect.length === 0, 'error',
      noEffect.length === 0 ? 'OK' : `${noEffect.length} missing`, cat));

    const overCal = sp.pyroCues.filter(c => c.caliber > sp.safetyConstraints.maxCaliper);
    out.push(issue('pyro-max-cal', `Caliber ≤ ${sp.safetyConstraints.maxCaliper}mm`, overCal.length === 0, 'error',
      overCal.length === 0 ? 'OK' : `${overCal.length} exceed limit`, cat));

    return out;
  }

  // ── DMX ───────────────────────────────────────────────────────
  private checkDMX(sp: ShowPlan): VerificationIssue[] {
    if (sp.dmxCues.length === 0) return [];
    const out: VerificationIssue[] = [];
    const cat = 'dmx' as const;

    const badUni = sp.dmxCues.filter(c => c.universe < 1 || c.universe > 32767);
    out.push(issue('dmx-universe', 'Universe 1–32767', badUni.length === 0, 'error',
      badUni.length === 0 ? 'OK' : `${badUni.length} invalid`, cat));

    const badCh = sp.dmxCues.filter(c => c.channel < 1 || c.channel > 512);
    out.push(issue('dmx-channel', 'Channel 1–512', badCh.length === 0, 'error',
      badCh.length === 0 ? 'OK' : `${badCh.length} invalid`, cat));

    const badVal = sp.dmxCues.filter(c => c.value < 0 || c.value > 255);
    out.push(issue('dmx-value', 'Value 0–255', badVal.length === 0, 'error',
      badVal.length === 0 ? 'OK' : `${badVal.length} out of range`, cat));

    const badDur = sp.dmxCues.filter(c => c.duration <= 0);
    out.push(issue('dmx-duration', 'Duration > 0', badDur.length === 0, 'warning',
      badDur.length === 0 ? 'OK' : `${badDur.length} zero/negative`, cat));

    const negTime = sp.dmxCues.filter(c => c.time < 0);
    out.push(issue('dmx-neg-time', 'No negative times', negTime.length === 0, 'error',
      negTime.length === 0 ? 'OK' : `${negTime.length} negative`, cat));

    return out;
  }

  // ── Drone ─────────────────────────────────────────────────────
  private checkDrone(sp: ShowPlan): VerificationIssue[] {
    if (sp.dronePaths.length === 0) return [];
    const out: VerificationIssue[] = [];
    const cat = 'drone' as const;

    const empty = sp.dronePaths.filter(p => p.waypoints.length === 0);
    out.push(issue('drone-empty', 'No empty paths', empty.length === 0, 'error',
      empty.length === 0 ? 'OK' : `${empty.length} empty path(s)`, cat));

    let unordered = 0;
    for (const p of sp.dronePaths) {
      for (let i = 1; i < p.waypoints.length; i++) {
        if (p.waypoints[i].time < p.waypoints[i - 1].time) { unordered++; break; }
      }
    }
    out.push(issue('drone-order', 'Waypoints time-ordered', unordered === 0, 'error',
      unordered === 0 ? 'OK' : `${unordered} unordered path(s)`, cat));

    let badSpeed = 0;
    for (const p of sp.dronePaths) for (const w of p.waypoints) if (w.speed < 0 || w.speed > 30) badSpeed++;
    out.push(issue('drone-speed', 'Speed 0–30 m/s', badSpeed === 0, 'warning',
      badSpeed === 0 ? 'OK' : `${badSpeed} out of range`, cat));

    let underground = 0;
    for (const p of sp.dronePaths) for (const w of p.waypoints) if (w.position.y < -10) underground++;
    out.push(issue('drone-altitude', 'No underground waypoints', underground === 0, 'warning',
      underground === 0 ? 'OK' : `${underground} below -10m`, cat));

    const posIds = new Set(sp.positions.map(p => p.id));
    const orphanPads = sp.dronePaths.filter(p => !posIds.has(p.padPositionId));
    out.push(issue('drone-pad-ref', 'Pad positions exist', orphanPads.length === 0, 'warning',
      orphanPads.length === 0 ? 'OK' : `${orphanPads.length} missing pad(s)`, cat));

    // Invalid waypoint IDs
    let noWpId = 0;
    for (const p of sp.dronePaths) for (const w of p.waypoints) if (!w.id) noWpId++;
    out.push(issue('drone-wp-ids', 'Waypoints have IDs', noWpId === 0, 'error',
      noWpId === 0 ? 'OK' : `${noWpId} missing`, cat));

    return out;
  }

  // ── Timing ────────────────────────────────────────────────────
  private checkTiming(sp: ShowPlan): VerificationIssue[] {
    const out: VerificationIssue[] = [];
    const cat = 'timing' as const;
    const dur = sp.metadata.duration;

    if (dur > 0) {
      const beyond = [
        ...sp.pyroCues.filter(c => c.time > dur),
        ...sp.dmxCues.filter(c => c.time > dur),
      ].length + sp.dronePaths.flatMap(p => p.waypoints).filter(w => w.time > dur).length;

      out.push(issue('timing-beyond', 'Events within duration', beyond === 0, 'warning',
        beyond === 0 ? `All within ${dur.toFixed(1)}s` : `${beyond} exceed ${dur.toFixed(1)}s`, cat));
    }

    // Rapid-fire (< 200ms on same module:channel)
    if (sp.pyroCues.length > 0) {
      const slots = new Map<string, number[]>();
      for (const c of sp.pyroCues) {
        const k = `${c.module}:${c.channel}`;
        if (!slots.has(k)) slots.set(k, []);
        slots.get(k)!.push(c.time);
      }
      let conflicts = 0;
      for (const [, times] of slots) {
        times.sort((a, b) => a - b);
        for (let i = 1; i < times.length; i++) if (times[i] - times[i - 1] < 0.2) conflicts++;
      }
      out.push(issue('timing-rapid', 'No rapid-fire (<200ms)', conflicts === 0, 'error',
        conflicts === 0 ? 'OK' : `${conflicts} conflict(s)`, cat));
    }

    // Channel conflicts (< 500ms on same module:channel)
    if (sp.pyroCues.length > 0) {
      const chMap = new Map<string, number[]>();
      for (const c of sp.pyroCues) {
        const k = `${c.module}:${c.channel}`;
        if (!chMap.has(k)) chMap.set(k, []);
        chMap.get(k)!.push(c.time);
      }
      let chConflicts = 0;
      for (const [, times] of chMap) {
        if (times.length <= 1) continue;
        times.sort((a, b) => a - b);
        for (let i = 1; i < times.length; i++) if (times[i] - times[i - 1] < 0.5) chConflicts++;
      }
      out.push(issue('timing-ch-conflict', 'No channel conflicts (<500ms)', chConflicts === 0, 'error',
        chConflicts === 0 ? 'OK' : `${chConflicts} conflict(s)`, cat));
    }

    return out;
  }

  // ── Safety ────────────────────────────────────────────────────
  private checkSafety(sp: ShowPlan): VerificationIssue[] {
    const out: VerificationIssue[] = [];
    const cat = 'safety' as const;

    const state = safetyStateMachine.state;
    const safetyOk = state !== 'SAFE';
    out.push(issue('safety-interlock', 'Safety interlock OK', safetyOk, 'error',
      safetyOk ? `State: ${state}` : 'E-STOP active — reset required', cat));

    if (sp.safetyConstraints.requireContinuityCheck) {
      const report = continuityCheckService.getReport();
      const ok = report.short === 0 && report.unknown === 0;
      out.push(issue('safety-continuity', 'Continuity check', ok,
        report.short > 0 ? 'error' : 'warning',
        `OK:${report.ok} Open:${report.open} Short:${report.short} Unk:${report.unknown}`, cat));
    }

    if (sp.pyroCues.length > 0) {
      const hasGeo = sp.safetyConstraints.geofenceZones.length > 0;
      out.push(issue('safety-geofence', 'Geofence zones', hasGeo, 'warning',
        hasGeo ? `${sp.safetyConstraints.geofenceZones.length} zone(s)` : 'No geofence zones', cat));
    }

    out.push(issue('safety-nfpa', 'NFPA distance ≥ 30m', sp.safetyConstraints.nfpaMinDistance >= 30, 'warning',
      `${sp.safetyConstraints.nfpaMinDistance}m`, cat));

    return out;
  }

  // ── Hardware ──────────────────────────────────────────────────
  private checkHardware(sp: ShowPlan): VerificationIssue[] {
    const out: VerificationIssue[] = [];
    const cat = 'hardware' as const;

    const hasHw = sp.hardwareConfig.modules.length > 0;
    out.push(issue('hw-modules', 'Hardware modules', hasHw, 'warning',
      hasHw ? `${sp.hardwareConfig.modules.length} module(s)` : 'No modules', cat));

    // Module channel limits
    if (sp.pyroCues.length > 0) {
      const modCh = new Map<number, Set<number>>();
      for (const c of sp.pyroCues) {
        if (!modCh.has(c.module)) modCh.set(c.module, new Set());
        modCh.get(c.module)!.add(c.channel);
      }
      let over = 0;
      for (const [, chs] of modCh) if (chs.size > 32) over++;
      out.push(issue('hw-ch-limit', 'Modules ≤ 32 channels', over === 0, 'error',
        over === 0 ? 'OK' : `${over} module(s) over limit`, cat));
    }

    return out;
  }
}

export const verificationEngine = new VerificationEngine();
