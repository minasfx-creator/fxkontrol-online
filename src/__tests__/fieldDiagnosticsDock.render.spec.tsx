import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const devicesRef: { current: any[] } = { current: [] };
vi.mock('@/core/discovery/DeviceAggregator', () => ({
  deviceAggregator: {
    getDevices: () => devicesRef.current,
    watch: () => () => {},
  },
}));

vi.mock('@/core/discovery/controllerRegistry', () => ({
  resolveControllerProfile: (d: any) => ({
    kind: d.aggregateId === 'fxk' ? 'fxk16' : 'unknown',
    label: d.aggregateId === 'fxk' ? 'FXK16 Pyro Controller' : 'Unknown',
    capabilities: { arm: false, fire: false, eStop: false, safetyCritical: false },
  }),
}));

import FieldDiagnosticsDock from '@/components/safety/FieldDiagnosticsDock';

describe('<FieldDiagnosticsDock />', () => {
  it('renders empty honest state when no devices', () => {
    devicesRef.current = [];
    render(
      <MemoryRouter initialEntries={['/office']}>
        <FieldDiagnosticsDock />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByText(/Field Diagnostics/i));
    expect(screen.getByText(/No physical devices detected/i)).toBeInTheDocument();
  });

  it('lists a device with its transport chips', () => {
    devicesRef.current = [{
      aggregateId: 'fxk',
      label: 'FXK16-DEMO',
      links: { webserial: { id: 'l1', label: 'COM3', family: 'esp32-s3' } },
      activeTransport: 'webserial',
      preferredTransport: 'webserial',
      online: true,
      firstSeen: Date.now(),
      lastSeen: Date.now(),
    }];
    render(
      <MemoryRouter initialEntries={['/office']}>
        <FieldDiagnosticsDock />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByText(/Field Diagnostics/i));
    expect(screen.getByText('FXK16-DEMO')).toBeInTheDocument();
    expect(screen.getByText('SER')).toBeInTheDocument();
    expect(screen.getByText('FXK16 Pyro Controller')).toBeInTheDocument();
  });

  it('hides on /command path', () => {
    devicesRef.current = [];
    const { container } = render(
      <MemoryRouter initialEntries={['/command']}>
        <FieldDiagnosticsDock />
      </MemoryRouter>,
    );
    expect(container.firstChild).toBeNull();
  });
});
