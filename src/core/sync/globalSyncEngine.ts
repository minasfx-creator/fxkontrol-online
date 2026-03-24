/**
 * ─── Global Sync Engine ─────────────────────────────────────────────
 * Distributed state synchronization via Supabase Realtime.
 * HOST broadcasts timeline state + clock; CLIENTs follow.
 * Handles: time sync, state reconciliation, permissions, fail-safe.
 */

import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { globalClock, type SyncRole, type ClockSyncState } from './globalClockAdapter';

// ── Types ──────────────────────────────────────────────────────────

export type SyncMessageType =
  | 'TIME'           // Host → Client: current timeline time
  | 'STATE'          // Host → Client: full state snapshot
  | 'COMMAND'        // Any → Host: action request
  | 'PING'           // Client → Host: clock sync ping
  | 'PONG'           // Host → Client: clock sync pong
  | 'LOCK'           // Host → All: edit lock notification
  | 'HEARTBEAT';     // Any → All: alive signal

export interface SyncMessage {
  type: SyncMessageType;
  payload: Record<string, unknown>;
  senderId: string;
  timestamp: number;
}

export type OperatorPermission = 'host' | 'operator' | 'viewer';

export interface SyncOperator {
  id: string;
  name: string;
  permission: OperatorPermission;
  joinedAt: number;
  lastHeartbeat: number;
  clockState?: ClockSyncState;
}

export interface GlobalSyncState {
  connected: boolean;
  sessionCode: string | null;
  role: SyncRole;
  operators: SyncOperator[];
  hostId: string | null;
  isHostAlive: boolean;
  lastStateSync: number;
}

export interface SyncHandlers {
  onTimeUpdate?: (time: number, playing: boolean) => void;
  onStateSnapshot?: (state: Record<string, unknown>) => void;
  onCommand?: (cmd: string, payload: Record<string, unknown>, senderId: string) => void;
  onOperatorChange?: (operators: SyncOperator[]) => void;
  onHostLost?: () => void;
  onEditLock?: (lockedBy: string, section: string) => void;
}

// ── Constants ──────────────────────────────────────────────────────

const TIME_BROADCAST_INTERVAL = 50;   // Host broadcasts time at 20Hz
const STATE_SNAPSHOT_INTERVAL = 5000; // Full state every 5s
const HEARTBEAT_INTERVAL = 1000;
const HOST_TIMEOUT = 4000;

// ── Engine ─────────────────────────────────────────────────────────

class GlobalSyncEngine {
  private _channel: RealtimeChannel | null = null;
  private _senderId = '';
  private _sessionCode: string | null = null;
  private _role: SyncRole = 'client';
  private _permission: OperatorPermission = 'viewer';
  private _handlers: SyncHandlers = {};
  private _operators = new Map<string, SyncOperator>();
  private _hostId: string | null = null;
  private _connected = false;

  // Timers
  private _timeBroadcastTimer: ReturnType<typeof setInterval> | null = null;
  private _stateBroadcastTimer: ReturnType<typeof setInterval> | null = null;
  private _heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private _hostWatchTimer: ReturnType<typeof setInterval> | null = null;

  // State getter for broadcasting
  private _getTimelineFn: (() => { time: number; playing: boolean }) | null = null;
  private _getStateFn: (() => Record<string, unknown>) | null = null;

  // ── Join Session ─────────────────────────────────────────────────

  join(
    sessionCode: string,
    role: SyncRole,
    permission: OperatorPermission,
    handlers: SyncHandlers,
    opts: {
      getTimeline: () => { time: number; playing: boolean };
      getState: () => Record<string, unknown>;
      operatorName?: string;
    }
  ): void {
    this.leave(); // Clean previous

    this._sessionCode = sessionCode;
    this._role = role;
    this._permission = permission;
    this._handlers = handlers;
    this._getTimelineFn = opts.getTimeline;
    this._getStateFn = opts.getState;
    this._senderId = `op-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

    globalClock.setRole(role);

    const channelName = `global-sync:${sessionCode}`;
    this._channel = supabase.channel(channelName, {
      config: { broadcast: { self: false } },
    });

    // ── Message handlers ───────────────────────────────────────────

    this._channel.on('broadcast', { event: 'sync' }, ({ payload }) => {
      const msg = payload as SyncMessage;
      this._handleMessage(msg);
    });

    // ── Presence ───────────────────────────────────────────────────

    this._channel.on('presence', { event: 'sync' }, () => {
      const state = this._channel!.presenceState();
      this._operators.clear();
      for (const key of Object.keys(state)) {
        for (const p of state[key] as any[]) {
          this._operators.set(p.senderId || key, {
            id: p.senderId || key,
            name: p.name || 'Unknown',
            permission: p.permission || 'viewer',
            joinedAt: p.joinedAt || Date.now(),
            lastHeartbeat: Date.now(),
          });
        }
      }
      this._handlers.onOperatorChange?.(this.getOperators());
    });

    // ── Subscribe ──────────────────────────────────────────────────

    this._channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        this._connected = true;
        await this._channel!.track({
          senderId: this._senderId,
          name: opts.operatorName || (role === 'host' ? 'HOST' : 'Operator'),
          permission,
          role,
          joinedAt: Date.now(),
        });

        if (role === 'host') {
          this._hostId = this._senderId;
          this._startHostBroadcasts();
        } else {
          this._startClientSync();
        }

        this._startHeartbeat();
      }
    });
  }

  // ── Message Router ───────────────────────────────────────────────

  private _handleMessage(msg: SyncMessage): void {
    // Track operator heartbeat
    const op = this._operators.get(msg.senderId);
    if (op) op.lastHeartbeat = Date.now();

    switch (msg.type) {
      case 'TIME': {
        if (this._role !== 'host') {
          const { time, playing } = msg.payload as { time: number; playing: boolean };
          this._handlers.onTimeUpdate?.(time, playing);
        }
        break;
      }

      case 'STATE': {
        if (this._role !== 'host') {
          this._handlers.onStateSnapshot?.(msg.payload);
        }
        break;
      }

      case 'COMMAND': {
        if (this._role === 'host') {
          const { command, ...rest } = msg.payload as { command: string; [k: string]: unknown };
          this._handlers.onCommand?.(command, rest, msg.senderId);
        }
        break;
      }

      case 'PING': {
        if (this._role === 'host') {
          // Respond with pong
          const hostTime = globalClock.createPongTimestamp();
          this._send('PONG', {
            targetId: msg.senderId,
            hostTime,
            originalSentAt: msg.payload.sentAt,
          });
        }
        break;
      }

      case 'PONG': {
        const { targetId, hostTime, originalSentAt } = msg.payload as {
          targetId: string;
          hostTime: number;
          originalSentAt: number;
        };
        if (targetId === this._senderId) {
          globalClock.processPong(originalSentAt as number, hostTime as number);
        }
        break;
      }

      case 'LOCK': {
        const { lockedBy, section } = msg.payload as { lockedBy: string; section: string };
        this._handlers.onEditLock?.(lockedBy, section);
        break;
      }

      case 'HEARTBEAT': {
        // Check if this is the host
        if (msg.payload.isHost) {
          this._hostId = msg.senderId;
        }
        break;
      }
    }
  }

  // ── Send ─────────────────────────────────────────────────────────

  private _send(type: SyncMessageType, payload: Record<string, unknown>): void {
    if (!this._channel || !this._connected) return;
    const msg: SyncMessage = {
      type,
      payload,
      senderId: this._senderId,
      timestamp: Date.now(),
    };
    this._channel.send({ type: 'broadcast', event: 'sync', payload: msg });
  }

  // ── HOST: Broadcasts ─────────────────────────────────────────────

  private _startHostBroadcasts(): void {
    // Time at 20Hz
    this._timeBroadcastTimer = setInterval(() => {
      if (!this._getTimelineFn) return;
      const { time, playing } = this._getTimelineFn();
      this._send('TIME', { time, playing });
    }, TIME_BROADCAST_INTERVAL);

    // Full state snapshot every 5s
    this._stateBroadcastTimer = setInterval(() => {
      if (!this._getStateFn) return;
      this._send('STATE', this._getStateFn());
    }, STATE_SNAPSHOT_INTERVAL);
  }

  // ── CLIENT: Sync ─────────────────────────────────────────────────

  private _startClientSync(): void {
    // Start clock pinging
    globalClock.startPinging(() => {
      const sentAt = globalClock.createPingTimestamp();
      this._send('PING', { sentAt });
    });

    // Watch for host timeout
    this._hostWatchTimer = setInterval(() => {
      if (!this._hostId) return;
      const hostOp = this._operators.get(this._hostId);
      if (hostOp && Date.now() - hostOp.lastHeartbeat > HOST_TIMEOUT) {
        this._handlers.onHostLost?.();
      }
    }, 1000);
  }

  // ── Heartbeat ────────────────────────────────────────────────────

  private _startHeartbeat(): void {
    this._heartbeatTimer = setInterval(() => {
      this._send('HEARTBEAT', { isHost: this._role === 'host' });
    }, HEARTBEAT_INTERVAL);
  }

  // ── Client Actions ───────────────────────────────────────────────

  /** Client sends a command request to the host. */
  sendCommand(command: string, payload: Record<string, unknown> = {}): void {
    if (this._role === 'host') return; // host executes directly
    this._send('COMMAND', { command, ...payload });
  }

  /** Host broadcasts an edit lock. */
  broadcastLock(section: string): void {
    if (this._role !== 'host') return;
    this._send('LOCK', { lockedBy: this._senderId, section });
  }

  // ── Queries ──────────────────────────────────────────────────────

  getOperators(): SyncOperator[] {
    return Array.from(this._operators.values());
  }

  getState(): GlobalSyncState {
    return {
      connected: this._connected,
      sessionCode: this._sessionCode,
      role: this._role,
      operators: this.getOperators(),
      hostId: this._hostId,
      isHostAlive: this._hostId
        ? (Date.now() - (this._operators.get(this._hostId)?.lastHeartbeat ?? 0)) < HOST_TIMEOUT
        : false,
      lastStateSync: 0,
    };
  }

  isHost(): boolean {
    return this._role === 'host';
  }

  canEdit(): boolean {
    return this._permission === 'host' || this._permission === 'operator';
  }

  getSenderId(): string {
    return this._senderId;
  }

  // ── Lifecycle ────────────────────────────────────────────────────

  leave(): void {
    if (this._timeBroadcastTimer) clearInterval(this._timeBroadcastTimer);
    if (this._stateBroadcastTimer) clearInterval(this._stateBroadcastTimer);
    if (this._heartbeatTimer) clearInterval(this._heartbeatTimer);
    if (this._hostWatchTimer) clearInterval(this._hostWatchTimer);
    this._timeBroadcastTimer = null;
    this._stateBroadcastTimer = null;
    this._heartbeatTimer = null;
    this._hostWatchTimer = null;

    if (this._channel) {
      this._channel.untrack();
      supabase.removeChannel(this._channel);
      this._channel = null;
    }

    globalClock.reset();
    this._operators.clear();
    this._connected = false;
    this._sessionCode = null;
    this._hostId = null;
  }
}

export const globalSync = new GlobalSyncEngine();
