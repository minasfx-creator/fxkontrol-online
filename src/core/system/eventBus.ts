/**
 * ─── Event Bus — System Backbone ────────────────────────────────────
 * Typed, decoupled pub/sub for ALL engine events.
 * Every subsystem emits here; HUD/UI/logging listens.
 *
 * Conventions:
 *   SYSTEM.*   — engine lifecycle
 *   CLUSTER.*  — sync events
 *   ENV.*      — environment changes
 *   TIMELINE.* — playback events
 *   PYRO.*     — firework events
 *   DRONE.*    — drone events
 *   PERF.*     — performance events
 *   ERROR.*    — failures
 */

export type EventPayload = Record<string, unknown>;

type Listener = (payload: EventPayload) => void;

class EventBus {
  private listeners = new Map<string, Set<Listener>>();
  private history: { event: string; payload: EventPayload; ts: number }[] = [];
  private maxHistory = 200;

  /** Subscribe to an event. Returns unsubscribe function. */
  on(event: string, cb: Listener): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(cb);
    return () => this.listeners.get(event)?.delete(cb);
  }

  /** Subscribe to any event matching a prefix (e.g. "CLUSTER.*") */
  onPrefix(prefix: string, cb: (event: string, payload: EventPayload) => void): () => void {
    const wrapper: Listener = (p) => cb(p.__event as string, p);
    // Store on a synthetic key
    const key = `__prefix:${prefix}`;
    if (!this.listeners.has(key)) this.listeners.set(key, new Set());
    this.listeners.get(key)!.add(wrapper);
    return () => this.listeners.get(key)?.delete(wrapper);
  }

  /** Emit an event to all listeners */
  emit(event: string, payload: EventPayload = {}): void {
    // Record history
    this.history.push({ event, payload, ts: Date.now() });
    if (this.history.length > this.maxHistory) this.history.shift();

    // Direct listeners
    const direct = this.listeners.get(event);
    if (direct) {
      for (const cb of direct) {
        try { cb(payload); } catch (e) { console.warn('[EventBus] listener error:', e); }
      }
    }

    // Prefix listeners
    for (const [key, set] of this.listeners) {
      if (!key.startsWith('__prefix:')) continue;
      const prefix = key.slice(9); // remove "__prefix:"
      if (event.startsWith(prefix.replace('*', ''))) {
        for (const cb of set) {
          try { cb({ ...payload, __event: event }); } catch { /* no-op */ }
        }
      }
    }
  }

  /** Get recent event history (for debugging / HUD) */
  getHistory(limit = 50) {
    return this.history.slice(-limit);
  }

  /** Clear all listeners */
  clear(): void {
    this.listeners.clear();
    this.history.length = 0;
  }
}

export const eventBus = new EventBus();
