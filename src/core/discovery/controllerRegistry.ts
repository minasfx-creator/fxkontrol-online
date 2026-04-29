/**
 * ─── Controller Registry — family → controller kind mapping ────────
 * Pure data. Maps the `family` string emitted by transport discoverers
 * (WebSerial / WebUSB / WebBLE / mDNS-ArtNet) to a logical controller
 * kind that the UI knows how to "open" (FXK16 console, FireOne console,
 * Tuya, etc.).
 *
 * Honest-hardware policy: we never invent controllers. If a device has
 * `family: 'unknown'` it stays as `kind: 'unknown'` and the auto-launcher
 * does not pop a panel — the operator must classify it manually via the
 * pairing wizard.
 */
import type { PhysicalDevice, DiscoveryTransport } from './types';

export type ControllerKind =
  | 'fxk16'        // FXK16 16-ch ESP32-S3 pyro relay (USB-CDC or BLE-UART)
  | 'fireone'      // FireOne FXK-PYRO 2.0 array
  | 'showven'      // Showven FX Commander Pro / Sonicboom / SPARKULAR
  | 'tuya'         // Tuya BLE-mesh / Wi-Fi smart outlets (low-precision SFX)
  | 'cubemesh'     // CubeMesh RE168 mesh outlets
  | 'enttec'       // ENTTEC DMX USB Pro / Open DMX
  | 'dmx-generic'  // FTDI / CH340 / CP210x — generic DMX adapter
  | 'artnet-node'  // mDNS-discovered Art-Net node
  | 'unknown';     // unrecognised — operator must classify

export interface ControllerProfile {
  kind: ControllerKind;
  /** Human label shown in the auto-launcher card. */
  label: string;
  /** Capabilities the controller exposes once opened. */
  capabilities: {
    arm: boolean;
    fire: boolean;
    eStop: boolean;
    /** True when the controller is safety-critical (pyro). Forces ARM gate. */
    safetyCritical: boolean;
  };
  /** Deep-link to the dedicated console route, when one exists. */
  consoleRoute?: string;
}

const PROFILES: Record<ControllerKind, ControllerProfile> = {
  fxk16: {
    kind: 'fxk16',
    label: 'FXK16 Pyro Controller',
    capabilities: { arm: true, fire: true, eStop: true, safetyCritical: true },
    consoleRoute: '/studio?panel=pyro-fireone',
  },
  fireone: {
    kind: 'fireone',
    label: 'FireOne FXK-PYRO 2.0',
    capabilities: { arm: true, fire: true, eStop: true, safetyCritical: true },
    consoleRoute: '/studio?panel=pyro-fireone',
  },
  showven: {
    kind: 'showven',
    label: 'Showven FX Commander',
    capabilities: { arm: true, fire: true, eStop: true, safetyCritical: true },
    consoleRoute: '/studio?panel=showven',
  },
  tuya: {
    kind: 'tuya',
    label: 'Tuya Smart Outlet',
    capabilities: { arm: false, fire: true, eStop: true, safetyCritical: false },
    consoleRoute: '/studio?panel=tuya',
  },
  cubemesh: {
    kind: 'cubemesh',
    label: 'CubeMesh RE168',
    capabilities: { arm: false, fire: true, eStop: true, safetyCritical: false },
    consoleRoute: '/studio?panel=cubemesh',
  },
  enttec: {
    kind: 'enttec',
    label: 'ENTTEC DMX',
    capabilities: { arm: false, fire: false, eStop: true, safetyCritical: false },
    consoleRoute: '/studio?panel=dmx',
  },
  'dmx-generic': {
    kind: 'dmx-generic',
    label: 'Generic DMX Adapter',
    capabilities: { arm: false, fire: false, eStop: true, safetyCritical: false },
    consoleRoute: '/studio?panel=dmx',
  },
  'artnet-node': {
    kind: 'artnet-node',
    label: 'Art-Net Node',
    capabilities: { arm: false, fire: false, eStop: true, safetyCritical: false },
    consoleRoute: '/studio?panel=dmx',
  },
  unknown: {
    kind: 'unknown',
    label: 'Unknown device',
    capabilities: { arm: false, fire: false, eStop: false, safetyCritical: false },
  },
};

/** Family-string → ControllerKind. Match by lower-cased substring. */
const FAMILY_RULES: Array<{ test: RegExp; kind: ControllerKind }> = [
  { test: /fxk[\s-]*16|fxkpyro/i,           kind: 'fxk16' },
  { test: /fireone|fxk[\s-]*pyro/i,          kind: 'fireone' },
  { test: /showven|sonicboom|sparkular|fx[\s-]*commander|pyromote/i, kind: 'showven' },
  { test: /tuya/i,                           kind: 'tuya' },
  { test: /cubemesh|re168/i,                 kind: 'cubemesh' },
  { test: /enttec/i,                         kind: 'enttec' },
  { test: /ftdi|wch|ch340|silabs|cp210/i,    kind: 'dmx-generic' },
];

/** Resolve a `PhysicalDevice` to its controller profile. */
export function resolveControllerProfile(dev: PhysicalDevice): ControllerProfile {
  // mDNS Art-Net nodes always map to Art-Net regardless of family text.
  if (dev.activeTransport === 'mdns-artnet' || dev.links['mdns-artnet']) {
    return PROFILES['artnet-node'];
  }
  // Pick the first link's family — they should all agree post-aggregation.
  const link = Object.values(dev.links).find(Boolean);
  const family = (link?.family ?? '').toLowerCase();
  const label = (dev.label ?? '').toLowerCase();
  const haystack = `${family} ${label}`;

  for (const rule of FAMILY_RULES) {
    if (rule.test.test(haystack)) return PROFILES[rule.kind];
  }
  return PROFILES.unknown;
}

export function getProfile(kind: ControllerKind): ControllerProfile {
  return PROFILES[kind];
}

/** True when the device is recognized AND maps to a known controller. */
export function isAutoOpenable(dev: PhysicalDevice): boolean {
  if (!dev.online) return false;
  const profile = resolveControllerProfile(dev);
  return profile.kind !== 'unknown';
}

/** Diagnostic — list every known kind (for UI debugging). */
export function listKnownKinds(): ControllerKind[] {
  return Object.keys(PROFILES) as ControllerKind[];
}

export type { DiscoveryTransport };
