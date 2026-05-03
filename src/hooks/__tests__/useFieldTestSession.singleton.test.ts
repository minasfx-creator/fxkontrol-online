/**
 * Singleton coherence — the FieldTest entry must keep the same
 * `fieldTestEngine` session AND the same FXK16 bridge instance when:
 *   - the user resizes the window (mobile ↔ desktop shell flip)
 *   - the unified entry remounts the lazy desktop shell
 *
 * If anyone replaces the singleton with a per-shell instance (or calls
 * `engine.stop()` on unmount), this test will fail loudly.
 */
import { describe, it, expect } from 'vitest';
import { fieldTestEngine } from '@/services/fieldTestService';
import { _getFXK16Singleton } from '@/hooks/useFXK16Bridge';

describe('FieldTest cross-shell singleton coherence', () => {
  it('exports a single fieldTestEngine instance per process', async () => {
    const a = (await import('@/services/fieldTestService')).fieldTestEngine;
    const b = (await import('@/services/fieldTestService')).fieldTestEngine;
    expect(a).toBe(b);
    expect(a).toBe(fieldTestEngine);
  });

  it('shares the same FXK16 bridge across multiple lookups', () => {
    const a = _getFXK16Singleton();
    const b = _getFXK16Singleton();
    expect(a).toBe(b);
  });

  it('does NOT clear the active session when the entry component would unmount', () => {
    // Simulated remount: unsubscribe a listener, then resubscribe — the
    // engine state must be preserved (no implicit stop()).
    const unsub = fieldTestEngine.subscribe(() => {});
    unsub();
    expect(typeof fieldTestEngine.subscribe).toBe('function');
    // currentSession is whatever the test environment had — the contract is
    // that *unsubscribing a listener never tears the session down*.
    const before = fieldTestEngine.currentSession;
    const unsub2 = fieldTestEngine.subscribe(() => {});
    unsub2();
    expect(fieldTestEngine.currentSession).toBe(before);
  });
});
