export type EmergencyLevel = 0 | 1 | 2 | 3;

export interface EmergencyState {
  level: EmergencyLevel;
  reason: string;
  acknowledged: boolean;
  autoTriggered: boolean;
  timestamp: number | null;
}

export interface EmergencyEvent extends EmergencyState {
  id: string;
}

export interface HealthMetrics {
  latencyMs: number;
  fps: number;
  positionErrorM: number;
  lostDrones: number;
  linkAlive: boolean;
  linkDownMs: number;
}

export interface EmergencyThresholds {
  minFps: number;
  maxPositionErrorM: number;
  maxLostDrones: number;
  maxLinkDownMs: number;
}

type EmergencyHandler = (level: EmergencyLevel, reason: string) => void;

const DEFAULT_THRESHOLDS: EmergencyThresholds = {
  minFps: 10,
  maxPositionErrorM: 50,
  maxLostDrones: 3,
  maxLinkDownMs: 5_000,
};

const initialState = (): EmergencyState => ({
  level: 0,
  reason: '',
  acknowledged: false,
  autoTriggered: false,
  timestamp: null,
});

class EmergencySystem {
  private state: EmergencyState = initialState();
  private history: EmergencyEvent[] = [];
  private handlers = new Set<EmergencyHandler>();
  private thresholds: EmergencyThresholds = { ...DEFAULT_THRESHOLDS };

  isActive(): boolean {
    return this.state.level > 0;
  }

  getLevel(): EmergencyLevel {
    return this.state.level;
  }

  getState(): EmergencyState {
    return { ...this.state };
  }

  getHistory(): EmergencyEvent[] {
    return this.history.map(event => ({ ...event }));
  }

  softStop(reason: string, autoTriggered = false): void {
    this.trigger(1, reason, autoTriggered);
  }

  hardStop(reason: string, autoTriggered = false): void {
    this.trigger(2, reason, autoTriggered);
  }

  killSwitch(reason: string, autoTriggered = false): void {
    this.trigger(3, reason, autoTriggered);
  }

  acknowledge(): void {
    this.state = { ...this.state, acknowledged: true };
  }

  clear(): boolean {
    if (this.state.level >= 2 && !this.state.acknowledged) return false;
    this.state = initialState();
    this.notify(0, '');
    return true;
  }

  reset(): void {
    this.state = initialState();
    this.history = [];
    this.handlers.clear();
    this.thresholds = { ...DEFAULT_THRESHOLDS };
  }

  checkHealth(metrics: HealthMetrics): void {
    if (this.state.level === 3) return;

    if (!metrics.linkAlive && metrics.linkDownMs >= this.thresholds.maxLinkDownMs) {
      this.hardStop('link timeout', true);
      return;
    }

    if (metrics.lostDrones >= this.thresholds.maxLostDrones) {
      this.hardStop('lost drones threshold exceeded', true);
      return;
    }

    if (metrics.fps <= this.thresholds.minFps) {
      this.softStop('low fps', true);
      return;
    }

    if (metrics.positionErrorM >= this.thresholds.maxPositionErrorM) {
      this.softStop('position error threshold exceeded', true);
    }
  }

  onEmergency(handler: EmergencyHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  setThresholds(thresholds: Partial<EmergencyThresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
  }

  private trigger(level: EmergencyLevel, reason: string, autoTriggered: boolean): void {
    if (level < this.state.level) return;

    this.state = {
      level,
      reason,
      acknowledged: false,
      autoTriggered,
      timestamp: Date.now(),
    };

    this.history.push({
      id: `${this.state.timestamp}-${this.history.length}`,
      ...this.state,
    });
    this.notify(level, reason);
  }

  private notify(level: EmergencyLevel, reason: string): void {
    for (const handler of this.handlers) {
      try {
        handler(level, reason);
      } catch (error) {
        console.warn('[EmergencySystem] handler failed:', error);
      }
    }
  }
}

export const emergency = new EmergencySystem();
