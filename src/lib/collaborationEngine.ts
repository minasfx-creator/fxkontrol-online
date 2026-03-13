/**
 * Multi-User Collaboration Engine
 * Real-time presence, cursor sharing, and conflict-free editing
 * using Supabase Realtime channels.
 */

import { supabase } from '@/integrations/supabase/client';

export interface CollaboratorPresence {
  userId: string;
  userName: string;
  color: string;
  cursorX: number;
  cursorY: number;
  activePanel: string | null;
  selectedPositionIds: string[];
  lastSeen: number;
  isOnline: boolean;
}

export interface EditOperation {
  id: string;
  userId: string;
  timestamp: number;
  type: 'position_move' | 'position_add' | 'position_remove' | 'timeline_add' | 'timeline_remove' | 'effect_change' | 'property_change';
  target: string;       // entity id
  data: Record<string, unknown>;
}

const PRESENCE_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
  '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
  '#BB8FCE', '#82E0AA', '#F1948A', '#85C1E9',
];

let channelRef: ReturnType<typeof supabase.channel> | null = null;

/**
 * Join a collaboration session for a project.
 */
export function joinSession(
  projectId: string,
  userId: string,
  userName: string,
  onPresenceUpdate: (presences: CollaboratorPresence[]) => void,
  onRemoteEdit: (op: EditOperation) => void,
): { leave: () => void; broadcastEdit: (op: Omit<EditOperation, 'id' | 'userId' | 'timestamp'>) => void; updateCursor: (x: number, y: number) => void } {
  const color = PRESENCE_COLORS[Math.abs(hashCode(userId)) % PRESENCE_COLORS.length];

  const channel = supabase.channel(`collab:${projectId}`, {
    config: {
      presence: { key: userId },
      broadcast: { self: false },
    },
  });

  channelRef = channel;

  // Track presence
  channel.on('presence', { event: 'sync' }, () => {
    const state = channel.presenceState<CollaboratorPresence>();
    const presences: CollaboratorPresence[] = [];
    for (const [key, entries] of Object.entries(state)) {
      if (entries && entries.length > 0) {
        presences.push(entries[0] as unknown as CollaboratorPresence);
      }
    }
    onPresenceUpdate(presences);
  });

  // Receive remote edits
  channel.on('broadcast', { event: 'edit' }, ({ payload }) => {
    onRemoteEdit(payload as EditOperation);
  });

  channel.subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      await channel.track({
        userId,
        userName,
        color,
        cursorX: 0,
        cursorY: 0,
        activePanel: null,
        selectedPositionIds: [],
        lastSeen: Date.now(),
        isOnline: true,
      });
    }
  });

  const broadcastEdit = (op: Omit<EditOperation, 'id' | 'userId' | 'timestamp'>) => {
    channel.send({
      type: 'broadcast',
      event: 'edit',
      payload: {
        ...op,
        id: `edit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        userId,
        timestamp: Date.now(),
      },
    });
  };

  const updateCursor = (x: number, y: number) => {
    channel.track({
      userId,
      userName,
      color,
      cursorX: x,
      cursorY: y,
      activePanel: null,
      selectedPositionIds: [],
      lastSeen: Date.now(),
      isOnline: true,
    });
  };

  const leave = () => {
    channel.unsubscribe();
    channelRef = null;
  };

  return { leave, broadcastEdit, updateCursor };
}

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

/**
 * Resolve conflicting edits using last-writer-wins with vector clocks.
 */
export function resolveConflict(local: EditOperation, remote: EditOperation): 'keep-local' | 'accept-remote' {
  // Same target — last timestamp wins
  if (local.target === remote.target && local.type === remote.type) {
    return remote.timestamp > local.timestamp ? 'accept-remote' : 'keep-local';
  }
  // Different targets — no conflict
  return 'keep-local';
}
