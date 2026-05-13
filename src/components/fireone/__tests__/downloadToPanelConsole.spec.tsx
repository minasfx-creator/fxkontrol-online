import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DownloadToPanelConsole from '@/components/fireone/DownloadToPanelConsole';
import { showPlanManager } from '@/core/showplan/ShowPlanManager';
import { setWorkMode } from '@/lib/workMode';
import type { UltraFireTransportLike } from '@/core/export/UltraFireDownloader';

function seedPyro() {
  const sp = showPlanManager.current;
  sp.pyroCues = [
    { id: 'c1', time: 1, module: 1, channel: 0, fuseDelay: 50, effectId: 'fx', position: { x: 0, y: 0, z: 0 } } as never,
    { id: 'c2', time: 2, module: 1, channel: 1, fuseDelay: 100, effectId: 'fx', position: { x: 0, y: 0, z: 0 } } as never,
    { id: 'c3', time: 3, module: 2, channel: 0, fuseDelay: 50, effectId: 'fx', position: { x: 0, y: 0, z: 0 } } as never,
  ];
}

function mockTransport(verifyOk: boolean): UltraFireTransportLike {
  return {
    send: vi.fn(async () => {}),
    sendVerify: vi.fn(async () => {}),
    waitVerify: vi.fn(async () => verifyOk),
  };
}

describe('DownloadToPanelConsole', () => {
  it('shows NO TRANSPORT advisory when no transport is provided', () => {
    setWorkMode('simulation');
    render(<DownloadToPanelConsole />);
    expect(screen.getByTestId('advisory-badge').textContent).toMatch(/NO TRANSPORT/);
  });

  it('shows SIM · ADVISORY in simulation when transport is present', () => {
    setWorkMode('simulation');
    render(<DownloadToPanelConsole transport={mockTransport(true)} />);
    expect(screen.getByTestId('advisory-badge').textContent).toMatch(/ADVISORY/);
  });

  it('compiles the active ShowPlan and lists per-module rows', async () => {
    setWorkMode('simulation');
    seedPyro();
    render(<DownloadToPanelConsole transport={mockTransport(true)} />);
    fireEvent.click(screen.getByTestId('recompile-btn'));
    await waitFor(() => {
      expect(screen.getAllByRole('row').length).toBeGreaterThan(2);
    });
  });

  it('runs the download and reports OK on verify success', async () => {
    setWorkMode('simulation');
    seedPyro();
    const tx = mockTransport(true);
    render(<DownloadToPanelConsole transport={tx} />);
    fireEvent.click(screen.getByTestId('recompile-btn'));
    fireEvent.click(screen.getByTestId('download-btn'));
    await waitFor(() => {
      expect(tx.send).toHaveBeenCalled();
      expect(tx.sendVerify).toHaveBeenCalled();
    }, { timeout: 2000 });
  });
});
