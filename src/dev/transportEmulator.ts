/**
 * ─── Transport Emulator (dev only) ─────────────────────────────────
 * Adversarial transport simulator for the FireOne hardware bridge.
 *
 * Models the wire protocol between the browser bridge and an ESP32/FXK-PYRO
 * field module: latency, jitter, packet loss, out-of-order delivery, frame
 * duplication, and mid-flight disconnects.
 *
 * Goal: validate the bridge's session/ordering/retry/rate-limit hardenings
 * (39/39 tests) against realistic RF/WiFi-Direct/BLE conditions BEFORE
 * burning physical hardware in the field.
 *
 * NOT for production. Gated by import path (src/dev/*).
 */

export type EmulatorMode =
  | 'normal'
  | 'latency'
  | 'jitter'
  | 'packet_loss'
  | 'out_of_order'
  | 'duplicate'
  | 'disconnect_mid_flight'
  | 'parse_garbage'
  | 'burst';

export interface EmulatorConfig {
  mode: EmulatorMode;
  /** Base one-way latency in ms (default 0). */
  latencyMs?: number;
  /** Random jitter added to latency, ±ms (default 0). */
  jitterMs?: number;
  /** 0..1 probability of dropping an outbound command (default 0). */
  lossRate?: number;
  /** 0..1 probability of duplicating an injected response (default 0). */
  duplicateRate?: number;
  /** After N commands, force a disconnect (default Infinity). */
  disconnectAfter?: number;
  /** Deterministic seed (optional). When set, RNG is reproducible. */
  seed?: number;
}

type ResponseListener = (frame: string) => void;
type StateListener = (state: 'connected' | 'disconnected') => void;

/** Tiny mulberry32 RNG — deterministic when seeded. */
function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6D2B79F5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export class TransportEmulator {
  private cfg: Required<EmulatorConfig>;
  private rng: () => number;
  private connected = true;
  private sentCount = 0;
  private outboundLog: string[] = [];
  private respListeners = new Set<ResponseListener>();
  private stateListeners = new Set<StateListener>();
  private timers = new Set<ReturnType<typeof setTimeout>>();
  /** Auto-reply rules: when bridge sends `match`, queue `reply` after delay. */
  private autoReplies: Array<{ match: RegExp; reply: (cmd: string) => string | null }> = [];
  private trace: Array<{ dir: 'tx' | 'rx'; data: string; at: number; mode: EmulatorMode }> = [];
  private traceCap = 1000;
  private txCount = 0;
  private rxCount = 0;
  private replayTimers = new Set<ReturnType<typeof setTimeout>>();
  private replayState: 'idle' | 'running' | 'paused' = 'idle';
  private replayCursor = 0;
  private replayFrames: Array<{ dir: 'tx' | 'rx'; data: string; at: number }> = [];
  private lastDeliveredRxIndex: number | null = null;
  private replayBreakpoint: ((frame: { dir: 'tx' | 'rx'; data: string; at: number }) => boolean) | null = null;
  private breakpointListeners = new Set<(frame: { dir: 'tx' | 'rx'; data: string; at: number }, index: number) => void>();

  constructor(cfg: EmulatorConfig) {
    // Production guard — emulator is dev/test only.
    // Vite exposes import.meta.env.DEV (true in dev) and MODE ('test' in vitest).
    const env = (import.meta as unknown as { env?: { DEV?: boolean; MODE?: string; PROD?: boolean } }).env;
    if (env && env.PROD === true && env.MODE !== 'test') {
      throw new Error('TransportEmulator must not be used in production');
    }
    this.cfg = {
      mode: cfg.mode,
      latencyMs: cfg.latencyMs ?? 0,
      jitterMs: cfg.jitterMs ?? 0,
      lossRate: cfg.lossRate ?? 0,
      duplicateRate: cfg.duplicateRate ?? 0,
      disconnectAfter: cfg.disconnectAfter ?? Number.POSITIVE_INFINITY,
      seed: cfg.seed ?? Math.floor(Math.random() * 0x7fffffff),
    };
    this.rng = mulberry32(this.cfg.seed);
  }

  // ── Subscriptions ───────────────────────────────────────────────
  onResponse(fn: ResponseListener): () => void {
    this.respListeners.add(fn);
    return () => this.respListeners.delete(fn);
  }
  onStateChange(fn: StateListener): () => void {
    this.stateListeners.add(fn);
    return () => this.stateListeners.delete(fn);
  }

  // ── Auto-reply rules ────────────────────────────────────────────
  /** Register an auto-reply for commands matching `match`. */
  registerReply(match: RegExp, reply: (cmd: string) => string | null) {
    this.autoReplies.push({ match, reply });
  }

  // ── Outbound (bridge → emulator) ────────────────────────────────
  /**
   * Called by the bridge when it wants to send a command on the wire.
   * Returns true if the command "made it" to the emulator (not dropped).
   */
  send(cmd: string): boolean {
    if (!this.connected) return false;
    this.sentCount++;
    if (this.sentCount > this.cfg.disconnectAfter) {
      this.forceDisconnect();
      return false;
    }
    if (this.cfg.mode === 'packet_loss' && this.rng() < this.cfg.lossRate) {
      return false; // dropped on the wire
    }
    this.outboundLog.push(cmd);
    this.recordTrace('tx', cmd);

    // Process auto-replies for this command
    for (const rule of this.autoReplies) {
      if (rule.match.test(cmd)) {
        const reply = rule.reply(cmd);
        if (reply !== null) this.scheduleResponse(reply);
      }
    }
    return true;
  }

  // ── Inbound (emulator → bridge) ─────────────────────────────────
  /** Manually inject a response frame (test helper). */
  injectResponse(frame: string) {
    if (this.cfg.mode === 'burst') {
      // Burst mode: deliver the same frame N times back-to-back to validate
      // rate limiter behavior under retry storms. Default 10×.
      for (let i = 0; i < 10; i++) this.scheduleResponse(frame);
      return;
    }
    this.scheduleResponse(frame);
  }

  /** Inject several responses simultaneously to test out-of-order delivery. */
  injectResponses(frames: string[]) {
    if (this.cfg.mode === 'out_of_order') {
      // Shuffle deterministically using RNG
      const shuffled = [...frames];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(this.rng() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      shuffled.forEach((f) => this.scheduleResponse(f));
    } else {
      frames.forEach((f) => this.scheduleResponse(f));
    }
  }

  private scheduleResponse(frame: string) {
    if (!this.connected) return;
    const delay = this.computeDelay();
    const t = setTimeout(() => {
      this.timers.delete(t);
      this.deliverFrame(frame);
      // Duplicate?
      if (this.cfg.duplicateRate > 0 && this.rng() < this.cfg.duplicateRate) {
        const t2 = setTimeout(() => {
          this.timers.delete(t2);
          this.deliverFrame(frame);
        }, this.computeDelay());
        this.timers.add(t2);
      }
    }, delay);
    this.timers.add(t);
  }

  private deliverFrame(frame: string) {
    if (!this.connected) return;
    let f = frame;
    if (this.cfg.mode === 'parse_garbage') {
      // Truncate or corrupt 30% of frames
      if (this.rng() < 0.3) f = frame.slice(0, Math.max(1, Math.floor(frame.length / 2)));
    }
    this.recordTrace('rx', f);
    for (const l of this.respListeners) l(f);
  }

  private computeDelay(): number {
    const base = this.cfg.latencyMs;
    const jitter = this.cfg.mode === 'jitter' || this.cfg.jitterMs > 0
      ? (this.rng() * 2 - 1) * this.cfg.jitterMs
      : 0;
    return Math.max(0, base + jitter);
  }

  // ── Connection control ──────────────────────────────────────────
  forceDisconnect() {
    if (!this.connected) return;
    this.connected = false;
    this.clearTimers();
    for (const l of this.stateListeners) l('disconnected');
  }

  reconnect() {
    if (this.connected) return;
    this.connected = true;
    this.sentCount = 0;
    for (const l of this.stateListeners) l('connected');
  }

  // ── Introspection (test helpers) ────────────────────────────────
  isConnected() { return this.connected; }
  getOutboundLog() { return [...this.outboundLog]; }
  getSentCount() { return this.sentCount; }
  getPendingTimers() { return this.timers.size; }
  resetLog() { this.outboundLog = []; this.trace = []; this.txCount = 0; this.rxCount = 0; }
  getMode(): EmulatorMode { return this.cfg.mode; }
  getConfig(): Required<EmulatorConfig> { return { ...this.cfg }; }
  setMode(mode: EmulatorMode) { this.cfg.mode = mode; }
  setLatency(ms: number) { this.cfg.latencyMs = Math.max(0, ms); }
  setJitter(ms: number) { this.cfg.jitterMs = Math.max(0, ms); }
  setLossRate(rate: number) { this.cfg.lossRate = Math.min(1, Math.max(0, rate)); }

  // ── Trace recording ─────────────────────────────────────────────
  /** Export full TX/RX trace as a serializable JSON-ready object. */
  exportTrace() {
    return {
      version: 1,
      seed: this.cfg.seed,
      mode: this.cfg.mode,
      capturedAt: Date.now(),
      frames: [...this.trace],
    };
  }

  private recordTrace(dir: 'tx' | 'rx', data: string) {
    this.trace.push({ dir, data, at: Date.now(), mode: this.cfg.mode });
    if (dir === 'tx') this.txCount++; else this.rxCount++;
    // Bounded buffer — drop oldest to keep memory flat.
    if (this.trace.length > this.traceCap) this.trace.shift();
  }

  /** O(1) live counters for UI polling — no array filter needed. */
  getStats() { return { tx: this.txCount, rx: this.rxCount, traced: this.trace.length }; }

  // ── Trace replay ─────────────────────────────────────────────────
  private replayFilter: ((data: string) => boolean) | null = null;
  private replayOpts: { preserveTiming: boolean; speed: number; onComplete?: () => void } = {
    preserveTiming: true,
    speed: 1,
  };

  /** Validate a trace shape — guards against corrupted/foreign JSON. */
  private isValidTrace(t: unknown): t is { frames: Array<{ dir: 'tx' | 'rx'; data: string; at: number }> } {
    if (!t || typeof t !== 'object') return false;
    const frames = (t as { frames?: unknown }).frames;
    if (!Array.isArray(frames)) return false;
    return frames.every((f: unknown) => {
      if (!f || typeof f !== 'object') return false;
      const ff = f as { dir?: unknown; data?: unknown; at?: unknown };
      return (ff.dir === 'tx' || ff.dir === 'rx')
        && typeof ff.data === 'string'
        && typeof ff.at === 'number';
    });
  }

  /** Load a previously exported trace. Replaces any in-flight replay state. */
  loadTrace(trace: unknown) {
    if (!this.isValidTrace(trace)) {
      throw new Error('Invalid trace: missing/malformed frames');
    }
    this.stopReplay();
    this.replayFrames = [...trace.frames];
    this.replayCursor = 0;
    this.replayState = 'idle';
  }

  /**
   * Replay loaded trace's RX frames into the bridge using an incremental
   * scheduler — only one timer in flight at a time, enabling true pause and
   * stable memory for large traces.
   *
   * - preserveTiming=true (default): respects original inter-frame deltas.
   * - preserveTiming=false: delivers everything as fast as possible.
   * - speed: multiplier applied to deltas (2 = 2× faster).
   * - filter: only replay RX frames whose data matches the predicate.
   */
  replay(opts: {
    preserveTiming?: boolean;
    speed?: number;
    onComplete?: () => void;
    filter?: (data: string) => boolean;
  } = {}) {
    if (this.replayFrames.length === 0) return;
    this.replayOpts = {
      preserveTiming: opts.preserveTiming ?? true,
      speed: opts.speed ?? 1,
      onComplete: opts.onComplete,
    };
    this.replayFilter = opts.filter ?? null;
    this.replayState = 'running';
    this.scheduleNextReplay();
  }

  /** Find the next RX frame index from a given cursor (respects filter). */
  private nextRxIndex(from: number): number {
    for (let i = from; i < this.replayFrames.length; i++) {
      const f = this.replayFrames[i];
      if (f.dir !== 'rx') continue;
      if (this.replayFilter && !this.replayFilter(f.data)) continue;
      return i;
    }
    return -1;
  }

  private scheduleNextReplay() {
    if (this.replayState !== 'running') return;
    const idx = this.nextRxIndex(this.replayCursor);
    if (idx === -1) {
      this.replayState = 'idle';
      this.replayOpts.onComplete?.();
      return;
    }
    const frame = this.replayFrames[idx];
    // Delta = gap between previous delivered frame and this one (true fidelity).
    let delta = 0;
    if (this.replayOpts.preserveTiming) {
      const prevIdx = this.replayCursor === 0 ? idx : this.replayCursor - 1;
      const prev = this.replayFrames[Math.max(0, prevIdx)];
      delta = Math.max(0, (frame.at - prev.at) / this.replayOpts.speed);
    }
    const t = setTimeout(() => {
      this.replayTimers.delete(t);
      if (this.replayState !== 'running') return;
      this.deliverFrame(frame.data);
      this.replayCursor = idx + 1;
      this.scheduleNextReplay();
    }, delta);
    this.replayTimers.add(t);
  }

  /** Step one RX frame at a time — advances cursor to the next *relevant* RX. */
  stepReplay(): boolean {
    const idx = this.nextRxIndex(this.replayCursor);
    if (idx === -1) return false;
    this.deliverFrame(this.replayFrames[idx].data);
    this.replayCursor = idx + 1;
    return this.nextRxIndex(this.replayCursor) !== -1;
  }

  pauseReplay() {
    if (this.replayState !== 'running') return;
    this.replayState = 'paused';
    for (const t of this.replayTimers) clearTimeout(t);
    this.replayTimers.clear();
  }

  resumeReplay() {
    if (this.replayState !== 'paused') return;
    this.replayState = 'running';
    this.scheduleNextReplay();
  }

  stopReplay() {
    this.replayState = 'idle';
    this.replayCursor = 0;
    for (const t of this.replayTimers) clearTimeout(t);
    this.replayTimers.clear();
  }

  getReplayStatus() {
    return {
      state: this.replayState,
      cursor: this.replayCursor,
      total: this.replayFrames.length,
    };
  }

  /** Read-only frames view for the visual timeline. */
  getReplayFrames(): ReadonlyArray<{ dir: 'tx' | 'rx'; data: string; at: number }> {
    return this.replayFrames;
  }

  // ── Cleanup ─────────────────────────────────────────────────────
  destroy() {
    this.clearTimers();
    this.stopReplay();
    this.respListeners.clear();
    this.stateListeners.clear();
    this.autoReplies = [];
  }

  private clearTimers() {
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
  }
}

