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
  resetLog() { this.outboundLog = []; this.trace = []; }
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
    // Bounded buffer — drop oldest to keep memory flat.
    if (this.trace.length > this.traceCap) this.trace.shift();
  }


  // ── Cleanup ─────────────────────────────────────────────────────
  destroy() {
    this.clearTimers();
    this.respListeners.clear();
    this.stateListeners.clear();
    this.autoReplies = [];
  }

  private clearTimers() {
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
  }
}
