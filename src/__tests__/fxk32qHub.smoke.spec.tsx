/**
 * Smoke: /dev/fxk32q hub renders both tabs and toggles deep-link `?tab=`.
 * Mocks the inner panels so we don't pull hardware bridges/three.js.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';

vi.mock('@/components/dev/fxk32q/FXK32QControlPanel', () => ({
  default: () => <div data-testid="control-panel">CONTROL_PANEL_RENDERED</div>,
}));
vi.mock('@/components/dev/fxk32q/FXK32QAdapterPanel', () => ({
  default: () => <div data-testid="snapshot-panel">SNAPSHOT_PANEL_RENDERED</div>,
}));

import FXK32QHub from '@/pages/dev/FXK32QHub';

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="loc">{loc.pathname + loc.search}</div>;
}

function renderHub(initial = '/dev/fxk32q') {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <Routes>
        <Route path="/dev/fxk32q" element={<><FXK32QHub /><LocationProbe /></>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('/dev/fxk32q FXK32QHub', () => {
  beforeEach(() => cleanup());

  it('renders both tabs and defaults to CONTROL', async () => {
    renderHub();
    expect(screen.getByRole('button', { name: /CONTROL/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /SNAPSHOT/i })).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId('control-panel')).toBeTruthy());
  });

  it('switches to SNAPSHOT and updates ?tab=', async () => {
    renderHub();
    fireEvent.click(screen.getByRole('button', { name: /SNAPSHOT/i }));
    await waitFor(() => expect(screen.getByTestId('snapshot-panel')).toBeTruthy());
    expect(screen.getByTestId('loc').textContent).toContain('tab=snapshot');
  });

  it('honours initial ?tab=snapshot deep-link', async () => {
    renderHub('/dev/fxk32q?tab=snapshot');
    await waitFor(() => expect(screen.getByTestId('snapshot-panel')).toBeTruthy());
  });

  it('switches back to CONTROL', async () => {
    renderHub('/dev/fxk32q?tab=snapshot');
    fireEvent.click(screen.getByRole('button', { name: /CONTROL/i }));
    await waitFor(() => expect(screen.getByTestId('control-panel')).toBeTruthy());
    expect(screen.getByTestId('loc').textContent).toContain('tab=control');
  });
});
