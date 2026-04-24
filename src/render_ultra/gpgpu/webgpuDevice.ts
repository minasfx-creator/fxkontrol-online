/**
 * WebGPU Device & Context Initialization
 *
 * Returns a discriminated diagnostic instead of swallowing failures with
 * `console.warn` + `null`. Callers can branch on `diagnostic.code` to render
 * a precise reason in the UI ("no adapter", "device request rejected because
 * of unsupported limits", "canvas already bound to another context", etc.)
 * and decide whether to fall back to WebGL2.
 */

export interface WebGPUContext {
  device: GPUDevice;
  context: GPUCanvasContext;
  format: GPUTextureFormat;
  canvas: HTMLCanvasElement;
}

/**
 * Stable failure codes for the fallback path.
 * Treat these as part of the public API — UI/telemetry switches on them.
 */
export type WebGPUInitFailureCode =
  | 'NO_NAVIGATOR_GPU'        // navigator.gpu missing (Safari <18, old Firefox, SSR)
  | 'ADAPTER_UNAVAILABLE'      // requestAdapter() resolved null (no GPU exposed, blocklist, sandbox)
  | 'DEVICE_REQUEST_FAILED'    // requestDevice() threw (limits unsupported, OOM risk, driver fault)
  | 'CANVAS_CONTEXT_FAILED'    // getContext('webgpu') returned null (canvas already bound, etc.)
  | 'DEVICE_LOST'              // device.lost resolved during init
  | 'UNKNOWN';                 // anything else thrown synchronously

export interface WebGPUInitDiagnostic {
  code: WebGPUInitFailureCode;
  /** Human-readable, safe to display in dev overlays. */
  message: string;
  /** Original error (if any) — useful for telemetry, not for UI. */
  cause?: unknown;
  /** Adapter info when we got far enough to query it. */
  adapterInfo?: {
    vendor?: string;
    architecture?: string;
    device?: string;
    description?: string;
  };
  /** Hints for the caller — e.g. recommend WebGL2, recommend retry. */
  recommendation: 'fallback' | 'retry' | 'abort';
}

export type WebGPUInitResult =
  | { ok: true; context: WebGPUContext }
  | { ok: false; diagnostic: WebGPUInitDiagnostic };

const REQUIRED_LIMITS: Record<string, number> = {
  maxStorageBuffersPerShaderStage: 4,
  maxComputeWorkgroupSizeX: 256,
  maxBufferSize: 256 * 1024 * 1024, // 256 MB
};

let _reinitCallback: (() => void) | null = null;

function fail(diagnostic: WebGPUInitDiagnostic): WebGPUInitResult {
  // Single, structured log line so devs see *why*, but UI gets the diagnostic too.
  console.warn(`[WebGPU] init failed (${diagnostic.code}): ${diagnostic.message}`);
  return { ok: false, diagnostic };
}

async function readAdapterInfo(adapter: GPUAdapter): Promise<WebGPUInitDiagnostic['adapterInfo']> {
  try {
    // `requestAdapterInfo` is being phased out in favor of `adapter.info`.
    const info = (adapter as unknown as { info?: GPUAdapterInfo }).info;
    if (info) {
      return {
        vendor: info.vendor,
        architecture: info.architecture,
        device: info.device,
        description: info.description,
      };
    }
  } catch {
    // ignore — adapter info is best-effort
  }
  return undefined;
}

/**
 * Initialize WebGPU: request adapter, create device, configure canvas.
 * Returns a discriminated result — never throws for expected fallback paths.
 */
export async function initWebGPU(
  canvas: HTMLCanvasElement,
  onReinit?: () => void,
): Promise<WebGPUInitResult> {
  if (typeof navigator === 'undefined' || !navigator.gpu) {
    return fail({
      code: 'NO_NAVIGATOR_GPU',
      message: 'navigator.gpu is unavailable — this browser/context does not expose WebGPU.',
      recommendation: 'fallback',
    });
  }

  let adapter: GPUAdapter | null;
  try {
    adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
  } catch (cause) {
    return fail({
      code: 'ADAPTER_UNAVAILABLE',
      message: 'requestAdapter() threw — likely a blocklisted GPU or sandbox restriction.',
      cause,
      recommendation: 'fallback',
    });
  }

  if (!adapter) {
    return fail({
      code: 'ADAPTER_UNAVAILABLE',
      message: 'No WebGPU adapter exposed (sandboxed preview, headless browser, or no GPU).',
      recommendation: 'fallback',
    });
  }

  const adapterInfo = await readAdapterInfo(adapter);

  // Pre-flight required limits so we can report *which* limit is the blocker
  // instead of the generic "device request rejected".
  const unsupported: string[] = [];
  for (const [k, v] of Object.entries(REQUIRED_LIMITS)) {
    const supported = (adapter.limits as unknown as Record<string, number | undefined>)[k];
    if (typeof supported === 'number' && supported < v) {
      unsupported.push(`${k} (need ${v}, adapter offers ${supported})`);
    }
  }
  if (unsupported.length > 0) {
    return fail({
      code: 'DEVICE_REQUEST_FAILED',
      message: `Adapter limits insufficient: ${unsupported.join('; ')}. OOM risk if requested anyway.`,
      adapterInfo,
      recommendation: 'fallback',
    });
  }

  let device: GPUDevice;
  try {
    device = await adapter.requestDevice({ requiredLimits: REQUIRED_LIMITS });
  } catch (cause) {
    return fail({
      code: 'DEVICE_REQUEST_FAILED',
      message: 'adapter.requestDevice() rejected — driver fault or transient resource pressure.',
      cause,
      adapterInfo,
      recommendation: 'retry',
    });
  }

  const context = canvas.getContext('webgpu');
  if (!context) {
    device.destroy();
    return fail({
      code: 'CANVAS_CONTEXT_FAILED',
      message: 'canvas.getContext("webgpu") returned null — canvas may already be bound to another context.',
      adapterInfo,
      recommendation: 'abort',
    });
  }

  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format, alphaMode: 'premultiplied' });

  _reinitCallback = onReinit ?? null;
  device.lost.then((info) => {
    console.warn('[WebGPU] device lost:', info.reason, info.message);
    if (info.reason !== 'destroyed' && _reinitCallback) {
      _reinitCallback();
    }
  });

  console.info('[WebGPU] ✓ device initialized —', format, adapterInfo?.vendor ?? '(vendor unknown)');
  return { ok: true, context: { device, context, format, canvas } };
}

/** Sync pre-check — does NOT guarantee an adapter is actually available. */
export function isWebGPUSupported(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.gpu;
}
