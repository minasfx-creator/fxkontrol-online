import { describe, it, expect, beforeEach, vi } from 'vitest';
import { commandBus } from '@/core/command/CommandBus';
import { fieldBus } from '@/core/network/fieldBus';
import { workMode } from '@/core/safety/workMode';
import { attachCommandFireRouter, detachCommandFireRouter } from '@/core/command/commandFireRouter';

describe('commandFireRouter', () => {
  beforeEach(() => {
    detachCommandFireRouter();
    workMode.set('simulation');
    // wire one alive transport
    fieldBus.setTransport('rs485', { isAlive: () => true, send: () => true });
    fieldBus.heartbeat('rs485');
  });

  it('subscribes once (idempotent attach)', () => {
    const a = attachCommandFireRouter();
    const b = attachCommandFireRouter();
    expect(a).toBe(b);
  });

  it('manual fire payload reaches fieldBus.send via pyroExecutor', async () => {
    const sentBytes: any[] = [];
    // wifi is default active transport
    fieldBus.setTransport('wifi', {
      isAlive: () => true,
      send: (m) => { sentBytes.push(m); return true; },
    });
    fieldBus.heartbeat('wifi');
    attachCommandFireRouter();

    commandBus.dispatch({ type: 'FIRE', payload: { slat: 3, cue: 7, duration: 0.2 } });
    const drained = commandBus.drain();
    commandBus.applyAll(drained);
    await new Promise((r) => setTimeout(r, 50));

    expect(sentBytes.length).toBeGreaterThan(0);
    expect(sentBytes[0].type).toBe('pyro');
    expect((sentBytes[0].payload as any).module).toBe(3);
    expect((sentBytes[0].payload as any).channel).toBe(7);
  });
});
