/**
 * ─── Double State Buffer ────────────────────────────────────────────
 * Simulation writes to `back`, render reads from `front`.
 * `swap()` atomically exchanges them each frame.
 * Prevents partial-state reads during rendering.
 */

export class StateBuffer<T extends Record<string, unknown>> {
  private _front: T;
  private _back: T;
  private _swapCount = 0;

  constructor(initialState: T) {
    // Deep clone for two independent copies
    this._front = structuredClone(initialState);
    this._back = structuredClone(initialState);
  }

  /** Get the read-only front buffer (for rendering). */
  get front(): Readonly<T> {
    return this._front;
  }

  /** Get the writable back buffer (for simulation). */
  get back(): T {
    return this._back;
  }

  /** Swap front and back. Call once per frame after simulation completes. */
  swap(): void {
    const tmp = this._front;
    this._front = this._back;
    this._back = tmp;
    this._swapCount++;
  }

  /** Copy front into back (useful after swap to carry state forward). */
  copyFrontToBack(): void {
    Object.assign(this._back, this._front);
  }

  /** Total swap count (for diagnostics). */
  getSwapCount(): number {
    return this._swapCount;
  }
}
