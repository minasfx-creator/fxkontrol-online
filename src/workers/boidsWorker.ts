/**
 * ─── Boids Worker ──────────────────────────────────────────────────
 * Runs the heavy O(n²) boids step off the main thread. Uses a Struct-
 * of-Arrays Float32Array layout so positions and velocities can be
 * shipped via Transferable objects (zero-copy):
 *
 *   stride = 6 floats per agent: [x, y, z, vx, vy, vz]
 *   buffer length = n * 6
 *
 * Double-buffering happens on the client side (BoidsWorkerClient):
 * the worker simply mutates the buffer it received and posts it back.
 *
 * Why a worker:
 *   - stepBoids is O(n²) per frame. With 256 agents that's ~65k pair
 *     checks every tick — enough to blow the main thread's 8.3ms
 *     budget at 120fps.
 *   - Moving it off-thread frees React commits + WebGPU dispatch on
 *     the main thread to stay within the 120fps target.
 *
 * Protocol (typed below in BoidsWorkerMsg):
 *   { type: 'config', config }            → update config in place
 *   { type: 'targets', buf, n }           → upload target positions
 *                                           (n*3 floats, transferred)
 *   { type: 'step', buf, n, dt, seq }     → step physics; worker
 *                                           returns { type: 'frame',
 *                                           buf, n, seq } with the
 *                                           same buffer transferred
 *                                           back.
 *   { type: 'minDist', buf, n, seq }      → compute min pair distance
 *
 * The `seq` field is an epoch counter so the client can discard stale
 * frames if it ever pipelines multiple steps.
 */
/// <reference lib="webworker" />

import {
  DEFAULT_BOIDS_CONFIG,
  type BoidsConfig,
} from '@/lib/boidsEngine';

const ctx = self as unknown as DedicatedWorkerGlobalScope;

let config: BoidsConfig = { ...DEFAULT_BOIDS_CONFIG };
let targets: Float32Array | null = null; // n*3
let targetCount = 0;

export type BoidsWorkerInbound =
  | { type: 'config'; config: Partial<BoidsConfig> }
  | { type: 'targets'; buf: ArrayBuffer; n: number }
  | { type: 'step'; buf: ArrayBuffer; n: number; dt: number; seq: number }
  | { type: 'minDist'; buf: ArrayBuffer; n: number; seq: number };

export type BoidsWorkerOutbound =
  | { type: 'frame'; buf: ArrayBuffer; n: number; seq: number; stepMs: number }
  | { type: 'minDist'; buf: ArrayBuffer; n: number; seq: number; minDist: number };

function clampTo(out: Float32Array, oi: number, x: number, y: number, z: number, max: number): void {
  const mag = Math.sqrt(x * x + y * y + z * z);
  if (mag > max && mag > 0) {
    const s = max / mag;
    out[oi] = x * s; out[oi + 1] = y * s; out[oi + 2] = z * s;
  } else {
    out[oi] = x; out[oi + 1] = y; out[oi + 2] = z;
  }
}

/**
 * In-place SoA boids step. `data` layout: [x,y,z,vx,vy,vz]*n.
 * Reads from `data` into a scratch copy so writes don't bias the loop.
 */
let scratch: Float32Array | null = null;

function stepSoA(data: Float32Array, n: number, dt: number): void {
  if (!scratch || scratch.length < n * 6) scratch = new Float32Array(n * 6);
  scratch.set(data.subarray(0, n * 6));

  const sepRadSq = config.separationRadius * config.separationRadius;
  const nbrRadSq = config.neighborRadius * config.neighborRadius;

  for (let i = 0; i < n; i++) {
    const ix = i * 6;
    const ax = scratch[ix], ay = scratch[ix + 1], az = scratch[ix + 2];
    const avx = scratch[ix + 3], avy = scratch[ix + 4], avz = scratch[ix + 5];

    let sepX = 0, sepY = 0, sepZ = 0, sepCount = 0;
    let aliX = 0, aliY = 0, aliZ = 0, aliCount = 0;
    let cohX = 0, cohY = 0, cohZ = 0, cohCount = 0;

    for (let j = 0; j < n; j++) {
      if (j === i) continue;
      const jx = j * 6;
      const dx = ax - scratch[jx];
      const dy = ay - scratch[jx + 1];
      const dz = az - scratch[jx + 2];
      const dSq = dx * dx + dy * dy + dz * dz;

      if (dSq < sepRadSq && dSq > 0.001) {
        const d = Math.sqrt(dSq);
        const strength = 1 - d / config.separationRadius;
        sepX += (dx / d) * strength;
        sepY += (dy / d) * strength;
        sepZ += (dz / d) * strength;
        sepCount++;
      }
      if (dSq < nbrRadSq) {
        aliX += scratch[jx + 3]; aliY += scratch[jx + 4]; aliZ += scratch[jx + 5];
        cohX += scratch[jx];     cohY += scratch[jx + 1]; cohZ += scratch[jx + 2];
        aliCount++; cohCount++;
      }
    }

    let fx = 0, fy = 0, fz = 0;
    if (sepCount > 0) {
      fx += (sepX / sepCount) * config.separationWeight;
      fy += (sepY / sepCount) * config.separationWeight;
      fz += (sepZ / sepCount) * config.separationWeight;
    }
    if (aliCount > 0) {
      fx += ((aliX / aliCount) - avx) * config.alignmentWeight * 0.1;
      fy += ((aliY / aliCount) - avy) * config.alignmentWeight * 0.1;
      fz += ((aliZ / aliCount) - avz) * config.alignmentWeight * 0.1;
    }
    if (cohCount > 0) {
      fx += ((cohX / cohCount) - ax) * config.cohesionWeight * 0.01;
      fy += ((cohY / cohCount) - ay) * config.cohesionWeight * 0.01;
      fz += ((cohZ / cohCount) - az) * config.cohesionWeight * 0.01;
    }

    if (targets && i < targetCount) {
      const ti = i * 3;
      const tx = targets[ti] - ax;
      const ty = targets[ti + 1] - ay;
      const tz = targets[ti + 2] - az;
      const td = Math.sqrt(tx * tx + ty * ty + tz * tz);
      if (td > 0.1) {
        fx += (tx / td) * config.targetWeight;
        fy += (ty / td) * config.targetWeight;
        fz += (tz / td) * config.targetWeight;
      }
    }

    const distFromCenter = Math.sqrt(ax * ax + az * az);
    if (distFromCenter > config.boundaryRadius * 0.9) {
      const push = (distFromCenter - config.boundaryRadius * 0.9) / (config.boundaryRadius * 0.1);
      fx -= (ax / distFromCenter) * push * 2;
      fz -= (az / distFromCenter) * push * 2;
    }
    if (ay < 1) fy += (1 - ay) * 3;
    if (ay > config.boundaryHeight * 0.95) {
      fy -= (ay - config.boundaryHeight * 0.95) / (config.boundaryHeight * 0.05) * 2;
    }

    // Clamp force, integrate velocity, clamp velocity, integrate position.
    const tmp = new Float32Array(3);
    clampTo(tmp, 0, fx, fy, fz, config.maxForce);
    let nvx = avx + tmp[0] * dt;
    let nvy = avy + tmp[1] * dt;
    let nvz = avz + tmp[2] * dt;
    clampTo(tmp, 0, nvx, nvy, nvz, config.maxSpeed);
    nvx = tmp[0]; nvy = tmp[1]; nvz = tmp[2];

    data[ix]     = ax + nvx * dt;
    data[ix + 1] = Math.max(0.1, ay + nvy * dt);
    data[ix + 2] = az + nvz * dt;
    data[ix + 3] = nvx;
    data[ix + 4] = nvy;
    data[ix + 5] = nvz;
  }
}

ctx.addEventListener('message', (e: MessageEvent<BoidsWorkerInbound>) => {
  const msg = e.data;
  switch (msg.type) {
    case 'config': {
      config = { ...config, ...msg.config };
      return;
    }
    case 'targets': {
      targets = new Float32Array(msg.buf);
      targetCount = msg.n;
      return;
    }
    case 'step': {
      const t0 = performance.now();
      const data = new Float32Array(msg.buf);
      stepSoA(data, msg.n, msg.dt);
      const stepMs = performance.now() - t0;
      const out: BoidsWorkerOutbound = {
        type: 'frame',
        buf: msg.buf,
        n: msg.n,
        seq: msg.seq,
        stepMs,
      };
      ctx.postMessage(out, [msg.buf]);
      return;
    }
    case 'minDist': {
      const data = new Float32Array(msg.buf);
      let min = Infinity;
      for (let i = 0; i < msg.n; i++) {
        const ix = i * 6;
        for (let j = i + 1; j < msg.n; j++) {
          const jx = j * 6;
          const dx = data[ix] - data[jx];
          const dy = data[ix + 1] - data[jx + 1];
          const dz = data[ix + 2] - data[jx + 2];
          const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (d < min) min = d;
        }
      }
      const out: BoidsWorkerOutbound = {
        type: 'minDist', buf: msg.buf, n: msg.n, seq: msg.seq, minDist: min,
      };
      ctx.postMessage(out, [msg.buf]);
      return;
    }
  }
});
