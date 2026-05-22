/**
 * ─── ECS Frame Budget Telemetry ────────────────────────────────────
 * Singleton observable that the active ECS kernel publishes p95 step ms to.
 * SafetyBar subscribes via useFrameBudget hook for the BUDGET chip.
 *
 * Pure read-only sink — never mutates anything operational.
 */

export interface FrameBudgetSnapshot {
  p95Ms: number;
  emaMs: number;
  liveCount: number;
  backend: 'wasm' | 'ts' | 'idle';
  updatedAt: number;
}

const SNAPSHOT: FrameBudgetSnapshot = {
  p95Ms: 0,
  emaMs: 0,
  liveCount: 0,
  backend: 'idle',
  updatedAt: 0,
};

type Listener = (s: FrameBudgetSnapshot) => void;
const listeners = new Set<Listener>();

export function publishFrameBudget(s: Omit<FrameBudgetSnapshot, 'updatedAt'>): void {
  SNAPSHOT.p95Ms = s.p95Ms;
  SNAPSHOT.emaMs = s.emaMs;
  SNAPSHOT.liveCount = s.liveCount;
  SNAPSHOT.backend = s.backend;
  SNAPSHOT.updatedAt = Date.now();
  for (const l of listeners) l(SNAPSHOT);
}

export function subscribeFrameBudget(fn: Listener): () => void {
  listeners.add(fn);
  fn(SNAPSHOT);
  return () => { listeners.delete(fn); };
}

export function getFrameBudget(): FrameBudgetSnapshot {
  return { ...SNAPSHOT };
}

export const FRAME_BUDGET_TARGET_MS = 50;
export const FRAME_BUDGET_WARN_MS = 40;
