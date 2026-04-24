import { describe, it, expect, afterEach, vi } from 'vitest';
import { captureError } from '../errorCapture';
import { clearReplayContext, setReplayContext } from '../errorCorrelation';
import type { RumClient } from '../rumClient';

vi.mock('../rumClient', async () => {
  const actual = await vi.importActual<typeof import('../rumClient')>('../rumClient');
  const client = new actual.RumClient({ enabled: true, endpoint: undefined, build: 'test' });
  return {
    ...actual,
    rumClient: client,
    pushRumEvent: (event: Parameters<typeof actual.pushRumEvent>[0]) => client.push(event),
    __client: client,
  };
});

describe('errorCapture', () => {
  afterEach(() => clearReplayContext());

  it('correlates errors with replay and trace ids', async () => {
    const mod = await import('../rumClient');
    const client = (mod as unknown as { __client: RumClient }).__client;

    setReplayContext('replay-123', 'trace-456');
    captureError(new Error('replay failure'), 'manual');

    const event = client.getQueueSnapshot().at(-1);
    expect(event?.type).toBe('error');
    expect(event?.replayId).toBe('replay-123');
    expect(event?.traceId).toBe('trace-456');
    expect(event?.payload.message).toBe('replay failure');
    expect(event?.payload.source).toBe('manual');
  });

  it('captures string rejections without stack', async () => {
    const mod = await import('../rumClient');
    const client = (mod as unknown as { __client: RumClient }).__client;

    captureError('plain string', 'unhandled_rejection');
    const event = client.getQueueSnapshot().at(-1);
    expect(event?.payload.message).toBe('plain string');
    expect(event?.payload.stack).toBeUndefined();
    expect(event?.payload.source).toBe('unhandled_rejection');
  });
});
