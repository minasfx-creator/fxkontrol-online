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
    d.aggregateId === 'art'
      ? { kind: 'artnet-node', label: 'Art-Net', capabilities: {} as any }
      : { kind: 'unknown', label: 'Unknown', capabilities: {} as any },
}));
vi.mock('@/core/protocols/ArtNetBridge', () => ({
  artNetBridge: {
    getState: () => 'idle',
    getStats: () => ({ nodes: 0, sent: 0, received: 0 }),
  },
}));
vi.mock('@/core/protocols/LinkFailoverPolicy', () => ({
  linkFailoverPolicy: { getStatus: () => ({ activeLink: 'artnet', failoverCount: 0 }) },
}));

import { showPlanManager } from '@/core/showplan/ShowPlanManager';
import { createEmptyShowPlan } from '@/core/showplan/ShowPlan';
import DMXArtNetConsole from '@/components/editor/DMXArtNetConsole';

describe('<DMXArtNetConsole /> honesty', () => {
  beforeEach(() => {
    const sp = createEmptyShowPlan();
    showPlanManager.load(sp);
  });

  it('renders SIMULATED badge with empty ShowPlan and no devices', () => {
    devicesRef.current = [];
    render(<DMXArtNetConsole />);
    expect(screen.getAllByText(/SIMULATED|SIM/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/No DMX cues in ShowPlan/i)).toBeInTheDocument();
  });

  it('shows LIVE-RO when an Art-Net node is online', () => {
    devicesRef.current = [{ aggregateId: 'art', online: true }];
    render(<DMXArtNetConsole />);
    expect(screen.getByText(/LIVE-RO|LIVE READ ONLY/i)).toBeInTheDocument();
  });
});
