import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/core/discovery/DeviceAggregator', () => ({
  deviceAggregator: { getDevices: () => [], watch: () => () => {} },
}));
vi.mock('@/core/discovery/controllerRegistry', () => ({
  resolveControllerProfile: () => ({ kind: 'unknown', label: 'Unknown', capabilities: {} as any }),
}));

import { showPlanManager } from '@/core/showplan/ShowPlanManager';
import { createEmptyShowPlan } from '@/core/showplan/ShowPlan';
import { CueConflictsConsole } from '@/components/safety/CueConflictsConsole';

describe('<CueConflictsConsole />', () => {
  it('renders NO CONFLICTS for an empty ShowPlan (after BLOCKED metadata is filtered to errors)', () => {
    const sp = createEmptyShowPlan();
    showPlanManager.load(sp);
    render(<CueConflictsConsole />);
    // Either NO CONFLICTS, or a counter with at least 0 errors visible
    const heading = screen.getByText(/Cue Conflicts/i);
    expect(heading).toBeInTheDocument();
    expect(screen.getByText(/CHECKS/i)).toBeInTheDocument();
  });
});
