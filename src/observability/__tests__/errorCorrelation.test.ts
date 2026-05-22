import { describe, it, expect, afterEach } from 'vitest';
import {
  clearReplayContext,
  createReplayId,
  getReplayContext,
  setReplayContext,
} from '../errorCorrelation';

describe('errorCorrelation', () => {
  afterEach(() => clearReplayContext());

  it('stores and clears replay context', () => {
    setReplayContext('replay-1', 'trace-1');
    expect(getReplayContext()).toEqual({ replayId: 'replay-1', traceId: 'trace-1' });
    clearReplayContext();
    expect(getReplayContext()).toEqual({ replayId: undefined, traceId: undefined });
  });

  it('allows replayId without a traceId', () => {
    setReplayContext('r-only');
    expect(getReplayContext()).toEqual({ replayId: 'r-only', traceId: undefined });
  });

  it('creates replay ids with prefix', () => {
    const id = createReplayId('fxk');
    expect(id.startsWith('fxk_')).toBe(true);
    expect(id.length).toBeGreaterThan(8);
  });
});
