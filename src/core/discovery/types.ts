/**
 * ─── Unified Discovery — Shared Types ──────────────────────────────
 * Common contract for transport-specific discoverers (Serial, USB, BLE,
 * Art-Net). All discoverers expose the same lifecycle so the
 * `UnifiedDiscoveryService` can fan-out, deduplicate and emit a single
 * normalized stream.
 */

export type DiscoveryTransport = 'webserial' | 'webusb' | 'webble' | 'mdns-artnet';

export type DiscoveryStatus =
  | 'idle'
  | 'scanning'
  | 'found'
  | 'lost'
  | 'unsupported'
  | 'permission_denied'
  | 'error';

export interface DiscoveredDevice {
  /** Stable id: `${transport}:${vid}:${pid}:${serial?}` or `${transport}:${ip}` */
  id: string;
  transport: DiscoveryTransport;
  /** Display label (manufacturer + product when available) */
  label: string;
  /** Vendor / product ids when exposed by the API */
  vendorId?: number;
  productId?: number;
  /** Network host for IP-based devices (Art-Net) */
  host?: string;
  /** True when the family is in the recognized profile registry */
  recognized: boolean;
  /** True when the user already granted access (no prompt needed to open) */
  authorized: boolean;
  /** True when the device is physically present and reachable */
  online: boolean;
  /** Optional family classification (enttec-pro, dmxking, ftdi, ch340, etc.) */
  family?: string;
  /** Last time the device was confirmed present */
  lastSeen: number;
  /** Free-form metadata for transport-specific fields */
  metadata?: Record<string, unknown>;
}

export type DiscoveryEventType = 'discovered' | 'updated' | 'lost';

export interface DiscoveryEvent {
  type: DiscoveryEventType;
  device: DiscoveredDevice;
}

export interface TransportDiscoverer {
  readonly id: DiscoveryTransport;
  isSupported(): boolean;
  /** Run an active scan (may require user gesture for prompt-based transports). */
  scan(opts?: { prompt?: boolean }): Promise<DiscoveredDevice[]>;
  /** Subscribe to hot-plug / async discovery events. Returns unsubscriber. */
  watch(listener: (event: DiscoveryEvent) => void): () => void;
  /** Current cached devices (no I/O). */
  getDevices(): DiscoveredDevice[];
}
