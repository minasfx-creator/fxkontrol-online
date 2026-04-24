import { describe, it, expect, beforeEach } from 'vitest';
import {
  setReplayContext,
  getReplayContext,
  clearReplayContext,
} from '../errorCorrelation';

describe('errorCorrelation', () => {
  beforeEach(() => clearReplayContext());

  it('returns undefined when no replay is active', () => {
    expect(getReplayContext()).toEqual({ replayId: undefined, traceId: undefined });
  });

  it('attaches replay + trace IDs', () => {
    setReplayContext('r-1', 't-1');
    expect(getReplayContext()).toEqual({ replayId: 'r-1', traceId: 't-1' });
  });

  it('clears the context', () => {
    setReplayContext('r-1', 't-1');
    clearReplayContext();
    expect(getReplayContext()).toEqual({ replayId: undefined, traceId: undefined });
  });

  it('allows replayId without a traceId', () => {
    setReplayContext('r-only');
    expect(getReplayContext()).toEqual({ replayId: 'r-only', traceId: undefined });
  });
});
