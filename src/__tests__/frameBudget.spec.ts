import { describe, it, expect, beforeEach } from 'vitest';
import { publishFrameBudget, getFrameBudget, subscribeFrameBudget } from '@/ecs/frameBudget';

describe('frameBudget telemetry', () => {
  beforeEach(() => {
    publishFrameBudget({ p95Ms: 0, emaMs: 0, liveCount: 0, backend: 'idle' });
  });

  it('publishes and reads snapshots', () => {
    publishFrameBudget({ p95Ms: 12.3, emaMs: 8.4, liveCount: 5000, backend: 'ts' });
    const s = getFrameBudget();
    expect(s.p95Ms).toBe(12.3);
    expect(s.backend).toBe('ts');
    expect(s.liveCount).toBe(5000);
    expect(s.updatedAt).toBeGreaterThan(0);
  });

  it('notifies subscribers immediately and on updates', () => {
    const seen: number[] = [];
    const unsub = subscribeFrameBudget((s) => seen.push(s.p95Ms));
    publishFrameBudget({ p95Ms: 42, emaMs: 30, liveCount: 1, backend: 'wasm' });
    publishFrameBudget({ p95Ms: 55, emaMs: 31, liveCount: 1, backend: 'wasm' });
    unsub();
    expect(seen).toEqual([0, 42, 55]);
  });
});
