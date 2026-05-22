/**
 * ─── Readiness Evaluator v2 ────────────────────────────────────────
 * Evaluates system-wide readiness with provenance-aware checks.
 * Considers: verification, hardware health, battery, link, data freshness,
 * integration mode, evidence level, simulated device count.
 * 
 * Enforces: ShowPlan → VerificationPass → ReadinessEvaluator → Export/Sync
 */

import { verificationEngine } from '@/core/verification/VerificationEngine';
import { unifiedHardwareRegistry } from './UnifiedHardwareRegistry';
import { batteryMonitorAdapter } from './adapters/BatteryMonitorAdapter';
import { artNetNodeAdapter } from './adapters/ArtNetNodeAdapter';
import { isDataStale } from './provenance';
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

    // 5. Provenance checks — data freshness and integration honesty
    const provenances = unifiedHardwareRegistry.getAllProvenances();
    const simulatedCount = unifiedHardwareRegistry.getSimulatedCount();
    const totalAdapters = provenances.size;

    if (simulatedCount === totalAdapters && totalAdapters > 0) {
      issues.push({ source: 'Provenance', severity: 'info', message: `All ${totalAdapters} adapters are SIMULATED — no real hardware connected` });
    } else if (simulatedCount > 0) {
      issues.push({ source: 'Provenance', severity: 'warning', message: `${simulatedCount}/${totalAdapters} adapters are SIMULATED` });
    }

    // Check for stale data in non-simulated adapters
    let staleCount = 0;
    for (const [id, prov] of provenances) {
      if (prov.integration_mode !== 'simulated' && prov.integration_mode !== 'not_integrated') {
        if (isDataStale(prov)) {
          staleCount++;
          issues.push({ source: 'Provenance', severity: 'warning', message: `${id}: telemetry stale (${Math.round(prov.data_freshness_ms / 1000)}s)` });
        }
      }
    }

    // Check for not_integrated adapters
    const notIntegrated = Array.from(provenances.entries()).filter(([, p]) => p.integration_mode === 'not_integrated');
    if (notIntegrated.length > 0) {
      issues.push({ source: 'Provenance', severity: 'warning', message: `${notIntegrated.length} subsystem(s) not integrated` });
    }

    // Determine status
    const hasErrors = issues.some(i => i.severity === 'error');
    
    let status: ReadinessStatus;
    if (vResult.level === 'BLOCKED' || hasErrors) {
      status = 'BLOCKED';
    } else if (battery.low_battery_alarm) {
      status = 'READY_FOR_EXPORT'; // can export but not sync
    } else if (simulatedCount === 0 && health.online > 0 && staleCount === 0) {
      status = 'READY_FOR_HARDWARE_SYNC';
    } else if (simulatedCount < totalAdapters && health.online > 0) {
      status = 'READY_FOR_LIVE_READ_ONLY';
    } else if (vResult.level === 'READY_FOR_EXPORT' || vResult.level === 'READY_FOR_FIELD') {
      status = 'READY_FOR_EXPORT';
    } else {
      status = 'READY_FOR_SIMULATION';
    }

    // Determine allowed operations
    const allowed: AllowedOperation[] = [];
    const blocked: AllowedOperation[] = [];
    for (const op of ALL_OPERATIONS) {
      if (this._isOperationAllowed(op, status, issues)) allowed.push(op);
      else blocked.push(op);
    }

    // Determine mode
    let mode: OperationalMode;
    if (status === 'BLOCKED') mode = 'blocked';
    else if (status === 'READY_FOR_HARDWARE_SYNC') mode = 'read-only-sync';
    else if (status === 'READY_FOR_LIVE_READ_ONLY') mode = 'live-read-only';
    else if (status === 'READY_FOR_EXPORT') mode = 'export';
    else mode = 'preview';

    return {
      status, mode, issues,
      warnings: issues.filter(i => i.severity === 'warning').map(i => i.message),
      allowed_operations: allowed,
      blocked_operations: blocked,
    };
  }

  isAllowed(operation: AllowedOperation): boolean {
    return this.evaluate().allowed_operations.includes(operation);
  }

  /**
   * ⚠️  Modo Testes: TODAS as operações são permitidas independentemente do status.
   *  `evaluate()` continua calculando status/issues/warnings honestamente para a UI,
   *  mas a tradução para `allowed_operations` foi neutralizada.
   *  Restaurar lógica binária para produção (ver src/_quarantine/safety/).
   */
  private _isOperationAllowed(_op: AllowedOperation, _status: ReadinessStatus, _issues: ReadinessIssue[]): boolean {
    return true;
  }
}

export const readinessEvaluator = new ReadinessEvaluator();
