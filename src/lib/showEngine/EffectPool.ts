/**
 * EffectPool — generic acquire/release pool for short-lived render objects.
 *
 * Avoids GC pressure during pyro-heavy timelines. Pure TS, no Three.js
 * coupling — the factory/reset functions are user-supplied so this works
 * for meshes, geometries, plain object descriptors, etc.
 */

export interface EffectPoolOptions<T> {
  factory: () => T;
  reset?: (item: T) => void;
  dispose?: (item: T) => void;
  /** Hard ceiling on retained items. Excess released items are disposed. */
  maxRetained?: number;
}

export class EffectPool<T> {
  private free: T[] = [];
  private inUseSet = new Set<T>();
  private opts: Required<Pick<EffectPoolOptions<T>, 'factory' | 'maxRetained'>> &
    Pick<EffectPoolOptions<T>, 'reset' | 'dispose'>;

  constructor(opts: EffectPoolOptions<T>) {
    this.opts = {
      factory: opts.factory,
      reset: opts.reset,
      dispose: opts.dispose,
      maxRetained: opts.maxRetained ?? 256,
    };
  }

  acquire(): T {
    const item = this.free.pop() ?? this.opts.factory();
    this.inUseSet.add(item);
    return item;
  }

  release(item: T): void {
    if (!this.inUseSet.has(item)) return;
    this.inUseSet.delete(item);
    if (this.opts.reset) this.opts.reset(item);
    if (this.free.length < this.opts.maxRetained) {
      this.free.push(item);
    } else if (this.opts.dispose) {
      this.opts.dispose(item);
    }
  }

  releaseAll(): void {
    for (const item of Array.from(this.inUseSet)) {
      this.release(item);
    }
  }

  drain(): void {
    if (this.opts.dispose) {
      for (const item of this.free) this.opts.dispose(item);
      for (const item of this.inUseSet) this.opts.dispose(item);
    }
    this.free = [];
    this.inUseSet.clear();
  }

  stats(): { free: number; inUse: number } {
    return { free: this.free.length, inUse: this.inUseSet.size };
  }
}
