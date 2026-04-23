/**
 * Health Persistence Service
 * Persists cluster health snapshots and incidents to the database every 30s.
 */

import { supabase } from '@/integrations/supabase/client';
import { clusterHealthService } from './ClusterHealthService';

const PERSIST_INTERVAL_MS = 30_000;
const MAX_PERSISTED_IDS = 500;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function normalizeTelemetryProjectId(projectId: string | null | undefined): string | null {
  const value = projectId?.trim();
  return value && UUID_RE.test(value) ? value : null;
}

class HealthPersistenceService {
  private timer: ReturnType<typeof setInterval> | null = null;
  private projectId: string | null = null;
  private lastPersistedIds = new Set<string>();

  start(projectId: string | null | undefined) {
    this.stop();
    this.setProjectId(projectId);

    // Seed known incident IDs to avoid re-persisting old ones.
    for (const inc of clusterHealthService.getIncidents()) {
      this.lastPersistedIds.add(inc.id);
    }

    this.timer = setInterval(() => this.flush(), PERSIST_INTERVAL_MS);
    console.log(`[HealthPersistence] Started - interval 30s${this.projectId ? '' : ' (waiting for app project id)'}`);
    if (this.projectId) void this.flush();
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  setProjectId(projectId: string | null | undefined) {
    const nextProjectId = normalizeTelemetryProjectId(projectId);
    if (this.projectId === nextProjectId) return;

    this.projectId = nextProjectId;
    if (!nextProjectId) {
      console.warn('[HealthPersistence] No valid app project id; health telemetry persistence is paused');
      return;
    }

    console.log(`[HealthPersistence] Using app project id ${nextProjectId}`);
    if (this.timer) void this.flush();
  }

  private async flush() {
    try {
      const projectId = this.projectId;
      if (!projectId) return;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const userId = session.user.id;
      const snap = clusterHealthService.getSnapshot();

      const { error: snapshotError } = await supabase.from('health_snapshots').insert({
        project_id: projectId,
        user_id: userId,
        global_score: snap.globalScore,
        global_level: snap.globalLevel,
        subsystem_scores: Object.fromEntries(
          snap.subsystems.map(s => [s.id, { score: s.score, level: s.level }])
        ),
        active_incidents: snap.activeIncidents,
        uptime_ms: snap.uptime,
      });
      if (snapshotError) throw snapshotError;

      const allIncidents = clusterHealthService.getIncidents();
      const newIncidents = allIncidents.filter(i => !this.lastPersistedIds.has(i.id));

      if (newIncidents.length > 0) {
        const rows = newIncidents.map(i => ({
          project_id: projectId,
          user_id: userId,
          incident_id: i.id,
          severity: i.severity,
          subsystem: i.subsystem,
          message: i.message,
          resolved: i.resolved,
          incident_at: new Date(i.timestamp).toISOString(),
          resolved_at: i.resolvedAt ? new Date(i.resolvedAt).toISOString() : null,
        }));

        const { error: incidentsError } = await supabase.from('health_incidents').insert(rows);
        if (incidentsError) throw incidentsError;

        for (const i of newIncidents) {
          this.lastPersistedIds.add(i.id);
        }

        if (this.lastPersistedIds.size > MAX_PERSISTED_IDS) {
          const arr = Array.from(this.lastPersistedIds);
          this.lastPersistedIds = new Set(arr.slice(-MAX_PERSISTED_IDS));
        }
      }
    } catch (e) {
      console.warn('[HealthPersistence] Flush error:', e);
    }
  }
}

export const healthPersistenceService = new HealthPersistenceService();
