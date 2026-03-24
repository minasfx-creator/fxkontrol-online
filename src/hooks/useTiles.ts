/**
 * ─── useTiles Hook ──────────────────────────────────────────────────
 * React hook for managing 3D Tiles loading state and configuration.
 * Provides adaptive SSE control based on FPS headroom.
 */

import { useCallback, useRef, useState } from 'react';
import { useSceneStore } from '@/store/useSceneStore';
import { getSmoothFPS } from '@/lib/smoothFramePacer';

export interface TilesState {
  loaded: number;
  pending: number;
  sse: number;
  adaptiveSSE: boolean;
}

export function useTiles() {
  const [state, setState] = useState<TilesState>({
    loaded: 0,
    pending: 0,
    sse: 16,
    adaptiveSSE: true,
  });

  const sseRef = useRef(16);

  /**
   * Update tile count from the tiles renderer.
   */
  const updateTileCount = useCallback((loaded: number, pending: number) => {
    setState(s => ({ ...s, loaded, pending }));
  }, []);

  /**
   * Evaluate and update adaptive SSE based on current FPS.
   * Call at ~2Hz from the render loop.
   * 
   * Rules:
   *   FPS > 50 → SSE = 16 (high quality)
   *   FPS > 40 → SSE = 24 (balanced)
   *   FPS > 30 → SSE = 32 (reduced)
   *   FPS ≤ 30 → SSE = 48 (minimum detail to save the show)
   */
  const evaluateAdaptiveSSE = useCallback((): number => {
    if (!state.adaptiveSSE) return sseRef.current;

    const fps = getSmoothFPS();
    let targetSSE: number;

    if (fps > 50) targetSSE = 16;
    else if (fps > 40) targetSSE = 24;
    else if (fps > 30) targetSSE = 32;
    else targetSSE = 48;

    // Smooth transition (avoid flicker)
    sseRef.current += (targetSSE - sseRef.current) * 0.1;
    const rounded = Math.round(sseRef.current);

    setState(s => ({ ...s, sse: rounded }));
    return rounded;
  }, [state.adaptiveSSE]);

  const setAdaptiveSSE = useCallback((enabled: boolean) => {
    setState(s => ({ ...s, adaptiveSSE: enabled }));
  }, []);

  const setSSE = useCallback((sse: number) => {
    sseRef.current = sse;
    setState(s => ({ ...s, sse }));
  }, []);

  return {
    ...state,
    updateTileCount,
    evaluateAdaptiveSSE,
    setAdaptiveSSE,
    setSSE,
  };
}
