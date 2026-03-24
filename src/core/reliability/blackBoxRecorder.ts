/**
 * ─── Black Box Recorder (Aviation Grade) ────────────────────────────
 * Records ALL commands, errors, state changes at 100ms intervals.
 * Non-blocking circular buffer — never allocates during show.
 */

export interface BlackBoxEntry {
  t: number;          // Timestamp (ms, performance.now based)
  cat: 'cmd' | 'err' | 'state' | 'fire' | 'drone' | 'net' | 'emergency';
  msg: string;
  data?: Record<string, unknown>;
}

const MAX_ENTRIES = 36_000; // 1 hour at 10Hz

class BlackBoxRecorder {
  private buffer: BlackBoxEntry[];
  private head = 0;
  private count = 0;
  private recording = false;
  private startTime = 0;

  constructor() {
    // Pre-allocate the entire buffer
    this.buffer = new Array(MAX_ENTRIES);
    for (let i = 0; i < MAX_ENTRIES; i++) {
      this.buffer[i] = { t: 0, cat: 'state', msg: '' };
    }
  }

  start(): void {
    this.recording = true;
    this.startTime = performance.now();
    this.record('state', 'BlackBox recording started');
  }

  stop(): void {
    this.record('state', 'BlackBox recording stopped');
    this.recording = false;
  }

  /** Record an entry — zero allocation (reuses pre-allocated slot). */
  record(cat: BlackBoxEntry['cat'], msg: string, data?: Record<string, unknown>): void {
    if (!this.recording) return;

    const entry = this.buffer[this.head];
    entry.t = performance.now() - this.startTime;
    entry.cat = cat;
    entry.msg = msg;
    entry.data = data;

    this.head = (this.head + 1) % MAX_ENTRIES;
    if (this.count < MAX_ENTRIES) this.count++;
  }

  /** Export all entries in chronological order. */
  export(): BlackBoxEntry[] {
    const result: BlackBoxEntry[] = [];
    const start = this.count < MAX_ENTRIES ? 0 : this.head;
    for (let i = 0; i < this.count; i++) {
      const idx = (start + i) % MAX_ENTRIES;
      const e = this.buffer[idx];
      result.push({ t: e.t, cat: e.cat, msg: e.msg, data: e.data ? { ...e.data } : undefined });
    }
    return result;
  }

  /** Export as downloadable JSON blob. */
  exportBlob(): Blob {
    const entries = this.export();
    const json = JSON.stringify({
      version: '1.0',
      startTime: this.startTime,
      exportTime: Date.now(),
      entryCount: entries.length,
      entries,
    }, null, 2);
    return new Blob([json], { type: 'application/json' });
  }

  getEntryCount(): number {
    return this.count;
  }

  isRecording(): boolean {
    return this.recording;
  }

  reset(): void {
    this.head = 0;
    this.count = 0;
    this.recording = false;
  }
}

export const blackbox = new BlackBoxRecorder();
