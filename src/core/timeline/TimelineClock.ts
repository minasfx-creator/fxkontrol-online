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

class TimelineClock {
  private state: TimelineClockState = { ...DEFAULT_STATE };
  private listeners = new Set<TimelineClockListener>();

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
    const next = this.clampTime(time);
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
    const next = this.clampTime(time);
    this.state.driftSec = next - this.state.time;
    if (next === this.state.time && this.state.source === 'external') {
      this.state.lastExternalSync = Date.now();
      this.notify();
      return;
    }
    this.state.time = next;
    this.state.source = 'external';
    this.state.lastExternalSync = Date.now();
    this.notify();
  }

  setSpeed(speed: number): void {
    if (!Number.isFinite(speed)) return;
    const next = Math.max(0.1, Math.min(speed, 10));
    if (next === this.state.speed) return;
    this.state.speed = next;
    this.notify();
  }

  setDuration(duration: number): void {
    if (!Number.isFinite(duration)) return;
    const nextDuration = Math.max(1, duration);
    const prevTime = this.state.time;
    this.state.duration = nextDuration;
    this.state.time = this.clampTime(prevTime);
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
    if (dt <= 0) return;

    const nextTime = this.state.time + dt * this.state.speed;
    if (nextTime >= this.state.duration) {
      if (this.state.loop) {
        this.state.time = nextTime % this.state.duration;
      } else {
        this.state.time = this.state.duration;
        this.state.playing = false;
      }
      this.state.source = 'local';
      this.state.driftSec = 0;
      this.notify();
      return;
    }

    this.state.time = nextTime;
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