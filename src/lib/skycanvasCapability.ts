/**
 * skycanvasCapability — pure detection of the renderer the host can sustain.
 *
 * Pipeline: WebGPU? · WebGL2? · SwiftShader/llvmpipe? · pointer/coarse · h≤500
 *           · prefers-reduced-motion · navigator.connection (saveData)
 *
 * Output: RenderProfile (low/mid/high) + Renderer (webgl2 / fallback2d).
 *
 * NUNCA toca CommandBus/FieldBus/SafetyStateMachine/workMode.
 */

export type Renderer = 'webgl2' | 'fallback2d';
export type RenderTier = 'low' | 'mid' | 'high';

export interface SkyCapability {
  renderer: Renderer;
  tier: RenderTier;
  webgpu: boolean;
  webgl2: boolean;
  software: boolean;       // SwiftShader/llvmpipe/Software
  coarsePointer: boolean;
  landscapePhone: boolean; // h≤500 + coarse
  portraitPhone: boolean;  // w<768
  reducedMotion: boolean;
  saveData: boolean;
  reasons: string[];
}

function detectWebGL2(): { ok: boolean; software: boolean; renderer: string } {
  if (typeof document === 'undefined') return { ok: false, software: false, renderer: '' };
  let canvas: HTMLCanvasElement | null = null;
  try {
    canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: false });
    if (!gl) return { ok: false, software: false, renderer: '' };
    let renderer = '';
    try {
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      if (ext) renderer = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) ?? '');
    } catch { /* ignore */ }
    const software = /SwiftShader|llvmpipe|Software|Microsoft Basic Render/i.test(renderer);
    return { ok: true, software, renderer };
  } catch {
    return { ok: false, software: false, renderer: '' };
  } finally {
    // Help GC; canvas was never attached to DOM.
    canvas = null;
  }
}

function safeMatch(q: string): boolean {
  if (typeof window === 'undefined') return false;
  try { return window.matchMedia(q).matches; } catch { return false; }
}

export function detectSkyCapability(): SkyCapability {
  const reasons: string[] = [];
  const webgpu = typeof navigator !== 'undefined'
    && typeof (navigator as Navigator & { gpu?: unknown }).gpu !== 'undefined';

  const gl = detectWebGL2();
  const coarsePointer = safeMatch('(pointer: coarse)');
  const reducedMotion = safeMatch('(prefers-reduced-motion: reduce)');
  const w = typeof window !== 'undefined' ? window.innerWidth : 1366;
  const h = typeof window !== 'undefined' ? window.innerHeight : 768;
  const landscapePhone = coarsePointer && h <= 500;
  const portraitPhone = w < 768;

  const conn = (typeof navigator !== 'undefined'
    ? (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
    : undefined);
  const saveData = !!conn?.saveData;

  // Renderer decision.
  let renderer: Renderer = 'webgl2';
  if (!gl.ok) { renderer = 'fallback2d'; reasons.push('no-webgl2'); }
  else if (gl.software) { renderer = 'fallback2d'; reasons.push(`software-renderer:${gl.renderer || 'unknown'}`); }

  // Tier decision (only meaningful when renderer === 'webgl2').
  let tier: RenderTier = 'high';
  if (renderer === 'fallback2d') tier = 'low';
  else if (landscapePhone || portraitPhone) { tier = 'mid'; reasons.push('mobile-form-factor'); }
  else if (reducedMotion) { tier = 'mid'; reasons.push('reduced-motion'); }
  else if (saveData) { tier = 'mid'; reasons.push('save-data'); }
  else if (!webgpu && coarsePointer) { tier = 'mid'; reasons.push('coarse-pointer'); }

  return {
    renderer, tier, webgpu, webgl2: gl.ok, software: gl.software,
    coarsePointer, landscapePhone, portraitPhone, reducedMotion, saveData,
    reasons,
  };
}

export interface ProfileBudget {
  /** DPR clamp [min, max]. */
  dpr: [number, number];
  antialias: boolean;
  /** Pyro burst pool cap. */
  burstPoolCap: number;
  /** Show heavy stage truss. */
  showStage: boolean;
  /** Show DMX fixtures layer. */
  showFixtures: boolean;
  /** Show stars (NightSky). */
  showStars: boolean;
}

export function profileBudget(cap: SkyCapability): ProfileBudget {
  switch (cap.tier) {
    case 'high':
      return { dpr: [1, 1.75], antialias: true, burstPoolCap: 256, showStage: true, showFixtures: true, showStars: true };
    case 'mid':
      return { dpr: [1, 1.25], antialias: false, burstPoolCap: 96, showStage: false, showFixtures: false, showStars: true };
    case 'low':
    default:
      return { dpr: [0.75, 1], antialias: false, burstPoolCap: 0, showStage: false, showFixtures: false, showStars: false };
  }
}
