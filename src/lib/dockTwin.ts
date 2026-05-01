/**
 * DockTwin — Physical/Digital Twin (Pilot)
 * ------------------------------------------------------------------
 * Models the operator station as a digital twin. The twin can be
 * inspected, validated and reported on in *bench* mode without ever
 * issuing real-world commands. Real operations remain gated by the
 * existing Safety State Machine + UI Command Gateway.
 *
 * CLAIM: pilot
 *   - DockTwin is a pilot product. Bench evidence and companion
 *     telemetry are still in validation. Always ship with disclaimer.
 */

export type DockMode =
  /** Diagnose peripherals; no commands flow to the field. */
  | 'serviceability'
  /** Bench/dummy load testing. Outputs visible, no live ignition. */
  | 'bench'
  /** Field-ready. Requires evidence + rollback validated upstream. */
  | 'field-readiness';

export type PeripheralType =
  | 'power'
  | 'comm-radio'
  | 'comm-ble'
  | 'comm-usb'
  | 'dmx-out'
  | 'artnet-out'
  | 'telemetry'
  | 'sensor-env'
  | 'dummy-load';

export type Health = 'ok' | 'degraded' | 'fault' | 'unknown';

export interface DockPeripheral {
  id: string;
  type: PeripheralType;
  label: string;
  version: string;
  health: Health;
  /** ms since epoch; null = never */
  lastSeen: number | null;
  replaceable: boolean;
  evidenceRequired: boolean;
  notes?: string;
}

export interface DockTwinProfile {
  id: string;
  model: string;
  firmware: string;
  /** logical ports advertised by the dock */
  ports: string[];
  /** transports the dock relays for the operator */
  transports: Array<'usb' | 'ble' | 'artnet' | '433mhz' | 'starlink'>;
  peripherals: DockPeripheral[];
  /** physical limits (e.g. max channels, max sustained current) */
  limits: { maxChannels: number; maxSustainedAmps: number; ipRating: string };
  battery: { percent: number; voltage: number; charging: boolean };
  mode: DockMode;
}

export interface DockReadinessReport {
  twinId: string;
  generatedAt: string;
  mode: DockMode;
  /** GO requires: battery≥40%, all evidenceRequired peripherals ok, firmware non-empty */
  decision: 'GO' | 'NO_GO';
  reasons: string[];
  peripheralsOk: number;
  peripheralsTotal: number;
}

const SEED_PERIPHERALS: DockPeripheral[] = [
  {
    id: 'pwr-1',
    type: 'power',
    label: 'Main 18V LiFePO₄',
    version: 'rev-B',
    health: 'ok',
    lastSeen: Date.now(),
    replaceable: true,
    evidenceRequired: true,
  },
  {
    id: 'comm-usb-1',
    type: 'comm-usb',
    label: 'USB-C uplink',
    version: 'v1',
    health: 'ok',
    lastSeen: Date.now(),
    replaceable: false,
    evidenceRequired: false,
  },
  {
    id: 'comm-ble-1',
    type: 'comm-ble',
    label: 'BLE 5.0 mesh',
    version: 'v1.2',
    health: 'ok',
    lastSeen: Date.now(),
    replaceable: true,
    evidenceRequired: false,
  },
  {
    id: 'dmx-1',
    type: 'dmx-out',
    label: 'DMX-A (XLR-5)',
    version: 'v1',
    health: 'unknown',
    lastSeen: null,
    replaceable: true,
    evidenceRequired: true,
    notes: 'Connect dummy load to validate continuity.',
  },
  {
    id: 'artnet-1',
    type: 'artnet-out',
    label: 'Art-Net RJ-45',
    version: 'v1',
    health: 'ok',
    lastSeen: Date.now() - 12_000,
    replaceable: false,
    evidenceRequired: false,
  },
  {
    id: 'tlm-1',
    type: 'telemetry',
    label: 'Companion telemetry',
    version: 'pilot-0.1',
    health: 'degraded',
    lastSeen: Date.now() - 45_000,
    replaceable: false,
    evidenceRequired: false,
    notes: 'Pilot stream — milestone day 36–60.',
  },
  {
    id: 'sens-env-1',
    type: 'sensor-env',
    label: 'Env sensor (temp/RH/baro)',
    version: 'v1',
    health: 'ok',
    lastSeen: Date.now() - 3_000,
    replaceable: true,
    evidenceRequired: false,
  },
  {
    id: 'dummy-1',
    type: 'dummy-load',
    label: 'Dummy load harness',
    version: 'v1',
    health: 'ok',
    lastSeen: Date.now(),
    replaceable: true,
    evidenceRequired: true,
    notes: 'Required for bench-mode FIRE simulation.',
  },
];

export function createSeedTwin(): DockTwinProfile {
  return {
    id: 'docktwin-pilot-001',
    model: 'FXK DockTwin Pilot',
    firmware: '0.4.2-pilot',
    ports: ['USB-C', 'XLR-5 ×2', 'RJ-45', 'GX12 power', 'SMA-radio'],
    transports: ['usb', 'ble', 'artnet'],
    peripherals: SEED_PERIPHERALS,
    limits: { maxChannels: 16, maxSustainedAmps: 12, ipRating: 'IP54' },
    battery: { percent: 87, voltage: 18.2, charging: false },
    mode: 'bench',
  };
}

export function evaluateReadiness(twin: DockTwinProfile): DockReadinessReport {
  const reasons: string[] = [];
  const required = twin.peripherals.filter((p) => p.evidenceRequired);
  const requiredOk = required.filter((p) => p.health === 'ok');
  const peripheralsOk = twin.peripherals.filter((p) => p.health === 'ok').length;

  if (twin.mode === 'serviceability') {
    reasons.push('Mode = serviceability: no field commands allowed.');
  }
  if (twin.battery.percent < 40) {
    reasons.push(`Battery ${twin.battery.percent}% < 40% threshold.`);
  }
  if (!twin.firmware) {
    reasons.push('Firmware string is empty.');
  }
  for (const p of required) {
    if (p.health !== 'ok') {
      reasons.push(`Required peripheral "${p.label}" is ${p.health}.`);
    }
  }
  if (twin.mode === 'field-readiness' && requiredOk.length < required.length) {
    reasons.push('Field-readiness requires every evidenceRequired peripheral to be ok.');
  }

  const decision: 'GO' | 'NO_GO' =
    twin.mode === 'field-readiness' && reasons.length === 0 ? 'GO' : 'NO_GO';

  if (decision === 'NO_GO' && reasons.length === 0) {
    reasons.push('Twin is not in field-readiness mode.');
  }

  return {
    twinId: twin.id,
    generatedAt: new Date().toISOString(),
    mode: twin.mode,
    decision,
    reasons,
    peripheralsOk,
    peripheralsTotal: twin.peripherals.length,
  };
}

export function setMode(twin: DockTwinProfile, mode: DockMode): DockTwinProfile {
  return { ...twin, mode };
}

export function togglePeripheralHealth(
  twin: DockTwinProfile,
  peripheralId: string,
  next: Health,
): DockTwinProfile {
  return {
    ...twin,
    peripherals: twin.peripherals.map((p) =>
      p.id === peripheralId ? { ...p, health: next, lastSeen: Date.now() } : p,
    ),
  };
}
