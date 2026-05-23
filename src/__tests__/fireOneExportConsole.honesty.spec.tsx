import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const devicesRef: { current: any[] } = { current: [] };
vi.mock('@/core/discovery/DeviceAggregator', () => ({
  deviceAggregator: {
    getDevices: () => devicesRef.current,
    watch: () => () => {},
  },
}));

vi.mock('@/core/discovery/controllerRegistry', () => ({
  resolveControllerProfile: (d: any) =>
    d.aggregateId === 'fxk'
      ? { kind: 'fxk16', label: 'FXK16', capabilities: {} as any }
      : { kind: 'unknown', label: 'Unknown', capabilities: {} as any },
}));

import { showPlanManager } from '@/core/showplan/ShowPlanManager';
import { createEmptyShowPlan } from '@/core/showplan/ShowPlan';
import FireOneExportConsole from '@/components/editor/FireOneExportConsole';

describe('<FireOneExportConsole /> honesty', () => {
  beforeEach(() => {
    showPlanManager.load(createEmptyShowPlan());
  });

  it('shows SIMULATED badge when no FXK16/FireOne device is online', () => {
    devicesRef.current = [];
    render(<FireOneExportConsole />);
    const badges = screen.getAllByText(/SIMULATED|SIM/i);
    expect(badges.length).toBeGreaterThan(0);
  });

  it('shows LIVE-RO badge when an FXK16 device is online', () => {
    devicesRef.current = [{ aggregateId: 'fxk', online: true }];
    render(<FireOneExportConsole />);
    expect(screen.getByText(/LIVE-RO|LIVE READ ONLY/i)).toBeInTheDocument();
  });
});
