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

      {/* Status banner — compact, top-centered */}
      <div className="absolute inset-x-0 top-6 flex justify-center pointer-events-none">
        <div
          className="pointer-events-auto flex items-center gap-3 px-4 py-2.5 rounded-md border backdrop-blur-md max-w-[520px]"
          style={{
            background: 'hsla(220, 25%, 8%, 0.85)',
            borderColor: 'hsla(45, 80%, 55%, 0.4)',
            fontFamily: 'ui-monospace, "JetBrains Mono", monospace',
          }}
        >
          <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-yellow-400">
              3D Viewport Unavailable
            </div>
            <div className="text-[10px] text-muted-foreground truncate" title={reason}>{reason}</div>
          </div>
        </div>
      </div>

      {/* Recovery card — primary actions, centered. Surfaces both an in-place
          Retry (preserves editor state) and a Reload Page escape hatch for
          the rare case where Retry alone can't recover the GL pipeline. */}
      <div className="absolute inset-0 flex items-center justify-center px-6">
        <div
          className="pointer-events-auto w-full max-w-[440px] rounded-xl border backdrop-blur-md p-6"
          style={{
            background: 'hsla(220, 25%, 8%, 0.92)',
            borderColor: 'hsla(207, 80%, 55%, 0.35)',
            boxShadow: '0 20px 60px hsla(220, 50%, 2%, 0.6), 0 0 30px hsla(207, 80%, 50%, 0.12)',
            fontFamily: 'ui-monospace, "JetBrains Mono", monospace',
          }}
          role="alertdialog"
          aria-live="polite"
          aria-label="3D viewport recovery"
        >
          <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground/60 mb-2 text-center">
            FX KONTROL · Recovery
          </div>
          <div className="text-sm text-foreground/90 mb-1 text-center font-semibold">
            3D viewport stopped responding
          </div>
          <div className="text-[11px] text-muted-foreground mb-5 text-center leading-relaxed">
            All editor controls (timeline, panels, hardware) remain active.
            <br />
            Try recovering the renderer below — your project state is preserved.
          </div>

          <div className="flex flex-col gap-2">
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                autoFocus
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-[11px] font-semibold uppercase tracking-wider transition-all focus:outline-none focus:ring-2 focus:ring-cyan-400/60"
                style={{
                  background: 'hsla(187, 90%, 45%, 0.18)',
                  borderWidth: 1,
                  borderStyle: 'solid',
                  borderColor: 'hsla(187, 90%, 55%, 0.65)',
                  color: 'hsl(187, 90%, 75%)',
                  boxShadow: '0 0 18px hsla(187, 90%, 50%, 0.25), inset 0 0 12px hsla(187, 90%, 50%, 0.08)',
                }}
              >
                <RotateCw className="w-3.5 h-3.5" />
                Retry · Reinitialize Renderer
              </button>
            )}
            <button
              type="button"
              onClick={() => { try { window.location.reload(); } catch { /* ignore */ } }}
              className="flex items-center justify-center gap-2 px-4 py-2 rounded-md text-[10px] uppercase tracking-wider bg-card/60 border border-border/40 text-muted-foreground hover:text-foreground hover:border-border/70 transition-all focus:outline-none focus:ring-2 focus:ring-border/60"
            >
              <RefreshCw className="w-3 h-3" />
              Reload Page
            </button>
          </div>

          <div className="mt-4 pt-3 border-t border-border/20 text-[9px] uppercase tracking-wider text-muted-foreground/50 text-center">
            Tip · close other GPU-heavy tabs before retrying
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
