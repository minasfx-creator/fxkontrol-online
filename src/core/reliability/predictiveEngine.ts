export type PredictiveEventType = 'fire' | 'drone_cmd' | 'effect';
export type PredictiveEventStatus = 'pending' | 'sent' | 'confirmed';

export interface PredictiveEvent {
  id: string;
  type: PredictiveEventType;
  targetTime: number;
  payload: unknown;
}

export interface TimelinePredictiveEvent {
  id: string;
  type: PredictiveEventType;
  time: number;
  payload: unknown;
}

interface ScheduledEvent extends PredictiveEvent {
  sendTime: number;
  status: PredictiveEventStatus;
}

export interface PredictiveStats {
  avgLatencyMs: number;
  jitterMs: number;
  compensationMs: number;
  pending: number;
  sent: number;
  confirmed: number;
}

const MAX_LATENCY_SAMPLES = 50;
const DEFAULT_SAFETY_MARGIN_MS = 20;
const DEFAULT_LOOKAHEAD_MS = 200;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

class PredictiveEngine {
  private latencySamples: number[] = [];
  private safetyMarginMs = DEFAULT_SAFETY_MARGIN_MS;
  private lookaheadMs = DEFAULT_LOOKAHEAD_MS;
  private events = new Map<string, ScheduledEvent>();

  reset(): void {
    this.latencySamples = [];
    this.safetyMarginMs = DEFAULT_SAFETY_MARGIN_MS;
    this.lookaheadMs = DEFAULT_LOOKAHEAD_MS;
    this.events.clear();
  }

  recordLatency(roundTripMs: number): void {
    this.latencySamples.push(Math.max(0, roundTripMs / 2));
    if (this.latencySamples.length > MAX_LATENCY_SAMPLES) {
      this.latencySamples.splice(0, this.latencySamples.length - MAX_LATENCY_SAMPLES);
    }
  }

  setSafetyMargin(ms: number): void {
    this.safetyMarginMs = Math.max(0, ms);
  }

  setLookahead(ms: number): void {
    this.lookaheadMs = clamp(ms, 50, 500);
  }

  schedule(event: PredictiveEvent): void {
    if (this.events.has(event.id)) return;
    const sendTime = event.targetTime - this.getCompensationMs() / 1000;
    this.events.set(event.id, {
      ...event,
      sendTime,
      status: 'pending',
    });
  }

  tick(simTime: number): ScheduledEvent[] {
    const ready: ScheduledEvent[] = [];
    for (const event of this.events.values()) {
      if (event.status !== 'pending' || simTime < event.sendTime) continue;
      event.status = 'sent';
      ready.push({ ...event });
    }
    return ready;
  }

  confirm(id: string): void {
    const event = this.events.get(id);
    if (!event) return;
    event.status = 'confirmed';
  }

  precomputeWindow(currentTime: number, timeline: TimelinePredictiveEvent[]): number {
    const endTime = currentTime + this.lookaheadMs / 1000;
    let scheduled = 0;

    for (const item of timeline) {
      if (item.time <= currentTime || item.time > endTime || this.events.has(item.id)) continue;
      this.schedule({
        id: item.id,
        type: item.type,
        targetTime: item.time,
        payload: item.payload,
      });
      scheduled++;
    }

    return scheduled;
  }

  getStats(): PredictiveStats {
    let pending = 0;
    let sent = 0;
    let confirmed = 0;

    for (const event of this.events.values()) {
      if (event.status === 'pending') pending++;
      if (event.status === 'sent') sent++;
      if (event.status === 'confirmed') confirmed++;
    }

    const avgLatencyMs = this.getAverageLatencyMs();
    const jitterMs = this.getJitterMs(avgLatencyMs);
    return {
      avgLatencyMs,
      jitterMs,
      compensationMs: avgLatencyMs + jitterMs + this.safetyMarginMs,
      pending,
      sent,
      confirmed,
    };
  }

  private getCompensationMs(): number {
    const avgLatencyMs = this.getAverageLatencyMs();
    return avgLatencyMs + this.getJitterMs(avgLatencyMs) + this.safetyMarginMs;
  }

  private getAverageLatencyMs(): number {
    if (this.latencySamples.length === 0) return 0;
    return this.latencySamples.reduce((sum, value) => sum + value, 0) / this.latencySamples.length;
  }

  private getJitterMs(avgLatencyMs: number): number {
    if (this.latencySamples.length <= 1) return 0;
    const variance = this.latencySamples.reduce(
      (sum, value) => sum + (value - avgLatencyMs) ** 2,
      0,
    ) / this.latencySamples.length;
    return Math.sqrt(variance);
  }
}

export const predictive = new PredictiveEngine();
