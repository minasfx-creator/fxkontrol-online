/**
 * WebGPU support detection.
 * Two checks are required: `navigator.gpu` may exist but `requestAdapter()`
 * can still return null when no GPU is exposed (sandboxed previews, headless,
 * etc). Callers should always use `isWebGPUSupported` first and treat
 * adapter/device acquisition failures as a soft fallback signal.
 */

export function isWebGPUSupported(): boolean {
  return typeof navigator !== "undefined" && "gpu" in navigator && navigator.gpu != null;
}

export function assertWebGPUSupported(): void {
  if (!isWebGPUSupported()) {
    throw new Error("WebGPU is not supported in this environment.");
  }
}
