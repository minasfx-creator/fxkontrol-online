/**
 * ─── Service Registry ───────────────────────────────────────────────
 * Centralised registry of HealthReporters with dependency graph.
 * Services register themselves; ClusterHealthService queries the registry.
 */

import type { SubsystemHealth } from './healthTypes';

export interface HealthReporter {
  id: string;
  label: string;
  weight: number; // 0–1
  dependsOn?: string[]; // IDs of upstream dependencies
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

  /** Returns services that depend on the given id */
  getDependents(id: string): HealthReporter[] {
    return this.getAll().filter(r => r.dependsOn?.includes(id));
  }

  /** Returns the dependencies of a given service */
  getDependencies(id: string): HealthReporter[] {
    const reporter = this.reporters.get(id);
    if (!reporter?.dependsOn) return [];
    return reporter.dependsOn
      .map(depId => this.reporters.get(depId))
      .filter((r): r is HealthReporter => r != null);
  }

  /** Full dependency graph: serviceId → dependsOn[] */
  getDependencyGraph(): Map<string, string[]> {
    const graph = new Map<string, string[]>();
    for (const r of this.reporters.values()) {
      graph.set(r.id, r.dependsOn ?? []);
    }
    return graph;
  }
}

export const serviceRegistry = new ServiceRegistry();
