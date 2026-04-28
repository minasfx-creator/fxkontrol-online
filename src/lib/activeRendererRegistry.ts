/**
 * ─── Active Renderer Registry ────────────────────────────────────────
 * Module-level handle to the currently mounted `THREE.WebGLRenderer`.
 * Set by `<Canvas onCreated>` in SkyCanvas; read by dev diagnostics panels
 * that live outside the R3F tree (so they can't use `useThree`).
 *
 * Holding a reference here is safe: when the Canvas remounts after context
 * loss, `setActiveRenderer(newGl)` overwrites the previous handle, and the
 * old renderer is disposed by R3F's cleanup. We deliberately do NOT call
 * `.dispose()` from this module to avoid double-frees.
 */
import type * as THREE from 'three';

let _renderer: THREE.WebGLRenderer | null = null;
const _subs = new Set<() => void>();

function _notify() {
  for (const fn of _subs) {
    try { fn(); } catch { /* ignore */ }
  }
}

export function setActiveRenderer(gl: THREE.WebGLRenderer | null): void {
  if (_renderer === gl) return;
  _renderer = gl;
  _notify();
}

export function getActiveRenderer(): THREE.WebGLRenderer | null {
  return _renderer;
}

export function subscribeActiveRenderer(fn: () => void): () => void {
  _subs.add(fn);
  return () => { _subs.delete(fn); };
}
