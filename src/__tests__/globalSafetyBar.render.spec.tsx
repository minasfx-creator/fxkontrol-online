import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import GlobalSafetyBar from '@/components/safety/GlobalSafetyBar';

vi.mock('@/hooks/useSystemReadiness', () => ({
  useSystemReadiness: () => ({
    status: 'READY',
    workMode: 'simulation',
    safetyState: 'IDLE',
    readinessStatus: 'READY_FOR_SIMULATION',
    blockingReasons: [],
    warnings: [],
    dominantProvenance: 'simulated',
    devicesOnline: 0,
    devicesTotal: 0,
    showPlanLoaded: true,
  }),
}));

describe('<GlobalSafetyBar />', () => {
  it('renders chips on /office', () => {
    render(
      <MemoryRouter initialEntries={['/office']}>
        <GlobalSafetyBar />
      </MemoryRouter>,
    );
    const bar = screen.getByTestId('global-safety-bar');
    expect(bar).toBeInTheDocument();
    expect(bar).toHaveTextContent('MODE');
    expect(bar).toHaveTextContent('SIMULATION');
    expect(bar).toHaveTextContent('STATE');
    expect(bar).toHaveTextContent('STATUS');
    expect(bar).toHaveTextContent('READY');
    expect(bar).toHaveTextContent('HASH');
  });

  it('hides on /command', () => {
    render(
      <MemoryRouter initialEntries={['/command']}>
        <GlobalSafetyBar />
      </MemoryRouter>,
    );
    expect(screen.queryByTestId('global-safety-bar')).toBeNull();
  });

  it('hides on /pairing/usb', () => {
    render(
      <MemoryRouter initialEntries={['/pairing/usb']}>
        <GlobalSafetyBar />
      </MemoryRouter>,
    );
    expect(screen.queryByTestId('global-safety-bar')).toBeNull();
  });
});
