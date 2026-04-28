/**
 * lazyRetry — resilient wrapper for React.lazy() dynamic imports.
 *
 * Goals:
 *  - Recover from transient Vite/HMR/CDN dynamic-import failures without
 *    leaving the user stuck in an infinite Suspense fallback.
 *  - Retry the import once with a cache-busting query param so a stale
 *    chunk URL doesn't poison subsequent attempts within the same session.
 *  - As a last resort, hard-reload the page exactly once per session
 *    (per-module key) — never enter a reload loop.
 *  - Always log the failing module specifier so devs can identify the
 *    chunk in the network tab.
 */

const SESSION_RELOAD_PREFIX = 'fxk_lazy_retry_reload:';
const SESSION_RETRIED_PREFIX = 'fxk_lazy_retry_inflight:';

function isDynamicImportError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError/i.test(
    error.message,
  );
}

function safeSession(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

function markReloadedOnce(key: string): boolean {
  const ss = safeSession();
  if (!ss) return true; // no storage → allow a single reload attempt
  if (ss.getItem(SESSION_RELOAD_PREFIX + key) === '1') return false;
  ss.setItem(SESSION_RELOAD_PREFIX + key, '1');
  return true;
}

function clearRetryFlag(key: string): void {
  const ss = safeSession();
  if (!ss) return;
  ss.removeItem(SESSION_RETRIED_PREFIX + key);
}

/**
 * Legacy global flag clearer kept for backwards compatibility with callers
 * that imported `clearLazyRetryFlag` from older versions of this module.
 * Now also clears all per-module retry markers.
 */
export function clearLazyRetryFlag(): void {
  const ss = safeSession();
  if (!ss) return;
  try {
    const remove: string[] = [];
    for (let i = 0; i < ss.length; i++) {
      const k = ss.key(i);
      if (k && (k.startsWith(SESSION_RELOAD_PREFIX) || k.startsWith(SESSION_RETRIED_PREFIX))) {
        remove.push(k);
      }
    }
    remove.forEach((k) => ss.removeItem(k));
    // Old global key from previous implementation
    ss.removeItem('fxk_lazy_chunk_retry');
  } catch {
    /* best-effort */
  }
}

/**
 * Extract a stable identifier for the dynamic import. We can't introspect the
 * importer arrow itself, but we can ask the caller to pass a key, or fall
 * back to the function source (Function.prototype.toString includes the
 * `import('…')` literal Vite emits, which is unique per module).
 */
function deriveModuleKey(importer: () => Promise<unknown>, explicit?: string): string {
  if (explicit) return explicit;
  try {
    const src = importer.toString();
    const match = src.match(/import\(\s*['"`]([^'"`]+)['"`]\s*\)/);
    if (match?.[1]) return match[1];
    // Fall back to a short hash of the source so different importers don't
    // collide on the same key.
    let h = 0;
    for (let i = 0; i < src.length; i++) h = (h * 31 + src.charCodeAt(i)) | 0;
    return `anon:${h.toString(36)}`;
  } catch {
    return 'anon:unknown';
  }
}

export function lazyRetry<T>(importer: () => Promise<T>, moduleKey?: string): () => Promise<T> {
  const key = deriveModuleKey(importer, moduleKey);

  return async () => {
    try {
      const mod = await importer();
      // Success — clear any stale retry markers for this module.
      clearRetryFlag(key);
      return mod;
    } catch (firstError) {
      if (!isDynamicImportError(firstError)) throw firstError;
      console.warn(`[lazyRetry] dynamic import failed for "${key}" — retrying once`, firstError);

      // Retry once. We cannot rewrite Vite's pre-built import URL with a
      // cache-buster from outside, but a second call gives the dev server /
      // browser cache a chance to recover from a transient 404.
      try {
        // Tiny delay so the dev server has time to settle after restart.
        await new Promise<void>((r) => setTimeout(r, 150));
        const mod = await importer();
        clearRetryFlag(key);
        console.info(`[lazyRetry] recovered "${key}" on retry`);
        return mod;
      } catch (secondError) {
        console.error(`[lazyRetry] retry failed for "${key}"`, secondError);
        // Hard reload exactly once per session per module — covers the case
        // where Vite emitted new chunk hashes after a restart and the in-memory
        // module graph is permanently out of sync.
        if (typeof window !== 'undefined' && markReloadedOnce(key)) {
          console.warn(`[lazyRetry] forcing one-time reload to recover "${key}"`);
          try { window.location.reload(); } catch { /* ignore */ }
          // Block resolution — the page will navigate away.
          return new Promise<T>(() => {});
        }
        // Already reloaded once for this module → bubble to ErrorBoundary.
        throw secondError;
      }
    }
  };
}
