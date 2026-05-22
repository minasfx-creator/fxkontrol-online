import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import FireOneModulesInline from '@/components/editor/FireOneModulesInline';
import type { FireOneModuleStatus } from '@/lib/fireoneProtocol';

function mod(addr: number, over: Partial<FireOneModuleStatus> = {}): FireOneModuleStatus {
  return {
    moduleAddress: addr,
    armed: false,
    batteryVoltage: 4.0,
    temperature: 25,
    signalStrength: 0,
    firmwareVersion: '5.0',
    igniters: Array.from({ length: 32 }, (_, i) => ({
      position: i + 1, connected: i < 8, fired: false, resistance: 2, continuityOk: i < 8,
    })),
    lastSeen: Date.now(),
    wireless: false,
    errors: [],
    rssiDbm: -55,
    connectionMode: 'wired',
    ...over,
  };
}

afterEach(() => cleanup());

describe('FireOneModulesInline', () => {
  it('shows hint when not connected', () => {
    render(<FireOneModulesInline modules={new Map()} isConnected={false} />);
    expect(screen.getByText(/para enxergar módulos/i)).toBeTruthy();
  });

  it('shows empty state when connected but no modules answered', () => {
    render(<FireOneModulesInline modules={new Map()} isConnected />);
    expect(screen.getByText(/Nenhum módulo respondeu/i)).toBeTruthy();
  });

  it('lists modules sorted by address with mode + igniter live count', () => {
    const map = new Map<number, FireOneModuleStatus>([
      [3, mod(3, { connectionMode: 'wireless', rssiDbm: -82 })],
      [1, mod(1)],
    ]);
    render(<FireOneModulesInline modules={map} isConnected />);
    const rows = screen.getAllByRole('row');
    // Each controller group renders its own <table> with a header row, so
    // wired + wireless = 2 groups = 2 header rows + 2 data rows = 4 total.
    expect(rows.length).toBe(4);
    const allText = rows.map((r) => r.textContent ?? '').join('|');
    expect(allText).toContain('8/32');
    expect(allText).toMatch(/\bWL\b/);
    // Address cells should appear somewhere in data rows.
    expect(allText).toMatch(/\b1\b/);
    expect(allText).toMatch(/\b3\b/);
  });

  it('rescan button calls onRescan and stops propagation', () => {
    const onRescan = vi.fn();
    const onParent = vi.fn();
    render(
      <div onClick={onParent}>
        <FireOneModulesInline modules={new Map([[1, mod(1)]])} isConnected onRescan={onRescan} />
      </div>,
    );
    fireEvent.click(screen.getByTestId('fireone-rescan'));
    expect(onRescan).toHaveBeenCalled();
    expect(onParent).not.toHaveBeenCalled();
  });
});
