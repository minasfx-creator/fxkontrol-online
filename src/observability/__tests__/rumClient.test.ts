import { describe, it, expect, beforeEach } from 'vitest';
import { pushRumEvent, _drainRumQueueForTest, getRumSessionId } from '../rumClient';

describe('rumClient', () => {
  beforeEach(() => {
    _drainRumQueueForTest();
  });

  it('enqueues events with a stable envelope', () => {
    pushRumEvent({
      type: 'web_vital',
      route: '/editor',
      payload: { name: 'CLS', value: 0.1 },
    });

    const drained = _drainRumQueueForTest();
    expect(drained).toHaveLength(1);
    expect(drained[0]).toMatchObject({
      type: 'web_vital',
      route: '/editor',
      sessionId: getRumSessionId(),
    });
    expect(drained[0].id).toBeTruthy();
    expect(drained[0].ts).toBeGreaterThan(0);
    expect(drained[0].build).toBeTruthy();
  });

  it('preserves correlation IDs', () => {
    pushRumEvent({
      type: 'error',
      route: '/x',
      replayId: 'r1',
      traceId: 't1',
      payload: { message: 'boom' },
    });
    const [evt] = _drainRumQueueForTest();
    expect(evt.replayId).toBe('r1');
    expect(evt.traceId).toBe('t1');
  });

  it('keeps a stable sessionId across calls', () => {
    const a = getRumSessionId();
    const b = getRumSessionId();
    expect(a).toBe(b);
    expect(a.length).toBeGreaterThan(8);
  });
});
