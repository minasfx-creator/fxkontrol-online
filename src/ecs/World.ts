/**
 * ─── ECS World — SoA storage ─────────────────────────────────────
 * Unified container for pyro cues, render particles, and drone agents.
 * Capacity is fixed at construction (no realloc during hot loop).
 *
 * Layout (parallel TypedArrays, length = capacity):
 *   kind:    Uint8       (EntityKind | 0 = free slot)
 *   flags:   Uint8       (bit flags — ALIVE/ARMED/FIRED/...)
 *   pos:     Float32×3   (x, y, z) — Three.js frame
 *   vel:     Float32×3   (vx, vy, vz) m/s
 *   accel:   Float32×3   (ax, ay, az) m/s² (wind/thrust accumulator)
 *   color:   Float32×4   (r, g, b, intensity 0..1)
 *   lifeMs:  Float32     remaining lifetime (ms); ≤0 → ALIVE cleared
 *   ageMs:   Float32     elapsed since spawn
 *   payload: Float32     generic (pyro: mass kg, drone: led brightness)
 */

import { ENTITY_KIND, FLAG, type EntityKind } from './types';

export interface SpawnDescriptor {
  kind: EntityKind;
  pos: [number, number, number];
  vel?: [number, number, number];
  color?: [number, number, number, number];
  lifeMs: number;
  flags?: number;
  payload?: number;
}

export class EcsWorld {
  readonly capacity: number;
  readonly kind: Uint8Array;
  readonly flags: Uint8Array;
  readonly pos: Float32Array;
  readonly vel: Float32Array;
  readonly accel: Float32Array;
  readonly color: Float32Array;
  readonly lifeMs: Float32Array;
  readonly ageMs: Float32Array;
  readonly payload: Float32Array;

  /** Free-list cursor (linear scan fallback). */
  private _cursor = 0;
  private _liveCount = 0;

  constructor(capacity: number) {
    if (!Number.isFinite(capacity) || capacity <= 0) {
      throw new Error('EcsWorld: capacity must be positive integer');
    }
    this.capacity = capacity | 0;
    this.kind = new Uint8Array(capacity);
    this.flags = new Uint8Array(capacity);
    this.pos = new Float32Array(capacity * 3);
    this.vel = new Float32Array(capacity * 3);
    this.accel = new Float32Array(capacity * 3);
    this.color = new Float32Array(capacity * 4);
    this.lifeMs = new Float32Array(capacity);
    this.ageMs = new Float32Array(capacity);
    this.payload = new Float32Array(capacity);
  }

  get liveCount(): number {
    return this._liveCount;
  }

  /** Allocate a slot; returns -1 if full. */
  spawn(d: SpawnDescriptor): number {
    const cap = this.capacity;
    let i = this._cursor;
    for (let n = 0; n < cap; n++) {
      const idx = (i + n) % cap;
      if ((this.flags[idx] & FLAG.ALIVE) === 0) {
        this._writeSlot(idx, d);
        this._cursor = (idx + 1) % cap;
        this._liveCount++;
        return idx;
      }
    }
    return -1;
  }

  private _writeSlot(i: number, d: SpawnDescriptor) {
    this.kind[i] = d.kind;
    this.flags[i] = FLAG.ALIVE | (d.flags ?? 0);
    const p3 = i * 3;
    const c4 = i * 4;
    this.pos[p3] = d.pos[0]; this.pos[p3 + 1] = d.pos[1]; this.pos[p3 + 2] = d.pos[2];
    const v = d.vel ?? [0, 0, 0];
    this.vel[p3] = v[0]; this.vel[p3 + 1] = v[1]; this.vel[p3 + 2] = v[2];
    this.accel[p3] = 0; this.accel[p3 + 1] = 0; this.accel[p3 + 2] = 0;
    const c = d.color ?? [1, 1, 1, 1];
    this.color[c4] = c[0]; this.color[c4 + 1] = c[1]; this.color[c4 + 2] = c[2]; this.color[c4 + 3] = c[3];
    this.lifeMs[i] = d.lifeMs;
    this.ageMs[i] = 0;
    this.payload[i] = d.payload ?? 0;
  }

  /** Mark slot free; called by kernel when life expires. */
  retire(i: number): void {
    if ((this.flags[i] & FLAG.ALIVE) === 0) return;
    this.flags[i] = 0;
    this.kind[i] = 0;
    this._liveCount--;
  }

  /** Internal: kernel adjusts liveCount in batch (avoids double-count). */
  _setLiveCount(n: number): void {
    this._liveCount = n;
  }

  clear(): void {
    this.kind.fill(0);
    this.flags.fill(0);
    this._cursor = 0;
    this._liveCount = 0;
  }
}

export { ENTITY_KIND, FLAG };
export type { EntityKind };
