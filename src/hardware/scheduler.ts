export type HardwareEventType = 'dmx' | 'pyro' | 'laser' | 'smpte' | (string & {});

export interface ScheduledHardwareEvent<TPayload = unknown> {
  id?: string;
  t: number;
  type: HardwareEventType;
  payload?: TPayload;
  latencyMs?: number;
}

export interface SchedulerDispatchTarget<TEvent extends ScheduledHardwareEvent = ScheduledHardwareEvent> {
  dispatch: (event: TEvent, now: number) => void;
  flush?: (now: number) => void;
}

export interface HardwareSchedulerOptions<TType extends string = HardwareEventType> {
  latencyByType?: Partial<Record<TType, number>>;
}

export interface HardwareSchedulerSnapshot<TEvent extends ScheduledHardwareEvent = ScheduledHardwareEvent> {
  now: number;
  pending: number;
  nextEventTime: number | null;
  nextDispatchTime: number | null;
  queue: ReadonlyArray<Readonly<TEvent>>;
}

interface InternalScheduledEvent<TEvent extends ScheduledHardwareEvent = ScheduledHardwareEvent> {
  event: TEvent;
  dispatchAt: number;
  sequence: number;
}

const MAX_SCHEDULED_EVENTS = 10_000;

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

export class HardwareScheduler<TEvent extends ScheduledHardwareEvent = ScheduledHardwareEvent> {
  private now = 0;
  private sequence = 0;
  private readonly queue: InternalScheduledEvent<TEvent>[] = [];

  constructor(
    private readonly target: SchedulerDispatchTarget<TEvent>,
    private readonly options: HardwareSchedulerOptions<TEvent['type']> = {},
  ) {}

  schedule(event: TEvent): number {
    if (!Number.isFinite(event.t) || event.t < 0) {
      throw new Error('Scheduled event time must be a finite number >= 0');
    }

    if (this.queue.length >= MAX_SCHEDULED_EVENTS) {
      throw new Error('HardwareScheduler queue overflow');
    }

    const dispatchAt = Math.max(0, event.t - this.resolveLatencySec(event));
    const queued: InternalScheduledEvent<TEvent> = {
      event,
      dispatchAt,
      sequence: this.sequence++,
    };

    const index = this.findInsertIndex(queued);
    this.queue.splice(index, 0, queued);
    return dispatchAt;
  }

  tick(dt: number): number {
    if (!Number.isFinite(dt) || dt <= 0) return 0;

    this.now += dt;
    let dispatched = 0;

    while (this.queue[0] && this.queue[0].dispatchAt <= this.now) {
      const next = this.queue.shift();
      if (!next) break;
      this.target.dispatch(next.event, this.now);
      dispatched++;
    }

    if (dispatched > 0) {
      this.target.flush?.(this.now);
    }

    return dispatched;
  }

  seek(time: number): void {
    if (!Number.isFinite(time) || time < 0) return;
    this.now = time;

    let writeIndex = 0;
    for (let readIndex = 0; readIndex < this.queue.length; readIndex++) {
      const queued = this.queue[readIndex];
      if (queued.dispatchAt >= time) {
        this.queue[writeIndex++] = queued;
      }
    }

    this.queue.length = writeIndex;
  }

  reset(time = 0): void {
    this.now = Number.isFinite(time) && time >= 0 ? time : 0;
    this.queue.length = 0;
    this.sequence = 0;
  }

  clear(): void {
    this.queue.length = 0;
  }

  getTime(): number {
    return this.now;
  }

  getPendingCount(): number {
    return this.queue.length;
  }

  getDiagnostics(): HardwareSchedulerSnapshot<TEvent> {
    const snapshot: HardwareSchedulerSnapshot<TEvent> = {
      now: this.now,
      pending: this.queue.length,
      nextEventTime: this.queue[0]?.event.t ?? null,
      nextDispatchTime: this.queue[0]?.dispatchAt ?? null,
      queue: this.queue.map(({ event }) => structuredClone(event)),
    };

    return deepFreeze(snapshot) as HardwareSchedulerSnapshot<TEvent>;
  }

  private resolveLatencySec(event: TEvent): number {
    const configuredLatencyMs = event.latencyMs ?? this.options.latencyByType?.[event.type];
    if (!Number.isFinite(configuredLatencyMs) || configuredLatencyMs === undefined) {
      return 0;
    }

    return Math.max(0, configuredLatencyMs) / 1000;
  }

  private findInsertIndex(candidate: InternalScheduledEvent<TEvent>): number {
    let low = 0;
    let high = this.queue.length;

    while (low < high) {
      const mid = (low + high) >> 1;
      const current = this.queue[mid];
      if (
        current.dispatchAt < candidate.dispatchAt ||
        (current.dispatchAt === candidate.dispatchAt && current.sequence < candidate.sequence)
      ) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }

    return low;
  }
}