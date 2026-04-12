/**
 * ─── Hardware Health Monitor ───────────────────────────────────────
 * Aggregated weighted health scoring with threshold alerts.
 * Weights: Safety 40%, Hardware 30%, Network 30%.
 * Logs state transitions to DeviceEventLog.
 */

import { unifiedHardwareRegistry } from './UnifiedHardwareRegistry';
import { readinessEvaluator } from './ReadinessEvaluator';
import { deviceEventLog } from './DeviceEventLog';

export type HealthLevel = 'HEALTHY' | 'DEGRADED' | 'CRITICAL';

export interface HealthReport {
  overallScore: number;
  level: HealthLevel;
  safetyScore: number;
  hardwareScore: number;
  networkScore: number;
  deviceCount: number;
  onlineCount: number;
  timestamp: number;
}

const THRESHOLDS = { HEALTHY: 70, DEGRADED: 40 };

class HardwareHealthMonitor {
  private _lastLevel: HealthLevel = 'HEALTHY';
  private _listeners = new Set<(report: HealthReport) => void>();

  evaluate(): HealthReport {
    const health = unifiedHardwareRegistry.getSystemHealth();
    const readiness = readinessEvaluator.evaluate();

    // Safety score: based on readiness + blocking issues
    const safetyErrors = readiness.issues.filter(i => i.severity === 'error').length;
    const safetyScore = Math.max(0, 100 - safetyErrors * 25);

    // Hardware score: based on online ratio + error count
    const hwRatio = health.total > 0 ? health.online / health.total : 0;
    const hardwareScore = Math.max(0, Math.round(hwRatio * 100 - health.errors * 15));

    // Network score: from Art-Net/DMX adapters
    const snapshots = unifiedHardwareRegistry.getSnapshots();
    const networkAdapters = snapshots.filter(s =>
      s.device_id.includes('artnet') || s.device_id.includes('dmx')
    );
    const networkOnline = networkAdapters.filter(s => s.online).length;
    const networkTotal = Math.max(networkAdapters.length, 1);
    const networkScore = Math.round((networkOnline / networkTotal) * 100);

    // Weighted
    const overallScore = Math.round(
      safetyScore * 0.4 + hardwareScore * 0.3 + networkScore * 0.3
    );

    const level: HealthLevel =
      overallScore >= THRESHOLDS.HEALTHY ? 'HEALTHY' :
      overallScore >= THRESHOLDS.DEGRADED ? 'DEGRADED' : 'CRITICAL';

    // Log transitions
    if (level !== this._lastLevel) {
      deviceEventLog.log('system', 'state_change',
        `Health level: ${this._lastLevel} → ${level} (score: ${overallScore})`);
      this._lastLevel = level;
    }

    const report: HealthReport = {
      overallScore, level, safetyScore, hardwareScore, networkScore,
      deviceCount: health.total, onlineCount: health.online,
      timestamp: Date.now(),
    };

    for (const fn of this._listeners) fn(report);
    return report;
  }

  onChange(fn: (report: HealthReport) => void): () => void {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }
}

export const hardwareHealthMonitor = new HardwareHealthMonitor();
