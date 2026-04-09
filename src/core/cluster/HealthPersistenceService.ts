/**
 * ─── Health Persistence Service ─────────────────────────────────────
 * Persists cluster health snapshots and incidents to the database
 * every 30s for trend analysis and sparkline visualization.
 */

import { supabase } from '@/integrations/supabase/client';
import { clusterHealthService } from './ClusterHealthService';

const PERSIST_INTERVAL_MS = 30_000;

class HealthPersistenceService {
  private timer: ReturnType<typeof setInterval> | null = null;
  private projectId: string = '';
  private lastPersistedIds = new Set<string>();

  start(projectId: string) {
    this.projectId = projectId;
    this.stop();
    // Seed known incident IDs to avoid re-persisting old ones
    for (const inc of clusterHealthService.getIncidents()) {
      this.lastPersistedIds.add(inc.id);
    }
    this.timer = setInterval(() => this.flush(), PERSIST_INTERVAL_MS);
    console.log('[HealthPersistence] Started — interval 30s');
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async flush() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const userId = session.user.id;
      const snap = clusterHealthService.getSnapshot();

      // Persist snapshot
      await supabase.from('health_snapshots' as any).insert({
        project_id: this.projectId,
        user_id: userId,
        global_score: snap.globalScore,
        global_level: snap.globalLevel,
        subsystem_scores: Object.fromEntries(
          snap.subsystems.map(s => [s.id, { score: s.score, level: s.level }])
        ),
        active_incidents: snap.activeIncidents,
        uptime_ms: snap.uptime,
      });

      // Persist new incidents only
      const allIncidents = clusterHealthService.getIncidents();
      const newIncidents = allIncidents.filter(i => !this.lastPersistedIds.has(i.id));

      if (newIncidents.length > 0) {
        const rows = newIncidents.map(i => ({
          project_id: this.projectId,
          user_id: userId,
          incident_id: i.id,
          severity: i.severity,
          subsystem: i.subsystem,
          message: i.message,
          resolved: i.resolved,
          incident_at: new Date(i.timestamp).toISOString(),
          resolved_at: i.resolvedAt ? new Date(i.resolvedAt).toISOString() : null,
        }));

        await supabase.from('health_incidents' as any).insert(rows);

        for (const i of newIncidents) {
          this.lastPersistedIds.add(i.id);
        }
      }
    } catch (e) {
      console.warn('[HealthPersistence] Flush error:', e);
    }
  }
}

export const healthPersistenceService = new HealthPersistenceService();
