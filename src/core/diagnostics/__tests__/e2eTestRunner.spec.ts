import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runE2ETest } from '../e2eTestRunner';
import type { FireOneFleetState } from '@/features/fieldbus/useFireOneFleet';

vi.mock('@/core/discovery/DeviceAggregator', () => ({
  deviceAggregator: {
    getDevices: () => [{ aggregateId: 'agg-1', family: 'fxk16', lastSeen: Date.now() }],
  },
}));
vi.mock('@/core/safety/safetyBlackBox', () => ({
  recordSafetyNote: vi.fn(async () => undefined),
}));

const armCalls: number[] = [];
const fireCalls: any[] = [];
vi.mock('@/core/command/uiCommandGateway', () => ({
  uiCommandGateway: {
    arm: vi.fn(() => { armCalls.push(Date.now()); }),
    disarm: vi.fn(),
    continuityCheck: vi.fn(),
    fire: vi.fn((_src, payload) => { fireCalls.push(payload); }),
  },
}));

function makeFleet(modules: Record<number, any>): FireOneFleetState {
  return {
    link: 'connected',
    mode: 'cable',
    cable: { state: 'connected', txBytes: 0, rxBytes: 0, lastReplyAt: Date.now() },
    radio: { state: 'disconnected', txBytes: 0, rxBytes: 0, lastReplyAt: null },
    modules,
    lastIdentifyAt: Date.now(),
    identifyCount: 1,
    txBytes: 0,
    rxBytes: 0,
    latencyMs: 0,
  } as FireOneFleetState;
}

const baseModule = (addr: number, armed = false) => ({
  moduleAddress: addr,
  armed,
  batteryVoltage: 12.4,
  temperature: 25,
  signalStrength: 80,
  firmwareVersion: '1.0',
  igniters: [{ position: 1, connected: true, fired: false, resistance: 1.5 }],
  lastSeen: Date.now(),
  wireless: false,
  errors: [],
  connectionMode: 'wired',
});

beforeEach(() => { armCalls.length = 0; fireCalls.length = 0; });

describe('runE2ETest', () => {
  it('passa pela sequência completa em modo dry-run', async () => {
    let armed = false;
    const getFleet = (): FireOneFleetState => makeFleet({
      1: { ...baseModule(1, armed), lastSeen: Date.now() },
    });
    // Simula ARM real após 200ms.
    setTimeout(() => { armed = true; }, 200);

    const res = await runE2ETest({ getFleet }, { stepTimeoutMs: 1500 });
    expect(res.steps.some((s) => s.kind === 'discovery' && s.status === 'pass')).toBe(true);
    expect(res.steps.some((s) => s.kind === 'routing' && s.status === 'pass')).toBe(true);
    expect(res.steps.some((s) => s.kind === 'fire-dry' && s.status === 'pass')).toBe(true);
    expect(fireCalls.length).toBe(0); // dry-run nunca chama uiCommandGateway.fire
  });

  it('falha rota quando fleet não tem cabo nem rádio conectado', async () => {
    const getFleet = (): FireOneFleetState => ({
      ...makeFleet({ 5: { ...baseModule(5), connectionMode: undefined as any } }),
      cable: { state: 'disconnected', txBytes: 0, rxBytes: 0, lastReplyAt: null },
      radio: { state: 'disconnected', txBytes: 0, rxBytes: 0, lastReplyAt: null },
    } as FireOneFleetState);
    const res = await runE2ETest({ getFleet }, { stepTimeoutMs: 500 });
    expect(res.ok).toBe(false);
    expect(res.steps.find((s) => s.kind === 'routing')?.status).toBe('fail');
  });

  it('marca timeout em ARM quando módulo nunca confirma', async () => {
    const getFleet = (): FireOneFleetState => makeFleet({
      9: baseModule(9, false), // nunca arma
    });
    const res = await runE2ETest({ getFleet }, { stepTimeoutMs: 300 });
    expect(res.steps.some((s) => s.kind === 'arm' && s.status === 'timeout')).toBe(true);
  });
});
