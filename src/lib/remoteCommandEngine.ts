/**
 * Remote Command Engine — Supabase Realtime Mobile→PC bidirectional control
 * Supports Cloud (6-digit code) and WiFi auto-discovery modes.
 */
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

export type CommandAction = 'transport' | 'panel' | 'camera' | 'effect' | 'undo' | 'redo' | 'panic';
export type ConnectionMode = 'cloud' | 'wifi-auto';

export interface CommandPacket {
  id: string;
  action: CommandAction;
  payload: Record<string, unknown>;
  ts: number;
  senderId: string;
}

export interface RemoteState {
  currentTime: number;
  isPlaying: boolean;
  activePanel: string | null;
  duration: number;
  selectedCount: number;
}

export interface RemoteDevice {
  id: string;
  name: string;
  role: 'controller' | 'receiver';
  joinedAt: number;
}

export type CommandHandler = (packet: CommandPacket) => void;
export type StateHandler = (state: RemoteState) => void;
export type PresenceHandler = (devices: RemoteDevice[]) => void;

export interface RemoteSession {
  code: string;
  channel: RealtimeChannel;
  sendCommand: (action: CommandAction, payload: Record<string, unknown>) => void;
  sendState: (state: RemoteState) => void;
  destroy: () => void;
  senderId: string;
  mode: ConnectionMode;
}

const SESSION_ID_KEY = 'fxk-remote-sender-id';

function getSenderId(): string {
  let id = sessionStorage.getItem(SESSION_ID_KEY);
  if (!id) {
    id = `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    sessionStorage.setItem(SESSION_ID_KEY, id);
  }
  return id;
}

export function generateSessionCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function createRemoteSession(
  code: string,
  role: 'controller' | 'receiver',
  handlers: {
    onCommand?: CommandHandler;
    onState?: StateHandler;
    onPresence?: PresenceHandler;
  },
  mode: ConnectionMode = 'cloud'
): RemoteSession {
  const senderId = getSenderId();
  const channelName = `remote:${code}`;

  const channel = supabase.channel(channelName, {
    config: { broadcast: { self: false } },
  });

  if (handlers.onCommand) {
    channel.on('broadcast', { event: 'cmd' }, ({ payload }) => {
      handlers.onCommand!(payload as CommandPacket);
    });
  }

  if (handlers.onState) {
    channel.on('broadcast', { event: 'state' }, ({ payload }) => {
      handlers.onState!(payload as RemoteState);
    });
  }

  if (handlers.onPresence) {
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      const devices: RemoteDevice[] = [];
      for (const key of Object.keys(state)) {
        for (const p of state[key] as any[]) {
          devices.push({
            id: p.senderId || key,
            name: p.name || 'Unknown',
            role: p.role || 'controller',
            joinedAt: p.joinedAt || Date.now(),
          });
        }
      }
      handlers.onPresence!(devices);
    });
  }

  channel.subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      await channel.track({
        senderId,
        role,
        name: role === 'controller' ? 'Mobile' : 'Desktop',
        joinedAt: Date.now(),
      });
    }
  });

  const sendCommand = (action: CommandAction, payload: Record<string, unknown>) => {
    const packet: CommandPacket = {
      id: `${senderId}-${Date.now().toString(36)}`,
      action,
      payload,
      ts: Date.now(),
      senderId,
    };
    channel.send({ type: 'broadcast', event: 'cmd', payload: packet });
  };

  const sendState = (state: RemoteState) => {
    channel.send({ type: 'broadcast', event: 'state', payload: state });
  };

  const destroy = () => {
    channel.untrack();
    supabase.removeChannel(channel);
  };

  return { code, channel, sendCommand, sendState, destroy, senderId, mode };
}

/* ── WiFi Auto-Discovery ─────────────────────────── */

export interface WifiDiscoveryCallbacks {
  onDeviceFound: (device: RemoteDevice & { sessionCode: string }) => void;
  onLost: () => void;
}

export interface WifiDiscoveryHandle {
  channel: RealtimeChannel;
  destroy: () => void;
}

/**
 * Join a well-known discovery channel. When another device with a different role
 * appears, auto-exchange session codes so they can connect without manual entry.
 */
export function startWifiDiscovery(
  role: 'controller' | 'receiver',
  sessionCode: string,
  callbacks: WifiDiscoveryCallbacks
): WifiDiscoveryHandle {
  const senderId = getSenderId();
  const channel = supabase.channel('remote:wifi-discover', {
    config: { broadcast: { self: false } },
  });

  channel.on('presence', { event: 'sync' }, () => {
    const state = channel.presenceState();
    let found = false;
    for (const key of Object.keys(state)) {
      for (const p of state[key] as any[]) {
        if (p.senderId !== senderId && p.role !== role) {
          found = true;
          callbacks.onDeviceFound({
            id: p.senderId,
            name: p.name || 'Unknown',
            role: p.role,
            joinedAt: p.joinedAt || Date.now(),
            sessionCode: p.sessionCode || '',
          });
        }
      }
    }
    if (!found) callbacks.onLost();
  });

  channel.subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      await channel.track({
        senderId,
        role,
        name: role === 'receiver' ? 'Desktop/Master' : 'Mobile/Slave',
        joinedAt: Date.now(),
        sessionCode,
      });
    }
  });

  const destroy = () => {
    channel.untrack();
    supabase.removeChannel(channel);
  };

  return { channel, destroy };
}
