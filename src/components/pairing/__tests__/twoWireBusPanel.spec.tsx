import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import TwoWireBusPanel from '@/components/pairing/TwoWireBusPanel';
import { setWorkMode } from '@/lib/workMode';

// Minimal stub of TwoWireTransport surface used by the panel.
function makeStubTransport() {
  const healthSubs: Array<(h: unknown) => void> = [];
  let health = { state: 'disconnected' as const, txOk: 0, txErr: 0, crcErrorRate60s: 0 };
  return {
    open: vi.fn(async () => { health = { ...health, state: 'connected' as never }; healthSubs.forEach(c => c(health)); }),
    close: vi.fn(async () => { health = { ...health, state: 'disconnected' as never }; healthSubs.forEach(c => c(health)); }),
    onHealthChange: (cb: (h: unknown) => void) => { healthSubs.push(cb); cb(health); return () => {}; },
    onFrame: () => () => {},
    getHealth: () => health,
    send: vi.fn(async () => {}),
  };
}

afterEach(() => cleanup());

describe('TwoWireBusPanel', () => {
  it('renders disconnected by default with NO HARDWARE provenance', () => {
    setWorkMode('simulation');
    render(<TwoWireBusPanel />);
    expect(screen.getByTestId('two-wire-bus-panel')).toBeTruthy();
    expect(screen.getByTestId('provenance-badge').textContent).toMatch(/NO HARDWARE/);
  });

  it('connects via injected serialApi + transport and flips to LIVE READ-ONLY in simulation', async () => {
    setWorkMode('simulation');
    const stub = makeStubTransport();
    const serial = { requestPort: vi.fn(async () => ({})) };
    render(
      <TwoWireBusPanel
        transportFactory={() => stub as never}
        serialApi={serial as never}
      />,
    );
    fireEvent.click(screen.getByTestId('connect-btn'));
    await waitFor(() => {
      expect(stub.open).toHaveBeenCalled();
      expect(screen.getByTestId('provenance-badge').textContent).toMatch(/LIVE READ-ONLY/);
    });
  });

  it('hold-scan button is disabled until connected', () => {
    setWorkMode('simulation');
    render(<TwoWireBusPanel />);
    const btn = screen.getByTestId('hold-scan-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });
});
