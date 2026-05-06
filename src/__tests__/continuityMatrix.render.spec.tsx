import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/hooks/useActiveControllers', () => ({
  useActiveControllers: () => ({ controllers: [], pending: [], acknowledge: () => {}, close: () => {} }),
}));

vi.mock('@/hooks/useContinuityMatrix', () => ({
  useContinuityMatrix: () => ({
    pins: Array.from({ length: 32 }, (_, i) => ({
      pin: i, ohms: Infinity, status: 'UNKNOWN' as const, lastChecked: 0,
    })),
    report: { total: 32, ok: 0, open: 0, short: 0, unknown: 32, lastCheckTime: 0 },
    provenance: { mode: 'not_integrated' as const, source: 'no MUX reader' },
    checking: false,
    isPassingForArm: false,
    runCheck: async () => {},
  }),
}));

vi.mock('@/core/safety/workMode', () => ({
  workMode: { get: () => 'simulation' as const, subscribe: () => () => {} },
}));

import ContinuityMatrix from '@/components/editor/ContinuityMatrix';

beforeEach(() => { /* fresh mocks */ });

describe('<ContinuityMatrix /> v2 4×8', () => {
  it('renders 32 cells in 4 rows × 8 columns with row source labels', () => {
    const { container } = render(<ContinuityMatrix />);
    const cells = container.querySelectorAll('[data-status]');
    expect(cells.length).toBe(32);
    expect(screen.getByText('Row 1')).toBeInTheDocument();
    expect(screen.getByText('Row 4')).toBeInTheDocument();
    // No FXK16 → '—' placeholders
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(4);
  });

  it('shows NOT INTEGRATED provenance when no MUX reader', () => {
    render(<ContinuityMatrix />);
    expect(screen.getByText(/NOTINTEGRATED|N\/I|NOT INTEGRATED/i)).toBeInTheDocument();
  });

  it('banner is ARM BLOCKED when 0 OK channels', () => {
    render(<ContinuityMatrix />);
    expect(screen.getByText(/ARM BLOCKED|SIM · ADVISORY/i)).toBeInTheDocument();
  });

  it('cells render UNKNOWN status without inventing ohms', () => {
    render(<ContinuityMatrix />);
    const dashes = screen.getAllByText('---');
    // 32 status labels + 32 ohms readouts both '---' for UNKNOWN.
    expect(dashes.length).toBeGreaterThanOrEqual(32);
  });
});
