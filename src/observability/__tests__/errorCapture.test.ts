import { describe, it, expect, beforeEach } from 'vitest';
import { captureError } from '../errorCapture';
import { _drainRumQueueForTest } from '../rumClient';
import { setReplayContext, clearReplayContext } from '../errorCorrelation';

describe('errorCapture', () => {
  beforeEach(() => {
    _drainRumQueueForTest();
    clearReplayContext();
  });

  it('captures Error instances with sanitized message + stack', () => {
    captureError(new Error('boom'));
    const [evt] = _drainRumQueueForTest();
    expect(evt.type).toBe('error');
    expect(evt.payload.message).toBe('boom');
    expect(typeof evt.payload.stack).toBe('string');
  });

  it('captures string rejections', () => {
    captureError('plain string');
    const [evt] = _drainRumQueueForTest();
    expect(evt.payload.message).toBe('plain string');
    expect(evt.payload.stack).toBeUndefined();
  });

  it('attaches active replay context', () => {
    setReplayContext('r-42', 't-42');
    captureError(new Error('contextual'));
    const [evt] = _drainRumQueueForTest();
    expect(evt.replayId).toBe('r-42');
    expect(evt.traceId).toBe('t-42');
  });

  it('caps stack at 1000 chars', () => {
    const e = new Error('big');
    e.stack = 'x'.repeat(5000);
    captureError(e);
    const [evt] = _drainRumQueueForTest();
    expect((evt.payload.stack as string).length).toBeLessThanOrEqual(1000);
  });
});
