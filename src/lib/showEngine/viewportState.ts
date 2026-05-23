/**
 * Viewport state machine for the Show3DEngine host.
 *
 * The canvas must NEVER be rendered alone. Whenever state ≠ 'ready' and ≠
 * 'rendering', an overlay must be visible. This is the contract that
 * eliminates the "black viewport" failure mode.
 */

export type ViewportState =
  | 'booting'      // engine is initialising
  | 'ready'        // engine initialised, scene present, idle
  | 'empty'        // engine initialised, no plan loaded
  | 'rendering'    // playing back a show
  | 'error'        // unrecoverable scene/render error
  | 'contextLost'; // WebGL context lost — recoverable

const ALLOWED: Record<ViewportState, ReadonlyArray<ViewportState>> = {
  booting:     ['ready', 'empty', 'error', 'contextLost'],
  empty:       ['booting', 'ready', 'rendering', 'error', 'contextLost'],
  ready:       ['empty', 'rendering', 'error', 'contextLost', 'booting'],
  rendering:   ['ready', 'empty', 'error', 'contextLost'],
  error:       ['booting', 'ready', 'empty', 'contextLost'],
  contextLost: ['booting', 'ready', 'empty', 'error'],
};

export function canTransition(from: ViewportState, to: ViewportState): boolean {
  if (from === to) return true;
  return ALLOWED[from].includes(to);
}

export function requiresOverlay(state: ViewportState): boolean {
  return state !== 'ready' && state !== 'rendering';
}

export type ViewportStateListener = (state: ViewportState) => void;

export class ViewportStateMachine {
  private _state: ViewportState = 'booting';
  private _subs = new Set<ViewportStateListener>();

  get(): ViewportState { return this._state; }

  set(next: ViewportState): boolean {
    if (!canTransition(this._state, next)) return false;
    if (this._state === next) return true;
    this._state = next;
    for (const fn of this._subs) {
      try { fn(next); } catch { /* swallow */ }
    }
    return true;
  }

  subscribe(fn: ViewportStateListener): () => void {
    this._subs.add(fn);
    return () => { this._subs.delete(fn); };
  }
}
