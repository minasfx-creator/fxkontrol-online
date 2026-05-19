import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import { DetectedModulesPanel } from '@/components/editor/DetectedModulesPanel';
import { moduleAggregator } from '@/lib/moduleAggregator';

describe('DetectedModulesPanel', () => {
  beforeEach(() => {
    moduleAggregator._resetForTests();
    vi.useFakeTimers();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    moduleAggregator._resetForTests();
  });

  it('shows empty state when no module detected (honest hardware)', () => {
    render(<DetectedModulesPanel />);
    expect(screen.getByText(/Nenhum módulo detectado/i)).toBeInTheDocument();
  });

  it('lists modules upserted by adapters grouped by inferred model with ONLINE status', () => {
    render(<DetectedModulesPanel />);
    act(() => {
      moduleAggregator.upsert({
        address: 1,
        model: 'FXK-M1',
        transport: 'artnet',
        controllerId: 'xl4-01',
        controllerLabel: 'XL4 Gateway',
        firmware: '5.0',
      });
      moduleAggregator.upsert({
        address: 2,
        model: 'IFMx-i32Q',
        transport: 'serial',
        controllerId: 'xl4-01',
        controllerLabel: 'XL4 Gateway',
      });
    });

    expect(screen.getByText(/FXK-M1/i)).toBeInTheDocument();
    expect(screen.getByText(/IFMx-i32Q/i)).toBeInTheDocument();
    expect(screen.getAllByText(/ONLINE/i).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText(/XL4 Gateway/i).length).toBeGreaterThanOrEqual(2);
  });

  it('transitions ONLINE → STALE → OFFLINE as lastSeen ages', () => {
    render(<DetectedModulesPanel />);
    act(() => {
      moduleAggregator.upsert({
        address: 7,
        model: 'FXK',
        transport: 'usb',
        lastSeen: Date.now(),
      });
    });
    expect(screen.getByLabelText('status ONLINE')).toBeInTheDocument();

    act(() => { vi.advanceTimersByTime(6_000); });
    expect(screen.getByLabelText('status STALE')).toBeInTheDocument();

    act(() => { vi.advanceTimersByTime(15_000); });
    expect(screen.getByLabelText('status OFFLINE')).toBeInTheDocument();
  });
});
