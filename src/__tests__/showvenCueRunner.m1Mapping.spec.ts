import { describe, it, expect } from 'vitest';
import { ShowvenCueRunner } from '@/features/viewport-tools/hardware/showvenCueRunner';

describe('ShowvenCueRunner — M1 cueIndex mapping', () => {
  it('resolves cueIndex via default M1 layout', () => {
    const runner = new ShowvenCueRunner();
    const r = runner.load([
      { id: 'a', startTime: 0,   cueIndex: 1   } as any,
      { id: 'b', startTime: 0.1, cueIndex: 17  } as any,
      { id: 'c', startTime: 0.2, cueIndex: 128 } as any,
    ]);
    expect(r.loaded).toBe(3);
    expect(r.skipped).toBe(0);
    const devs = runner.getDeviceList();
    expect(devs).toEqual([1, 2, 8]);
  });

  it('falls back to rack/tube when cueIndex absent', () => {
    const runner = new ShowvenCueRunner();
    const r = runner.load([
      { id: 'x', startTime: 0, rack: 3, tube: 5 } as any,
    ]);
    expect(r.loaded).toBe(1);
    expect(runner.getDeviceList()).toEqual([3]);
  });

  it('honors m1CueOverride', () => {
    const runner = new ShowvenCueRunner({ m1CueOverride: { 1: { slaveAddress: 9, channel: 2 } } });
    runner.load([{ id: 'a', startTime: 0, cueIndex: 1 } as any]);
    expect(runner.getDeviceList()).toEqual([9]);
  });

  it('skips out-of-range cueIndex', () => {
    const runner = new ShowvenCueRunner();
    const r = runner.load([{ id: 'x', startTime: 0, cueIndex: 999 } as any]);
    expect(r.loaded).toBe(0);
    expect(r.skipped).toBe(1);
  });
});
