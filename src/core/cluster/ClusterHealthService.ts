/**
 * ─── Cluster Health Service ─────────────────────────────────────────
 * Aggregates health from all registered HealthReporters via ServiceRegistry
 * into a unified global health score with incident history.
 */

import { serviceRegistry } from './ServiceRegistry';

// Re-export types from shared module
export type { HealthLevel, SubsystemHealth } from './healthTypes';
import type { SubsystemHealth, HealthLevel } from './healthTypes';

export interface Incident {
  id: string;
  timestamp: number;
  subsystem: string;
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
  private alertCounts = new Map<string, number>();
  private listeners: Array<() => void> = [];
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.start();
  }

  private start() {
    this.pollTimer = setInterval(() => this.tick(), 500);
  }

  private tick() {
    // Detect new alerts from each registered reporter
    for (const reporter of serviceRegistry.getAll()) {
      const prev = this.alertCounts.get(reporter.id) ?? 0;
      const curr = reporter.getAlertCount();
      if (curr > prev) {
        const health = reporter.getHealth();
        this.addIncident(
          reporter.id,
          health.score < 30 ? 'critical' : 'warning',
          `${reporter.label}: ${health.details}`
        );
      }
      this.alertCounts.set(reporter.id, curr);
    }

    this.notify();
  }

  private addIncident(subsystem: string, severity: 'warning' | 'critical', message: string) {
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

  // ── Public API ────────────────────────────────────────────────────

  getSnapshot(): ClusterSnapshot {
    const reporters = serviceRegistry.getAll();
    const subsystems = reporters.map(r => r.getHealth());

    const totalWeight = reporters.reduce((s, r) => s + r.weight, 0) || 1;
    const globalScore = Math.round(
      reporters.reduce((sum, r, i) => sum + subsystems[i].score * r.weight, 0) / totalWeight
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

  reportBootFailure(subsystem: string, error: string) {
    this.addIncident(subsystem, 'critical', `Boot failure: ${error}`);
    this.notify();
  }

  reportRecovery(subsystem: string, message: string) {
    // Auto-resolve most recent unresolved incident for this subsystem
    for (let i = this.incidents.length - 1; i >= 0; i--) {
      if (this.incidents[i].subsystem === subsystem && !this.incidents[i].resolved) {
        this.incidents[i].resolved = true;
        this.incidents[i].resolvedAt = Date.now();
        break;
      }
    }
    this.addIncident(subsystem, 'warning', `Recovery: ${message}`);
    this.notify();
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
