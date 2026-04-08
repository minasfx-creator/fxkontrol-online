/**
 * ─── Command Relay ──────────────────────────────────────────────────
 * Bridges the local CommandBus to remote sites via Supabase Realtime
 * broadcast channel. Master relays mutation commands; slaves receive.
 * Echo-loop prevention via originSiteId tagging.
 */

import { supabase } from '@/integrations/supabase/client';
import { commandBus, type Command } from '@/core/command/CommandBus';
import type { RealtimeChannel } from '@supabase/supabase-js';

export type RelayRole = 'master' | 'slave';

/** Commands that only master can relay */
const MUTATION_TYPES = new Set<Command['type']>([
  'FIRE', 'ARM_SYSTEM', 'DISARM_SYSTEM', 'E_STOP', 'ROLLBACK',
]);

interface RelayState {
  connected: boolean;
  sessionCode: string;
  role: RelayRole;
  peerCount: number;
  latencyMs: number;
  siteId: string;
}

class CommandRelay {
  private _channel: RealtimeChannel | null = null;
  private _state: RelayState = {
    connected: false,
    sessionCode: '',
    role: 'slave',
    peerCount: 0,
    latencyMs: 0,
    siteId: crypto.randomUUID().slice(0, 8),
  };
  private _listeners: Array<() => void> = [];

  /** Join a relay session */
  start(sessionCode: string, role: RelayRole): void {
    if (this._channel) this.stop();

    this._state = { ...this._state, sessionCode, role, connected: false };

    this._channel = supabase.channel(`cmd-relay:${sessionCode}`, {
      config: { broadcast: { self: false } },
    });

    this._channel
      .on('broadcast', { event: 'cmd' }, ({ payload }) => {
        if (!payload || payload.originSiteId === this._state.siteId) return;
        // Inject remote command into local bus
        const cmd = payload.command as Command;
        if (cmd) {
          commandBus.dispatch(cmd);
        }
      })
      .on('presence', { event: 'sync' }, () => {
        const state = this._channel?.presenceState() ?? {};
        this._state.peerCount = Object.keys(state).length;
        this._notify();
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          this._state.connected = true;
          await this._channel?.track({
            siteId: this._state.siteId,
            role: this._state.role,
            joinedAt: Date.now(),
          });
          this._notify();
        }
      });
  }

  /** Leave the relay channel */
  stop(): void {
    if (this._channel) {
      this._channel.unsubscribe();
      supabase.removeChannel(this._channel);
      this._channel = null;
    }
    this._state.connected = false;
    this._state.peerCount = 0;
    this._notify();
  }

  /**
   * Broadcast a command to peers.
   * Master can relay any command; slave only non-mutation.
   */
  relayOutgoing(cmd: Command): void {
    if (!this._channel || !this._state.connected) return;

    // Slaves cannot relay mutation commands
    if (this._state.role === 'slave' && MUTATION_TYPES.has(cmd.type)) return;

    this._channel.send({
      type: 'broadcast',
      event: 'cmd',
      payload: {
        originSiteId: this._state.siteId,
        command: cmd,
        ts: Date.now(),
      },
    });
  }

  getState(): Readonly<RelayState> {
    return this._state;
  }

  getSiteId(): string {
    return this._state.siteId;
  }

  onStateChange(cb: () => void): () => void {
    this._listeners.push(cb);
    return () => {
      const idx = this._listeners.indexOf(cb);
      if (idx >= 0) this._listeners.splice(idx, 1);
    };
  }

  private _notify(): void {
    for (const cb of this._listeners) cb();
  }
}

export const commandRelay = new CommandRelay();
