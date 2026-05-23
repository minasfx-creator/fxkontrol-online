import { describe, expect, it } from 'vitest';
import { EffectPool } from '@/lib/showEngine/EffectPool';

describe('EffectPool', () => {
  it('reuses released items instead of allocating', () => {
    let created = 0;
    const pool = new EffectPool<{ id: number }>({
      factory: () => ({ id: ++created }),
    });
    const a = pool.acquire();
    pool.release(a);
    const b = pool.acquire();
    expect(b).toBe(a);
    expect(created).toBe(1);
  });

  it('respects maxRetained and disposes excess', () => {
    const disposed: number[] = [];
    const pool = new EffectPool<{ id: number }>({
      factory: () => ({ id: Math.random() }),
      dispose: (item) => disposed.push(item.id),
      maxRetained: 1,
    });
    const a = pool.acquire();
    const b = pool.acquire();
    pool.release(a);
    pool.release(b);
    expect(disposed).toHaveLength(1);
  });

  it('reset hook runs on release', () => {
    const seen: number[] = [];
    const pool = new EffectPool<{ v: number }>({
      factory: () => ({ v: 0 }),
      reset: (item) => { seen.push(item.v); item.v = 0; },
    });
    const x = pool.acquire();
    x.v = 42;
    pool.release(x);
    expect(seen).toEqual([42]);
  });
});
