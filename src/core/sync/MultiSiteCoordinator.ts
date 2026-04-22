/**
 * ─── Multi-Site Coordinator ─────────────────────────────────────────
 * Manages site presence via Supabase Realtime presence API.
 * Tracks connected sites, roles, latency, and sync status.
 */

import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface SiteInfo {
  siteId: string;
  name: string;
  status: 'synced' | 'degraded' | 'local' | 'disconnected';
  latencyMs: number;
  offsetMs: number;
  isHost: boolean;
  role: 'master' | 'slave';
  lastHeartbeat: number;
}

class MultiSiteCoordinator {
  private _channel: RealtimeChannel | null = null;
  private _sites = new Map<string, SiteInfo>();
  private _localSiteId = '';
  private _listeners: Array<() => void> = [];
  private _heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  /** Start coordination for a session */
  start(sessionCode: string, siteId: string, siteName: string, role: 'master' | 'slave'): void {
    if (this._channel) this.stop();
    this._localSiteId = siteId;

    this._channel = supabase.channel(`sites:${sessionCode}`);

    this._channel
      .on('presence', { event: 'sync' }, () => {
        this._syncPresence();
      })
      .on('presence', { event: 'join' }, () => {
        this._syncPresence();
      })
      .on('presence', { event: 'leave' }, () => {
        this._syncPresence();
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await this._channel?.track({
            siteId,
            name: siteName,
            role,
            heartbeat: Date.now(),
            pingTs: Date.now(),
          });
        }
      });

    // Periodic heartbeat
    this._heartbeatInterval = setInterval(() => {
      this._channel?.track({
        siteId,
        name: siteName,
        role,
        heartbeat: Date.now(),
        pingTs: Date.now(),
      });
    }, 3000);
  }

  stop(): void {
    if (this._heartbeatInterval) {
      clearInterval(this._heartbeatInterval);
      this._heartbeatInterval = null;
    }
    if (this._channel) {
      this._channel.unsubscribe();
      supabase.removeChannel(this._channel);
      this._channel = null;
    }
    this._sites.clear();
    this._notify();
  }

  getAllSites(): SiteInfo[] {
    return Array.from(this._sites.values());
  }

  isLocalMode(): boolean {
    return this._sites.size <= 1;
  }

  getMaster(): SiteInfo | undefined {
    return Array.from(this._sites.values()).find(s => s.role === 'master');
  }

  onStateChange(cb: () => void): () => void {
    this._listeners.push(cb);
    return () => {
      const idx = this._listeners.indexOf(cb);
      if (idx >= 0) this._listeners.splice(idx, 1);
    };
  }

  private _syncPresence(): void {
    const state = this._channel?.presenceState() ?? {};
    const now = Date.now();
    this._sites.clear();

    for (const key of Object.keys(state)) {
      const presences = state[key] as any[];
      for (const p of presences) {
        const hb = p.heartbeat ?? now;
        const age = now - hb;
        const latency = p.pingTs ? Math.round((now - p.pingTs) / 2) : 0;

        this._sites.set(p.siteId, {
          siteId: p.siteId,
          name: p.name ?? p.siteId,
          role: p.role ?? 'slave',
          isHost: p.role === 'master',
          latencyMs: latency,
          offsetMs: 0,
          lastHeartbeat: hb,
          status: age < 10000 ? 'synced' : age < 30000 ? 'degraded' : 'disconnected',
        });
      }
    }
    this._notify();
  }

  private _notify(): void {
    for (const cb of this._listeners) cb();
  }
}

export const multiSiteCoordinator = new MultiSiteCoordinator();
