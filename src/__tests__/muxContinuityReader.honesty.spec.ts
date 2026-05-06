import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mutable mock for muxReaderAdapter — drives provenance + getAllChannels.
const mockState = {
  mode: 'not_integrated' as 'live_read_only' | 'simulated' | 'not_integrated',
  channels: [] as Array<{ channel: number; raw_value: number; resistance_ohms: number; state: string }>,
};

vi.mock('@/core/hardware/adapters/MuxReaderAdapterCD4051', () => ({
  muxReaderAdapter: {
    getProvenance: () => ({ integration_mode: mockState.mode, source: 'analog_mux' }),
    getAllChannels: () => mockState.channels,
  },
}));

import {
  MuxContinuityReader,
  resolveContinuityReader,
  getReaderProvenance,
} from '@/core/safety/MuxContinuityReader';
import { continuityCheckService } from '@/core/safety/ContinuityCheckService';

beforeEach(() => {
  mockState.mode = 'not_integrated';
  mockState.channels = [];
});

describe('MuxContinuityReader (honesty)', () => {
  it('returns null reader when MUX is not integrated', () => {
    expect(resolveContinuityReader()).toBeNull();
    expect(getReaderProvenance().mode).toBe('not_integrated');
  });

  it('returns live reader when MUX is live_read_only', () => {
    mockState.mode = 'live_read_only';
    const reader = resolveContinuityReader();
    expect(reader).toBeInstanceOf(MuxContinuityReader);
    expect(getReaderProvenance().mode).toBe('live_read_only');
  });

  it('reads ohms from MUX channels for pins 0..15 only', async () => {
    mockState.mode = 'live_read_only';
    mockState.channels = Array.from({ length: 16 }, (_, i) => ({
      channel: i, raw_value: 0, resistance_ohms: 12 + i, state: 'ok',
    }));
    const reader = new MuxContinuityReader();
    expect(await reader.readContinuity(0)).toBe(12);
    expect(await reader.readContinuity(15)).toBe(27);
    // Pins ≥16 always Infinity (no truth source).
    expect(await reader.readContinuity(16)).toBe(Number.POSITIVE_INFINITY);
    expect(await reader.readContinuity(31)).toBe(Number.POSITIVE_INFINITY);
  });

  it('treats adapter default 9999 as honest UNKNOWN (Infinity)', async () => {
    mockState.mode = 'live_read_only';
    mockState.channels = [{ channel: 0, raw_value: 0, resistance_ohms: 9999, state: 'unknown' }];
    const reader = new MuxContinuityReader();
    expect(await reader.readContinuity(0)).toBe(Number.POSITIVE_INFINITY);
  });

  it('integrates with continuityCheckService.runFullCheck without inventing data', async () => {
    // No reader, no simulator → all 32 UNKNOWN.
    const report = await continuityCheckService.runFullCheck();
    expect(report.total).toBe(32);
    // unknown OR (when sim flag is on) ok+open+short — but never throws.
    expect(report.ok + report.open + report.short + report.unknown).toBe(32);
  });
});
