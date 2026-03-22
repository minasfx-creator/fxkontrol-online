/**
 * Art-Net Remote Module Control Service
 * Enables internet-based control of FXK-M1 modules via Art-Net over IP tunneling.
 * Supports: direct LAN, WAN via relay server, per-module addressing.
 */
import { supabase } from '@/integrations/supabase/client';

export type ModuleTransport = 'lan' | 'wan' | 'relay';
export type ModuleConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error' | 'timeout';

export interface ArtNetModuleConfig {
  id: string;
  name: string;
  moduleAddress: number;       // 0-255 unique module ID
  dmxUniverse: number;         // Art-Net universe (0-32767)
  dmxSubnet: number;           // 0-15
  dmxNet: number;              // 0-127
  dmxStartAddress: number;     // 1-512
  dmxChannelCount: number;     // channels used
  ip: string;                  // Module IP or relay endpoint
  port: number;                // Art-Net port (default 6454)
  transport: ModuleTransport;
  relayToken?: string;         // Auth token for WAN relay
  channelCount: number;        // Pyro channels (e.g. 32)
  armed: boolean;
  enabled: boolean;
  lastSeen: number;            // timestamp
  latencyMs: number | null;
  firmwareVersion?: string;
  batteryLevel?: number;
  gpsLat?: number;
  gpsLng?: number;
  label?: string;              // Field label e.g. "STAGE LEFT"
}

export interface ArtNetControllerConfig {
  id: string;
  name: string;
  ip: string;
  port: number;
  transport: ModuleTransport;
  modules: ArtNetModuleConfig[];
  masterArmed: boolean;
  relayServerUrl?: string;     // WAN relay server URL
  encryptionKey?: string;      // AES-128 key for WAN
}

export interface ModuleHeartbeat {
  moduleId: string;
  timestamp: number;
  batteryLevel: number;
  armed: boolean;
  cdsStatus: boolean[];
  latencyMs: number;
  gpsLat?: number;
  gpsLng?: number;
}

export interface FireCommand {
  moduleId: string;
  channel: number;
  duration?: number;
  intensity?: number;
}

type ModuleEventType = 'module-connected' | 'module-disconnected' | 'module-heartbeat' | 'module-fired' | 'module-error' | 'controller-update';
type ModuleEventListener = (type: ModuleEventType, data: any) => void;

class ArtNetModuleService {
  private controller: ArtNetControllerConfig | null = null;
  private heartbeatIntervals = new Map<string, ReturnType<typeof setInterval>>();
  private listeners = new Set<ModuleEventListener>();
  private wsConnections = new Map<string, WebSocket>();
  private moduleStates = new Map<string, ModuleConnectionState>();
  private sequenceCounters = new Map<string, number>();

  subscribe(fn: ModuleEventListener) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(type: ModuleEventType, data: any) {
    this.listeners.forEach(fn => fn(type, data));
  }

  // ─── Controller Setup ────────────────────────────
  initController(config: Partial<ArtNetControllerConfig>): ArtNetControllerConfig {
    this.controller = {
      id: `ctrl-${Date.now()}`,
      name: config.name || 'FXK Controller',
      ip: config.ip || '0.0.0.0',
      port: config.port || 6454,
      transport: config.transport || 'lan',
      modules: config.modules || [],
      masterArmed: false,
      relayServerUrl: config.relayServerUrl,
      encryptionKey: config.encryptionKey,
    };
    return this.controller;
  }

  getController(): ArtNetControllerConfig | null {
    return this.controller;
  }

  // ─── Module Registration ─────────────────────────
  addModule(config: Partial<ArtNetModuleConfig>): ArtNetModuleConfig {
    if (!this.controller) throw new Error('Controller not initialized');

    const existingAddresses = new Set(this.controller.modules.map(m => m.moduleAddress));
    let addr = config.moduleAddress ?? 1;
    while (existingAddresses.has(addr)) addr++;

    const module: ArtNetModuleConfig = {
      id: `mod-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      name: config.name || `MODULE ${addr}`,
      moduleAddress: addr,
      dmxUniverse: config.dmxUniverse ?? 0,
      dmxSubnet: config.dmxSubnet ?? 0,
      dmxNet: config.dmxNet ?? 0,
      dmxStartAddress: config.dmxStartAddress ?? 1,
      dmxChannelCount: config.dmxChannelCount ?? 32,
      ip: config.ip || '192.168.1.100',
      port: config.port || 6454,
      transport: config.transport || this.controller.transport,
      relayToken: config.relayToken,
      channelCount: config.channelCount ?? 32,
      armed: false,
      enabled: true,
      lastSeen: 0,
      latencyMs: null,
      firmwareVersion: config.firmwareVersion,
      batteryLevel: config.batteryLevel,
      gpsLat: config.gpsLat,
      gpsLng: config.gpsLng,
      label: config.label,
    };

    this.controller.modules.push(module);
    this.moduleStates.set(module.id, 'disconnected');
    this.emit('controller-update', this.controller);
    return module;
  }

  removeModule(moduleId: string) {
    if (!this.controller) return;
    this.disconnectModule(moduleId);
    this.controller.modules = this.controller.modules.filter(m => m.id !== moduleId);
    this.moduleStates.delete(moduleId);
    this.emit('controller-update', this.controller);
  }

  updateModule(moduleId: string, updates: Partial<ArtNetModuleConfig>) {
    if (!this.controller) return;
    const idx = this.controller.modules.findIndex(m => m.id === moduleId);
    if (idx >= 0) {
      this.controller.modules[idx] = { ...this.controller.modules[idx], ...updates };
      this.emit('controller-update', this.controller);
    }
  }

  getModuleState(moduleId: string): ModuleConnectionState {
    return this.moduleStates.get(moduleId) || 'disconnected';
  }

  // ─── Connection Management ───────────────────────
  async connectModule(moduleId: string): Promise<boolean> {
    const module = this.controller?.modules.find(m => m.id === moduleId);
    if (!module) return false;

    this.moduleStates.set(moduleId, 'connecting');
    this.emit('module-connected', { moduleId, state: 'connecting' });

    try {
      if (module.transport === 'wan' || module.transport === 'relay') {
        return await this.connectViaRelay(module);
      }
      return await this.connectViaLAN(module);
    } catch (err: any) {
      this.moduleStates.set(moduleId, 'error');
      this.emit('module-error', { moduleId, error: err.message });
      return false;
    }
  }

  private async connectViaLAN(module: ArtNetModuleConfig): Promise<boolean> {
    // Use edge function to validate Art-Net connectivity
    const start = performance.now();
    const { data, error } = await supabase.functions.invoke('artnet-bridge', {
      body: {
        action: 'validate',
        universes: [{
          universe: module.dmxUniverse,
          subnet: module.dmxSubnet,
          net: module.dmxNet,
          channels: Array(module.dmxChannelCount).fill(0),
          sequence: 0,
        }],
        targetIp: module.ip,
        targetPort: module.port,
      },
    });

    const latency = Math.round(performance.now() - start);

    if (error) {
      this.moduleStates.set(module.id, 'error');
      return false;
    }

    this.moduleStates.set(module.id, 'connected');
    this.updateModule(module.id, { lastSeen: Date.now(), latencyMs: latency });
    this.startHeartbeat(module.id);
    this.emit('module-connected', { moduleId: module.id, latencyMs: latency });
    return true;
  }

  private async connectViaRelay(module: ArtNetModuleConfig): Promise<boolean> {
    const relayUrl = this.controller?.relayServerUrl || `ws://localhost:9001`;

    try {
      const ws = new WebSocket(relayUrl);

      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          ws.close();
          this.moduleStates.set(module.id, 'timeout');
          resolve(false);
        }, 10000);

        ws.onopen = () => {
          clearTimeout(timeout);
          this.wsConnections.set(module.id, ws);
          this.moduleStates.set(module.id, 'connected');
          this.updateModule(module.id, { lastSeen: Date.now() });
          this.startHeartbeat(module.id);
          this.emit('module-connected', { moduleId: module.id });

          // Send auth if WAN
          if (module.relayToken) {
            ws.send(JSON.stringify({
              action: 'auth',
              token: module.relayToken,
              moduleAddress: module.moduleAddress,
            }));
          }
          resolve(true);
        };

        ws.onerror = () => {
          clearTimeout(timeout);
          this.moduleStates.set(module.id, 'error');
          resolve(false);
        };

        ws.onclose = () => {
          this.wsConnections.delete(module.id);
          this.moduleStates.set(module.id, 'disconnected');
          this.stopHeartbeat(module.id);
          this.emit('module-disconnected', { moduleId: module.id });
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            this.handleModuleMessage(module.id, msg);
          } catch { /* ignore */ }
        };
      });
    } catch {
      this.moduleStates.set(module.id, 'error');
      return false;
    }
  }

  disconnectModule(moduleId: string) {
    this.stopHeartbeat(moduleId);
    const ws = this.wsConnections.get(moduleId);
    if (ws) {
      ws.close();
      this.wsConnections.delete(moduleId);
    }
    this.moduleStates.set(moduleId, 'disconnected');
    this.emit('module-disconnected', { moduleId });
  }

  async connectAllModules() {
    if (!this.controller) return;
    await Promise.all(
      this.controller.modules.filter(m => m.enabled).map(m => this.connectModule(m.id))
    );
  }

  disconnectAllModules() {
    this.controller?.modules.forEach(m => this.disconnectModule(m.id));
  }

  // ─── DMX / Art-Net Sending ───────────────────────
  async sendDMX(moduleId: string, channels: number[]): Promise<boolean> {
    const module = this.controller?.modules.find(m => m.id === moduleId);
    if (!module || this.moduleStates.get(moduleId) !== 'connected') return false;

    const seq = (this.sequenceCounters.get(moduleId) || 0) + 1;
    this.sequenceCounters.set(moduleId, seq > 255 ? 1 : seq);

    const ws = this.wsConnections.get(moduleId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        action: 'dmx',
        universe: module.dmxUniverse,
        subnet: module.dmxSubnet,
        net: module.dmxNet,
        channels,
        sequence: seq,
        moduleAddress: module.moduleAddress,
      }));
      return true;
    }

    // Fallback: edge function
    const { error } = await supabase.functions.invoke('artnet-bridge', {
      body: {
        action: 'send',
        universes: [{
          universe: module.dmxUniverse,
          subnet: module.dmxSubnet,
          net: module.dmxNet,
          channels,
          sequence: seq,
        }],
        targetIp: module.ip,
        targetPort: module.port,
      },
    });

    return !error;
  }

  // ─── Fire Commands ───────────────────────────────
  async fireChannel(moduleId: string, channel: number, intensity = 255, durationMs = 500): Promise<boolean> {
    const module = this.controller?.modules.find(m => m.id === moduleId);
    if (!module || !module.armed) return false;
    if (!this.controller?.masterArmed) return false;

    const dmxChannels = Array(module.dmxChannelCount).fill(0);
    if (channel >= 0 && channel < dmxChannels.length) {
      dmxChannels[channel] = intensity;
    }

    const sent = await this.sendDMX(moduleId, dmxChannels);
    if (sent) {
      this.emit('module-fired', { moduleId, channel, intensity, durationMs });

      // Auto-off after duration
      setTimeout(async () => {
        const offChannels = Array(module.dmxChannelCount).fill(0);
        await this.sendDMX(moduleId, offChannels);
      }, durationMs);
    }
    return sent;
  }

  async fireMultiple(commands: FireCommand[]): Promise<boolean[]> {
    return Promise.all(commands.map(cmd =>
      this.fireChannel(cmd.moduleId, cmd.channel, cmd.intensity, cmd.duration)
    ));
  }

  // ─── ARM / DISARM ────────────────────────────────
  async armModule(moduleId: string) {
    if (!this.controller?.masterArmed) return;
    this.updateModule(moduleId, { armed: true });
  }

  async disarmModule(moduleId: string) {
    this.updateModule(moduleId, { armed: false });
  }

  setMasterArm(armed: boolean) {
    if (!this.controller) return;
    this.controller.masterArmed = armed;
    if (!armed) {
      this.controller.modules.forEach(m => {
        this.updateModule(m.id, { armed: false });
      });
    }
    this.emit('controller-update', this.controller);
  }

  async eStopAll() {
    if (!this.controller) return;
    this.controller.masterArmed = false;
    for (const m of this.controller.modules) {
      this.updateModule(m.id, { armed: false });
      const offChannels = Array(m.dmxChannelCount).fill(0);
      await this.sendDMX(m.id, offChannels);
    }
    this.emit('controller-update', this.controller);
  }

  // ─── Heartbeat ───────────────────────────────────
  private startHeartbeat(moduleId: string) {
    this.stopHeartbeat(moduleId);
    const interval = setInterval(async () => {
      const module = this.controller?.modules.find(m => m.id === moduleId);
      if (!module) { this.stopHeartbeat(moduleId); return; }

      const ws = this.wsConnections.get(moduleId);
      if (ws && ws.readyState === WebSocket.OPEN) {
        const pingTime = Date.now();
        ws.send(JSON.stringify({ action: 'ping', moduleAddress: module.moduleAddress, t: pingTime }));
      } else {
        // LAN heartbeat via edge function
        const start = performance.now();
        const { error } = await supabase.functions.invoke('artnet-bridge', {
          body: {
            action: 'validate',
            universes: [{ universe: module.dmxUniverse, subnet: module.dmxSubnet, net: module.dmxNet, channels: [0], sequence: 0 }],
          },
        });
        const latency = Math.round(performance.now() - start);
        if (!error) {
          this.updateModule(moduleId, { lastSeen: Date.now(), latencyMs: latency });
          this.emit('module-heartbeat', { moduleId, latencyMs: latency, timestamp: Date.now() });
        } else {
          this.moduleStates.set(moduleId, 'error');
          this.emit('module-error', { moduleId, error: 'Heartbeat timeout' });
        }
      }
    }, 5000);
    this.heartbeatIntervals.set(moduleId, interval);
  }

  private stopHeartbeat(moduleId: string) {
    const int = this.heartbeatIntervals.get(moduleId);
    if (int) { clearInterval(int); this.heartbeatIntervals.delete(moduleId); }
  }

  private handleModuleMessage(moduleId: string, msg: any) {
    if (msg.action === 'pong') {
      const latency = msg.t ? Date.now() - msg.t : null;
      this.updateModule(moduleId, {
        lastSeen: Date.now(),
        latencyMs: latency,
        batteryLevel: msg.battery,
      });
      this.emit('module-heartbeat', { moduleId, latencyMs: latency, timestamp: Date.now(), battery: msg.battery });
    }
    if (msg.action === 'cds') {
      this.emit('module-heartbeat', { moduleId, cdsStatus: msg.channels });
    }
    if (msg.action === 'status') {
      this.updateModule(moduleId, {
        firmwareVersion: msg.firmware,
        batteryLevel: msg.battery,
        gpsLat: msg.lat,
        gpsLng: msg.lng,
      });
    }
  }

  // ─── Discovery ───────────────────────────────────
  async discoverModules(): Promise<ArtNetModuleConfig[]> {
    const { data, error } = await supabase.functions.invoke('artnet-bridge', {
      body: { action: 'poll', universes: [{ universe: 0, subnet: 0, net: 0, channels: [0], sequence: 0 }] },
    });

    if (error || !data) return [];
    // In production, ArtPollReply would return discovered nodes
    // For now, return empty — real discovery needs UDP on local network
    return [];
  }

  // ─── Cleanup ─────────────────────────────────────
  destroy() {
    this.disconnectAllModules();
    this.listeners.clear();
  }
}

export const artnetModuleService = new ArtNetModuleService();
