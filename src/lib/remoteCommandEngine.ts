/**
 * Remote Command Engine — Supabase Realtime Mobile→PC bidirectional control
 * Pairing via 6-digit session code, broadcast commands through channels.
 */
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

export type CommandAction = 'transport' | 'panel' | 'camera' | 'effect' | 'undo' | 'redo' | 'panic';

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
  }
): RemoteSession {
  const senderId = getSenderId();
  const channelName = `remote:${code}`;

  const channel = supabase.channel(channelName, {
    config: { broadcast: { self: false } },
  });

  // Listen for commands
  if (handlers.onCommand) {
    channel.on('broadcast', { event: 'cmd' }, ({ payload }) => {
      handlers.onCommand!(payload as CommandPacket);
    });
  }

  // Listen for state sync
  if (handlers.onState) {
    channel.on('broadcast', { event: 'state' }, ({ payload }) => {
      handlers.onState!(payload as RemoteState);
    });
  }

  // Presence tracking
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

  return { code, channel, sendCommand, sendState, destroy, senderId };
}
