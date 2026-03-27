/**
 * Route chunk prefetcher — triggers dynamic import() on hover
 * so chunks are already cached when the user navigates.
 */

const prefetchedRoutes = new Set<string>();

const ROUTE_LOADERS: Record<string, () => Promise<unknown>> = {
  '/': () => import('@/pages/Index'),
  '/command': () => import('@/pages/CommandCenter'),
  '/editor': () => import('@/pages/Index'), // editor lives inside Index
  '/agenda': () => import('@/pages/Agenda'),
  '/training': () => import('@/pages/Training'),
  '/show-test': () => import('@/pages/ShowTestSimulator'),
  '/settings': () => import('@/pages/Settings'),
  '/admin': () => import('@/pages/Admin'),
  '/field-test': () => import('@/pages/FieldTest'),
};

export function prefetchRoute(path: string) {
  if (prefetchedRoutes.has(path)) return;
  prefetchedRoutes.add(path);

  const loader = ROUTE_LOADERS[path];
  if (loader) {
    // Use requestIdleCallback for non-blocking prefetch
    const schedule = typeof requestIdleCallback === 'function'
      ? requestIdleCallback
      : (cb: () => void) => setTimeout(cb, 50);

    schedule(() => {
      loader().catch(() => {
        // Silent fail — will retry on actual navigation
        prefetchedRoutes.delete(path);
      });
    });
  }
}
