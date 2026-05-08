import { describe, it, expect, beforeEach } from 'vitest';
import { recordCommandRequested, recordCommandDispatched } from '@/core/journal/commandJournal';
import { safetyBlackBox } from '@/core/safety/safetyBlackBox';

describe('Command Journal (Sprint B)', () => {
  beforeEach(() => { safetyBlackBox.reset(); });

  it('writes correlated requested + dispatched entries with shared commandId', async () => {
    const commandId = await recordCommandRequested({ type: 'FIRE', source: 'TestSurface', detail: 'ch=3' });
    expect(commandId).toBeTruthy();

    await recordCommandDispatched(commandId, 'ack');

    const entries = safetyBlackBox.getRecent(10);
    const requested = entries.find((e) => (e.payload as any).kind === 'command.requested');
    const dispatched = entries.find((e) => (e.payload as any).kind === 'command.dispatched');
    expect(requested).toBeDefined();
    expect(dispatched).toBeDefined();
    expect((requested!.payload as any).commandId).toBe(commandId);
    expect((dispatched!.payload as any).commandId).toBe(commandId);
    expect((dispatched!.payload as any).result).toBe('ack');
    expect((dispatched!.payload as any).latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('marks nack/timeout dispatch entries as ok=false with reason', async () => {
    const id = await recordCommandRequested({ type: 'ARM_SYSTEM', source: 'X' });
    await recordCommandDispatched(id, 'nack', 'LINK_DEGRADED');
    const last = safetyBlackBox.getRecent(1)[0];
    expect(last.ok).toBe(false);
    expect(last.reason).toBe('LINK_DEGRADED');
  });

  it('preserves blackbox hash chain across journal writes', async () => {
    const id = await recordCommandRequested({ type: 'E_STOP', source: 'GlobalEStop' });
    await recordCommandDispatched(id, 'ack');
    const v = await safetyBlackBox.verifyChain();
    expect(v.ok).toBe(true);
  });
});
