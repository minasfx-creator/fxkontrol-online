/**
 * EngineDiagnostics — single source of truth for engine health.
 *
 * Subscriber-based so React panels can render without polling. Data is
 * fed by the Show3DEngine render loop and by webgl context handlers.
 */

export interface EngineDiagnostics {
  webglAvailable: boolean;
  contextLost: boolean;
  fps: number;
  drawCalls: number;
  triangles: number;
  sceneObjects: number;
  lastError?: string;
}

export type DiagnosticsListener = (d: EngineDiagnostics) => void;

const INITIAL: EngineDiagnostics = {
  webglAvailable: false,
  contextLost: false,
  fps: 0,
  drawCalls: 0,
  triangles: 0,
  sceneObjects: 0,
};

export class EngineDiagnosticsBus {
  private _state: EngineDiagnostics = { ...INITIAL };
  private _subs = new Set<DiagnosticsListener>();

  get(): EngineDiagnostics { return { ...this._state }; }

  update(patch: Partial<EngineDiagnostics>): void {
    this._state = { ...this._state, ...patch };
    for (const fn of this._subs) {
      try { fn(this._state); } catch { /* swallow */ }
    }
  }

  reportError(message: string): void {
    this.update({ lastError: message });
  }

  reset(): void {
    this._state = { ...INITIAL };
    for (const fn of this._subs) {
      try { fn(this._state); } catch { /* swallow */ }
    }
  }

  subscribe(fn: DiagnosticsListener): () => void {
    this._subs.add(fn);
    return () => { this._subs.delete(fn); };
  }
}

/** Module-level singleton — the engine writes, panels read. */
export const engineDiagnostics = new EngineDiagnosticsBus();
