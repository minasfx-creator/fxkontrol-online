/**
 * ─── Global Clock Adapter ───────────────────────────────────────────
 * Synchronizes local DeterministicClock with a remote HOST clock.
 * Uses exponential smoothing (lerp) to avoid jitter.
 * Zero-GC hot path.
 */

const SMOOTHING_FACTOR = 0.1;
const PING_INTERVAL_MS = 1000;
const DEGRADED_THRESHOLD_MS = 3000;
const MAX_HISTORY = 20;

export type SyncRole = 'host' | 'client' | 'viewer';

export interface ClockSyncState {
  role: SyncRole;
  offset: number;        // ms offset from host
  rtt: number;           // round-trip time ms
  status: 'synced' | 'syncing' | 'degraded' | 'disconnected';
  drift: number;         // instantaneous drift ms
  lastSyncAt: number;
  sampleCount: number;
}

class GlobalClockAdapter {
  private _role: SyncRole = 'host';
  private _offset = 0;
  private _smoothedOffset = 0;
  private _rtt = 0;
  private _status: ClockSyncState['status'] = 'disconnected';
  private _lastSyncAt = 0;
  private _sampleCount = 0;
  private _drift = 0;
  private _pingTimer: ReturnType<typeof setInterval> | null = null;

  // RTT history for median filtering
  private _rttHistory: number[] = [];

  // Callbacks
  private _onPing: (() => void) | null = null;
  private _onStatusChange: ((state: ClockSyncState) => void) | null = null;

  // ── Configuration ────────────────────────────────────────────────

  setRole(role: SyncRole): void {
    this._role = role;
    if (role === 'host') {
      this._offset = 0;
      this._smoothedOffset = 0;
      this._status = 'synced';
      this._stopPinging();
    }
  }

  getRole(): SyncRole {
    return this._role;
  }

  // ── Sync Protocol ────────────────────────────────────────────────

  /**
   * CLIENT: Record when we sent a ping request.
   * Returns the local timestamp for matching the pong.
   */
  createPingTimestamp(): number {
    return performance.now();
  }

  /**
   * CLIENT: Process a pong from the host.
   * @param sentAt - local time when ping was sent
   * @param hostTime - host's clock time (ms) when it received the ping
   */
  processPong(sentAt: number, hostTime: number): void {
    if (this._role === 'host') return;

    const now = performance.now();
    const rtt = now - sentAt;

    // Median-filtered RTT
    this._rttHistory.push(rtt);
    if (this._rttHistory.length > MAX_HISTORY) this._rttHistory.shift();
    const sorted = [...this._rttHistory].sort((a, b) => a - b);
    this._rtt = sorted[Math.floor(sorted.length / 2)];

    // Estimate one-way latency as RTT/2
    const oneWay = this._rtt / 2;

    // Raw offset: where host was when we received pong
    const rawOffset = hostTime + oneWay - now;

    // Track drift before smoothing
    this._drift = rawOffset - this._smoothedOffset;

    // Exponential smoothing
    this._smoothedOffset = this._smoothedOffset + SMOOTHING_FACTOR * (rawOffset - this._smoothedOffset);
    this._offset = this._smoothedOffset;

    this._lastSyncAt = now;
    this._sampleCount++;

    // Update status
    this._status = Math.abs(this._drift) < 5 ? 'synced' : 'syncing';

    this._onStatusChange?.(this.getState());
  }

  /**
   * HOST: Process a ping from a client.
   * Returns the host's current time for the pong response.
   */
  createPongTimestamp(): number {
    return performance.now();
  }

  // ── Corrected Time ───────────────────────────────────────────────

  /**
   * Get the corrected global time from a local time.
   * Host returns localTime unchanged.
   * Client applies the smoothed offset.
   */
  getCorrectedTime(localTime: number): number {
    if (this._role === 'host') return localTime;
    return localTime + this._offset;
  }

  /**
   * Get the current offset in ms.
   */
  getOffset(): number {
    return this._offset;
  }

  // ── Ping Loop ────────────────────────────────────────────────────

  startPinging(pingFn: () => void): void {
    this._onPing = pingFn;
    this._stopPinging();
    this._pingTimer = setInterval(() => {
      // Check for degraded state
      if (this._lastSyncAt > 0 && performance.now() - this._lastSyncAt > DEGRADED_THRESHOLD_MS) {
        this._status = 'degraded';
        this._onStatusChange?.(this.getState());
      }
      this._onPing?.();
    }, PING_INTERVAL_MS);
    // Immediate first ping
    this._onPing?.();
    this._status = 'syncing';
  }

  private _stopPinging(): void {
    if (this._pingTimer) {
      clearInterval(this._pingTimer);
      this._pingTimer = null;
    }
  }

  // ── Event Hooks ──────────────────────────────────────────────────

  onStatusChange(cb: (state: ClockSyncState) => void): () => void {
    this._onStatusChange = cb;
    return () => { this._onStatusChange = null; };
  }

  // ── State ────────────────────────────────────────────────────────

  getState(): ClockSyncState {
    return {
      role: this._role,
      offset: Math.round(this._offset * 100) / 100,
      rtt: Math.round(this._rtt * 100) / 100,
      status: this._status,
      drift: Math.round(this._drift * 100) / 100,
      lastSyncAt: this._lastSyncAt,
      sampleCount: this._sampleCount,
    };
  }

  // ── Lifecycle ────────────────────────────────────────────────────

  reset(): void {
    this._stopPinging();
    this._offset = 0;
    this._smoothedOffset = 0;
    this._rtt = 0;
    this._drift = 0;
    this._status = 'disconnected';
    this._lastSyncAt = 0;
    this._sampleCount = 0;
    this._rttHistory.length = 0;
  }

  destroy(): void {
    this._stopPinging();
    this._onPing = null;
    this._onStatusChange = null;
  }
}

export const globalClock = new GlobalClockAdapter();
