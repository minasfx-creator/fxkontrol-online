import { AlertTriangle, RotateCw, RefreshCw } from 'lucide-react';

/**
 * SimplifiedSkyFallback — pure CSS sky scene shown when the WebGL pipeline
 * cannot run (no WebGL support, context loss in cooldown, or boundary crash).
 * Renders a stylized horizon with moon + stars and a clear status banner so
 * the editor remains usable for non-3D tasks.
 *
 * The "Retry" action attempts to reinitialize the renderer in-place (no page
 * reload, preserves all editor state). The "Reload Page" escape hatch is
 * available as a last resort if Retry repeatedly fails.
 */
export default function SimplifiedSkyFallback({
  reason = 'WebGL could not be initialized.',
  onRetry,
}: {
  reason?: string;
  onRetry?: () => void;
}) {
  return (
    <div
      className="absolute inset-0 overflow-hidden"
      data-sky-fallback
      style={{
        background:
          'radial-gradient(ellipse at 50% 110%, hsl(220 40% 18%) 0%, hsl(225 50% 8%) 35%, hsl(230 60% 4%) 70%, #050810 100%)',
      }}
    >
      {/* Stars layer (CSS-only, pseudo-random via box-shadow chain) */}
      <div className="absolute inset-0 opacity-70" aria-hidden style={{ background: 'transparent' }}>
        <div
          className="absolute"
          style={{
            top: 0,
            left: 0,
            width: 1,
            height: 1,
            background: 'transparent',
            boxShadow: STAR_FIELD,
          }}
        />
      </div>

      {/* Subtle moon */}
      <div
        className="absolute rounded-full"
        aria-hidden
        style={{
          top: '18%',
          right: '22%',
          width: 70,
          height: 70,
          background: 'radial-gradient(circle at 35% 35%, hsl(45 50% 92%) 0%, hsl(40 30% 75%) 55%, hsl(35 25% 55%) 100%)',
          boxShadow: '0 0 60px hsla(45, 80%, 80%, 0.25), 0 0 120px hsla(45, 70%, 70%, 0.12)',
          opacity: 0.85,
        }}
      />

      {/* Horizon glow */}
      <div
        className="absolute inset-x-0 bottom-0"
        aria-hidden
        style={{
          height: '30%',
          background:
            'linear-gradient(to top, hsla(220, 30%, 12%, 0.95) 0%, hsla(220, 40%, 18%, 0.6) 40%, transparent 100%)',
        }}
      />

      {/* Ground silhouette */}
      <div
        className="absolute inset-x-0 bottom-0"
        aria-hidden
        style={{
          height: '12%',
          background: 'linear-gradient(to top, #050810 0%, hsl(225 30% 8%) 100%)',
          borderTop: '1px solid hsla(207, 80%, 50%, 0.2)',
          boxShadow: '0 -2px 24px hsla(207, 90%, 55%, 0.15)',
        }}
      />

      {/* Status banner */}
      <div className="absolute inset-x-0 top-6 flex justify-center pointer-events-none">
        <div
          className="pointer-events-auto flex items-center gap-3 px-4 py-2.5 rounded-md border backdrop-blur-md max-w-[480px]"
          style={{
            background: 'hsla(220, 25%, 8%, 0.85)',
            borderColor: 'hsla(45, 80%, 55%, 0.4)',
            fontFamily: 'ui-monospace, "JetBrains Mono", monospace',
          }}
        >
          <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-yellow-400">
              Simplified Sky Fallback
            </div>
            <div className="text-[10px] text-muted-foreground truncate">{reason}</div>
          </div>
          {onRetry && (
            <button
              onClick={onRetry}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] uppercase tracking-wider bg-card/80 border border-border/40 text-muted-foreground hover:text-foreground hover:border-border transition-all"
            >
              <RotateCw className="w-3 h-3" />
              Retry
            </button>
          )}
        </div>
      </div>

      {/* Center info */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div
          className="text-center px-6"
          style={{ fontFamily: 'ui-monospace, "JetBrains Mono", monospace' }}
        >
          <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground/60 mb-1">
            FX KONTROL · Editor
          </div>
          <div className="text-xs text-muted-foreground/80">
            3D viewport unavailable — editor controls still active
          </div>
        </div>
      </div>
    </div>
  );
}

// Pre-computed pseudo-random star field — 120 tiny white dots via box-shadow chain.
// Generated deterministically so it stays the same across renders.
const STAR_FIELD = (() => {
  const shadows: string[] = [];
  // Simple LCG for deterministic positions
  let seed = 1337;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };
  for (let i = 0; i < 120; i++) {
    const x = Math.floor(rand() * 1920);
    const y = Math.floor(rand() * 700); // upper portion only
    const a = (0.35 + rand() * 0.55).toFixed(2);
    shadows.push(`${x}px ${y}px 0 0 hsla(0, 0%, 100%, ${a})`);
  }
  return shadows.join(', ');
})();

/**
 * Detects whether the current browser can create a WebGL context.
 * Returns null if everything looks fine, or an error string for the fallback.
 */
export function detectWebGLCapability(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const canvas = document.createElement('canvas');
    const gl =
      (canvas.getContext('webgl2') as WebGL2RenderingContext | null) ||
      (canvas.getContext('webgl') as WebGLRenderingContext | null) ||
      (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null);
    if (!gl) return 'WebGL is not supported on this browser/device.';
    // Some browsers expose a context but it is software-only / disabled
    const dbg = (gl as WebGLRenderingContext).getExtension('WEBGL_debug_renderer_info');
    if (dbg) {
      const renderer = (gl as WebGLRenderingContext).getParameter(
        (dbg as { UNMASKED_RENDERER_WEBGL: number }).UNMASKED_RENDERER_WEBGL,
      ) as string | undefined;
      if (renderer && /swiftshader|software|llvmpipe/i.test(renderer)) {
        return `Hardware acceleration disabled (renderer: ${renderer}).`;
      }
    }
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : 'Unable to query WebGL.';
  }
}
