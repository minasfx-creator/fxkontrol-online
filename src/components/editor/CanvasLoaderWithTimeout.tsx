import { useEffect, useState } from 'react';
import { clearLazyRetryFlag } from '@/lib/lazyRetry';

/**
 * CanvasLoaderWithTimeout — replaces the old infinite spinner used while
 * SkyCanvas (and other heavy lazy chunks) are loading. After `timeoutMs`
 * milliseconds, surfaces a "Reload Studio" button so the user is never
 * trapped if a dynamic import silently stalls.
 */
export default function CanvasLoaderWithTimeout({
  timeoutMs = 8000,
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
      // Clear LazyChunkBoundary's per-path auto-reload guard so reload works.
      sessionStorage.removeItem(`lazyChunkAutoReload:${window.location.pathname}`);
    } catch { /* ignore */ }
    window.location.reload();
  };

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
            <button
              type="button"
              onClick={handleReload}
              className="inline-flex items-center justify-center px-4 py-2 rounded-md text-[11px] font-semibold uppercase tracking-wider border border-primary/60 bg-primary/15 text-primary hover:bg-primary/25 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/60"
            >
              Reload Studio
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
