/**
 * Route chunk prefetcher — triggers dynamic import() on hover (desktop only)
 * so chunks are already cached when the user navigates.
 * Skipped on mobile/low-memory devices to prevent iOS crashes.
 */

const prefetchedRoutes = new Set<string>();

// Skip prefetching on mobile or low-memory devices
function canPrefetch(): boolean {
  if (typeof navigator === 'undefined') return false;
  // Skip on mobile (touch-primary devices)
  if ('maxTouchPoints' in navigator && navigator.maxTouchPoints > 0 && !window.matchMedia('(pointer: fine)').matches) {
    return false;
  }
  // Skip if low memory (< 4GB)
  if ('deviceMemory' in navigator && (navigator as any).deviceMemory < 4) {
    return false;
  }
  // Skip on slow connections
  if ('connection' in navigator) {
    const conn = (navigator as any).connection;
    if (conn?.saveData || conn?.effectiveType === '2g' || conn?.effectiveType === 'slow-2g') {
      return false;
    }
  }
  return true;
}

const ROUTE_LOADERS: Record<string, () => Promise<unknown>> = {
  '/': () => import('@/pages/Index'),
  '/command': () => import('@/pages/CommandCenter'),
  '/editor': () => import('@/pages/Index'),
  '/agenda': () => import('@/pages/Agenda'),
  '/training': () => import('@/pages/Training'),
  
  '/settings': () => import('@/pages/Settings'),
  '/admin': () => import('@/pages/Admin'),
  '/field': () => import('@/pages/FieldOps'),
};

export function prefetchRoute(path: string) {
  if (!canPrefetch()) return;
  if (prefetchedRoutes.has(path)) return;
  prefetchedRoutes.add(path);

  const loader = ROUTE_LOADERS[path];
  if (loader) {
    const schedule = typeof requestIdleCallback === 'function'
      ? requestIdleCallback
      : (cb: () => void) => setTimeout(cb, 100);

    schedule(() => {
      loader().catch(() => {
        prefetchedRoutes.delete(path);
      });
    });
  }
}
