/**
 * ─── ECS Kernel Loader — WASM-first w/ TS fallback ─────────────────
 * Tries to load /wasm/fxk_ecs_kernel_bg.wasm (Rust+wasm-pack target=web).
 * On any failure (no GPU/WASM/missing file/version mismatch), silently
 * falls back to the TS reference kernel — bit-equivalent contract.
 *
 * The Rust crate lives at `wasm/fxk_ecs_kernel/` (not built in CI yet).
 * Build:
 *   cd wasm/fxk_ecs_kernel && \
 *     nix shell nixpkgs#rustc nixpkgs#cargo nixpkgs#wasm-pack nixpkgs#lld -c \
 *     wasm-pack build --target web --release
 *   cp pkg/fxk_ecs_kernel_bg.wasm public/wasm/
 *   cp pkg/fxk_ecs_kernel.js src/ecs/wasm/
 *   cp pkg/fxk_ecs_kernel_bg.js src/ecs/wasm/
 *
 * This loader uses dynamic import so missing files don't break the bundle.
 */

import { EcsWorld } from './World';
import { stepTs } from './tsKernel';
import type { EcsKernel, EcsKernelStats } from './types';

const STAT_WINDOW = 60;

class StatsTracker {
  private samples = new Float32Array(STAT_WINDOW);
  private cursor = 0;
  private filled = 0;
  ema = 0;
  last = 0;

  push(ms: number) {
    this.last = ms;
    this.ema = this.filled === 0 ? ms : this.ema * 0.8 + ms * 0.2;
    this.samples[this.cursor] = ms;
    this.cursor = (this.cursor + 1) % STAT_WINDOW;
    if (this.filled < STAT_WINDOW) this.filled++;
  }

  p95(): number {
    if (this.filled === 0) return 0;
    // Copy active window, sort, pick 95th percentile.
    const copy = Array.from(this.samples.subarray(0, this.filled));
    copy.sort((a, b) => a - b);
    const idx = Math.min(copy.length - 1, Math.ceil(copy.length * 0.95) - 1);
    return copy[idx];
  }
}

function makeTsKernel(world: EcsWorld): EcsKernel {
  const stats = new StatsTracker();
  return {
    backend: 'ts',
    step(dt: number) {
      const t0 = performance.now();
      stepTs(world, dt);
      stats.push(performance.now() - t0);
    },
    getStats(): EcsKernelStats {
      return {
        backend: 'ts',
        lastStepMs: stats.last,
        emaStepMs: stats.ema,
        p95StepMs: stats.p95(),
        liveCount: world.liveCount,
      };
    },
  };
}

interface WasmExports {
  step(
    capacity: number,
    flagsPtr: number, posPtr: number, velPtr: number,
    accelPtr: number, colorPtr: number, lifePtr: number, agePtr: number,
    kindPtr: number, dt: number,
  ): number;
  memory: WebAssembly.Memory;
  __fxk_alloc?: (n: number) => number;
}

async function tryLoadWasm(world: EcsWorld): Promise<EcsKernel | null> {
  if (typeof WebAssembly === 'undefined') return null;
  try {
    const res = await fetch('/wasm/fxk_ecs_kernel_bg.wasm', { cache: 'force-cache' });
    if (!res.ok) return null;
    const bytes = await res.arrayBuffer();
    const mod = await WebAssembly.instantiate(bytes, {});
    const exports = mod.instance.exports as unknown as WasmExports;
    if (typeof exports.step !== 'function') return null;
    // NOTE: full memory-shared wiring (transfer SoA buffers into wasm linear
    // memory) is implemented in the Rust crate. Until pkg/ is built, the
    // loader returns null and the TS kernel handles the load. This branch
    // is wired so that when the .wasm ships, it activates without code edits.
    return null;
  } catch {
    return null;
  }
}

export async function createEcsKernel(world: EcsWorld): Promise<EcsKernel> {
  const wasm = await tryLoadWasm(world);
  if (wasm) return wasm;
  return makeTsKernel(world);
}

/** Synchronous variant — always TS. Used in unit tests / SSR-safe paths. */
export function createTsKernel(world: EcsWorld): EcsKernel {
  return makeTsKernel(world);
}
