/**
 * GPU tier detection — one-shot probe that classifies the device into
 * `'high'` or `'low'` so the design system can downgrade expensive
 * `backdrop-filter` blurs on weak hardware.
 *
 * Why a tier (not a continuous score)?
 *   - `backdrop-filter` cost is dominated by the blur radius and the
 *     composited area. The expensive layers (Dock, Sidebar, Header,
 *     popovers) all use 32-60px radii — they're either cheap on a
 *     discrete GPU or catastrophic on integrated/mobile. There's no
 *     middle ground worth modelling.
 *   - A binary tier maps cleanly to a CSS data-attribute, which lets us
 *     rewrite the offending declarations with a single selector tree
 *     instead of dynamic style mutation per component.
 *
 * Signals (cheap, all sync, no async APIs):
 *   - `navigator.hardwareConcurrency` — coarse CPU proxy. <=4 → likely
 *     low-end mobile or integrated laptop.
 *   - `(navigator as any).deviceMemory` — RAM in GB (Chromium only).
 *     <=4 → low.
 *   - WebGL `UNMASKED_RENDERER_WEBGL` — GPU model string. Substrings
 *     like 'Mali', 'Adreno', 'PowerVR', 'Apple GPU' (older), 'Intel HD'
 *     are flagged. Discrete GPUs (NVIDIA/AMD/Apple M-series) pass.
 *   - `prefers-reduced-motion` — explicit user signal; treat as low so
 *     they get the cheaper, calmer surface.
 *
 * Result is written to `<html data-gpu-tier="low|high">` so plain CSS
 * selectors can react. Re-runs are no-ops; the value is sticky for the
 * session (GPU doesn't change at runtime).
 */

export type GpuTier = 'high' | 'low';
export type GlassQualityPref = 'auto' | 'high' | 'low';

const STORAGE_KEY = 'fxk:glass-quality';
let cachedTier: GpuTier | null = null;
const listeners = new Set<(tier: GpuTier, pref: GlassQualityPref) => void>();

export function getGlassQualityPref(): GlassQualityPref {
  if (typeof localStorage === 'undefined') return 'auto';
  const v = localStorage.getItem(STORAGE_KEY);
  return v === 'high' || v === 'low' ? v : 'auto';
}

export function setGlassQualityPref(pref: GlassQualityPref): GpuTier {
  if (typeof localStorage !== 'undefined') {
    if (pref === 'auto') localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, pref);
  }
  const tier = applyGpuTier();
  listeners.forEach((l) => l(tier, pref));
  return tier;
}

export function subscribeGlassQuality(cb: (tier: GpuTier, pref: GlassQualityPref) => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

const LOW_GPU_PATTERNS = [
  /mali/i,
  /adreno [3-5]\d{2}/i,    // Adreno 3xx-5xx are weak; 6xx+ are fine
  /powervr/i,
  /intel.*\b(hd|uhd) graphics\b/i,
  /apple gpu/i,             // Older A-series iGPUs (Safari masks newer ones as "Apple GPU" too — see fallback)
  /microsoft basic render/i,
  /swiftshader/i,           // Software renderer
  /llvmpipe/i,
];

function probeGpuRenderer(): string | null {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl || !('getExtension' in gl)) return null;
    const dbg = (gl as WebGLRenderingContext).getExtension('WEBGL_debug_renderer_info');
    if (!dbg) return null;
    return (gl as WebGLRenderingContext).getParameter(
      (dbg as { UNMASKED_RENDERER_WEBGL: number }).UNMASKED_RENDERER_WEBGL,
    ) as string;
  } catch {
    return null;
  }
}

function computeTier(): GpuTier {
  // Explicit user preference → low (calmer surface, cheaper to render).
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    return 'low';
  }

  const cores = navigator.hardwareConcurrency ?? 8;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;

  // Hard floors — no GPU on the planet rescues a 2-core/2GB machine from 60px blurs.
  if (cores <= 2 || mem <= 2) return 'low';

  const renderer = probeGpuRenderer();
  if (renderer && LOW_GPU_PATTERNS.some((p) => p.test(renderer))) return 'low';

  // Soft floor: 4 cores AND 4GB RAM AND no GPU info → assume integrated, low tier.
  if (cores <= 4 && mem <= 4 && !renderer) return 'low';

  return 'high';
}

export function getGpuTier(): GpuTier {
  if (cachedTier) return cachedTier;
  cachedTier = computeTier();
  return cachedTier;
}

/**
 * Detect once and write `<html data-gpu-tier="...">`. Idempotent.
 * User preference (localStorage) overrides the auto-detected tier.
 * Call from app entry (e.g. main.tsx) before first paint.
 */
export function applyGpuTier(): GpuTier {
  if (typeof document === 'undefined') return 'high';
  const pref = getGlassQualityPref();
  const tier: GpuTier = pref === 'auto' ? getGpuTier() : pref;
  document.documentElement.dataset.gpuTier = tier;
  document.documentElement.dataset.glassPref = pref;
  return tier;
}
