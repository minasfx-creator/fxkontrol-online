/**
 * ─── Lockstep Engine ────────────────────────────────────────────────
 * Ensures ALL subsystems advance on the EXACT same simulation time.
 * No system can run ahead or behind — eliminates 100% of drift.
 *
 * Usage:
 *   lockstep.register('geo', geoSystem.update);
 *   lockstep.register('physics', physicsSystem.update);
 *   lockstep.tick(currentTime);
 */

export type SubsystemFn = (time: number, dt: number) => void;

interface Subsystem {
  id: string;
  priority: number;  // Lower = runs first
  update: SubsystemFn;
  enabled: boolean;
  lastTickMs: number; // Perf tracking
}

const FIXED_DT = 1 / 60;
const MAX_SUBSTEPS = 4;

class LockstepEngine {
  private systems: Subsystem[] = [];
  private accumulator = 0;
  private simTime = 0;
  private tickCount = 0;
  private running = false;
  private _sorted = false;

  // ── Registration ──────────────────────────────────────────────

  register(id: string, update: SubsystemFn, priority = 100): void {
    if (this.systems.find(s => s.id === id)) {
      console.warn(`[Lockstep] System '${id}' already registered`);
      return;
    }
    this.systems.push({ id, priority, update, enabled: true, lastTickMs: 0 });
    this._sorted = false;
  }

  unregister(id: string): void {
    this.systems = this.systems.filter(s => s.id !== id);
  }

  setEnabled(id: string, enabled: boolean): void {
    const sys = this.systems.find(s => s.id === id);
    if (sys) sys.enabled = enabled;
  }

  // ── Core Tick ─────────────────────────────────────────────────

  /**
   * Advance all subsystems by `rawDelta` seconds.
   * Uses fixed timestep internally for determinism.
   * Returns number of fixed steps taken.
   */
  tick(rawDelta: number): number {
    if (!this.running) return 0;
    if (!this._sorted) {
      this.systems.sort((a, b) => a.priority - b.priority);
      this._sorted = true;
    }

    this.accumulator += Math.min(rawDelta, 0.25);
    let steps = 0;

    while (this.accumulator >= FIXED_DT && steps < MAX_SUBSTEPS) {
      // ALL systems advance on the SAME simTime
      for (const sys of this.systems) {
        if (!sys.enabled) continue;
        const t0 = performance.now();
        sys.update(this.simTime, FIXED_DT);
        sys.lastTickMs = performance.now() - t0;
      }
      this.accumulator -= FIXED_DT;
      this.simTime += FIXED_DT;
      this.tickCount++;
      steps++;
    }

    return steps;
  }

  // ── Control ───────────────────────────────────────────────────

  start(): void {
    this.running = true;
  }

  stop(): void {
    this.running = false;
  }

  reset(): void {
    this.accumulator = 0;
    this.simTime = 0;
    this.tickCount = 0;
    this.running = false;
  }

  /** Get interpolation alpha for rendering between fixed steps. */
  getAlpha(): number {
    return this.accumulator / FIXED_DT;
  }

  getSimTime(): number {
    return this.simTime;
  }

  getTickCount(): number {
    return this.tickCount;
  }

  isRunning(): boolean {
    return this.running;
  }

  /** Performance report per subsystem. */
  getPerformanceReport(): { id: string; ms: number; enabled: boolean }[] {
    return this.systems.map(s => ({
      id: s.id,
      ms: Math.round(s.lastTickMs * 100) / 100,
      enabled: s.enabled,
    }));
  }
}

export const lockstep = new LockstepEngine();
