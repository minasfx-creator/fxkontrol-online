export interface TimelineClockState {
  time: number;
  playing: boolean;
  speed: number;
  duration: number;
  loop: boolean;
  source: 'local' | 'external';
  lastExternalSync: number | null;
  driftSec: number;
}

type TimelineClockListener = (state: TimelineClockState) => void;

const TIME_PRECISION = 1e6;
const MAX_DT = 0.25;
const FREEZE_DT_THRESHOLD = 2.5;

const DEFAULT_STATE: TimelineClockState = {
  time: 0,
  playing: false,
  speed: 1,
  duration: 300,
  loop: false,
  source: 'local',
  lastExternalSync: null,
  driftSec: 0,
};

function deepFreeze<T>(value: T): Readonly<T> {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value as Readonly<T>;
  }

  Object.freeze(value);

  for (const nested of Object.values(value as Record<string, unknown>)) {
    if (nested && typeof nested === 'object') {
      deepFreeze(nested);
    }
  }

  return value as Readonly<T>;
}

class TimelineClock {
  private state: TimelineClockState = { ...DEFAULT_STATE };
  private listeners = new Set<TimelineClockListener>();

  private normalizeTime(time: number): number {
    return Math.round(this.clampTime(time) * TIME_PRECISION) / TIME_PRECISION;
  }

  play(): void {
    if (this.state.playing) return;
    this.state.playing = true;
    this.state.source = 'local';
    this.notify();
  }

  pause(): void {
    if (!this.state.playing) return;
    this.state.playing = false;
    this.notify();
  }

  toggle(): void {
    this.state.playing ? this.pause() : this.play();
  }

  seek(time: number): void {
    if (!Number.isFinite(time)) return;
    const next = this.normalizeTime(time);
    this.state.driftSec = 0;
    if (next === this.state.time) {
      this.state.source = 'local';
      this.notify();
      return;
    }
    this.state.time = next;
    this.state.source = 'local';
    this.notify();
  }

  syncExternalTime(time: number): void {
    if (!Number.isFinite(time)) return;
    const next = this.normalizeTime(time);
    this.state.driftSec = next - this.state.time;
    if (next === this.state.time && this.state.source === 'external') {
      this.state.lastExternalSync = Date.now();
      this.notify();
      return;
    }
    this.state.time = next;
    this.state.speed = 1;
    this.state.source = 'external';
    this.state.lastExternalSync = Date.now();
    this.notify();
  }

  setSpeed(speed: number): void {
    if (!Number.isFinite(speed)) return;
    const next = Math.max(0, Math.min(speed, 10));
    if (next === this.state.speed) return;
    this.state.speed = next;
    this.notify();
  }

  setDuration(duration: number): void {
    if (!Number.isFinite(duration) || duration < 0) return;
    const nextDuration = Math.max(1, duration);
    const prevTime = this.state.time;
    this.state.duration = nextDuration;
    this.state.time = this.normalizeTime(prevTime);
    if (this.state.time >= this.state.duration && !this.state.loop) {
      this.state.playing = false;
    }
    this.notify();
  }

  setLoop(loop: boolean): void {
    if (loop === this.state.loop) return;
    this.state.loop = loop;
    this.notify();
  }

  tick(dt: number): void {
    if (!this.state.playing) return;
    if (!Number.isFinite(dt) || dt <= 0) return;
    const clampedDt = dt > FREEZE_DT_THRESHOLD ? MAX_DT : dt;

    const nextTime = this.state.time + clampedDt * this.state.speed;
    if (nextTime >= this.state.duration) {
      if (this.state.loop) {
        this.state.time = this.normalizeTime(nextTime % this.state.duration);
      } else {
        this.state.time = this.normalizeTime(this.state.duration);
        this.state.playing = false;
      }
      this.state.source = 'local';
      this.state.driftSec = 0;
      this.notify();
      return;
    }

    this.state.time = this.normalizeTime(nextTime);
    this.state.source = 'local';
    this.state.driftSec = 0;
    this.notify();
  }

  reset(): void {
    this.state = { ...DEFAULT_STATE, duration: this.state.duration };
    this.notify();
  }

  getTime(): number {
    return this.state.time;
  }

  isPlaying(): boolean {
    return this.state.playing;
  }

  getState(): TimelineClockState {
    return { ...this.state };
  }

  getDiagnostics(): Readonly<TimelineClockState> {
    return deepFreeze(structuredClone(this.state));
  }

  subscribe(listener: TimelineClockListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  onChange(listener: TimelineClockListener): () => void {
    return this.subscribe(listener);
  }

  private clampTime(time: number): number {
    if (!Number.isFinite(time)) {
      return this.state.time;
    }
    return Math.max(0, Math.min(time, this.state.duration));
  }

  private notify(): void {
    const snapshot = this.getState();
    for (const listener of this.listeners) {
      try {
        listener(snapshot);
      } catch {
      }
    }
  }
}

export const timelineClock = new TimelineClock();