const RETRY_STORAGE_KEY = 'fxk_lazy_chunk_retry';

function shouldRetry(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(error.message);
}

function markRetried(): boolean {
  try {
    if (sessionStorage.getItem(RETRY_STORAGE_KEY) === '1') return false;
    sessionStorage.setItem(RETRY_STORAGE_KEY, '1');
    return true;
  } catch {
    return true;
  }
}

export function clearLazyRetryFlag(): void {
  try {
    sessionStorage.removeItem(RETRY_STORAGE_KEY);
  } catch { /* best-effort: sessionStorage may be unavailable */ }
}

export function lazyRetry<T>(importer: () => Promise<T>): () => Promise<T> {
  return async () => {
    try {
      const module = await importer();
      clearLazyRetryFlag();
      return module;
    } catch (error) {
      if (typeof window !== 'undefined' && shouldRetry(error) && markRetried()) {
        window.location.reload();
        return new Promise<T>(() => {});
      }
      throw error;
    }
  };
}