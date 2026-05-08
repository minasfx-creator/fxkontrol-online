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
import { fxk32qModuleAdapter } from './adapters/FXK32QModuleAdapter';
import { fireOneXL4Adapter } from './adapters/FireOneXL4Adapter';
import { showvenM1Adapter } from './adapters/ShowvenM1Adapter';
import { artNetNodeAdapter } from './adapters/ArtNetNodeAdapter';
import { dmxUniverseAdapter } from './adapters/DMXUniverseAdapter';
import { batteryMonitorAdapter } from './adapters/BatteryMonitorAdapter';
import { muxReaderAdapter } from './adapters/MuxReaderAdapterCD4051';
import { shiftRegisterAdapter } from './adapters/ShiftRegisterAdapter74HC595';
import { unifiedHardwareRegistry } from './UnifiedHardwareRegistry';
import { subscribeFXK16Bridge } from '@/hooks/useFXK16Bridge';
import { subscribeFXK32QBridge } from '@/hooks/useFXK32QBridge';
import { subscribeFireOneXL4Bridge } from '@/hooks/useFireOneXL4Bridge';
import { subscribeShowvenM1Bridge } from '@/hooks/useShowvenM1Bridge';
import { isFxk32q } from '@/lib/fxk32q/pinmap';
import { mdnsArtnetDiscoverer } from '@/core/discovery/MdnsArtnetDiscoverer';
import { webSerialDiscoverer } from '@/core/discovery/WebSerialDiscoverer';
import type { TransportType } from './provenance';

let _started = false;
let _unsubFxk: (() => void) | null = null;
let _unsubFxk32q: (() => void) | null = null;
let _unsubXl4: (() => void) | null = null;
let _unsubM1: (() => void) | null = null;
let _unsubArtnet: (() => void) | null = null;
let _unsubSerial: (() => void) | null = null;
let _lastVerified = false;
let _lastFxk32qVerified = false;
let _lastXl4Verified = false;
let _lastM1Verified = false;
/** Track which Art-Net hosts are currently online so we can demote on loss. */
const _artnetOnline = new Set<string>();
/** Track DMX-family serial device ids currently online. */
const _dmxSerialOnline = new Set<string>();

/**
 * Map FireOneHardwareBridge `transport` to the canonical `TransportType`.
 * Cobre TODOS os 6 transports usados em FXK16/FXK32Q:
 *  ble | ble_lr → 'ble'
 *  usb | direct_relay → 'serial_usb' (RS-485 via USB↔RS485 cai aqui)
 *  websocket → 'ethernet_tcp'
 *  wifi_direct → 'wifi'
 */
function mapTransport(t?: string | null): TransportType {
  if (!t) return 'serial_usb';
  if (/wifi_direct/i.test(t)) return 'wifi';
  if (/websocket/i.test(t)) return 'ethernet_tcp';
  if (/ble|bluetooth/i.test(t)) return 'ble';
  if (/usb|serial|cdc|relay/i.test(t)) return 'serial_usb';
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
      // Battery 12V, CD4051 mux reading and 74HC595 chain are all
      // piggy-back on the FXK16 host controller — promote together on
      // the same handshake (all read-only; canWrite=false).
      batteryMonitorAdapter.markHandshakeOk(transport);
      muxReaderAdapter.markHandshakeOk(transport);
      shiftRegisterAdapter.markHandshakeOk(transport);
      logger.info(
        `[discoveryBridge] FXK16 + Battery-12V + Mux + SR promoted to LIVE READ-ONLY (transport=${transport})`,
      );
      try { unifiedHardwareRegistry.startPolling(1000); }
      catch (err) { logger.warn('[discoveryBridge] startPolling failed', err); }
    } else {
      fxk16ModuleAdapter.markHandshakeLost();
      batteryMonitorAdapter.markHandshakeLost();
      muxReaderAdapter.markHandshakeLost();
      shiftRegisterAdapter.markHandshakeLost();
      logger.info('[discoveryBridge] FXK16 + Battery-12V + Mux + SR demoted to NOT_INTEGRATED');
    }
  });

  // ── FXK32Q (USB / BLE / BLE-LR / WebSocket / Wi-Fi Direct / RS-485) ──
  // Espelho do FXK16 — mesmo handshake VERSION/STATUS, mas espera
  // `MODEL:FXK32Q;CH:32`. Promovido em qualquer dos 6 transports.
  _unsubFxk32q = subscribeFXK32QBridge((status) => {
    const verified =
      !!status.connected
      && isFxk32q(status.deviceModel, status.channelCount)
      && status.linkHealth === 'healthy';

    if (verified === _lastFxk32qVerified) return;
    _lastFxk32qVerified = verified;

    if (verified) {
      const transport = mapTransport(status.transport);
      fxk32qModuleAdapter.markHandshakeOk(transport);
      logger.info(
        `[discoveryBridge] FXK32Q promoted to LIVE READ-ONLY (transport=${transport}, fw=${status.firmwareVersion ?? '?'})`,
      );
      try { unifiedHardwareRegistry.startPolling(1000); }
      catch (err) { logger.warn('[discoveryBridge] startPolling failed', err); }
    } else {
      fxk32qModuleAdapter.markHandshakeLost();
      logger.info('[discoveryBridge] FXK32Q demoted to NOT_INTEGRATED');
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

  // ── DMX Universe (USB-DMX via Web Serial) ──────────────────────
  // Promote when ANY authorized Web Serial port is classified as
  // family === 'dmx' (Enttec, USBDMX, uDMX, etc.). Demote when none.
  _unsubSerial = webSerialDiscoverer.watch((event) => {
    const { device, type } = event;
    if (device.family !== 'dmx') return;

    if ((type === 'discovered' || type === 'updated') && device.online) {
      if (!_dmxSerialOnline.has(device.id)) {
        _dmxSerialOnline.add(device.id);
        if (_dmxSerialOnline.size === 1) {
          dmxUniverseAdapter.markHandshakeOk(device.label);
          logger.info(
            `[discoveryBridge] DMX universe promoted to LIVE READ-ONLY (label=${device.label})`,
          );
          try { unifiedHardwareRegistry.startPolling(1000); }
          catch (err) { logger.warn('[discoveryBridge] startPolling failed', err); }
        }
      }
    } else if (type === 'lost') {
      _dmxSerialOnline.delete(device.id);
      if (_dmxSerialOnline.size === 0) {
        dmxUniverseAdapter.markHandshakeLost();
        logger.info('[discoveryBridge] DMX universe demoted to NOT_INTEGRATED');
      }
    }
  });

  // ── FireOne XL4+ (USB-FTDI / RS-485) ───────────────────────────
  // Wizard publishes verified handshake → singleton bridge → here.
  _unsubXl4 = subscribeFireOneXL4Bridge((status) => {
    if (status.verified === _lastXl4Verified) return;
    _lastXl4Verified = status.verified;
    if (status.verified) {
      fireOneXL4Adapter.markHandshakeOk({
        transport: 'serial_usb',
        firmware: status.firmware ?? undefined,
        moduleAddress: status.moduleAddress ?? undefined,
        baudRate: status.baudRate ?? undefined,
      });
      logger.info(
        `[discoveryBridge] FireOne XL4+ promoted to LIVE READ-ONLY (fw=${status.firmware ?? '?'}, addr=${status.moduleAddress ?? '?'}, baud=${status.baudRate ?? '?'})`,
      );
      try { unifiedHardwareRegistry.startPolling(1000); }
      catch (err) { logger.warn('[discoveryBridge] startPolling failed', err); }
    } else {
      fireOneXL4Adapter.markHandshakeLost();
      logger.info('[discoveryBridge] FireOne XL4+ demoted to NOT_INTEGRATED');
    }
  });

  // ── Showven M1 / FXcommander Pro (PBus dual-band via USB-FTDI) ─
  // Wizard publishes verified PBus STATUS (FW ≥ V1.5) → singleton → here.
  _unsubM1 = subscribeShowvenM1Bridge((status) => {
    if (status.verified === _lastM1Verified) return;
    _lastM1Verified = status.verified;
    if (status.verified) {
      showvenM1Adapter.markHandshakeOk({
        transport: 'serial_usb',
        firmware: status.firmware ?? undefined,
        masterAddress: status.masterAddress ?? undefined,
        baudRate: status.baudRate ?? undefined,
        slavesOnline: status.slavesOnline,
      });
      logger.info(
        `[discoveryBridge] Showven M1 promoted to LIVE READ-ONLY (fw=${status.firmware ?? '?'}, addr=${status.masterAddress ?? '?'}, baud=${status.baudRate ?? '?'}, slaves=${status.slavesOnline})`,
      );
      try { unifiedHardwareRegistry.startPolling(1000); }
      catch (err) { logger.warn('[discoveryBridge] startPolling failed', err); }
    } else {
      showvenM1Adapter.markHandshakeLost();
      logger.info('[discoveryBridge] Showven M1 demoted to NOT_INTEGRATED');
    }
  });
}
export function stopDiscoveryRegistryBridge(): void {
  if (_unsubFxk) { _unsubFxk(); _unsubFxk = null; }
  if (_unsubFxk32q) { _unsubFxk32q(); _unsubFxk32q = null; }
  if (_unsubXl4) { _unsubXl4(); _unsubXl4 = null; }
  if (_unsubM1) { _unsubM1(); _unsubM1 = null; }
  if (_unsubArtnet) { _unsubArtnet(); _unsubArtnet = null; }
  if (_unsubSerial) { _unsubSerial(); _unsubSerial = null; }
  _started = false;
  _lastVerified = false;
  _lastFxk32qVerified = false;
  _lastXl4Verified = false;
  _lastM1Verified = false;
  _artnetOnline.clear();
  _dmxSerialOnline.clear();
}

/** Diagnostic accessor — read-only. */
export function isDiscoveryRegistryBridgeRunning(): boolean {
  return _started;
}
