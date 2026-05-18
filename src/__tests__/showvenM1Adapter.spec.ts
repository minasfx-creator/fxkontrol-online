import { describe, it, expect, beforeEach } from 'vitest';
import {
  ShowvenM1Adapter,
} from '@/core/hardware/adapters/ShowvenM1Adapter';

describe('ShowvenM1Adapter', () => {
  let adapter: ShowvenM1Adapter;
  beforeEach(() => { adapter = new ShowvenM1Adapter(); });

  it('starts disconnected with 128 channels and not_integrated provenance', () => {
    expect(adapter.getConnectionState()).toBe('disconnected');
    expect(adapter.getCapabilities().maxChannels).toBe(128);
    expect(adapter.getCapabilities().canWrite).toBe(false);
    expect(adapter.getProvenance().integration_mode).toBe('simulated');
    expect(adapter.getFirmware()).toBeNull();
  });

  it('promotes via markHandshakeOk and exposes metadata', () => {
    adapter.markHandshakeOk({ firmware: '1.5.0', masterAddress: 1, baudRate: 19200, slavesOnline: 3 });
    expect(adapter.getConnectionState()).toBe('connected');
    expect(adapter.getFirmware()).toBe('1.5.0');
    expect(adapter.getMasterAddress()).toBe(1);
    expect(adapter.getBaudRate()).toBe(19200);
    expect(adapter.getSlavesOnline()).toBe(3);
    const snap = adapter.getSnapshot();
    expect(snap.online).toBe(true);
    expect(snap.metrics.firmware).toBe('1.5.0');
    expect(snap.metrics.slaves_online).toBe(3);
  });

  it('demotes via markHandshakeLost', () => {
    adapter.markHandshakeOk({ firmware: '1.5.0', masterAddress: 1, baudRate: 19200 });
    adapter.markHandshakeLost();
    expect(adapter.getConnectionState()).toBe('disconnected');
  });

  it('reset() clears metadata', () => {
    adapter.markHandshakeOk({ firmware: '1.5.0', masterAddress: 2, baudRate: 19200 });
    adapter.reset();
    expect(adapter.getFirmware()).toBeNull();
    expect(adapter.getMasterAddress()).toBeNull();
    expect(adapter.getSlavesOnline()).toBe(0);
  });
});
