import { describe, it, expect, vi } from 'vitest';
import { RumClient } from '../rumClient';

describe('RumClient', () => {
  it('queues sanitized events when endpoint is missing', () => {
    const client = new RumClient({
      enabled: true,
      endpoint: undefined,
      build: 'test',
      maxQueue: 10,
    });

    client.push({
      type: 'web_vital',
      route: '/editor',
      payload: {
        name: 'LCP',
        value: 123,
        command: 'FIRE:1:100',          // must be dropped
        frames: [{ dir: 'rx', data: 'SECRET' }], // must be dropped
        email: 'op@example.com',        // must be dropped
      },
    });

    const q = client.getQueueSnapshot();
    expect(q).toHaveLength(1);
    expect(q[0].payload.name).toBe('LCP');
    expect(q[0].payload.value).toBe(123);
    expect(q[0].payload.command).toBeUndefined();
    expect(q[0].payload.frames).toBeUndefined();
    expect(q[0].payload.email).toBeUndefined();
  });

  it('flush is no-op without endpoint', () => {
    const client = new RumClient({ endpoint: undefined, build: 'test' });
    client.push({
      type: 'route_change',
      route: '/',
      payload: { from: '/', to: '/editor', durationMs: 10 },
    });
    expect(client.flush()).toBe(false);
    expect(client.getQueueSize()).toBe(1);
  });

  it('flush uses sendBeacon when available', () => {
    const sendBeacon = vi.fn(() => true);
    vi.stubGlobal('navigator', { sendBeacon });

    const client = new RumClient({ endpoint: '/rum', build: 'test' });
    client.push({ type: 'error', route: '/', payload: { message: 'boom' } });

    expect(client.flush()).toBe(true);
    expect(sendBeacon).toHaveBeenCalled();
    expect(client.getQueueSize()).toBe(0);

    vi.unstubAllGlobals();
  });

  it('truncates long string fields to 1000 chars', () => {
    const client = new RumClient({ endpoint: undefined, build: 'test' });
    client.push({
      type: 'error',
      route: '/',
      payload: { message: 'x'.repeat(5000) },
    });
    const [evt] = client.getQueueSnapshot();
    expect((evt.payload.message as string).length).toBeLessThanOrEqual(1001);
  });

  it('produces stable envelope (id, ts, sessionId, build)', () => {
    const client = new RumClient({ endpoint: undefined, build: 'v9' });
    const evt = client.push({ type: 'web_vital', route: '/x', payload: { name: 'LCP', value: 1 } });
    expect(evt?.id).toBeTruthy();
    expect(evt?.ts).toBeGreaterThan(0);
    expect(evt?.sessionId).toBe(client.getSessionId());
    expect(evt?.build).toBe('v9');
  });
});
