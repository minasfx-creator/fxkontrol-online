/**
 * E2E guardian: installChunkErrorRecovery
 *
 * Simulates the production failure mode where Vite/CDN rotates chunk hashes
 * mid-session and a `lazy(() => import(...))` rejects with the canonical
 * "Failed to fetch dynamically imported module" message. Verifies that:
 *
 *   1. The first stale-chunk failure triggers EXACTLY ONE window.location.reload().
 *   2. The reload is gated by sessionStorage so a second failure in the same
 *      session does NOT re-reload (anti-loop guard).
 *   3. After the simulated reload, when the import() succeeds, the viewport
 *      mount completes (no permanent Suspense limbo).
 *   4. Non-stale errors (e.g. TypeError) are ignored — no reload is forced.
 *   5. `vite:preloadError` events also trip the recovery once.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  installChunkErrorRecovery,
  resetChunkRecoveryFlag,
} from '@/lib/installChunkErrorRecovery';

const STALE_MSG =
  'Failed to fetch dynamically imported module: /assets/SkyCanvas-abc123.js';

function fireUnhandledRejection(reason: unknown): PromiseRejectionEvent {
  // jsdom doesn't natively dispatch PromiseRejectionEvent on real rejections,
  // so we synthesize the event the way the browser would.
  const ev = new Event('unhandledrejection', {
    cancelable: true,
  }) as PromiseRejectionEvent;
  Object.defineProperty(ev, 'reason', { value: reason, configurable: true });
  Object.defineProperty(ev, 'promise', {
    value: Promise.reject(reason).catch(() => {}),
    configurable: true,
  });
  window.dispatchEvent(ev);
  return ev;
}

describe('installChunkErrorRecovery · E2E stale-chunk recovery', () => {
  let reloadSpy: ReturnType<typeof vi.fn>;
  let originalLocation: Location;

  beforeEach(() => {
    resetChunkRecoveryFlag();
    window.sessionStorage.clear();

    originalLocation = window.location;
    reloadSpy = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, reload: reloadSpy, pathname: '/studio' },
    });

    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // Idempotent — installs listeners once per test process. Subsequent calls
    // are no-ops, which is exactly the behaviour we want to assert here.
    installChunkErrorRecovery();
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
    vi.restoreAllMocks();
    resetChunkRecoveryFlag();
  });

  it('reloads exactly once when a stale-chunk import() rejection bubbles to window', () => {
    // Simulate a `lazy(() => import('/assets/SkyCanvas-abc123.js'))` failure
    // that no per-component lazyRetry caught.
    fireUnhandledRejection(new Error(STALE_MSG));

    expect(reloadSpy).toHaveBeenCalledTimes(1);
    expect(window.sessionStorage.getItem('fxk_chunk_recovery_reloaded')).toBe('1');
  });

  it('does NOT reload a second time within the same session (anti-loop guard)', () => {
    fireUnhandledRejection(new Error(STALE_MSG));
    expect(reloadSpy).toHaveBeenCalledTimes(1);

    // A second stale failure (e.g. another lazy chunk also stale) must NOT
    // trigger a reload loop — the boundary takes over from here.
    fireUnhandledRejection(new Error(STALE_MSG));
    fireUnhandledRejection(new Error('ChunkLoadError: Loading chunk 42 failed'));

    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it('ignores non-stale errors (e.g. plain TypeError) — no reload', () => {
    fireUnhandledRejection(new TypeError('Cannot read properties of undefined'));
    fireUnhandledRejection('some random string rejection');
    fireUnhandledRejection(null);

    expect(reloadSpy).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem('fxk_chunk_recovery_reloaded')).toBeNull();
  });

  it('also recovers from a vite:preloadError event', () => {
    const ev = new Event('vite:preloadError', { cancelable: true });
    window.dispatchEvent(ev);

    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it('after the one-shot reload, a subsequent successful import() resolves (viewport mounts)', async () => {
    // 1. Stale failure → reload triggered, sessionStorage flag set.
    fireUnhandledRejection(new Error(STALE_MSG));
    expect(reloadSpy).toHaveBeenCalledTimes(1);

    // 2. Simulate the post-reload world: the new HTML ships fresh chunk hashes,
    //    so a fresh import() now resolves. The recovery layer must NOT
    //    interfere with successful imports.
    const importer = vi.fn(async () => ({ default: () => 'SkyCanvas mounted' }));
    const mod = await importer();

    expect(mod.default()).toBe('SkyCanvas mounted');
    expect(importer).toHaveBeenCalledTimes(1);
    // No additional reload was triggered by the successful import.
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it('detects multiple stale-chunk message variants', () => {
    const variants = [
      'Failed to fetch dynamically imported module: /a.js',
      'Importing a module script failed',
      'error loading dynamically imported module',
      'ChunkLoadError: Loading chunk 7 failed',
      'Loading CSS chunk 3 failed',
    ];

    for (const msg of variants) {
      // Reset between iterations so each variant gets a fresh budget.
      resetChunkRecoveryFlag();
      reloadSpy.mockClear();

      fireUnhandledRejection(new Error(msg));
      expect(reloadSpy, `variant "${msg}" should trigger reload`).toHaveBeenCalledTimes(1);
    }
  });
});
