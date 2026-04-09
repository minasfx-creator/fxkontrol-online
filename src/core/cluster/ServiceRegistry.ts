/**
 * ─── Service Registry ───────────────────────────────────────────────
 * Centralised registry of HealthReporters.
 * Services register themselves; ClusterHealthService queries the registry.
 */

import type { SubsystemHealth } from './ClusterHealthService';

export interface HealthReporter {
  id: string;
  label: string;
  weight: number; // 0–1
  getHealth(): SubsystemHealth;
  getAlertCount(): number;
}

class ServiceRegistry {
  private reporters = new Map<string, HealthReporter>();

  register(reporter: HealthReporter): () => void {
    this.reporters.set(reporter.id, reporter);
    return () => { this.reporters.delete(reporter.id); };
  }

  getAll(): HealthReporter[] {
    return Array.from(this.reporters.values());
  }

  get(id: string): HealthReporter | null {
    return this.reporters.get(id) ?? null;
  }
}

export const serviceRegistry = new ServiceRegistry();
