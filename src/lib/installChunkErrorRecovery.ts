/**
 * installChunkErrorRecovery — Global safety net for dynamic-import failures
 * that bypass the per-component `lazyRetry` wrapper.
 *
 * Problem
 * -------
 * When the dev server (Vite/HMR) or the production CDN rotates chunk hashes
 * mid-session, any in-flight or future `import()` for an old chunk URL
 * rejects with one of:
 *   - "Failed to fetch dynamically imported module"
 *   - "Importing a module script failed"
 *   - Vite-specific `vite:preloadError` event
 *   - ChunkLoadError
 *
 * Components that use `lazy(() => import(...))` directly (without `lazyRetry`)
 * end up in a permanent Suspense limbo or trigger their boundary, but in
 * either case the user sees a *black/white viewport that never opens* —
 * exactly the symptom reported on desktop.
 *
 * Solution
 * --------
 * Listen for both:
 *   1) `vite:preloadError` — emitted by Vite when a preload `<link>` fails.
 *   2) `unhandledrejection` — catches all dynamic import rejections that
 *      no boundary handled.
 *
 * On the *first* such failure of a session, hard-reload the page once. A
 * sessionStorage flag prevents a reload loop. After the reload the new HTML
 * shipped by the server references the current chunk hashes, the module
 * graph is consistent, and the viewport boots normally.
 *
 * This is intentionally aggressive: a stale-chunk failure is *never*
 * recoverable in-place because the JS module registry has already cached
 * the broken specifier. Reloading is the only deterministic fix.
 */

const RELOAD_FLAG = 'fxk_chunk_recovery_reloaded';

function isStaleChunkError(reason: unknown): boolean {
  const msg =
    reason instanceof Error
      ? reason.message
      : typeof reason === 'string'
        ? reason
        : (reason as { message?: string } | null)?.message ?? '';
  if (!msg) return false;
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError|Loading chunk \d+ failed|Loading CSS chunk/i.test(
    msg,
  );
}

function reloadOnce(reasonLabel: string): void {
  let already = false;
  try {
    already = window.sessionStorage.getItem(RELOAD_FLAG) === '1';
    if (!already) window.sessionStorage.setItem(RELOAD_FLAG, '1');
  } catch {
    // sessionStorage blocked (private mode, sandbox). Allow exactly one reload.
  }
  if (already) {
    console.error(
      `[chunkRecovery] stale-chunk failure (${reasonLabel}) persists after one reload — surfacing to error boundary.`,
    );
    return;
  }
  console.warn(
    `[chunkRecovery] stale-chunk failure detected (${reasonLabel}) — forcing one-shot reload to recover the module graph.`,
  );
  try {
    window.location.reload();
  } catch {
    /* ignore */
  }
}

let installed = false;

/**
 * Idempotent. Safe under HMR — re-installing leaves only one set of listeners
 * because we guard with a module-level flag.
 */
export function installChunkErrorRecovery(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  // 1) Vite's first-class signal for preload <link> failures.
  window.addEventListener('vite:preloadError', (event: Event) => {
    // Prevent Vite's default behavior (which is just to warn).
    try {
      (event as Event & { preventDefault?: () => void }).preventDefault?.();
    } catch {
      /* ignore */
    }
    reloadOnce('vite:preloadError');
  });

  // 2) Catch-all for unhandled dynamic-import rejections.
  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    if (!isStaleChunkError(event.reason)) return;
    // Prevent the noisy "Uncaught (in promise)" red banner — we own this now.
    try {
      event.preventDefault();
    } catch {
      /* ignore */
    }
    reloadOnce('unhandledrejection');
  });

  // 3) Some browsers surface chunk failures as a window error instead.
  window.addEventListener('error', (event: ErrorEvent) => {
    if (!isStaleChunkError(event.error ?? event.message)) return;
    reloadOnce('window.error');
  });
}

/**
 * Test-only escape hatch — clears the once-per-session reload flag so a
 * test harness or the in-app "Reload Studio" button can recover after a
 * developer manually fixes the chunk graph.
 */
export function resetChunkRecoveryFlag(): void {
  try {
    window.sessionStorage.removeItem(RELOAD_FLAG);
  } catch {
    /* ignore */
  }
}
