import { describe, it, expect } from 'vitest';
import { channelsToMask32, isFxk32q, FXK32Q_MAX_CHANNEL } from '../pinmap';

describe('FXK32Q pinmap helpers', () => {
  it('builds 32-bit mask correctly', () => {
    expect(channelsToMask32([1])).toBe(0x00000001);
    expect(channelsToMask32([32])).toBe(0x80000000 >>> 0);
    expect(channelsToMask32([1, 17, 32])).toBe((0x00000001 | (1 << 16) | (0x80000000 >>> 0)) >>> 0);
  });

  it('rejects out-of-range channels', () => {
    expect(() => channelsToMask32([0])).toThrow();
    expect(() => channelsToMask32([FXK32Q_MAX_CHANNEL + 1])).toThrow();
    expect(() => channelsToMask32([1.5])).toThrow();
  });

  it('isFxk32q recognizes MODEL:FXK32Q;CH:32', () => {
    expect(isFxk32q('FXK32Q', 32)).toBe(true);
    expect(isFxk32q('fxk32q', 32)).toBe(true);
    expect(isFxk32q('FXK16', 16)).toBe(false);
    expect(isFxk32q('FXK32Q', 16)).toBe(false);
    expect(isFxk32q(undefined, 32)).toBe(false);
  });
});
