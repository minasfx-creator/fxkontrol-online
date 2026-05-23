/**
 * ─── ECS Unified — Type contracts ────────────────────────────────
 * Structure-of-Arrays (SoA) world for pyro / particles / drones.
 * Zero-GC hot loop: `step(dt)` mutates TypedArrays in place.
 *
 * NEVER touches uiCommandGateway / fieldBus / SSM / workMode.
 * Pure simulation kernel (read-only from physical hardware POV).
 */

export const ENTITY_KIND = {
  PYRO: 1,
  PARTICLE: 2,
  DRONE: 3,
} as const;

export type EntityKind = typeof ENTITY_KIND[keyof typeof ENTITY_KIND];

/** Bit flags packed into `flags[i]` (Uint8). */
export const FLAG = {
  ALIVE: 1 << 0,
  PYRO_ARMED: 1 << 1,        // simulated arm only — never physical
  PYRO_FIRED: 1 << 2,
  HAS_TRAIL: 1 << 3,
  HAS_GRAVITY: 1 << 4,
} as const;

export interface EcsKernelStats {
  /** Last step duration (ms, hi-res). */
  lastStepMs: number;
  /** Exponentially-weighted moving avg (alpha=0.2). */
  emaStepMs: number;
  /** p95 over last 60 steps. */
  p95StepMs: number;
  /** Total live entities after last step. */
  liveCount: number;
  /** Backend actually used. */
  backend: 'wasm' | 'ts';
}

export interface EcsKernel {
  step(dt: number): void;
  getStats(): EcsKernelStats;
  /** Backend identifier ('wasm' | 'ts'). */
  readonly backend: 'wasm' | 'ts';
}
