/**
 * useFXKEngine — React hook that manages the FXKGPUEngine lifecycle.
 *
 * Initializes WebGPU on mount, falls back to ParticleGPGPU (WebGL) automatically,
 * and cleans up all GPU resources on unmount.
 *
 * Usage:
 *   const canvasRef = useRef<HTMLCanvasElement>(null);
 *   const { state, engine, fallback } = useFXKEngine(canvasRef, {
 *     computeWGSL: COMPUTE_WGSL,
 *     sortWGSL: SORT_WGSL,
 *   });
 */

import { useRef, useEffect, useState, useCallback } from 'react';
import { FXKGPUEngine } from '@/render_ultra/gpgpu/fxk-gpu/engine';
import type { FXKEngineConfig, FXKEngineState, FXKCameraState, FXKLightSource } from '@/render_ultra/gpgpu/fxk-gpu/engine';
import { ParticleGPGPU } from '@/render_ultra/gpgpu/ParticleGPGPU';
import * as THREE from 'three';

export type RenderBackend = 'webgpu' | 'webgl' | 'none';

export interface UseFXKEngineOptions {
  computeWGSL: string;
  sortWGSL: string;
  maxParticles?: number;
  enableSort?: boolean;
  enableSmokeSim?: boolean;
  enableLightScatter?: boolean;
  /** Three.js renderer for WebGL fallback. If not provided, fallback creates its own. */
  threeRenderer?: THREE.WebGLRenderer;
  /** Texture size for WebGL fallback (default 256 = 65536 particles). */
  fallbackTextureSize?: number;
  /** Auto-start rAF loop. Default false — caller manages frame timing. */
  autoStart?: boolean;
}

export interface UseFXKEngineReturn {
  /** Current engine state. */
  state: FXKEngineState;
  /** Active render backend. */
  backend: RenderBackend;
  /** WebGPU engine instance (null if using fallback). */
  engine: FXKGPUEngine | null;
  /** WebGL fallback instance (null if using WebGPU). */
  fallback: ParticleGPGPU | null;
  /** Upload particle data to whichever backend is active. */
  uploadParticles: (packed: Float32Array, count: number) => void;
  /** Update camera (WebGPU path only). */
  updateCamera: (cam: FXKCameraState) => void;
  /** Update light scatter params (WebGPU path only). */
  updateLightScatter: (intensity: number, falloff: number, radius: number, time: number, lights: FXKLightSource[]) => void;
  /** Execute a single frame (WebGPU path). For WebGL, call fallback.compute(dt). */
  frame: (dt: number, time: number, wind: { x: number; y: number; z: number }) => void;
  /** Start the rAF loop (WebGPU path). */
  start: (windFn: () => { x: number; y: number; z: number }, cameraFn: () => FXKCameraState) => void;
  /** Stop the rAF loop. */
  stop: () => void;
}

export function useFXKEngine(
  canvasRef: React.RefObject<HTMLCanvasElement>,
  options: UseFXKEngineOptions,
): UseFXKEngineReturn {
  const engineRef = useRef<FXKGPUEngine | null>(null);
  const fallbackRef = useRef<ParticleGPGPU | null>(null);
  const [state, setState] = useState<FXKEngineState>('uninitialized');
  const [backend, setBackend] = useState<RenderBackend>('none');

  // Stable refs for options that shouldn't trigger re-init
  const optsRef = useRef(options);
  optsRef.current = options;

  useEffect(() => {
    let disposed = false;

    async function init() {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const opts = optsRef.current;

      // Attempt WebGPU
      const engine = new FXKGPUEngine({
        computeWGSL: opts.computeWGSL,
        sortWGSL: opts.sortWGSL,
        maxParticles: opts.maxParticles,
        enableSort: opts.enableSort,
        enableSmokeSim: opts.enableSmokeSim,
        enableLightScatter: opts.enableLightScatter,
      });

      const ok = await engine.init(canvas);

      if (disposed) {
        engine.dispose();
        return;
      }

      if (ok) {
        engineRef.current = engine;
        setState('ready');
        setBackend('webgpu');
        console.info('[useFXKEngine] WebGPU engine ready');
        return;
      }

      // WebGPU failed → fallback to WebGL ParticleGPGPU
      engine.dispose();
      console.info('[useFXKEngine] Falling back to WebGL (ParticleGPGPU)');

      try {
        const renderer = opts.threeRenderer ?? new THREE.WebGLRenderer({
          canvas,
          antialias: false,
          alpha: true,
          powerPreference: 'high-performance',
        });

        const textureSize = opts.fallbackTextureSize ?? 256;
        const gpgpu = new ParticleGPGPU(renderer, textureSize);

        if (disposed) {
          gpgpu.dispose();
          if (!opts.threeRenderer) renderer.dispose();
          return;
        }

        fallbackRef.current = gpgpu;
        setState('fallback' as FXKEngineState);
        setBackend('webgl');
      } catch (e) {
        console.warn('[useFXKEngine] WebGL fallback also failed', e);
        setState('fallback' as FXKEngineState);
        setBackend('none');
      }
    }

    init();

    return () => {
      disposed = true;
      if (engineRef.current) {
        engineRef.current.dispose();
        engineRef.current = null;
      }
      if (fallbackRef.current) {
        fallbackRef.current.dispose();
        fallbackRef.current = null;
      }
      setState('disposed');
      setBackend('none');
    };
    // Only re-init when canvas ref identity changes (intentionally stable deps)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasRef]);

  const uploadParticles = useCallback((packed: Float32Array, count: number) => {
    if (engineRef.current) {
      engineRef.current.uploadParticles(packed, count);
    }
    // WebGL path: caller should use fallback.seedParticles() directly
  }, []);

  const updateCamera = useCallback((cam: FXKCameraState) => {
    engineRef.current?.updateCamera(cam);
  }, []);

  const updateLightScatter = useCallback(
    (intensity: number, falloff: number, radius: number, time: number, lights: FXKLightSource[]) => {
      engineRef.current?.updateLightScatter(intensity, falloff, radius, time, lights);
    },
    [],
  );

  const frame = useCallback(
    (dt: number, time: number, wind: { x: number; y: number; z: number }) => {
      engineRef.current?.frame(dt, time, wind);
    },
    [],
  );

  const start = useCallback(
    (windFn: () => { x: number; y: number; z: number }, cameraFn: () => FXKCameraState) => {
      engineRef.current?.start(windFn, cameraFn);
    },
    [],
  );

  const stop = useCallback(() => {
    engineRef.current?.stop();
  }, []);

  return {
    state,
    backend,
    engine: engineRef.current,
    fallback: fallbackRef.current,
    uploadParticles,
    updateCamera,
    updateLightScatter,
    frame,
    start,
    stop,
  };
}
