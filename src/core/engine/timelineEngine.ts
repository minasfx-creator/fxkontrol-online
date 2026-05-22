/**
 * ─── Timeline Engine ────────────────────────────────────────────────
 * Synchronised show timeline. Drives playback time for all subsystems.
 * Supports play/pause/seek/speed and listener notifications.
 */

export interface TimelineState {
  time: number;      // seconds
  playing: boolean;
  speed: number;     // 1.0 = realtime
  duration: number;  // total show length
  loop: boolean;
}

type TimelineListener = (state: TimelineState) => void;

class TimelineEngine {
  private state: TimelineState = {
    time: 0,
    playing: false,
    speed: 1,
    duration: 300, // 5 min default
    loop: false,
  };
  private listeners = new Set<TimelineListener>();

  play(): void {
    if (this.state.playing) return;
    this.state.playing = true;
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

  seek(t: number): void {
    this.state.time = Math.max(0, Math.min(t, this.state.duration));
    this.notify();
  }

  setSpeed(speed: number): void {
    this.state.speed = Math.max(0.1, Math.min(speed, 10));
    this.notify();
  }

  setDuration(d: number): void {
    this.state.duration = Math.max(1, d);
  }

  setLoop(loop: boolean): void {
    this.state.loop = loop;
  }

  /** Advance time — called from FXKEngine.tick() */
  tick(delta: number): void {
    if (!this.state.playing) return;
    this.state.time += delta * this.state.speed;

    if (this.state.time >= this.state.duration) {
      if (this.state.loop) {
        this.state.time = 0;
      } else {
        this.state.time = this.state.duration;
        this.state.playing = false;
      }
      this.notify();
    }
  }

  getState(): TimelineState {
    return { ...this.state };
  }

  getTime(): number {
    return this.state.time;
  }

  isPlaying(): boolean {
    return this.state.playing;
  }

  onChange(cb: TimelineListener): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  reset(): void {
    this.state = { time: 0, playing: false, speed: 1, duration: 300, loop: false };
    this.notify();
  }

  private notify(): void {
    const s = this.getState();
    for (const cb of this.listeners) {
      try { cb(s); } catch { /* no-op */ }
    }
  }
}

export const timelineEngine = new TimelineEngine();
