/**
 * Guardian: lazyRetry resilience.
 *
 * Simulates transient dynamic-import failures and verifies the user is
 * never trapped in an infinite Suspense spinner:
 *  1. Transient failure → retried once → resolves successfully.
 *  2. Two consecutive failures → triggers a one-time hard reload (does
 *     NOT hang forever) and never reloads twice for the same module.
 *  3. Non-dynamic-import errors are NOT retried (bubble immediately).
 *  4. Successful retry clears the in-flight flag.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { lazyRetry, clearLazyRetryFlag } from '@/lib/lazyRetry';

const DYN_ERR = () =>
  new Error('Failed to fetch dynamically imported module: /src/foo.tsx');

describe('lazyRetry · transient dynamic-import resilience', () => {
  let reloadSpy: ReturnType<typeof vi.fn>;
  let originalLocation: Location;

  beforeEach(() => {
    clearLazyRetryFlag();
    window.sessionStorage.clear();
    // Stub window.location.reload so the test process doesn't actually navigate.
    originalLocation = window.location;
    reloadSpy = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, reload: reloadSpy, pathname: '/studio' },
    });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
    vi.restoreAllMocks();
    clearLazyRetryFlag();
  });

  it('recovers from a single transient failure (no spinner trap)', async () => {
    let calls = 0;
    const importer = vi.fn(async () => {
      calls += 1;
      if (calls === 1) throw DYN_ERR();
      return { default: 'OK' };
    });

    const wrapped = lazyRetry(importer, 'mod-A');
    const result = await wrapped();

    expect(result).toEqual({ default: 'OK' });
    expect(importer).toHaveBeenCalledTimes(2);
  });

  it('two consecutive failures trigger exactly one hard reload (never loops)', async () => {
    const importer = vi.fn(async () => {
      throw DYN_ERR();
    });

    const wrapped = lazyRetry(importer, 'mod-B');

    // First call: importer fails twice → reload triggered, promise hangs
    // (page would navigate). We race against a timeout to assert it does
    // not throw and does not resolve synchronously with bad data.
    const racePromise = Promise.race([
      wrapped().then(() => 'resolved').catch(() => 'rejected'),
      new Promise<string>((r) => setTimeout(() => r("pending"), 400)),
    ]);

    const outcome = await racePromise;
    expect(outcome).toBe('pending'); // hangs because reload was invoked
    expect(reloadSpy).toHaveBeenCalledTimes(1);
    expect(importer).toHaveBeenCalledTimes(2);

    // Second invocation for the SAME module must NOT reload again
    // (anti reload-loop guard) and must reject so an ErrorBoundary takes over.
    reloadSpy.mockClear();
    importer.mockClear();
    const wrapped2 = lazyRetry(importer, 'mod-B');
    await expect(wrapped2()).rejects.toThrow(/dynamically imported module/);
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it('non-dynamic-import errors are NOT retried and bubble immediately', async () => {
    const importer = vi.fn(async () => {
      throw new TypeError('something else entirely');
    });

    const wrapped = lazyRetry(importer, 'mod-C');
    await expect(wrapped()).rejects.toThrow('something else entirely');
    expect(importer).toHaveBeenCalledTimes(1); // no retry
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it('successful import on first try does not consume any retry budget', async () => {
    const importer = vi.fn(async () => ({ default: 'fast' }));
    const wrapped = lazyRetry(importer, 'mod-D');
    await expect(wrapped()).resolves.toEqual({ default: 'fast' });
    expect(importer).toHaveBeenCalledTimes(1);
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it('different modules have independent reload budgets', async () => {
    const importerE = vi.fn(async () => { throw DYN_ERR(); });
    const importerF = vi.fn(async () => { throw DYN_ERR(); });

    // Module E exhausts its budget → reload #1
    await Promise.race([
      lazyRetry(importerE, 'mod-E')().catch(() => {}),
      new Promise((r) => setTimeout(r, 400)),
    ]);
    expect(reloadSpy).toHaveBeenCalledTimes(1);

    // Module F is independent → reload #2 (NOT blocked by E's marker)
    await Promise.race([
      lazyRetry(importerF, 'mod-F')().catch(() => {}),
      new Promise((r) => setTimeout(r, 400)),
    ]);
    expect(reloadSpy).toHaveBeenCalledTimes(2);
  });
});
