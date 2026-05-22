import { describe, it, expect, beforeEach, vi } from 'vitest';
import { extensionHighlight } from '../extensionHighlight';

describe('extensionHighlight', () => {
  beforeEach(() => extensionHighlight._reset());

  it('starts empty', () => {
    expect(extensionHighlight.get()).toBeNull();
  });

  it('broadcasts set/clear to listeners', () => {
    const spy = vi.fn();
    const off = extensionHighlight.subscribe(spy);
    const h = {
      entryId: 'e1',
      cueIds: new Set(['c1']),
      positionIds: new Set<string>(),
      sectionIds: new Set<string>(),
      trajectoryIds: new Set<string>(),
    };
    extensionHighlight.set(h);
    extensionHighlight.clear();
    off();
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenNthCalledWith(1, h);
    expect(spy).toHaveBeenNthCalledWith(2, null);
  });

  it('dedupes when same entryId is set twice', () => {
    const spy = vi.fn();
    extensionHighlight.subscribe(spy);
    const mk = () => ({
      entryId: 'e1', cueIds: new Set<string>(), positionIds: new Set<string>(),
      sectionIds: new Set<string>(), trajectoryIds: new Set<string>(),
    });
    extensionHighlight.set(mk());
    extensionHighlight.set(mk());
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('clear(entryId) is no-op if entryId mismatch', () => {
    const spy = vi.fn();
    extensionHighlight.set({
      entryId: 'e1', cueIds: new Set(), positionIds: new Set(),
      sectionIds: new Set(), trajectoryIds: new Set(),
    });
    extensionHighlight.subscribe(spy);
    extensionHighlight.clear('other');
    expect(spy).not.toHaveBeenCalled();
    expect(extensionHighlight.get()?.entryId).toBe('e1');
  });

  it('unsubscribe stops notifications', () => {
    const spy = vi.fn();
    const off = extensionHighlight.subscribe(spy);
    off();
    extensionHighlight.set({
      entryId: 'e1', cueIds: new Set(), positionIds: new Set(),
      sectionIds: new Set(), trajectoryIds: new Set(),
    });
    expect(spy).not.toHaveBeenCalled();
  });

  it('listener throws are isolated', () => {
    const bad = vi.fn(() => { throw new Error('boom'); });
    const good = vi.fn();
    extensionHighlight.subscribe(bad);
    extensionHighlight.subscribe(good);
    extensionHighlight.set({
      entryId: 'e1', cueIds: new Set(), positionIds: new Set(),
      sectionIds: new Set(), trajectoryIds: new Set(),
    });
    expect(good).toHaveBeenCalled();
  });
});
