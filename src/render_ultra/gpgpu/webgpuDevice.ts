/**
 * WebGPU Device & Context Initialization
 * Handles adapter request, device creation, canvas configuration, and device-lost recovery.
 */

export interface WebGPUContext {
  device: GPUDevice;
  context: GPUCanvasContext;
  format: GPUTextureFormat;
  canvas: HTMLCanvasElement;
}

let _reinitCallback: (() => void) | null = null;

/**
 * Initialize WebGPU: request adapter, create device, configure canvas.
 * Returns null if WebGPU is unavailable.
 */
export async function initWebGPU(
  canvas: HTMLCanvasElement,
  onReinit?: () => void,
): Promise<WebGPUContext | null> {
  if (typeof navigator === 'undefined' || !navigator.gpu) {
    console.warn('[WebGPU] navigator.gpu unavailable');
    return null;
  }

  const adapter = await navigator.gpu.requestAdapter({
    powerPreference: 'high-performance',
  });
  if (!adapter) {
    console.warn('[WebGPU] No adapter found');
    return null;
  }

  let device: GPUDevice;
  try {
    device = await adapter.requestDevice({
      requiredLimits: {
        maxStorageBuffersPerShaderStage: 4,
        maxComputeWorkgroupSizeX: 256,
        maxBufferSize: 256 * 1024 * 1024, // 256 MB
      },
    });
  } catch {
    console.warn('[WebGPU] Device request rejected — limits unsupported');
    return null;
  }

  const context = canvas.getContext('webgpu');
  if (!context) {
    console.warn('[WebGPU] Could not get webgpu context');
    device.destroy();
    return null;
  }

  const format = navigator.gpu.getPreferredCanvasFormat();

  context.configure({
    device,
    format,
    alphaMode: 'premultiplied',
  });

  // Device-lost recovery
  _reinitCallback = onReinit ?? null;
  device.lost.then((info) => {
    console.warn('[WebGPU] Device lost:', info.reason);
    if (info.reason !== 'destroyed' && _reinitCallback) {
      _reinitCallback();
    }
  });

  console.info('[WebGPU] ✓ Device initialized —', format);
  return { device, context, format, canvas };
}

/** Check if WebGPU is likely available (sync pre-check). */
export function isWebGPUSupported(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.gpu;
}
