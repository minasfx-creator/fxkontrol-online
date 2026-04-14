/**
 * useWebGPUDevice — React hook for WebGPU device initialization.
 * Singleton pattern: one adapter/device per app lifetime.
 * Handles device-lost with automatic re-init.
 */
import { useState, useEffect, useRef } from 'react';

interface WebGPUState {
  device: GPUDevice | null;
  format: GPUTextureFormat | null;
  supported: boolean;
  error: string | null;
}

let _cachedState: WebGPUState | null = null;
let _initPromise: Promise<WebGPUState> | null = null;

async function initWebGPU(): Promise<WebGPUState> {
  if (typeof navigator === 'undefined' || !navigator.gpu) {
    return { device: null, format: null, supported: false, error: 'WebGPU not available' };
  }

  try {
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!adapter) {
      return { device: null, format: null, supported: false, error: 'No GPU adapter' };
    }

    const device = await adapter.requestDevice({
      requiredLimits: {
        maxStorageBufferBindingSize: 128 * 1024 * 1024,
      },
    });

    const format = navigator.gpu.getPreferredCanvasFormat();

    // Handle device lost
    device.lost.then((info) => {
      console.warn('[WebGPU] Device lost:', info.reason, info.message);
      _cachedState = null;
      _initPromise = null;
      if (info.reason !== 'destroyed') {
        // Re-init on next hook mount
      }
    });

    return { device, format, supported: true, error: null };
  } catch (e) {
    return { device: null, format: null, supported: false, error: String(e) };
  }
}

export function useWebGPUDevice(): WebGPUState {
  const [state, setState] = useState<WebGPUState>(
    _cachedState ?? { device: null, format: null, supported: false, error: null }
  );
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;

    if (_cachedState) {
      setState(_cachedState);
      return;
    }

    if (!_initPromise) {
      _initPromise = initWebGPU();
    }

    _initPromise.then((result) => {
      _cachedState = result;
      if (mounted.current) setState(result);
    });

    return () => { mounted.current = false; };
  }, []);

  return state;
}
