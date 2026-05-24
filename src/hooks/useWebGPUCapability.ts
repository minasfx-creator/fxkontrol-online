/**
 * useWebGPUCapability — React hook that probes WebGPU availability on mount
 * and exposes it as stable state for feature-gating and diagnostics.
 *
 * Usage:
 *   const { available, reported } = useWebGPUCapability();
 *   if (available) { // show WebGPU-exclusive features }
 *
 * Design:
 *  - `isWebGPUAvailable()` is synchronous (no GPU context created).
 *  - `reported` flips to true after the first render so callers can defer
 *    any conditional rendering until the check has run (avoids flash).
 *  - For standalone (non-R3F) canvases use `initSkyCanvasRenderer` from
 *    `@/render_ultra/skyCanvasRenderer` — it handles async context init.
 *  - For R3F canvases, wire the `gl={{ powerPreference:'high-performance' }}`
 *    prop and let R3F/Three.js negotiate the backend internally.
 */
import { useState, useEffect } from 'react';
import { isWebGPUAvailable } from '@/render_ultra/skyCanvasRenderer';

export interface WebGPUCapability {
  /** true when navigator.gpu is present and non-null. */
  available: boolean;
  /** false until the check has executed (safe initial render guard). */
  reported: boolean;
}

let _cachedResult: boolean | null = null;

export function useWebGPUCapability(): WebGPUCapability {
  const [state, setState] = useState<WebGPUCapability>({
    available: false,
    reported:  false,
  });

  useEffect(() => {
    // Cache the result — navigator.gpu doesn't change at runtime.
    if (_cachedResult === null) {
      _cachedResult = isWebGPUAvailable();
    }
    setState({ available: _cachedResult, reported: true });
  }, []);

  return state;
}
