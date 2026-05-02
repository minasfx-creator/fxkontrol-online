/**
 * ─── Adapter Triage Catalog (Phase 0) ────────────────────────────────
 *
 * Static, deterministic triage of every adapter registered in
 * `unifiedHardwareRegistry`. Classifies each adapter as:
 *
 *   A · NOT_INTEGRATED_EXPECTED
 *       Honest "not integrated" — no hardware physically present.
 *       UI must display it under "Not integrated (expected)" and never
 *       count it as an error.
 *
 *   B · AWAITING_HANDSHAKE
 *       Hardware is expected to be reachable via a known transport but
 *       has not completed handshake yet. Has a concrete pairing route.
 *
 *   C · ADAPTER_ISSUE
 *       Code-level bug or missing implementation. Needs an engineer.
 *
 * The triage is the source of truth for the readiness audit grouping
 * and the deployment-plan reporting. It does NOT change adapter
 * behavior — it only describes intent.
 *
 * ZERO synthetic data. Honest-Hardware-Layer compliant.
 */

import type { unifiedHardwareRegistry } from './UnifiedHardwareRegistry';

export type TriageClass =
  | 'NOT_INTEGRATED_EXPECTED'
  | 'AWAITING_HANDSHAKE'
  | 'ADAPTER_ISSUE';

export interface AdapterTriageEntry {
  /** Adapter `deviceId` registered in `unifiedHardwareRegistry`. */
  id: string;
  /** Triage classification — see TriageClass docs. */
  class: TriageClass;
  /** Canonical transport for this device family. */
  transport:
    | 'serial_usb'
    | 'ble'
    | 'ethernet_udp'
    | 'analog_mux'
    | 'spi'
    | 'logical';
  /** Short human-readable rationale displayed in the UI. */
  rationale: string;
  /** Concrete next action — wizard route, doc, or "no action". */
  nextAction:
    | { kind: 'route'; path: string; label: string }
    | { kind: 'doc'; path: string; label: string }
    | { kind: 'none'; label: string };
  /**
   * `true` if the adapter is required for the system to leave
   * READY_FOR_SIMULATION. False = optional; missing it is not a blocker.
   */
  requiredForSync: boolean;
}

/**
 * Triage table — keep alphabetized by `id`.
 * Update whenever a new adapter is registered or a route changes.
 */
export const ADAPTER_TRIAGE: ReadonlyArray<AdapterTriageEntry> = [
  {
    id: 'arduino-nano-01',
    class: 'NOT_INTEGRATED_EXPECTED',
    transport: 'serial_usb',
    rationale:
      'Controlador legado opcional. Substituído na prática pelo FXK16 (ESP32-S3). Mantido como adapter para diagnóstico de bancadas antigas.',
    nextAction: { kind: 'none', label: 'Sem ação — opcional' },
    requiredForSync: false,
  },
  {
    id: 'artnet-node-01',
    class: 'AWAITING_HANDSHAKE',
    transport: 'ethernet_udp',
    rationale:
      'Art-Net 4/5 node descoberto via ArtPoll. Aguarda primeiro pacote ArtPollReply válido para marcar handshake.',
    nextAction: {
      kind: 'route',
      path: '/dev/real-discovery',
      label: 'Probar discovery real',
    },
    requiredForSync: false,
  },
  {
    id: 'battery-12v',
    class: 'AWAITING_HANDSHAKE',
    transport: 'serial_usb',
    rationale:
      'Telemetria de bateria 12V vem do mesmo módulo do Mux/ShiftRegister. Aparecerá online assim que o controlador físico fizer handshake.',
    nextAction: {
      kind: 'route',
      path: '/pairing/usb',
      label: 'Parear via USB',
    },
    requiredForSync: true,
  },
  {
    id: 'dmx-universe-1',
    class: 'AWAITING_HANDSHAKE',
    transport: 'serial_usb',
    rationale:
      'Interface USB-DMX (e.g., Enttec, USBDMX). Aguarda autorização Web Serial / WebUSB e identificação do firmware.',
    nextAction: {
      kind: 'route',
      path: '/pairing/usb',
      label: 'Parear interface DMX',
    },
    requiredForSync: false,
  },
  {
    id: 'fireone-profile',
    class: 'NOT_INTEGRATED_EXPECTED',
    transport: 'logical',
    rationale:
      'Perfil lógico de export FireOne — não é hardware. Ativa-se ao gerar export; não precisa de handshake.',
    nextAction: { kind: 'none', label: 'Sem ação — perfil de export' },
    requiredForSync: false,
  },
  {
    id: 'fxk16-esp32s3',
    class: 'AWAITING_HANDSHAKE',
    transport: 'serial_usb',
    rationale:
      'Módulo de referência para Fase 0. Espera linha "MODEL:FXK16;CH:16" via Web Serial @115200 ou BLE FFE0/FFE1/FFE2.',
    nextAction: {
      kind: 'route',
      path: '/pairing/usb',
      label: 'Parear FXK16 via USB',
    },
    requiredForSync: true,
  },
  {
    id: 'mux-cd4051-dual',
    class: 'AWAITING_HANDSHAKE',
    transport: 'analog_mux',
    rationale:
      'Multiplexador analógico de 8 canais para leitura de continuidade. Telemetria piggy-back no controlador FXK16/Arduino.',
    nextAction: {
      kind: 'route',
      path: '/pairing/usb',
      label: 'Parear controlador host',
    },
    requiredForSync: false,
  },
  {
    id: 'relay-bank-32ch',
    class: 'NOT_INTEGRATED_EXPECTED',
    transport: 'spi',
    rationale:
      'Banco de relés 32ch opcional para expansão. Substituível por dois FXK16 em linkMode=dual.',
    nextAction: { kind: 'none', label: 'Sem ação — expansão futura' },
    requiredForSync: false,
  },
  {
    id: 'sr-74hc595-chain',
    class: 'AWAITING_HANDSHAKE',
    transport: 'spi',
    rationale:
      'Shift register 74HC595 cascateado. Estado é reportado pelo controlador host; vem online junto com FXK16/Arduino.',
    nextAction: {
      kind: 'route',
      path: '/pairing/usb',
      label: 'Parear controlador host',
    },
    requiredForSync: false,
  },
];

/** Lookup helper. Returns `undefined` if id not in triage table. */
export function getTriageEntry(
  id: string,
): AdapterTriageEntry | undefined {
  return ADAPTER_TRIAGE.find((t) => t.id === id);
}

/** Group helper for UI rendering. */
export function groupTriageByClass(): Record<TriageClass, AdapterTriageEntry[]> {
  const out: Record<TriageClass, AdapterTriageEntry[]> = {
    NOT_INTEGRATED_EXPECTED: [],
    AWAITING_HANDSHAKE: [],
    ADAPTER_ISSUE: [],
  };
  for (const e of ADAPTER_TRIAGE) out[e.class].push(e);
  return out;
}

/**
 * Phase 0 exit criterion check.
 *
 * Returns the list of `requiredForSync` adapters that are still
 * `not_integrated` according to the live registry. Empty array means
 * Phase 0 hardware-pairing goal is met.
 *
 * Pure function — pass the registry as argument so it stays testable.
 */
export function pendingRequiredAdapters(
  registry: typeof unifiedHardwareRegistry,
): AdapterTriageEntry[] {
  const provenances = registry.getAllProvenances();
  return ADAPTER_TRIAGE.filter((entry) => {
    if (!entry.requiredForSync) return false;
    const prov = provenances.get(entry.id);
    if (!prov) return true;
    return prov.integration_mode === 'not_integrated';
  });
}
