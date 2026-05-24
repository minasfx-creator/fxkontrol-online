import { describe, expect, it } from 'vitest';
import {
  ViewportStateMachine,
  canTransition,
  requiresOverlay,
} from '@/lib/showEngine/viewportState';

describe('viewportState', () => {
  it('boots in `booting` state', () => {
    const sm = new ViewportStateMachine();
    expect(sm.get()).toBe('booting');
  });

  it('overlays required for non-ready/rendering states', () => {
    expect(requiresOverlay('booting')).toBe(true);
    expect(requiresOverlay('empty')).toBe(true);
    expect(requiresOverlay('error')).toBe(true);
    expect(requiresOverlay('contextLost')).toBe(true);
    expect(requiresOverlay('ready')).toBe(false);
    expect(requiresOverlay('rendering')).toBe(false);
  });

  it('allows booting → ready and notifies subscribers', () => {
    const sm = new ViewportStateMachine();
    const seen: string[] = [];
    sm.subscribe((s) => seen.push(s));
    expect(sm.set('ready')).toBe(true);
    expect(seen).toEqual(['ready']);
  });

  it('allows ready → contextLost → ready (recovery cycle)', () => {
    expect(canTransition('ready', 'contextLost')).toBe(true);
    expect(canTransition('contextLost', 'ready')).toBe(true);
  });
});
