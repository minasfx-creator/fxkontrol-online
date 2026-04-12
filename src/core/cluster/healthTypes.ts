/**
 * Shared health types — extracted to break circular dependency
 * between ClusterHealthService ↔ ServiceRegistry.
 */

export type HealthLevel = 'healthy' | 'degraded' | 'critical' | 'offline';

export interface SubsystemHealth {
  id: string;
  label: string;
  level: HealthLevel;
  score: number;        // 0–100
  details: string;
  lastUpdate: number;
  metrics: Record<string, string | number>;
}
