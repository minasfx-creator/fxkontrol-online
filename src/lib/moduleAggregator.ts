/**
 * moduleAggregator — single source of truth for FXK / FXK-M1 / IFMx-i32Q /
 * ESP32-Generic modules currently visible to the Pyro Console, regardless of
 * transport (RS-485 / USB / BLE / BLE-LR / WebSocket / Wi-Fi-Direct / Art-Net /
 * 2-Wire CDS).
 *
 * Honest hardware: the aggregator never invents modules. Every entry must be
 * `upsert()`-ed by an adapter that actually saw the hardware.
 *
 * The aggregator is designed to feed `useFireOneHardware().modules` so that
 * `FireOneModulesInline` lights up the same way for any transport.
 */

import type { FireOneModuleStatus } from './fireoneProtocol';
import type { FxkModel } from './inferFxkModel';
import { defaultChannelCount } from './inferFxkModel';

export type AggregatedTransport =
  | 'serial'
  | 'usb'
  | 'ble'
  | 'ble_lr'
  | 'websocket'
  | 'wifi_direct'
  | 'two_wire'
  | 'artnet'
  | 'direct_relay';

export interface AggregatedModule {
  /** Stable canonical key — `${controllerId|'_'}::${model}#${address}` (model normalised). */
  key: string;
  address: number;
  model: FxkModel;
  transport: AggregatedTransport;
  firmware?: string;
  rssi?: number;
  battery?: number;
  channels: number;
  /** Live igniter count, when known. */
  igniterCount?: number;
  lastSeen: number;
  deviceName?: string;
  /** Transport instance id that saw this module (XL4 vs XL2 differentiation). */
  controllerId?: string;
  /** Human-readable controller label (e.g. "XL4 Gateway"). */
  controllerLabel?: string;
}

export type ModuleAggregatorEvent =
  | { type: 'upsert'; module: AggregatedModule }
  | { type: 'remove'; key: string };

type Listener = (e: ModuleAggregatorEvent) => void;

class ModuleAggregator {
  private _modules = new Map<string, AggregatedModule>();
  private _listeners = new Set<Listener>();

  static keyFor(model: FxkModel, address: number, controllerId?: string): string {
    const m = (model ?? 'Unknown').toString().toLowerCase();
    const c = (controllerId ?? '_').toString();
    return `${c}::${m}#${address}`;
  }

  upsert(input: Omit<AggregatedModule, 'key' | 'channels' | 'lastSeen'> & {
    channels?: number;
    lastSeen?: number;
  }): AggregatedModule {
    const key = ModuleAggregator.keyFor(input.model, input.address, input.controllerId);
    const prev = this._modules.get(key);
    const next: AggregatedModule = {
      ...prev,
      ...input,
      key,
      channels: input.channels ?? prev?.channels ?? defaultChannelCount(input.model),
      lastSeen: input.lastSeen ?? Date.now(),
    };
    this._modules.set(key, next);
    this._emit({ type: 'upsert', module: next });
    return next;
  }

  remove(key: string): void {
    if (this._modules.delete(key)) this._emit({ type: 'remove', key });
  }

  /** Drop every entry that came in via `transport` (e.g. on disconnect). */
  removeByTransport(transport: AggregatedTransport): void {
    for (const [key, m] of this._modules) {
      if (m.transport === transport) {
        this._modules.delete(key);
        this._emit({ type: 'remove', key });
      }
    }
  }

  list(): AggregatedModule[] {
    return Array.from(this._modules.values()).sort((a, b) => a.address - b.address);
  }

  get size(): number { return this._modules.size; }

  subscribe(fn: Listener): () => void {
    this._listeners.add(fn);
    return () => { this._listeners.delete(fn); };
  }

  /** Test/diagnostic only — never call from production paths. */
  _resetForTests(): void {
    this._modules.clear();
    this._listeners.clear();
  }

  private _emit(e: ModuleAggregatorEvent): void {
    for (const l of this._listeners) {
      try { l(e); } catch { /* swallow listener errors */ }
    }
  }
}

export const moduleAggregator = new ModuleAggregator();

/** Helper to project an AggregatedModule into the legacy FireOneModuleStatus
 *  shape consumed by `FireOneModulesInline`. */
export function aggregatedToFireOneStatus(m: AggregatedModule): FireOneModuleStatus {
  const ignTotal = m.channels || 32;
  const ignLive = m.igniterCount ?? 0;
  return {
    moduleAddress: m.address,
    armed: false,
    batteryVoltage: m.battery ?? 0,
    temperature: 0,
    signalStrength: m.rssi ?? 0,
    firmwareVersion: m.firmware ?? '—',
    igniters: Array.from({ length: ignTotal }, (_, i) => ({
      position: i + 1,
      connected: i < ignLive,
      fired: false,
      resistance: 0,
      continuityOk: i < ignLive,
    })),
    lastSeen: m.lastSeen,
    wireless: m.transport !== 'serial' && m.transport !== 'usb' && m.transport !== 'two_wire' && m.transport !== 'direct_relay',
    errors: [],
    rssiDbm: m.rssi,
    connectionMode:
      m.transport === 'serial' || m.transport === 'usb' || m.transport === 'direct_relay' || m.transport === 'two_wire'
        ? 'wired'
        : 'wireless',
    // Extended fields below are read by the updated FireOneModulesInline.
    model: m.model,
    transport: m.transport,
    deviceName: m.deviceName,
    controllerId: m.controllerId,
    controllerLabel: m.controllerLabel,
  } as FireOneModuleStatus;
}
