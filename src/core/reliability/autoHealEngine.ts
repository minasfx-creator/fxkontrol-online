/**
 * ─── Auto-Heal Engine ───────────────────────────────────────────────
 * Detect → Isolate → Fix → Re-test loop for any subsystem failure.
 * Max 3 retries per failure type. Never crash — always degrade.
 */

export type SubsystemId =
  | 'tiles' | 'camera' | 'physics' | 'drones' | 'fireworks'
  | 'cluster' | 'environment' | 'unreal' | 'audio' | 'postfx'
  | 'lighting' | 'timeline';

export type HealStatus = 'healthy' | 'degraded' | 'disabled' | 'healing';

export interface SubsystemHealth {
  id: SubsystemId;
  status: HealStatus;
  failureCount: number;
  lastError: string | null;
  lastHealAttempt: number;
  disabled: boolean;
}

export interface HealEvent {
  subsystem: SubsystemId;
  error: string;
  attempt: number;
  success: boolean;
  timestamp: number;
}

const MAX_RETRIES = 3;
const HEAL_COOLDOWN_MS = 5_000;

class AutoHealEngine {
  private subsystems = new Map<SubsystemId, SubsystemHealth>();
  private healLog: HealEvent[] = [];
  private healFunctions = new Map<SubsystemId, () => boolean>();
  private listeners = new Set<(event: HealEvent) => void>();

  /** Register a subsystem with its heal/reset function */
  register(id: SubsystemId, healFn: () => boolean): void {
    this.subsystems.set(id, {
      id,
      status: 'healthy',
      failureCount: 0,
      lastError: null,
      lastHealAttempt: 0,
      disabled: false,
    });
    this.healFunctions.set(id, healFn);
  }

  /** Report a failure in a subsystem — triggers heal loop */
  reportFailure(id: SubsystemId, error: string): HealStatus {
    let health = this.subsystems.get(id);
    if (!health) {
      // Auto-register unknown subsystem with no-op heal
      this.register(id, () => true);
      health = this.subsystems.get(id)!;
    }

    if (health.disabled) {
      return 'disabled';
    }

    const now = Date.now();
    if (now - health.lastHealAttempt < HEAL_COOLDOWN_MS) {
      return health.status;
    }

    health.failureCount++;
    health.lastError = error;
    health.lastHealAttempt = now;

    if (health.failureCount > MAX_RETRIES) {
      // Graceful degradation — disable subsystem
      health.status = 'disabled';
      health.disabled = true;
      console.error(`[AutoHeal] ${id} disabled after ${MAX_RETRIES} failed heal attempts: ${error}`);
      this.logEvent(id, error, health.failureCount, false);
      return 'disabled';
    }

    // Attempt heal
    health.status = 'healing';
    const healFn = this.healFunctions.get(id);
    let success = false;

    try {
      success = healFn ? healFn() : false;
    } catch (e) {
      console.warn(`[AutoHeal] Heal function for ${id} threw:`, e);
      success = false;
    }

    if (success) {
      health.status = 'healthy';
      health.failureCount = 0;
      health.lastError = null;
      console.log(`[AutoHeal] ${id} healed successfully (attempt ${health.failureCount})`);
    } else {
      health.status = 'degraded';
      console.warn(`[AutoHeal] ${id} heal attempt ${health.failureCount}/${MAX_RETRIES} failed`);
    }

    this.logEvent(id, error, health.failureCount, success);
    return health.status;
  }

  /** Get health status of all subsystems */
  getHealthReport(): SubsystemHealth[] {
    return [...this.subsystems.values()];
  }

  /** Get specific subsystem health */
  getHealth(id: SubsystemId): SubsystemHealth | undefined {
    return this.subsystems.get(id);
  }

  /** Check if a subsystem is operational (healthy or degraded) */
  isOperational(id: SubsystemId): boolean {
    const h = this.subsystems.get(id);
    return !h || (!h.disabled && h.status !== 'disabled');
  }

  /** Force-enable a previously disabled subsystem */
  forceEnable(id: SubsystemId): void {
    const h = this.subsystems.get(id);
    if (h) {
      h.disabled = false;
      h.failureCount = 0;
      h.status = 'healthy';
      h.lastError = null;
      console.log(`[AutoHeal] ${id} force-enabled`);
    }
  }

  /** Get recent heal events */
  getHealLog(): readonly HealEvent[] {
    return this.healLog;
  }

  /** Subscribe to heal events */
  onHeal(cb: (event: HealEvent) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  /** Reset all subsystems */
  reset(): void {
    for (const h of this.subsystems.values()) {
      h.failureCount = 0;
      h.status = 'healthy';
      h.lastError = null;
      h.disabled = false;
      h.lastHealAttempt = 0;
    }
    this.healLog = [];
  }

  private logEvent(subsystem: SubsystemId, error: string, attempt: number, success: boolean): void {
    const event: HealEvent = { subsystem, error, attempt, success, timestamp: Date.now() };
    this.healLog.push(event);
    if (this.healLog.length > 200) this.healLog.shift();
    for (const l of this.listeners) {
      try { l(event); } catch { /* no-op */ }
    }
  }
}

export const autoHeal = new AutoHealEngine();
