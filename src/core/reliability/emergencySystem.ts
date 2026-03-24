/**
 * ─── Emergency System ───────────────────────────────────────────────
 * Three-tier emergency response, aviation-grade:
 *
 * Level 1 — SOFT STOP:  Controlled pause, drones hover, pyro holds
 * Level 2 — HARD STOP:  Immediate halt, all outputs cut
 * Level 3 — KILL SWITCH: Full power down, RTH all drones
 */

export type EmergencyLevel = 0 | 1 | 2 | 3;

export interface EmergencyState {
  level: EmergencyLevel;
  reason: string;
  timestamp: number;
  acknowledged: boolean;
  autoTriggered: boolean;
}

export type EmergencyHandler = (level: EmergencyLevel, reason: string) => void;

class EmergencySystem {
  private state: EmergencyState = {
    level: 0,
    reason: '',
    timestamp: 0,
    acknowledged: false,
    autoTriggered: false,
  };
  private handlers = new Set<EmergencyHandler>();
  private history: EmergencyState[] = [];

  // ── Auto-trigger thresholds ───────────────────────────────────
  private thresholds = {
    maxLatencyMs: 500,
    minFps: 15,
    maxPositionErrorM: 50,
    maxLostDrones: 3,
    linkTimeoutMs: 5000,
  };

  // ── Level Control ─────────────────────────────────────────────

  /**
   * Level 1 — Soft Stop: pause show, drones hover in place.
   */
  softStop(reason: string): void {
    this.trigger(1, reason, false);
  }

  /**
   * Level 2 — Hard Stop: cut all outputs immediately.
   */
  hardStop(reason: string): void {
    this.trigger(2, reason, false);
  }

  /**
   * Level 3 — Kill Switch: full emergency, RTH all, power down.
   */
  killSwitch(reason: string): void {
    this.trigger(3, reason, false);
  }

  /**
   * Clear emergency state (requires acknowledgment for L2+).
   */
  clear(): boolean {
    if (this.state.level >= 2 && !this.state.acknowledged) {
      console.warn('[Emergency] Level 2+ requires acknowledgment before clearing');
      return false;
    }
    this.state = {
      level: 0,
      reason: '',
      timestamp: 0,
      acknowledged: false,
      autoTriggered: false,
    };
    this.notify(0, 'cleared');
    return true;
  }

  acknowledge(): void {
    this.state.acknowledged = true;
  }

  // ── Auto-Trigger Checks ───────────────────────────────────────

  /**
   * Call periodically with system health metrics.
   * Automatically escalates if thresholds are breached.
   */
  checkHealth(metrics: {
    latencyMs: number;
    fps: number;
    positionErrorM: number;
    lostDrones: number;
    linkAlive: boolean;
    linkDownMs: number;
  }): void {
    // Don't escalate if already at max
    if (this.state.level >= 3) return;

    if (!metrics.linkAlive && metrics.linkDownMs > this.thresholds.linkTimeoutMs) {
      this.trigger(2, `Link lost for ${Math.round(metrics.linkDownMs / 1000)}s`, true);
      return;
    }

    if (metrics.lostDrones >= this.thresholds.maxLostDrones) {
      this.trigger(2, `${metrics.lostDrones} drones lost`, true);
      return;
    }

    if (metrics.positionErrorM > this.thresholds.maxPositionErrorM) {
      this.trigger(1, `Position error ${metrics.positionErrorM.toFixed(1)}m`, true);
      return;
    }

    if (metrics.fps < this.thresholds.minFps && this.state.level < 1) {
      this.trigger(1, `FPS critically low: ${metrics.fps}`, true);
    }
  }

  // ── Handlers ──────────────────────────────────────────────────

  onEmergency(handler: EmergencyHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  // ── State ─────────────────────────────────────────────────────

  getState(): Readonly<EmergencyState> {
    return this.state;
  }

  getLevel(): EmergencyLevel {
    return this.state.level;
  }

  isActive(): boolean {
    return this.state.level > 0;
  }

  getHistory(): ReadonlyArray<EmergencyState> {
    return this.history;
  }

  setThresholds(partial: Partial<typeof this.thresholds>): void {
    Object.assign(this.thresholds, partial);
  }

  // ── Internal ──────────────────────────────────────────────────

  private trigger(level: EmergencyLevel, reason: string, auto: boolean): void {
    // Only escalate, never de-escalate automatically
    if (level <= this.state.level && !auto) {
      // Manual trigger can set any level
    } else if (level <= this.state.level) {
      return;
    }

    this.state = {
      level,
      reason,
      timestamp: Date.now(),
      acknowledged: false,
      autoTriggered: auto,
    };

    this.history.push({ ...this.state });
    if (this.history.length > 100) this.history.shift();

    console.warn(`[EMERGENCY L${level}] ${reason} ${auto ? '(auto)' : '(manual)'}`);
    this.notify(level, reason);
  }

  private notify(level: EmergencyLevel, reason: string): void {
    for (const handler of this.handlers) {
      try {
        handler(level, reason);
      } catch (e) {
        console.error('[Emergency] Handler error:', e);
      }
    }
  }

  reset(): void {
    this.state = { level: 0, reason: '', timestamp: 0, acknowledged: false, autoTriggered: false };
    this.history = [];
  }
}

export const emergency = new EmergencySystem();
