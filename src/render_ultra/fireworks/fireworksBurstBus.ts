/**
 * Fireworks Burst Bus — fire-and-forget visual-only event channel for the
 * `InstancedFireworks` renderer. Decoupled from Show3DEngine / CommandBus /
 * SafetyStateMachine on purpose: this is presentation, never physical fire.
 *
 * Timeline / cue layer calls `fireworksBurstBus.fire({...})`. The renderer
 * subscribes once on mount and dispatches the burst into its instanced pool.
 */

export interface BurstRequest {
  /** World position. Y is up. */
  position: [number, number, number];
  /** sRGB color for the burst core (defaults to warm white). */
  color?: [number, number, number];
  /** 0..2 — scales particle speed + count. */
  intensity?: number;
  /** Optional cue id for trace/debug only. Never used for safety. */
  cueId?: string;
  /** Optional kind hint for the renderer (mine / shell / comet). */
  kind?: 'shell' | 'mine' | 'comet' | 'strobe';
}

type Listener = (req: BurstRequest) => void;

class FireworksBurstBus {
  private listeners = new Set<Listener>();

  fire(req: BurstRequest): void {
    // Snapshot to avoid mutation while iterating
    const snap = Array.from(this.listeners);
    for (const l of snap) {
      try { l(req); } catch { /* visual-only — never throw upstream */ }
    }
  }

  on(l: Listener): () => void {
    this.listeners.add(l);
    return () => { this.listeners.delete(l); };
  }

  /** Test-only */
  _listenerCount(): number { return this.listeners.size; }
  /** Test-only */
  _clear(): void { this.listeners.clear(); }
}

export const fireworksBurstBus = new FireworksBurstBus();
