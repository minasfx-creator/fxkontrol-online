import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import FireOneModulesInline from '@/components/editor/FireOneModulesInline';
import type { FireOneModuleStatus } from '@/lib/fireoneProtocol';

function mod(addr: number, controllerId: string, label: string): FireOneModuleStatus {
  return {
    moduleAddress: addr,
    armed: false,
    batteryVoltage: 12.0,
    temperature: 25,
    signalStrength: 90,
    firmwareVersion: '5.0',
    igniters: Array.from({ length: 32 }, (_, i) => ({ position: i + 1, connected: i < 4, fired: false, resistance: 1.5, continuityOk: true })),
    lastSeen: Date.now(),
    wireless: true,
    errors: [],
    model: 'IFMx-i32Q',
    transport: 'wifi_direct',
    controllerId,
    controllerLabel: label,
  };
}

describe('FireOneModulesInline — grouped by controller', () => {
  it('renders one group per controllerLabel even when addresses collide', () => {
    const xl4 = mod(3, 'wifi-direct-xl4', 'XL4 Gateway');
    const xl2 = mod(3, 'wifi-direct-xl2', 'XL2 Gateway');
    render(
      <FireOneModulesInline
        modules={new Map([[3, xl4]])}
        extraRows={[xl2]}
        isConnected
      />,
    );
    expect(screen.getByText(/XL4 Gateway/)).toBeInTheDocument();
    expect(screen.getByText(/XL2 Gateway/)).toBeInTheDocument();
    expect(screen.getByText(/2 controladores/)).toBeInTheDocument();
  });
});
