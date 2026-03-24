/**
 * ─── Seeded PRNG ────────────────────────────────────────────────────
 * Deterministic pseudo-random number generator (Mulberry32).
 * NEVER use Math.random() in simulation code — always use this.
 */

export class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed | 0;
  }

  /** Returns deterministic float in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6D2B79F5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Deterministic float in [min, max). */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Deterministic integer in [min, max]. */
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  /** Deterministic pick from array. */
  pick<T>(arr: readonly T[]): T {
    return arr[this.int(0, arr.length - 1)];
  }

  /** Fork a child PRNG with a new seed derived from current state. */
  fork(): SeededRandom {
    return new SeededRandom(this.state ^ 0xDEADBEEF);
  }

  /** Reset to a known seed. */
  reset(seed: number): void {
    this.state = seed | 0;
  }
}

/** Global simulation PRNG — reset at show start. */
export const simRNG = new SeededRandom(42);
