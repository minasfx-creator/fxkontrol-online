import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act, cleanup, fireEvent } from '@testing-library/react';
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

    expect(screen.getAllByText(/FXK-M1/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/IFMx-i32Q/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByLabelText('status ONLINE').length).toBe(2);
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

  it('filters by model, transport and free-text search', () => {
    render(<DetectedModulesPanel />);
    act(() => {
      moduleAggregator.upsert({ address: 1, model: 'FXK-M1', transport: 'artnet', deviceName: 'alpha' });
      moduleAggregator.upsert({ address: 2, model: 'IFMx-i32Q', transport: 'serial', deviceName: 'beta' });
      moduleAggregator.upsert({ address: 3, model: 'FXK', transport: 'usb', deviceName: 'gamma' });
    });

    expect(screen.getAllByText(/ONLINE/i).length).toBe(3);

    // Model filter: keep only FXK-M1
    fireEvent.click(screen.getByTestId('detected-modules-filter-model-FXK-M1'));
    expect(screen.getAllByText(/ONLINE/i).length).toBe(1);
    expect(screen.getByText(/alpha/)).toBeInTheDocument();

    // Clear and apply transport filter
    fireEvent.click(screen.getByTestId('detected-modules-clear-filters'));
    fireEvent.click(screen.getByTestId('detected-modules-filter-transport-serial'));
    expect(screen.getAllByText(/ONLINE/i).length).toBe(1);
    expect(screen.getByText(/beta/)).toBeInTheDocument();

    // Search by deviceName
    fireEvent.click(screen.getByTestId('detected-modules-clear-filters'));
    fireEvent.change(screen.getByTestId('detected-modules-search'), { target: { value: 'gamma' } });
    expect(screen.getAllByText(/ONLINE/i).length).toBe(1);
    expect(screen.getByText(/gamma/)).toBeInTheDocument();

    // No-match state
    fireEvent.change(screen.getByTestId('detected-modules-search'), { target: { value: 'zzz-nope' } });
    expect(screen.getByTestId('detected-modules-no-match')).toBeInTheDocument();
  });
});
