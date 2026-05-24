/**
 * FXK32Q discovery → registry promotion across ALL FireOne transports.
 *
 * Reuses the same mock pattern as `discoveryRegistryBridge.integration.test.ts`
 * but focuses on the FXK32Q path: a verified VERSION/STATUS handshake reporting
 * `MODEL:FXK32Q;CH:32` over USB, BLE, BLE-LR, WebSocket, Wi-Fi Direct or
 * direct_relay (USB↔RS-485) must promote `fxk32qModuleAdapter`.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { BridgeStatus } from '@/lib/fireoneModuleHardwareBridge';

const fxkListeners = new Set<(s: BridgeStatus) => void>();
const fxk32qListeners = new Set<(s: BridgeStatus) => void>();
const artnetListeners = new Set<(e: unknown) => void>();
const serialListeners = new Set<(e: unknown) => void>();

vi.mock('@/hooks/useFXK16Bridge', () => ({
  subscribeFXK16Bridge: (fn: (s: BridgeStatus) => void) => {
    fxkListeners.add(fn);
    return () => fxkListeners.delete(fn);
  },
}));
vi.mock('@/hooks/useFXK32QBridge', () => ({
  subscribeFXK32QBridge: (fn: (s: BridgeStatus) => void) => {
    fxk32qListeners.add(fn);
    return () => fxk32qListeners.delete(fn);
  },
}));
vi.mock('@/core/discovery/MdnsArtnetDiscoverer', () => ({
  mdnsArtnetDiscoverer: {
    watch: (fn: (e: unknown) => void) => {
      artnetListeners.add(fn);
      return () => artnetListeners.delete(fn);
    },
  },
}));
vi.mock('@/core/discovery/WebSerialDiscoverer', () => ({
  webSerialDiscoverer: {
    watch: (fn: (e: unknown) => void) => {
      serialListeners.add(fn);
      return () => serialListeners.delete(fn);
    },
  },
}));
vi.mock('@/core/hardware/UnifiedHardwareRegistry', async () => {
  const actual = await vi.importActual<typeof import('@/core/hardware/UnifiedHardwareRegistry')>(
    '@/core/hardware/UnifiedHardwareRegistry',
  );
  return {
    ...actual,
    unifiedHardwareRegistry: new Proxy(actual.unifiedHardwareRegistry, {
      get(target, prop, receiver) {
        if (prop === 'startPolling') return () => {};
        return Reflect.get(target, prop, receiver);
      },
    }),
  };
});

import {
  startDiscoveryRegistryBridge,
  stopDiscoveryRegistryBridge,
} from '../discoveryRegistryBridge';
import { fxk32qModuleAdapter } from '../adapters/FXK32QModuleAdapter';

function statusFor(transport: BridgeStatus['transport'], extra: Partial<BridgeStatus> = {}): BridgeStatus {
  return {
    connected: true,
    deviceModel: 'FXK32Q',
    channelCount: 32,
    transport,
    linkHealth: 'healthy',
    firmwareVersion: '1.0.0',
    ...extra,
  } as unknown as BridgeStatus;
}

const lostStatus = (): BridgeStatus => ({
  connected: false,
  deviceModel: undefined,
  channelCount: 0,
  transport: 'none',
  linkHealth: 'disconnected',
} as unknown as BridgeStatus);

describe('discoveryRegistryBridge · FXK32Q across all FireOne transports', () => {
  beforeEach(() => {
    fxkListeners.clear();
    fxk32qListeners.clear();
    artnetListeners.clear();
    serialListeners.clear();
    fxk32qModuleAdapter.reset();
    startDiscoveryRegistryBridge();
  });
  afterEach(() => {
    stopDiscoveryRegistryBridge();
    fxk32qModuleAdapter.reset();
  });

  it.each([
    ['usb',          'serial_usb'],
    ['ble',          'ble'],
    ['ble_lr',       'ble'],
    ['websocket',    'ethernet_tcp'],
    ['wifi_direct',  'wifi'],
    ['direct_relay', 'serial_usb'], // USB↔RS-485 XLII+ slave
  ] as const)('promotes FXK32Q to LIVE READ-ONLY when handshake arrives via %s', (t, expected) => {
    fxk32qListeners.forEach((fn) => fn(statusFor(t)));
    const prov = fxk32qModuleAdapter.getProvenance();
    expect(prov.integration_mode).toBe('live_read_only');
    expect(prov.transport_type).toBe(expected);
  });

  it('rejects promotion when MODEL token is wrong', () => {
    fxk32qListeners.forEach((fn) =>
      fn(statusFor('usb', { deviceModel: 'FXK16', channelCount: 16 })),
    );
    expect(fxk32qModuleAdapter.getProvenance().integration_mode).toBe('not_integrated');
  });

  it('rejects promotion when channelCount is wrong', () => {
    fxk32qListeners.forEach((fn) =>
      fn(statusFor('usb', { channelCount: 16 })),
    );
    expect(fxk32qModuleAdapter.getProvenance().integration_mode).toBe('not_integrated');
  });

  it('demotes FXK32Q on link loss', () => {
    fxk32qListeners.forEach((fn) => fn(statusFor('usb')));
    expect(fxk32qModuleAdapter.getProvenance().integration_mode).toBe('live_read_only');
    fxk32qListeners.forEach((fn) => fn(lostStatus()));
    expect(fxk32qModuleAdapter.getProvenance().integration_mode).toBe('not_integrated');
  });
});
