import { describe, it, expect, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import ExtensionDiffStrip from '../ExtensionDiffStrip';
import { extensionHighlight } from '@/lib/aiShowBuilder/extensionHighlight';
import type { ShowPlan } from '@/lib/aiShowBuilder/types';

const plan: ShowPlan = {
  id: 'p1', title: 't', duration: 100, intent: '', style: '',
  site: { name: '', latitude: 0, longitude: 0, elevation: 0, audienceDistance: 0 } as any,
  sections: [],
  positions: [],
  timelineItems: [
    { id: 'c1', type: 'pyro_effect', label: 'a', startTime: 10, duration: 5 },
    { id: 'c2', type: 'pyro_effect', label: 'b', startTime: 50, duration: 10 },
    { id: 'c3', type: 'pyro_effect', label: 'c', startTime: 80 },
  ],
  trajectories: [],
  safetyWarnings: [],
  assumptions: [],
};

describe('ExtensionDiffStrip', () => {
  beforeEach(() => extensionHighlight._reset());

  it('renders nothing without highlight', () => {
    const { container } = render(<ExtensionDiffStrip plan={plan} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders one tick per highlighted cueId', () => {
    const { container, rerender } = render(<ExtensionDiffStrip plan={plan} />);
    act(() => {
      extensionHighlight.set({
        entryId: 'e1',
        cueIds: new Set(['c1', 'c3']),
        positionIds: new Set(), sectionIds: new Set(), trajectoryIds: new Set(),
      });
    });
    rerender(<ExtensionDiffStrip plan={plan} />);
    const ticks = container.querySelectorAll('div[style]');
    expect(ticks.length).toBe(2);
  });

  it('clears when highlight goes null', () => {
    const { container, rerender } = render(<ExtensionDiffStrip plan={plan} />);
    act(() => {
      extensionHighlight.set({
        entryId: 'e1', cueIds: new Set(['c1']),
        positionIds: new Set(), sectionIds: new Set(), trajectoryIds: new Set(),
      });
    });
    rerender(<ExtensionDiffStrip plan={plan} />);
    expect(container.firstChild).not.toBeNull();
    act(() => extensionHighlight.clear());
    rerender(<ExtensionDiffStrip plan={plan} />);
    expect(container.firstChild).toBeNull();
  });
});
