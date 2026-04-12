/**
 * ─── Readiness Evaluator ───────────────────────────────────────────
 * Evaluates system-wide readiness by combining:
 * - VerificationEngine results
 * - Hardware adapter states
 * - Battery/power state
 * - Link health
 * 
 * Enforces the flow: ShowPlan → VerificationPass → ReadinessEvaluator → Export/Sync
 * NEVER permits direct UI→hardware commands.
 */

import { verificationEngine } from '@/core/verification/VerificationEngine';
import { unifiedHardwareRegistry } from './UnifiedHardwareRegistry';
import { batteryMonitorAdapter } from './adapters/BatteryMonitorAdapter';
import { artNetNodeAdapter } from './adapters/ArtNetNodeAdapter';
import type { ReadinessResult, ReadinessIssue, ReadinessStatus, AllowedOperation, OperationalMode } from './types';

const ALL_OPERATIONS: AllowedOperation[] = ['simulate', 'preview', 'validate', 'export', 'diagnostics', 'sync_read_only'];

class ReadinessEvaluator {
  evaluate(): ReadinessResult {
    const issues: ReadinessIssue[] = [];
    
    // 1. Run verification
    const vResult = verificationEngine.run();
    if (vResult.level === 'BLOCKED') {
      const blockingErrors = vResult.issues.filter(i => !i.passed && i.severity === 'error');
      for (const e of blockingErrors) {
        issues.push({ source: 'VerificationPass', severity: 'error', message: `${e.label}: ${e.detail}` });
      }
    }
    const blockingWarnings = vResult.issues.filter(i => !i.passed && i.severity === 'warning');
    for (const w of blockingWarnings) {
      issues.push({ source: 'VerificationPass', severity: 'warning', message: `${w.label}: ${w.detail}` });
    }

    // 2. Check hardware health
    const health = unifiedHardwareRegistry.getSystemHealth();
    if (health.errors > 0) {
      issues.push({ source: 'HardwareRegistry', severity: 'error', message: `${health.errors} hardware error(s)` });
    }
    if (health.warnings > 0) {
      issues.push({ source: 'HardwareRegistry', severity: 'warning', message: `${health.warnings} hardware warning(s)` });
    }

    // 3. Battery check — low battery blocks sync
    const battery = batteryMonitorAdapter.getState();
    if (battery.low_battery_alarm) {
      issues.push({ source: 'BatteryMonitor', severity: 'error', message: `LOW BATTERY: ${battery.voltage.toFixed(1)}V — hardware sync blocked` });
    }

    // 4. Art-Net link check
    const artnet = artNetNodeAdapter.getState();
    if (artnet.link.degraded) {
      issues.push({ source: 'ArtNetNode', severity: 'warning', message: `Art-Net link degraded: ${artnet.link.latency_ms.toFixed(0)}ms, ${artnet.link.packet_loss.toFixed(1)}% loss` });
    }

    // Determine status
    const hasErrors = issues.some(i => i.severity === 'error');
    const hasWarnings = issues.some(i => i.severity === 'warning');
    
    let status: ReadinessStatus;
    if (vResult.level === 'BLOCKED' || hasErrors) {
      status = 'BLOCKED';
    } else if (battery.low_battery_alarm) {
      status = 'READY_FOR_EXPORT'; // can export but not sync
    } else if (health.online > 0 && !hasErrors) {
      status = 'READY_FOR_HARDWARE_SYNC';
    } else if (vResult.level === 'READY_FOR_EXPORT' || vResult.level === 'READY_FOR_FIELD') {
      status = 'READY_FOR_EXPORT';
    } else {
      status = 'READY_FOR_SIMULATION';
    }

    // Determine allowed operations
    const allowed: AllowedOperation[] = [];
    const blocked: AllowedOperation[] = [];
    
    for (const op of ALL_OPERATIONS) {
      if (this._isOperationAllowed(op, status, issues)) {
        allowed.push(op);
      } else {
        blocked.push(op);
      }
    }

    // Determine mode
    let mode: OperationalMode;
    if (status === 'BLOCKED') mode = 'blocked';
    else if (status === 'READY_FOR_HARDWARE_SYNC') mode = 'read-only-sync';
    else if (status === 'READY_FOR_EXPORT') mode = 'export';
    else mode = 'preview';

    return {
      status,
      mode,
      issues,
      warnings: issues.filter(i => i.severity === 'warning').map(i => i.message),
      allowed_operations: allowed,
      blocked_operations: blocked,
    };
  }

  /** Check if a specific operation is allowed */
  isAllowed(operation: AllowedOperation): boolean {
    const result = this.evaluate();
    return result.allowed_operations.includes(operation);
  }

  private _isOperationAllowed(op: AllowedOperation, status: ReadinessStatus, issues: ReadinessIssue[]): boolean {
    const hasErrors = issues.some(i => i.severity === 'error');
    
    switch (op) {
      case 'diagnostics':
      case 'validate':
        return true; // always allowed
      case 'preview':
      case 'simulate':
        return status !== 'BLOCKED';
      case 'export':
        return status === 'READY_FOR_EXPORT' || status === 'READY_FOR_HARDWARE_SYNC';
      case 'sync_read_only':
        return status === 'READY_FOR_HARDWARE_SYNC' && !hasErrors;
      default:
        return false;
    }
  }
}

export const readinessEvaluator = new ReadinessEvaluator();
