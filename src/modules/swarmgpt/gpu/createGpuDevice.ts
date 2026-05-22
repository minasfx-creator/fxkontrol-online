/**
 * GPU device acquisition.
 *
 * Sandbox note: The Lovable preview browser does NOT have a GPU adapter,
 * so this will fail there — callers MUST handle the rejection and fall back
 * to the CPU sampler. Tested in real browsers (Chrome/Edge/Safari TP) over HTTPS.
 */
import { assertWebGPUSupported } from "./webgpuSupport";

export type CreateGpuDeviceOptions = {
  powerPreference?: GPUPowerPreference;
  /** Optional callback invoked when the device is lost (driver crash, suspend). */
  onDeviceLost?: (info: GPUDeviceLostInfo) => void;
};

export async function createGpuDevice(
  options: CreateGpuDeviceOptions = {},
): Promise<GPUDevice> {
  assertWebGPUSupported();

  const adapter = await navigator.gpu.requestAdapter({
    powerPreference: options.powerPreference ?? "high-performance",
  });

  if (!adapter) {
    throw new Error("WebGPU adapter unavailable.");
  }

  const device = await adapter.requestDevice();

  // Best-effort: attach lost handler so callers can react. Don't await.
  device.lost
    .then((info) => {
      if (info.reason === "destroyed") return;
      options.onDeviceLost?.(info);
    })
    .catch(() => {
      // ignore — `lost` only rejects if the promise itself is rejected
    });

  return device;
}
