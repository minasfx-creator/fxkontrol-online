/**
 * ─── BoidsWorkerClient ─────────────────────────────────────────────
 * Main-thread façade for `boidsWorker.ts`. Owns a double-buffer pair
 * of Float32Arrays (SoA: [x,y,z,vx,vy,vz]*n) and ping-pongs them via
 * Transferable postMessage so each `step()` call is zero-copy and
 * never blocks the render loop.
 *
 * Pipeline:
 *   1. Main thread holds bufA. Calls `step(dt)`.
 *   2. bufA is transferred to the worker (main thread can no longer
 *      read it). Client immediately resolves to bufB (idle) so the
 *      next render frame has a buffer to read from.
 *   3. Worker mutates bufA in place and posts it back.
 *   4. On `frame` message we adopt the returned buffer as the new
 *      "ready" buffer and the previously-read buffer becomes the
 *      next step's input.
 *
 * Public API:
 *   - init(agents): seed both buffers with positions (zero velocity)
 *   - setConfig(partial): forward config changes
 *   - setTargets(positions): upload formation targets
 *   - step(dt): kick a step; returns a Promise<StepResult>
 *   - readPositions(): synchronous Float32Array view of the latest
 *                      ready frame, safe to read every render
 *   - dispose(): terminate the worker
 *
 * Falls back gracefully if Worker construction fails (older browsers
 * or strict CSP) by running stepBoids inline on the main thread.
 */
import {
  type BoidAgent,
  type BoidsConfig,
  stepBoids,
} from '@/lib/boidsEngine';
import type {
  BoidsWorkerInbound,
  BoidsWorkerOutbound,
} from '@/workers/boidsWorker';

export interface BoidsStepResult {
  /** Read-only Float32Array view of the freshly-computed frame (SoA, n*6). */
  data: Float32Array;
  n: number;
  /** Worker-side step time in ms. -1 when fallback is in use. */
  stepMs: number;
  seq: number;
}

const STRIDE = 6;

function agentsToBuf(agents: BoidAgent[], buf: Float32Array): void {
  for (let i = 0; i < agents.length; i++) {
    const o = i * STRIDE;
    const a = agents[i];
    buf[o]     = a.x;  buf[o + 1] = a.y;  buf[o + 2] = a.z;
    buf[o + 3] = a.vx; buf[o + 4] = a.vy; buf[o + 5] = a.vz;
  }
}

export class BoidsWorkerClient {
  private worker: Worker | null = null;
  /** Buffer currently owned by the main thread (safe to read). */
  private ready: Float32Array;
  /** Buffer currently owned by the worker (do not touch until 'frame'). */
  private inFlight: ArrayBuffer | null = null;
  /** Pending readyBuffer to use as next input once the in-flight one returns. */
  private spare: Float32Array;
  private n = 0;
  private capacity = 0;
  private seq = 0;
  private pending = new Map<number, (r: BoidsStepResult) => void>();
  private fallback = false;
  private config: BoidsConfig | null = null;
  private targets: Float32Array | null = null;
  private targetCount = 0;

  constructor(initialCapacity = 256) {
    this.capacity = initialCapacity;
    this.ready = new Float32Array(initialCapacity * STRIDE);
    this.spare = new Float32Array(initialCapacity * STRIDE);
    try {
      this.worker = new Worker(
        new URL('@/workers/boidsWorker.ts', import.meta.url),
        { type: 'module', name: 'fxk-boids' },
      );
      this.worker.addEventListener('message', this.onMessage);
      this.worker.addEventListener('error', () => { this.fallback = true; });
    } catch {
      this.fallback = true;
    }
  }

  private onMessage = (e: MessageEvent<BoidsWorkerOutbound>) => {
    const msg = e.data;
    if (msg.type !== 'frame') return;
    // Adopt returned buffer as the new "ready" frame; previous ready becomes spare.
    const returned = new Float32Array(msg.buf);
    const oldReady = this.ready;
    this.ready = returned;
    this.spare = oldReady;
    this.inFlight = null;
    const cb = this.pending.get(msg.seq);
    if (cb) {
      this.pending.delete(msg.seq);
      cb({ data: this.ready, n: msg.n, stepMs: msg.stepMs, seq: msg.seq });
    }
  };

  private ensureCapacity(n: number): void {
    if (n <= this.capacity) return;
    this.capacity = n;
    this.ready = new Float32Array(n * STRIDE);
    this.spare = new Float32Array(n * STRIDE);
    this.inFlight = null;
  }

  init(agents: BoidAgent[]): void {
    this.ensureCapacity(agents.length);
    this.n = agents.length;
    agentsToBuf(agents, this.ready);
    this.spare.set(this.ready);
  }

  setConfig(config: Partial<BoidsConfig>): void {
    this.config = { ...(this.config ?? {} as BoidsConfig), ...config } as BoidsConfig;
    if (this.worker && !this.fallback) {
      const msg: BoidsWorkerInbound = { type: 'config', config };
      this.worker.postMessage(msg);
    }
  }

  setTargets(positions: { x: number; y: number; z: number }[]): void {
    const buf = new Float32Array(positions.length * 3);
    for (let i = 0; i < positions.length; i++) {
      const p = positions[i];
      buf[i * 3] = p.x; buf[i * 3 + 1] = p.y; buf[i * 3 + 2] = p.z;
    }
    this.targets = buf;
    this.targetCount = positions.length;
    if (this.worker && !this.fallback) {
      const msg: BoidsWorkerInbound = {
        type: 'targets', buf: buf.buffer, n: positions.length,
      };
      this.worker.postMessage(msg, [buf.buffer]);
    }
  }

  /** Latest frame data — safe to read every render (zero-copy view). */
  readPositions(): { data: Float32Array; n: number } {
    return { data: this.ready, n: this.n };
  }

  /** Has a step in flight? Skip kicking another to avoid pile-up. */
  get busy(): boolean {
    return this.inFlight !== null;
  }

  /**
   * Kick a physics step. If a previous step is still in flight we
   * skip (returns the cached frame); the caller decides cadence.
   */
  step(dt: number): Promise<BoidsStepResult> {
    if (this.fallback || !this.worker) {
      return Promise.resolve(this.fallbackStep(dt));
    }
    if (this.inFlight) {
      // Coalesce: caller will pick up next ready frame.
      return Promise.resolve({
        data: this.ready, n: this.n, stepMs: 0, seq: this.seq,
      });
    }
    const seq = ++this.seq;
    // Use the spare as input: copy current "ready" into it so reads
    // during in-flight remain stable, then transfer the spare.
    this.spare.set(this.ready);
    const out = this.spare.buffer as unknown as ArrayBuffer;
    this.inFlight = out;
    const msg: BoidsWorkerInbound = {
      type: 'step', buf: out, n: this.n, dt, seq,
    };
    return new Promise((resolve) => {
      this.pending.set(seq, resolve);
      this.worker!.postMessage(msg, [out]);
      // After transfer, `this.spare` is detached. Allocate a fresh
      // backing so future `step()` calls don't crash before 'frame'.
      this.spare = new Float32Array(this.capacity * STRIDE);
    });
  }

  private fallbackStep(dt: number): BoidsStepResult {
    if (!this.config) return { data: this.ready, n: this.n, stepMs: -1, seq: ++this.seq };
    // Decode SoA → AoS, run engine, re-encode.
    const agents: BoidAgent[] = [];
    for (let i = 0; i < this.n; i++) {
      const o = i * STRIDE;
      agents.push({
        x: this.ready[o], y: this.ready[o + 1], z: this.ready[o + 2],
        vx: this.ready[o + 3], vy: this.ready[o + 4], vz: this.ready[o + 5],
      });
    }
    let targets: { x: number; y: number; z: number }[] | undefined;
    if (this.targets) {
      targets = [];
      for (let i = 0; i < this.targetCount; i++) {
        targets.push({
          x: this.targets[i * 3],
          y: this.targets[i * 3 + 1],
          z: this.targets[i * 3 + 2],
        });
      }
    }
    const stepped = stepBoids(agents, dt, this.config, targets);
    for (let i = 0; i < stepped.length; i++) {
      const o = i * STRIDE; const a = stepped[i];
      this.ready[o]     = a.x;  this.ready[o + 1] = a.y;  this.ready[o + 2] = a.z;
      this.ready[o + 3] = a.vx; this.ready[o + 4] = a.vy; this.ready[o + 5] = a.vz;
    }
    return { data: this.ready, n: this.n, stepMs: -1, seq: ++this.seq };
  }

  dispose(): void {
    this.worker?.removeEventListener('message', this.onMessage);
    this.worker?.terminate();
    this.worker = null;
    this.pending.clear();
  }
}

/** Decode the SoA buffer to plain `BoidAgent` objects (for legacy consumers). */
export function decodeBoidsBuffer(data: Float32Array, n: number): BoidAgent[] {
  const out: BoidAgent[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const o = i * STRIDE;
    out[i] = {
      x: data[o], y: data[o + 1], z: data[o + 2],
      vx: data[o + 3], vy: data[o + 4], vz: data[o + 5],
    };
  }
  return out;
}
