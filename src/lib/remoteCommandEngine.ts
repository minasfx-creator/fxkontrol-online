/**
 * Remote Command Engine — AnyDesk-style full remote control
 * Supports Cloud (6-digit code) and WiFi auto-discovery modes.
 * Hardware bridge for FireOne/PBUS/Radio remote operation.
 * Multi-session manager for controlling multiple sites.
 */
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

/* ── Types ──────────────────────────────────────────── */

export type CommandAction =
  | 'transport' | 'panel' | 'camera' | 'effect'
  | 'undo' | 'redo' | 'panic'
  | 'hardware' | 'open-panel' | 'system-status'
  | 'livefx' | 'sfx-channel' | 'store-sync';

export type ConnectionMode = 'cloud' | 'wifi-auto';

export interface CommandPacket {
  id: string;
  action: CommandAction;
  payload: Record<string, unknown>;
  ts: number;
  senderId: string;
}

export interface HardwareCommandPayload {
  target: 'fireone' | 'pbus' | 'radio';
  action: 'arm' | 'fire' | 'disarm' | 'continuity' | 'scan' | 'arm-all' | 'disarm-all' | 'estop';
  moduleAddr?: number;
  cuePosition?: number;
  duration?: number;
}

export interface HardwareStatus {
  fireoneModules: number;
  fireoneArmed: number;
  pbusDevices: number;
  pbusArmed: number;
  radioDevices: number;
  batteryAvg: number;
  connectionPaths: ('usb' | 'radio' | 'pbus')[];
}

export interface RemotePermissions {
  canFire: boolean;
  canArm: boolean;
  canEditTimeline: boolean;
  canAccessPanels: boolean;
  canPanic: boolean;
}

export const DEFAULT_PERMISSIONS: RemotePermissions = {
  canFire: false,
  canArm: false,
  canEditTimeline: true,
  canAccessPanels: true,
  canPanic: true,
};

export interface RemoteState {
  currentTime: number;
  isPlaying: boolean;
  activePanel: string | null;
  duration: number;
  selectedCount: number;
  hardwareStatus?: HardwareStatus;
  permissions?: RemotePermissions;
}

export interface RemoteDevice {
  id: string;
  name: string;
  role: 'controller' | 'receiver';
  joinedAt: number;
  permissions?: RemotePermissions;
}

export type CommandHandler = (packet: CommandPacket) => void;
export type StateHandler = (state: RemoteState) => void;
export type PresenceHandler = (devices: RemoteDevice[]) => void;

export interface RemoteSession {
  code: string;
  channel: RealtimeChannel;
  sendCommand: (action: CommandAction, payload: Record<string, unknown>) => void;
  sendState: (state: RemoteState) => void;
  sendPermissions: (deviceId: string, perms: RemotePermissions) => void;
  destroy: () => void;
  senderId: string;
  mode: ConnectionMode;
  siteName?: string;
}

/* ── Sender ID ──────────────────────────────────────── */

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

/* ── Session Factory ────────────────────────────────── */

export function createRemoteSession(
  code: string,
  role: 'controller' | 'receiver',
  handlers: {
    onCommand?: CommandHandler;
    onState?: StateHandler;
    onPresence?: PresenceHandler;
    onPermissions?: (perms: RemotePermissions) => void;
  },
  mode: ConnectionMode = 'cloud',
  siteName?: string,
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

  if (handlers.onPermissions) {
    channel.on('broadcast', { event: 'permissions' }, ({ payload }) => {
      const p = payload as { targetId: string; permissions: RemotePermissions };
      if (p.targetId === senderId) handlers.onPermissions!(p.permissions);
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

  const sendPermissions = (deviceId: string, perms: RemotePermissions) => {
    channel.send({ type: 'broadcast', event: 'permissions', payload: { targetId: deviceId, permissions: perms } });
  };

  const destroy = () => {
    channel.untrack();
    supabase.removeChannel(channel);
  };

  return { code, channel, sendCommand, sendState, sendPermissions, destroy, senderId, mode, siteName };
}

/* ── Shared Command Executor (DRY) ──────────────────── */

export interface CommandExecutorDeps {
  projectStore: any;
  sfxStore: any;
  undoStore: any;
  onOpenPanel?: (id: string) => void;
  onHardwareCommand?: (payload: HardwareCommandPayload) => void;
}

export function executeRemoteCommand(packet: CommandPacket, deps: CommandExecutorDeps): void {
  const { projectStore, sfxStore, undoStore, onOpenPanel, onHardwareCommand } = deps;

  switch (packet.action) {
    case 'transport': {
      const { type, delta, time } = packet.payload as any;
      if (type === 'play') projectStore.setPlaying?.(true);
      else if (type === 'pause') projectStore.setPlaying?.(false);
      else if (type === 'stop') { projectStore.setPlaying?.(false); projectStore.setCurrentTime?.(0); }
      else if (type === 'seek') projectStore.setCurrentTime?.((projectStore.currentTime ?? 0) + (delta || 0));
      else if (type === 'seekTo') projectStore.setCurrentTime?.(time ?? 0);
      break;
    }
    case 'panel':
    case 'open-panel': {
      const { panelId } = packet.payload as any;
      onOpenPanel?.(panelId);
      break;
    }
    case 'camera':
      window.dispatchEvent(new CustomEvent('remote-camera', { detail: packet.payload }));
      break;
    case 'effect': {
      const { type: fxType, action: fxAction } = packet.payload as any;
      if (fxAction === 'fire') {
        sfxStore.fireEffect({
          id: `remote-${Date.now()}`,
          type: fxType,
          position: [0, 0, 0],
          color: '#ffffff',
          intensity: 255,
          startedAt: performance.now(),
          duration: 2000,
        });
      }
      break;
    }
    case 'hardware': {
      const hwPayload = packet.payload as unknown as HardwareCommandPayload;
      onHardwareCommand?.(hwPayload);
      break;
    }
    case 'undo': undoStore.undo?.(); break;
    case 'redo': undoStore.redo?.(); break;
    case 'panic': {
      projectStore.setPlaying?.(false);
      sfxStore.clearAll();
      onHardwareCommand?.({ target: 'fireone', action: 'estop' });
      onHardwareCommand?.({ target: 'pbus', action: 'estop' });
      break;
    }
  }
}

/* ── Multi-Session Manager ──────────────────────────── */

export class MultiSessionManager {
  sessions = new Map<string, RemoteSession>();

  add(session: RemoteSession): void {
    this.sessions.set(session.code, session);
  }

  remove(code: string): void {
    const s = this.sessions.get(code);
    s?.destroy();
    this.sessions.delete(code);
  }

  get(code: string): RemoteSession | undefined {
    return this.sessions.get(code);
  }

  getAll(): RemoteSession[] {
    return Array.from(this.sessions.values());
  }

  sendToAll(action: CommandAction, payload: Record<string, unknown>): void {
    this.sessions.forEach(s => s.sendCommand(action, payload));
  }

  destroyAll(): void {
    this.sessions.forEach(s => s.destroy());
    this.sessions.clear();
  }

  get count(): number {
    return this.sessions.size;
  }
}

/* ── QR Code SVG Generator ──────────────────────────── */

export function generateQRCodeSVG(data: string, size = 200): string {
  // Simple QR-like grid (visual placeholder — real QR needs library)
  const cells = 21;
  const cellSize = size / cells;
  let hash = 0;
  for (let i = 0; i < data.length; i++) hash = ((hash << 5) - hash + data.charCodeAt(i)) | 0;

  let rects = '';
  // Finder patterns
  const drawFinder = (ox: number, oy: number) => {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        const border = r === 0 || r === 6 || c === 0 || c === 6;
        const inner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        if (border || inner) {
          rects += `<rect x="${(ox + c) * cellSize}" y="${(oy + r) * cellSize}" width="${cellSize}" height="${cellSize}" fill="currentColor"/>`;
        }
      }
    }
  };
  drawFinder(0, 0);
  drawFinder(cells - 7, 0);
  drawFinder(0, cells - 7);

  // Data modules from hash
  const seed = Math.abs(hash);
  for (let r = 0; r < cells; r++) {
    for (let c = 0; c < cells; c++) {
      if ((r < 8 && c < 8) || (r < 8 && c >= cells - 8) || (r >= cells - 8 && c < 8)) continue;
      const v = ((seed * (r * cells + c + 1)) >> 3) & 1;
      if (v) {
        rects += `<rect x="${c * cellSize}" y="${r * cellSize}" width="${cellSize}" height="${cellSize}" fill="currentColor"/>`;
      }
    }
  }

  return `<svg viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">${rects}</svg>`;
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
