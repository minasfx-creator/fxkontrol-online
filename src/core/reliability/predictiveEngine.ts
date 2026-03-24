/**
 * ─── Predictive Engine ──────────────────────────────────────────────
 * Pre-computes future events and sends commands ahead of time,
 * compensating for network latency.
 *
 * Rule: EXECUTION = T + latencyCompensation
 *
 * The system is ALWAYS 50-200ms in the future, ensuring commands
 * arrive at the exact physical moment they need to execute.
 */

export interface PredictedEvent {
  id: string;
  type: 'fire' | 'drone_cmd' | 'dmx' | 'effect';
  targetTime: number;      // When it SHOULD happen (sim time, seconds)
  sendTime: number;        // When we WILL send it (sim time - latency)
  payload: unknown;
  sent: boolean;
  confirmed: boolean;
}

interface LatencyProfile {
  avgMs: number;
  jitterMs: number;
  samples: number[];
  maxSamples: number;
}

class PredictiveEngine {
  private events: PredictedEvent[] = [];
  private latency: LatencyProfile = {
    avgMs: 50,
    jitterMs: 10,
    samples: [],
    maxSamples: 50,
  };
  private lookaheadMs = 200;  // How far ahead to pre-compute
  private safetyMarginMs = 20; // Extra buffer for jitter

  // ── Latency Measurement ───────────────────────────────────────

  /** Feed a round-trip-time sample (ms). */
  recordLatency(rttMs: number): void {
    const oneWay = rttMs / 2;
    this.latency.samples.push(oneWay);
    if (this.latency.samples.length > this.latency.maxSamples) {
      this.latency.samples.shift();
    }
    // Weighted moving average
    const sum = this.latency.samples.reduce((a, b) => a + b, 0);
    this.latency.avgMs = sum / this.latency.samples.length;
    // Jitter = standard deviation
    const mean = this.latency.avgMs;
    const variance = this.latency.samples.reduce((a, s) => a + (s - mean) ** 2, 0) / this.latency.samples.length;
    this.latency.jitterMs = Math.sqrt(variance);
  }

  /** Total compensation = avg latency + jitter + safety margin. */
  getCompensationMs(): number {
    return this.latency.avgMs + this.latency.jitterMs + this.safetyMarginMs;
  }

  // ── Event Scheduling ──────────────────────────────────────────

  /**
   * Schedule a future event. The engine will calculate when to
   * actually send the command to compensate for latency.
   */
  schedule(event: Omit<PredictedEvent, 'sendTime' | 'sent' | 'confirmed'>): void {
    const compensationSec = this.getCompensationMs() / 1000;
    this.events.push({
      ...event,
      sendTime: event.targetTime - compensationSec,
      sent: false,
      confirmed: false,
    });
  }

  /**
   * Call every tick. Returns events that need to be sent NOW.
   */
  tick(currentSimTime: number): PredictedEvent[] {
    const toSend: PredictedEvent[] = [];

    for (const evt of this.events) {
      if (!evt.sent && currentSimTime >= evt.sendTime) {
        evt.sent = true;
        toSend.push(evt);
      }
    }

    // Garbage collect old confirmed events
    this.events = this.events.filter(
      e => !e.confirmed || (currentSimTime - e.targetTime) < 5
    );

    return toSend;
  }

  /** Mark an event as confirmed by hardware. */
  confirm(eventId: string): void {
    const evt = this.events.find(e => e.id === eventId);
    if (evt) evt.confirmed = true;
  }

  // ── Precompute Window ─────────────────────────────────────────

  /**
   * Pre-scan timeline for events in the next `lookaheadMs`.
   * Call this to populate the prediction buffer.
   */
  precomputeWindow(
    currentTime: number,
    timelineEvents: { id: string; time: number; type: PredictedEvent['type']; payload: unknown }[]
  ): number {
    const windowEnd = currentTime + this.lookaheadMs / 1000;
    let scheduled = 0;

    for (const evt of timelineEvents) {
      if (evt.time > currentTime && evt.time <= windowEnd) {
        if (!this.events.find(e => e.id === evt.id)) {
          this.schedule({
            id: evt.id,
            type: evt.type,
            targetTime: evt.time,
            payload: evt.payload,
          });
          scheduled++;
        }
      }
    }

    return scheduled;
  }

  // ── Config ────────────────────────────────────────────────────

  setLookahead(ms: number): void {
    this.lookaheadMs = Math.max(50, Math.min(500, ms));
  }

  setSafetyMargin(ms: number): void {
    this.safetyMarginMs = Math.max(0, Math.min(100, ms));
  }

  getStats() {
    return {
      pending: this.events.filter(e => !e.sent).length,
      sent: this.events.filter(e => e.sent && !e.confirmed).length,
      confirmed: this.events.filter(e => e.confirmed).length,
      avgLatencyMs: Math.round(this.latency.avgMs * 10) / 10,
      jitterMs: Math.round(this.latency.jitterMs * 10) / 10,
      compensationMs: Math.round(this.getCompensationMs() * 10) / 10,
    };
  }

  reset(): void {
    this.events = [];
  }
}

export const predictive = new PredictiveEngine();
