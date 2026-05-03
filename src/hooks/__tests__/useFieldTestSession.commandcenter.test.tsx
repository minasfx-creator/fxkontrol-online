/**
 * Integration: CommandCenter → FieldTest shells → uiCommandGateway + fieldTestEngine
 *
 * Validates that the canonical safety command path holds in BOTH shells
 * mounted from the CommandCenter `field_test` console:
 *
 *   ARM    → uiCommandGateway.arm    + fieldTestEngine.arm
 *   DISARM → uiCommandGateway.disarm + fieldTestEngine.disarm
 *   E-STOP → uiCommandGateway.eStop  + fieldTestEngine.eStop
 *
 * The hook (`useFieldTestSession`) is the shared contract — testing it
 * here covers both desktop and mobile shells without booting their
 * heavy dependency trees.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// ─── Mocks ──────────────────────────────────────────
const gatewayMock = {
  arm: vi.fn(),
  disarm: vi.fn(),
  eStop: vi.fn(),
  lock: vi.fn(),
  unlock: vi.fn(),
  reset: vi.fn(),
  fire: vi.fn(),
  continuityCheck: vi.fn(),
};
vi.mock('@/core/command/uiCommandGateway', () => ({
  uiCommandGateway: gatewayMock,
}));

const engineState: { armed: boolean; role: 'controller' | 'module' } = {
  armed: false,
  role: 'controller',
};
const engineMock = {
  arm: vi.fn(() => { engineState.armed = true; }),
  disarm: vi.fn(() => { engineState.armed = false; }),
  eStop: vi.fn(() => { engineState.armed = false; }),
  fire: vi.fn(),
  start: vi.fn(async () => true),
  stop: vi.fn(async () => {}),
  runBenchmark: vi.fn(async () => {}),
  stopBenchmark: vi.fn(),
  generateReport: vi.fn(() => 'report'),
  getSuggestions: vi.fn(() => []),
  subscribe: vi.fn((_fn: (s: unknown) => void) => () => {}),
  get currentSession() {
    return { armed: engineState.armed, role: engineState.role };
  },
};
vi.mock('@/services/fieldTestService', () => ({
  fieldTestEngine: engineMock,
  generateSessionCode: () => 'TEST',
}));

vi.mock('@/lib/haptics', () => ({
  haptics: { success: vi.fn(), panic: vi.fn(), fire: vi.fn(), arm: vi.fn(), disarm: vi.fn(), tap: vi.fn() },
}));
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { useFieldTestSession } from '@/hooks/useFieldTestSession';

describe('CommandCenter ↔ FieldTest safety command path', () => {
  beforeEach(() => {
    engineState.armed = false;
    engineState.role = 'controller';
    Object.values(gatewayMock).forEach(fn => fn.mockClear());
    Object.values(engineMock).forEach(fn => typeof fn === 'function' && (fn as any).mockClear?.());
  });

  it('ARM: routes through uiCommandGateway AND mirrors on fieldTestEngine', () => {
    const { result } = renderHook(() => useFieldTestSession());
    act(() => result.current.toggleArm('FieldTestDesktop'));

    expect(gatewayMock.arm).toHaveBeenCalledTimes(1);
    expect(gatewayMock.arm).toHaveBeenCalledWith({ source: 'FieldTestDesktop' });
    expect(engineMock.arm).toHaveBeenCalledTimes(1);
    expect(gatewayMock.disarm).not.toHaveBeenCalled();
    expect(gatewayMock.eStop).not.toHaveBeenCalled();
  });

  it('DISARM: when armed, toggleArm flips through gateway+engine', () => {
    engineState.armed = true;
    const { result } = renderHook(() => useFieldTestSession());
    act(() => result.current.toggleArm('FieldTestMobile'));

    expect(gatewayMock.disarm).toHaveBeenCalledWith({ source: 'FieldTestMobile' });
    expect(engineMock.disarm).toHaveBeenCalledTimes(1);
    expect(gatewayMock.arm).not.toHaveBeenCalled();
  });

  it('E-STOP: routes through gateway with PANIC detail AND mirrors on engine', () => {
    const { result } = renderHook(() => useFieldTestSession());
    act(() => result.current.panic('FieldTestDesktop'));

    expect(gatewayMock.eStop).toHaveBeenCalledTimes(1);
    expect(gatewayMock.eStop).toHaveBeenCalledWith({ source: 'FieldTestDesktop', detail: 'PANIC' });
    expect(engineMock.eStop).toHaveBeenCalledTimes(1);
  });

  it('source label propagates so the audit trail attributes the right shell', () => {
    const { result } = renderHook(() => useFieldTestSession());
    act(() => result.current.toggleArm('FieldTestDesktop:keyboard'));
    act(() => result.current.panic('FieldTestMobile'));

    expect(gatewayMock.arm).toHaveBeenCalledWith({ source: 'FieldTestDesktop:keyboard' });
    expect(gatewayMock.eStop).toHaveBeenCalledWith({ source: 'FieldTestMobile', detail: 'PANIC' });
  });

  it('contract: each command hits gateway + engine exactly once (no double-dispatch)', () => {
    const { result } = renderHook(() => useFieldTestSession());
    act(() => result.current.toggleArm('s'));
    act(() => result.current.toggleArm('s')); // disarm
    act(() => result.current.panic('s'));

    expect(gatewayMock.arm).toHaveBeenCalledTimes(1);
    expect(gatewayMock.disarm).toHaveBeenCalledTimes(1);
    expect(gatewayMock.eStop).toHaveBeenCalledTimes(1);
    expect(engineMock.arm).toHaveBeenCalledTimes(1);
    expect(engineMock.disarm).toHaveBeenCalledTimes(1);
    expect(engineMock.eStop).toHaveBeenCalledTimes(1);
  });
});
