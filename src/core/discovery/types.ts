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
  /** Optional last-known error from this transport for this device. */
  lastError?: { message: string; at: number; code?: string };
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

// ─── Multi-Transport Aggregation ──────────────────────────────────
/**
 * A single physical device that may be reachable through multiple
 * transports simultaneously. Built by `DeviceAggregator` from the raw
 * `DiscoveredDevice` stream.
 */
export interface PhysicalDevice {
  /** Canonical cross-transport id — see `aggregateKey()`. */
  aggregateId: string;
  /** Best-effort display label (longest non-empty link label wins). */
  label: string;
  vendorId?: number;
  productId?: number;
  serialNumber?: string;
  host?: string;
  /** Sparse map — present links only. */
  links: Partial<Record<DiscoveryTransport, DiscoveredDevice>>;
  /** Transport currently chosen as primary (may be null when all offline). */
  activeTransport: DiscoveryTransport | null;
  /** Operator-pinned transport (persisted in portRegistry). */
  preferredTransport: DiscoveryTransport | null;
  /** True when at least one link is online. */
  online: boolean;
  firstSeen: number;
  lastSeen: number;
  /** Last automatic promotion (for UI surfacing). */
  lastPromotion?: {
    from: DiscoveryTransport | null;
    to: DiscoveryTransport;
    at: number;
    reason: 'link-lost' | 'preference-applied' | 'initial';
  };
}

export type PhysicalDeviceEventType =
  | 'added'
  | 'link-added'
  | 'link-updated'
  | 'link-lost'
  | 'promoted'
  | 'removed';

export interface PhysicalDeviceEvent {
  type: PhysicalDeviceEventType;
  device: PhysicalDevice;
  transport?: DiscoveryTransport;
  previousActive?: DiscoveryTransport | null;
}

// ─── Multi-Transport Concurrent Dispatch ──────────────────────────
/**
 * Concurrency mode for sending payloads to a PhysicalDevice across
 * multiple transports simultaneously.
 *
 *  • `single`    — only the active transport is used (legacy behavior).
 *  • `dual`      — active + next-best online link receive every dispatch.
 *  • `broadcast` — every online link receives every dispatch in parallel.
 */
export type LinkMode = 'single' | 'dual' | 'broadcast';

/** Free-form payload routed through MultiTransportLink. */
export interface TransportPayload {
  kind: string;
  /** Optional bytes (DMX universe, PBUS frame, etc.). */
  bytes?: Uint8Array;
  /** Free-form metadata (channel, address, opcode...). */
  meta?: Record<string, unknown>;
  /** Wall-clock origin time, used for end-to-end latency stats. */
  at?: number;
}

export interface DispatchResult {
  transport: DiscoveryTransport;
  ok: boolean;
  latencyMs: number;
  error?: string;
}

export type LinkSendStatus = 'idle' | 'sending' | 'ok' | 'fail';

export interface LinkHealth {
  transport: DiscoveryTransport;
  txOk: number;
  txErr: number;
  /** EMA latency (alpha 0.3). */
  latencyMs: number;
  lastAt: number;
  lastError?: string;
  status: LinkSendStatus;
}

export interface MultiTransportLinkSnapshot {
  aggregateId: string;
  mode: LinkMode;
  participants: DiscoveryTransport[];
  primary: DiscoveryTransport | null;
  health: Partial<Record<DiscoveryTransport, LinkHealth>>;
  totalTxOk: number;
  totalTxErr: number;
  lastDispatch?: {
    at: number;
    okCount: number;
    failCount: number;
    avgLatencyMs: number;
  };
}

export type MultiTransportEventType =
  | 'mode-changed'
  | 'participants-changed'
  | 'tx'
  | 'health';

export interface MultiTransportEvent {
  type: MultiTransportEventType;
  aggregateId: string;
  snapshot: MultiTransportLinkSnapshot;
  results?: DispatchResult[];
}
