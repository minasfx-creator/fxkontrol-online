import { useEffect, useState } from 'react';
import { clearLazyRetryFlag } from '@/lib/lazyRetry';

/**
 * CanvasLoaderWithTimeout — replaces the old infinite spinner used while
 * SkyCanvas (and other heavy lazy chunks) are loading. After `timeoutMs`
 * milliseconds, surfaces a "Reload Studio" button so the user is never
 * trapped if a dynamic import silently stalls.
 *
 * v2 — also surfaces useful diagnostics (WebGPU/WebGL2 availability)
 * and a "Force WebGL2" escape hatch (?backend=webgl2) when the WebGPU
 * pipeline is suspected to be hanging the boot on desktop.
 */
function detectGpuStack() {
  if (typeof window === 'undefined') return { webgpu: false, webgl2: false };
  const webgpu = typeof (navigator as Navigator & { gpu?: unknown }).gpu !== 'undefined';
  let webgl2 = false;
  try {
    const c = document.createElement('canvas');
    webgl2 = !!c.getContext('webgl2');
  } catch { /* ignore */ }
  return { webgpu, webgl2 };
}

export default function CanvasLoaderWithTimeout({
  timeoutMs = 5000,
  label = 'Loading 3D Engine...',
}: {
  timeoutMs?: number;
  label?: string;
}) {
  const [showReload, setShowReload] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setShowReload(true), timeoutMs);
    return () => window.clearTimeout(t);
  }, [timeoutMs]);

  const handleReload = () => {
    clearLazyRetryFlag();
    try {
      sessionStorage.removeItem(`lazyChunkAutoReload:${window.location.pathname}`);
    } catch { /* ignore */ }
    window.location.reload();
  };

  const handleForceWebGL2 = () => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('backend', 'webgl2');
      window.location.replace(url.toString());
    } catch {
      window.location.reload();
    }
  };

  const { webgpu, webgl2 } = showReload ? detectGpuStack() : { webgpu: true, webgl2: true };
  const usingWebGPUParam = typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('backend') !== 'webgl2';

  return (
    <div className="w-full h-full flex items-center justify-center bg-background">
      <div className="text-center px-6">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs text-muted-foreground font-mono">{label}</p>
        {showReload && (
          <div className="mt-5 space-y-2">
            <p className="text-[11px] text-muted-foreground/80 max-w-xs mx-auto">
              Loading is taking longer than expected. A module may have failed to load.
            </p>
            <p className="text-[10px] font-mono text-muted-foreground/70">
              GPU: WebGPU={webgpu ? 'yes' : 'no'} · WebGL2={webgl2 ? 'yes' : 'no'}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={handleReload}
                className="inline-flex items-center justify-center px-4 py-2 rounded-md text-[11px] font-semibold uppercase tracking-wider border border-primary/60 bg-primary/15 text-primary hover:bg-primary/25 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/60"
              >
                Reload Studio
              </button>
              {webgl2 && usingWebGPUParam && (
                <button
                  type="button"
                  onClick={handleForceWebGL2}
                  className="inline-flex items-center justify-center px-4 py-2 rounded-md text-[11px] font-semibold uppercase tracking-wider border border-border bg-card hover:bg-accent transition-colors"
                  title="Reabre /studio?backend=webgl2"
                >
                  Force WebGL2
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
