/**
 * ─── Discovery → Registry Bridge (Phase 0) ──────────────────────────
 *
 * The "missing link" that promotes the `FXK16ModuleAdapter` provenance
 * from `not_integrated` → `live_read_only` once a real device completes
 * the FXK16 handshake (`MODEL:FXK16;CH:16` over USB-CDC or BLE).
 *
 * This is the FIRST adapter wired through the bridge. Other adapters
 * (Art-Net, Battery-12V, Mux/SR) keep their `AWAITING_HANDSHAKE` state
 * until their respective discoverers grow the same wiring.
 *
 * Strictly READ-ONLY at the registry boundary:
 *   - Operational firing still flows UI → CommandBus → SafetyStateMachine.
 *   - This bridge only updates provenance + connection state.
 *
 * Honest-Hardware-Layer compliant:
 *   - Zero synthetic data.
 *   - No Math.random.
 *   - Promotion happens only on a verified `MODEL:FXK16` reply.
 *   - Demotion happens immediately on disconnect / heartbeat timeout.
 */

import { logger } from '@/lib/logger';
import { fxk16ModuleAdapter } from './adapters/FXK16ModuleAdapter';
import { artNetNodeAdapter } from './adapters/ArtNetNodeAdapter';
import { dmxUniverseAdapter } from './adapters/DMXUniverseAdapter';
import { unifiedHardwareRegistry } from './UnifiedHardwareRegistry';
import { subscribeFXK16Bridge } from '@/hooks/useFXK16Bridge';
import { mdnsArtnetDiscoverer } from '@/core/discovery/MdnsArtnetDiscoverer';
import { webSerialDiscoverer } from '@/core/discovery/WebSerialDiscoverer';
import type { TransportType } from './provenance';

let _started = false;
let _unsubFxk: (() => void) | null = null;
let _unsubArtnet: (() => void) | null = null;
let _unsubSerial: (() => void) | null = null;
let _lastVerified = false;
/** Track which Art-Net hosts are currently online so we can demote on loss. */
const _artnetOnline = new Set<string>();
/** Track DMX-family serial device ids currently online. */
const _dmxSerialOnline = new Set<string>();

/**
 * Map FXK16 bridge `transport` field to the canonical `TransportType`
 * used by `provenance.ts`. Defaults to `serial_usb`.
 */
function mapTransport(t?: string | null): TransportType {
  if (!t) return 'serial_usb';
  if (/ble|bluetooth/i.test(t)) return 'ble';
  if (/usb|serial|cdc/i.test(t)) return 'serial_usb';
  return 'serial_usb';
}

/**
 * Start the bridge. Idempotent — calling twice is a no-op.
 * Must be invoked once at app boot (e.g. App.tsx mount).
 */
export function startDiscoveryRegistryBridge(): void {
  if (_started) return;
  _started = true;

  // ── FXK16 (USB / BLE) ──────────────────────────────────────────
  _unsubFxk = subscribeFXK16Bridge((status) => {
    const verified =
      !!status.connected
      && (status.deviceModel ?? '').toUpperCase() === 'FXK16'
      && status.channelCount === 16
      && status.linkHealth === 'healthy';

    if (verified === _lastVerified) return;
    _lastVerified = verified;

    if (verified) {
      const transport = mapTransport(status.transport);
      fxk16ModuleAdapter.markHandshakeOk(transport);
      logger.info(
        `[discoveryBridge] FXK16 promoted to LIVE READ-ONLY (transport=${transport})`,
      );
      try { unifiedHardwareRegistry.startPolling(1000); }
      catch (err) { logger.warn('[discoveryBridge] startPolling failed', err); }
    } else {
      fxk16ModuleAdapter.markHandshakeLost();
      logger.info('[discoveryBridge] FXK16 demoted to NOT_INTEGRATED');
    }
  });

  // ── Art-Net (UDP via edge ArtPoll) ─────────────────────────────
  _unsubArtnet = mdnsArtnetDiscoverer.watch((event) => {
    const { device, type } = event;
    if (device.family !== 'artnet-node' || !device.host) return;
    const host = device.host;

    if (type === 'discovered' || type === 'updated') {
      if (!_artnetOnline.has(host)) {
        _artnetOnline.add(host);
        // Promote on FIRST verified ArtPollReply.
        if (_artnetOnline.size === 1) {
          artNetNodeAdapter.markHandshakeOk(host);
          logger.info(
            `[discoveryBridge] Art-Net node promoted to LIVE READ-ONLY (host=${host})`,
          );
          try { unifiedHardwareRegistry.startPolling(1000); }
          catch (err) { logger.warn('[discoveryBridge] startPolling failed', err); }
        }
      }
    } else if (type === 'lost') {
      _artnetOnline.delete(host);
      if (_artnetOnline.size === 0) {
        artNetNodeAdapter.markHandshakeLost();
        logger.info('[discoveryBridge] Art-Net node demoted to NOT_INTEGRATED');
      }
    }
  });
}

/** Stop the bridge — primarily for tests. */
export function stopDiscoveryRegistryBridge(): void {
  if (_unsubFxk) { _unsubFxk(); _unsubFxk = null; }
  if (_unsubArtnet) { _unsubArtnet(); _unsubArtnet = null; }
  _started = false;
  _lastVerified = false;
  _artnetOnline.clear();
}

/** Diagnostic accessor — read-only. */
export function isDiscoveryRegistryBridgeRunning(): boolean {
  return _started;
}
