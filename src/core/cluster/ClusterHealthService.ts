/**
 * ─── Cluster Health Service ─────────────────────────────────────────
 * Aggregates health from safety, performance, and network subsystems
 * into a unified global health score with incident history.
 */

import { safetyStateMachine } from '@/core/safety/SafetyStateMachine';
import { safetyAuditTrail } from '@/core/safety/SafetyAuditTrail';
import { getFrameHistory, getActiveAlerts as getPerfAlerts } from '@/core/performance/PerformanceProfilerService';
import { networkHealthService } from '@/core/network/NetworkHealthService';
import { fieldBus } from '@/core/reliability';

// ── Types ────────────────────────────────────────────────────────────

export type SubsystemId = 'safety' | 'performance' | 'network';
export type HealthLevel = 'healthy' | 'degraded' | 'critical' | 'offline';

export interface SubsystemHealth {
  id: SubsystemId;
  label: string;
  level: HealthLevel;
  score: number;        // 0–100
  details: string;
  lastUpdate: number;
  metrics: Record<string, string | number>;
}

export interface Incident {
  id: string;
  timestamp: number;
  subsystem: SubsystemId;
  severity: 'warning' | 'critical';
  message: string;
  resolved: boolean;
  resolvedAt?: number;
}

export interface ClusterSnapshot {
  globalScore: number;        // 0–100 weighted avg
  globalLevel: HealthLevel;
  subsystems: SubsystemHealth[];
  activeIncidents: number;
  totalIncidents: number;
  uptime: number;             // ms since boot
}

// ── Ring buffer for incidents ────────────────────────────────────────

const MAX_INCIDENTS = 200;

class ClusterHealthService {
  private incidents: Incident[] = [];
  private bootTime = Date.now();
  private lastSafetyState = '';
  private lastPerfAlertCount = 0;
  private lastNetAlertCount = 0;
  private listeners: Array<() => void> = [];
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.start();
  }

  private start() {
    // Poll subsystems at 2Hz
    this.pollTimer = setInterval(() => this.tick(), 500);
  }

  private tick() {
    // Detect safety state changes → incidents
    const safetyState = safetyStateMachine.state;
    if (safetyState !== this.lastSafetyState) {
      if (safetyState === 'EMERGENCY') {
        this.addIncident('safety', 'critical', `Safety entered EMERGENCY state`);
      } else if (this.lastSafetyState === 'EMERGENCY') {
        this.resolveSubsystemIncidents('safety');
      }
      this.lastSafetyState = safetyState;
    }

    // Detect performance alerts
    const perfAlerts = getPerfAlerts();
    if (perfAlerts.length > this.lastPerfAlertCount) {
      const newest = perfAlerts[perfAlerts.length - 1];
      this.addIncident('performance',
        newest.type === 'PERF_CRITICAL' || newest.type === 'GPU_CRASH' ? 'critical' : 'warning',
        `${newest.type}: ${newest.message}`
      );
    }
    this.lastPerfAlertCount = perfAlerts.length;

    // Detect network alerts
    const netAlerts = networkHealthService.getActiveAlerts();
    if (netAlerts.length > this.lastNetAlertCount) {
      const newest = netAlerts[netAlerts.length - 1];
      this.addIncident('network',
        newest.type === 'NETWORK_DOWN' || newest.type === 'PACKET_LOSS_CRITICAL' ? 'critical' : 'warning',
        `${newest.type}: ${newest.message}`
      );
    }
    this.lastNetAlertCount = netAlerts.length;

    this.notify();
  }

  private addIncident(subsystem: SubsystemId, severity: 'warning' | 'critical', message: string) {
    const incident: Incident = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
      subsystem,
      severity,
      message,
      resolved: false,
    };
    this.incidents.push(incident);
    if (this.incidents.length > MAX_INCIDENTS) {
      this.incidents = this.incidents.slice(-MAX_INCIDENTS);
    }
  }

  private resolveSubsystemIncidents(subsystem: SubsystemId) {
    const now = Date.now();
    for (const inc of this.incidents) {
      if (inc.subsystem === subsystem && !inc.resolved) {
        inc.resolved = true;
        inc.resolvedAt = now;
      }
    }
  }

  // ── Subsystem health computation ──────────────────────────────────

  private getSafetyHealth(): SubsystemHealth {
    const state = safetyStateMachine.state;
    const conditions = safetyStateMachine.conditions;
    const auditEntries = safetyAuditTrail.getAll();
    const violations = auditEntries.filter(e => e.event === 'VIOLATION').length;

    let score = 100;
    let level: HealthLevel = 'healthy';

    if (state === 'EMERGENCY') { score = 0; level = 'critical'; }
    else if (violations > 5) { score = 40; level = 'degraded'; }
    else if (violations > 0) { score = 70; level = 'degraded'; }
    if (!conditions.linkStable) score -= 15;
    if (!conditions.validationPassed) score -= 10;

    score = Math.max(0, Math.min(100, score));
    if (score < 30) level = 'critical';
    else if (score < 70) level = 'degraded';

    return {
      id: 'safety', label: 'Safety', level, score,
      details: `State: ${state}, ${violations} violations`,
      lastUpdate: Date.now(),
      metrics: { state, violations, link: conditions.linkStable ? 'OK' : 'FAIL' },
    };
  }

  private getPerformanceHealth(): SubsystemHealth {
    const alerts = getPerfAlerts();
    const frames = getFrameHistory();
    const lastFrame = frames.length > 0 ? frames[frames.length - 1] : null;
    const fps = lastFrame ? Math.round(1000 / Math.max(1, lastFrame.frameTimeMs)) : 60;

    let score = 100;
    let level: HealthLevel = 'healthy';

    if (fps < 20) { score = 20; level = 'critical'; }
    else if (fps < 30) { score = 50; level = 'degraded'; }
    else if (fps < 50) { score = 75; level = 'degraded'; }

    alerts.forEach(a => {
      if (a.type === 'PERF_CRITICAL' || a.type === 'GPU_CRASH') score -= 30;
      else score -= 15;
    });

    score = Math.max(0, Math.min(100, score));
    if (score < 30) level = 'critical';
    else if (score < 70) level = 'degraded';

    return {
      id: 'performance', label: 'Performance', level, score,
      details: `${fps} FPS, ${alerts.length} alerts`,
      lastUpdate: Date.now(),
      metrics: { fps, alerts: alerts.length },
    };
  }

  private getNetworkHealth(): SubsystemHealth {
    const alerts = networkHealthService.getActiveAlerts();
    const lossPercent = networkHealthService.getPacketLossPercent();
    const rttHistory = networkHealthService.getRTTHistory();
    const currentRtt = rttHistory.length > 0 ? rttHistory[rttHistory.length - 1].rttMs : 0;
    const busState = fieldBus.getState();

    let score = 100;
    let level: HealthLevel = 'healthy';

    if (currentRtt > 200) score -= 40;
    else if (currentRtt > 100) score -= 20;
    if (lossPercent > 15) score -= 40;
    else if (lossPercent > 5) score -= 20;
    if (busState.failoverCount > 0) score -= 10;

    alerts.forEach(a => {
      if (a.type === 'NETWORK_DOWN') score -= 30;
      else score -= 10;
    });

    score = Math.max(0, Math.min(100, score));
    if (score < 30) level = 'critical';
    else if (score < 70) level = 'degraded';

    return {
      id: 'network', label: 'Network', level, score,
      details: `RTT ${currentRtt.toFixed(0)}ms, Loss ${lossPercent.toFixed(1)}%`,
      lastUpdate: Date.now(),
      metrics: { rtt: Math.round(currentRtt), loss: `${lossPercent.toFixed(1)}%`, failovers: busState.failoverCount },
    };
  }

  // ── Public API ────────────────────────────────────────────────────

  getSnapshot(): ClusterSnapshot {
    const subsystems = [
      this.getSafetyHealth(),
      this.getPerformanceHealth(),
      this.getNetworkHealth(),
    ];

    // Weighted average: safety 40%, performance 30%, network 30%
    const weights = [0.4, 0.3, 0.3];
    const globalScore = Math.round(
      subsystems.reduce((sum, s, i) => sum + s.score * weights[i], 0)
    );

    const globalLevel: HealthLevel =
      globalScore >= 80 ? 'healthy' :
      globalScore >= 50 ? 'degraded' : 'critical';

    const activeIncidents = this.incidents.filter(i => !i.resolved).length;

    return {
      globalScore,
      globalLevel,
      subsystems,
      activeIncidents,
      totalIncidents: this.incidents.length,
      uptime: Date.now() - this.bootTime,
    };
  }

  getIncidents(): Incident[] {
    return [...this.incidents].reverse();
  }

  getActiveIncidents(): Incident[] {
    return this.incidents.filter(i => !i.resolved).reverse();
  }

  resolveIncident(id: string) {
    const inc = this.incidents.find(i => i.id === id);
    if (inc) { inc.resolved = true; inc.resolvedAt = Date.now(); }
  }

  onStateChange(cb: () => void): () => void {
    this.listeners.push(cb);
    return () => { this.listeners = this.listeners.filter(l => l !== cb); };
  }

  private notify() {
    this.listeners.forEach(cb => cb());
  }

  dispose() {
    if (this.pollTimer) clearInterval(this.pollTimer);
  }
}

export const clusterHealthService = new ClusterHealthService();
