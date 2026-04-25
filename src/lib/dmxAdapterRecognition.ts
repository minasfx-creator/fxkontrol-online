/**
 * USB DMX adapter recognition.
 *
 * WebSerial does not expose VID/PID consistently across platforms, so the
 * `USBDeviceProfile.label` chosen by the user when authorizing the port is
 * the source of truth ("Honest Hardware Layer": never infer hardware that
 * the browser did not authorize).
 */
import type { USBDeviceProfile } from './usbEngine';

export type DMXAdapterKind =
  | 'enttec-pro'
  | 'enttec-open'
  | 'dmxking'
  | 'eurolite'
  | 'generic-dmx'
  | 'non-dmx';

export interface DMXAdapterInfo {
  kind: DMXAdapterKind;
  label: string;
  badgeClass: string;
  protocol: 'ENTTEC Widget' | 'DMX512 Direto' | '—';
  rdmCapable: boolean;
  /** True when the label maps to a known DMX adapter family (not a generic FTDI guess). */
  recognized: boolean;
  /**
   * True when the adapter family is unknown (generic FTDI/CH340/CP210x) and
   * therefore needs explicit operator confirmation before transmitting DMX.
   */
  requiresOperatorConfirmation: boolean;
}

export function detectDMXAdapter(profile: USBDeviceProfile): DMXAdapterInfo {
  if (profile.type !== 'dmx') {
    return {
      kind: 'non-dmx',
      label: 'Não é DMX',
      badgeClass: 'bg-muted text-muted-foreground',
      protocol: '—',
      rdmCapable: false,
      recognized: false,
    };
  }
  const label = profile.label.toLowerCase();
  if (label.includes('enttec') && label.includes('pro')) {
    return {
      kind: 'enttec-pro',
      label: 'ENTTEC DMX USB Pro',
      badgeClass: 'bg-green-500/20 text-green-400 border border-green-500/40',
      protocol: 'ENTTEC Widget',
      rdmCapable: true,
      recognized: true,
    };
  }
  if (label.includes('enttec') || label.includes('open dmx')) {
    return {
      kind: 'enttec-open',
      label: 'ENTTEC Open DMX',
      badgeClass: 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40',
      protocol: 'DMX512 Direto',
      rdmCapable: false,
      recognized: true,
    };
  }
  if (label.includes('dmxking') || label.includes('ultradmx')) {
    return {
      kind: 'dmxking',
      label: 'DMXking ultraDMX',
      badgeClass: 'bg-green-500/20 text-green-400 border border-green-500/40',
      protocol: 'ENTTEC Widget',
      rdmCapable: true,
      recognized: true,
    };
  }
  if (label.includes('eurolite')) {
    return {
      kind: 'eurolite',
      label: 'Eurolite USB-DMX512',
      badgeClass: 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40',
      protocol: 'DMX512 Direto',
      rdmCapable: false,
      recognized: true,
    };
  }
  return {
    kind: 'generic-dmx',
    label: 'DMX Genérico (FTDI/CH340)',
    badgeClass: 'bg-amber-500/20 text-amber-400 border border-amber-500/40',
    protocol: 'DMX512 Direto',
    rdmCapable: false,
    recognized: false,
  };
}
