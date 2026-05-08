/**
 * ─── useShowvenM1Bridge — singleton presence relay ─────────────────
 *
 * Espelho do `useFireOneXL4Bridge`. Wizard/handshake publica aqui
 * (notifyHandshakeOk/notifyHandshakeLost) e o `discoveryRegistryBridge`
 * subscreve para promover/demote o `showvenM1Adapter`.
 *
 * Honesty contract:
 *   - `notifyHandshakeOk` é a ÚNICA forma de marcar verified=true.
 *   - `notifyHandshakeLost` limpa.
 *   - Auto-clear quando a porta WebSerial paired desaparece.
 *   - Zero dado sintético, zero auto-promoção.
 */

import { logger } from '@/lib/logger';
import { webSerialDiscoverer } from '@/core/discovery/WebSerialDiscoverer';
import type { DiscoveryEvent } from '@/core/discovery/types';

export interface ShowvenM1BridgeStatus {
  verified: boolean;
  firmware: string | null;
  masterAddress: number | null;
  baudRate: number | null;
  slavesOnline: number;
  deviceId: string | null;
  lastHandshakeAt: number;
}

const EMPTY: ShowvenM1BridgeStatus = {
  verified: false,
  firmware: null,
  masterAddress: null,
  baudRate: null,
  slavesOnline: 0,
  deviceId: null,
  lastHandshakeAt: 0,
};

type Listener = (s: ShowvenM1BridgeStatus) => void;

const _listeners = new Set<Listener>();
let _state: ShowvenM1BridgeStatus = { ...EMPTY };
let _serialUnsub: (() => void) | null = null;

function _emit() {
  const snapshot = { ..._state };
  for (const fn of _listeners) {
    try { fn(snapshot); } catch (e) { logger.warn('[showvenM1Bridge] listener err', e); }
  }
}

function _ensureSerialWatcher() {
  if (_serialUnsub) return;
  _serialUnsub = webSerialDiscoverer.watch((ev: DiscoveryEvent) => {
    if (!_state.deviceId) return;
    if (ev.device.id !== _state.deviceId) return;
    if (ev.type === 'lost' || (ev.type === 'updated' && ev.device.online === false)) {
      logger.info('[showvenM1Bridge] paired port gone — demoting');
      notifyHandshakeLost();
    }
  });
}

export function getShowvenM1Status(): ShowvenM1BridgeStatus {
  return { ..._state };
}

export function notifyHandshakeOk(args: {
  firmware: string;
  masterAddress: number;
  baudRate: number;
  slavesOnline?: number;
  deviceId?: string;
}): void {
  _ensureSerialWatcher();
  const next: ShowvenM1BridgeStatus = {
    verified: true,
    firmware: args.firmware,
    masterAddress: args.masterAddress,
    baudRate: args.baudRate,
    slavesOnline: Math.max(0, args.slavesOnline ?? 0),
    deviceId: args.deviceId ?? null,
    lastHandshakeAt: Date.now(),
  };
  const prev = _state;
  if (
    prev.verified === next.verified
    && prev.firmware === next.firmware
    && prev.masterAddress === next.masterAddress
    && prev.baudRate === next.baudRate
    && prev.slavesOnline === next.slavesOnline
    && prev.deviceId === next.deviceId
  ) {
    _state = { ...prev, lastHandshakeAt: next.lastHandshakeAt };
    return;
  }
  _state = next;
  _emit();
}

export function notifyHandshakeLost(): void {
  if (!_state.verified && _state.deviceId === null) return;
  _state = { ...EMPTY, lastHandshakeAt: Date.now() };
  _emit();
}

export function subscribeShowvenM1Bridge(fn: Listener): () => void {
  _ensureSerialWatcher();
  _listeners.add(fn);
  try { fn({ ..._state }); } catch (e) { logger.warn('[showvenM1Bridge] initial deliver err', e); }
  return () => { _listeners.delete(fn); };
}

export function _resetShowvenM1BridgeForTests(): void {
  _state = { ...EMPTY };
  _listeners.clear();
  if (_serialUnsub) { _serialUnsub(); _serialUnsub = null; }
}
