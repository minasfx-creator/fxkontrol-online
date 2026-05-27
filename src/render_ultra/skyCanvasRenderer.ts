/**
 * SkyCanvas Renderer Factory — Three.js r171+
 *
 * Initialises a WebGPURenderer against the supplied canvas element with
 * graceful fallback to WebGL2 when WebGPU is unavailable.  The caller
 * receives a fully-initialised renderer regardless of the backend chosen.
 *
 * Usage:
 *   const { renderer, backend } = await initSkyCanvasRenderer(canvasEl);
 *   console.log(backend); // 'webgpu' | 'webgl2'
 *
 * Design notes:
 *  - `renderer.init()` MUST be awaited — it negotiates the GPU context.
 *  - ACESFilmic tone-mapping matches the Studio Mode colour pipeline.
 *  - `pixelRatio` is clamped to 2.0 to avoid fill-rate collapse on HiDPI.
 *  - Dispose via `renderer.dispose()` before unmounting the React tree.
 */

// three/webgpu ships the WebGPURenderer that auto-falls back to WebGL2.
// Import is a dynamic-compatible named export in Three.js ≥ r163.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — types are bundled inside three/webgpu; TS may not resolve the subpath yet.
import { WebGPURenderer, ACESFilmicToneMapping } from 'three/webgpu';

export type SkyCanvasBackend = 'webgpu' | 'webgl2' | 'unknown';

export interface SkyCanvasRendererResult {
  renderer: InstanceType<typeof WebGPURenderer>;
  backend: SkyCanvasBackend;
}

/**
 * Detects WebGPU availability without importing any Three internals.
 * Safe to call synchronously during React component mount.
 */
export function isWebGPUAvailable(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'gpu' in navigator &&
    navigator.gpu !== null
  );
}

/**
 * Initialise the Three.js renderer against `canvasElement`.
 *
 * @param canvasElement - The HTMLCanvasElement owned by the React Three Fiber canvas.
 * @param width  - Initial viewport width in CSS pixels (default: innerWidth).
 * @param height - Initial viewport height in CSS pixels (default: innerHeight).
 */
export async function initSkyCanvasRenderer(
  canvasElement: HTMLCanvasElement,
  width  = window.innerWidth,
  height = window.innerHeight,
): Promise<SkyCanvasRendererResult> {
  const gpuAvailable = isWebGPUAvailable();

  if (!gpuAvailable) {
    console.warn(
      '[SkyCanvas] WebGPU unavailable — WebGPURenderer will fall back to WebGL2 automatically.',
    );
  }

  // WebGPURenderer auto-detects the best backend; forceWebGL forces WebGL2.
  const renderer = new WebGPURenderer({
    canvas:     canvasElement,
    antialias:  true,
    alpha:      false,
    // When WebGPU is absent the renderer switches to WebGL2 internally.
    forceWebGL: !gpuAvailable,
  });

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // cap at 2× — fill-rate guard
  renderer.setSize(width, height);
  renderer.toneMapping      = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  // Asynchronous context negotiation — must complete before first render call.
  // Failure here means the GPU context was rejected (e.g. too many WebGPU
  // contexts open, driver crash) — we surface a descriptive error rather than
  // leaving the caller with a half-initialised renderer.
  try {
    await renderer.init();
  } catch (initErr) {
    renderer.dispose();
    throw new Error(
      `[SkyCanvas] Renderer.init() failed — GPU context rejected. ` +
      `Original: ${initErr instanceof Error ? initErr.message : String(initErr)}`,
    );
  }

  // Probe which backend was actually selected post-init.
  let backend: SkyCanvasBackend = 'unknown';
  try {
    // renderer.backend is available after init() resolves in Three.js ≥ r163.
    const backendName: string = (renderer as { backend?: { isWebGPUBackend?: boolean } })
      .backend?.isWebGPUBackend
      ? 'webgpu'
      : 'webgl2';
    backend = backendName as SkyCanvasBackend;
  } catch {
    backend = gpuAvailable ? 'webgpu' : 'webgl2';
  }

  console.info(`[SkyCanvas] Renderer initialised — backend: ${backend}`);

  return { renderer, backend };
}
