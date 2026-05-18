/**
 * ─── useFireOneXL4Bridge — singleton presence relay ─────────────────
 *
 * Non-React module-scoped store that the FireOne XL4+ pairing wizard
 * publishes into on every successful handshake (and on every link-lost
 * event surfaced by `webSerialDiscoverer`). The discovery → registry
 * bridge subscribes here and owns the actual provenance promotion.
 *
 * Why a separate singleton (vs. reusing useFireOneFleet)?
 *   The XL4+ wizard runs WITHOUT mounting useFireOneFleet (which is
 *   only loaded inside `/studio?panel=pyro-fireone`). So we need a
 *   module-level handle that survives wizard unmount and route changes.
 *
 * Honesty contract:
 *   - `notifyHandshakeOk` is the ONLY way `verified=true` is set.
 *   - `notifyHandshakeLost` clears it.
 *   - We also auto-clear when the underlying webSerial port disappears.
 *   - Zero synthetic data; zero auto-promotion.
 */

import { logger } from '@/lib/logger';
import { webSerialDiscoverer } from '@/core/discovery/WebSerialDiscoverer';
import type { DiscoveryEvent } from '@/core/discovery/types';

export interface FireOneXL4BridgeStatus {
  /** True when wizard handshake is fresh AND port is still online. */
  verified: boolean;
  /** Wizard-confirmed firmware ('major.minor'). */
  firmware: string | null;
  /** XL4+ module address from STATUS payload. */
  moduleAddress: number | null;
  /** Baud the wizard authorized at. */
  baudRate: number | null;
  /** WebSerial device id (`webserial:<vid>:<pid>:...`) the wizard locked. */
  deviceId: string | null;
  /** Epoch ms of last handshake transition. */
  lastHandshakeAt: number;
}

const EMPTY: FireOneXL4BridgeStatus = {
  verified: false,
  firmware: null,
  moduleAddress: null,
  baudRate: null,
  deviceId: null,
  lastHandshakeAt: 0,
};

type Listener = (s: FireOneXL4BridgeStatus) => void;

const _listeners = new Set<Listener>();
let _state: FireOneXL4BridgeStatus = { ...EMPTY };
let _serialUnsub: (() => void) | null = null;

function _emit() {
  const snapshot = { ..._state };
  for (const fn of _listeners) {
    try { fn(snapshot); } catch (e) { logger.warn('[fireOneXL4Bridge] listener err', e); }
  }
}

function _ensureSerialWatcher() {
  if (_serialUnsub) return;
  _serialUnsub = webSerialDiscoverer.watch((ev: DiscoveryEvent) => {
    // Only react when a port we actually paired with goes away.
    if (!_state.deviceId) return;
    if (ev.device.id !== _state.deviceId) return;
    if (ev.type === 'lost' || (ev.type === 'updated' && ev.device.online === false)) {
      logger.info('[fireOneXL4Bridge] paired port gone — demoting');
      notifyHandshakeLost();
    }
  });
}

/** Public read-only snapshot for non-React callers. */
export function getFireOneXL4Status(): FireOneXL4BridgeStatus {
  return { ..._state };
}

/** Wizard publishes a successful handshake here. Idempotent on identical input. */
export function notifyHandshakeOk(args: {
  firmware: string;
  moduleAddress: number;
  baudRate: number;
  /** WebSerial device id — preferred when available so we can auto-demote. */
  deviceId?: string;
}): void {
  _ensureSerialWatcher();
  const next: FireOneXL4BridgeStatus = {
    verified: true,
    firmware: args.firmware,
    moduleAddress: args.moduleAddress,
    baudRate: args.baudRate,
    deviceId: args.deviceId ?? null,
    lastHandshakeAt: Date.now(),
  };
  // Skip emit if nothing observable changed.
  const prev = _state;
  if (
    prev.verified === next.verified
    && prev.firmware === next.firmware
    && prev.moduleAddress === next.moduleAddress
    && prev.baudRate === next.baudRate
    && prev.deviceId === next.deviceId
  ) {
    _state = { ...prev, lastHandshakeAt: next.lastHandshakeAt };
    return;
  }
  _state = next;
  _emit();
}

/** Wizard or hot-unplug demotes the bridge. Idempotent. */
export function notifyHandshakeLost(): void {
  if (!_state.verified && _state.deviceId === null) return;
  _state = { ...EMPTY, lastHandshakeAt: Date.now() };
  _emit();
}

/** Subscribe to bridge transitions. Returns unsubscribe. */
export function subscribeFireOneXL4Bridge(fn: Listener): () => void {
  _ensureSerialWatcher();
  _listeners.add(fn);
  // Immediately deliver current state so subscribers don't have to poll.
  try { fn({ ..._state }); } catch (e) { logger.warn('[fireOneXL4Bridge] initial deliver err', e); }
  return () => { _listeners.delete(fn); };
}

/** Test helper: tear everything down. NOT for production use. */
export function _resetFireOneXL4BridgeForTests(): void {
  _state = { ...EMPTY };
  _listeners.clear();
  if (_serialUnsub) { _serialUnsub(); _serialUnsub = null; }
}
