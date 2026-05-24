import { describe, it, expect, beforeEach } from 'vitest';
import {
  notifyHandshakeOk,
  notifyHandshakeLost,
  subscribeShowvenM1Bridge,
  _resetShowvenM1BridgeForTests,
} from '@/hooks/useShowvenM1Bridge';
import { showvenM1Adapter } from '@/core/hardware/adapters/ShowvenM1Adapter';
import { startDiscoveryRegistryBridge, stopDiscoveryRegistryBridge } from '@/core/hardware/discoveryRegistryBridge';

describe('Showven M1 discovery → registry bridge', () => {
  beforeEach(() => {
    stopDiscoveryRegistryBridge();
    _resetShowvenM1BridgeForTests();
    showvenM1Adapter.reset();
    startDiscoveryRegistryBridge();
  });

  it('promotes adapter on notifyHandshakeOk', () => {
    expect(showvenM1Adapter.getConnectionState()).toBe('disconnected');
    notifyHandshakeOk({ firmware: '1.5.0', masterAddress: 1, baudRate: 19200, slavesOnline: 4 });
    expect(showvenM1Adapter.getConnectionState()).toBe('connected');
    expect(showvenM1Adapter.getFirmware()).toBe('1.5.0');
    expect(showvenM1Adapter.getSlavesOnline()).toBe(4);
  });

  it('demotes on notifyHandshakeLost', () => {
    notifyHandshakeOk({ firmware: '1.5.0', masterAddress: 1, baudRate: 19200 });
    notifyHandshakeLost();
    expect(showvenM1Adapter.getConnectionState()).toBe('disconnected');
  });

  it('subscribers receive immediate snapshot', () => {
    let received = 0;
    const unsub = subscribeShowvenM1Bridge(() => { received++; });
    expect(received).toBe(1);
    unsub();
  });
});
