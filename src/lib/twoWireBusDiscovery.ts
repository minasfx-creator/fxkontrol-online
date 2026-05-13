/**
 * twoWireBusDiscovery — sweep IDENTIFY across the 2-Wire CDS bus and
 * aggregate honest module presence. Absence of a reply is `unknown`,
 * never synthesised.
 *
 * Pure orchestration: relies on `TwoWireTransport.send` + `onFrame`. No
 * direct SafetyStateMachine / FieldBus interaction.
 */

import type { TwoWireTransport } from './twoWireTransport';
import { TwoWireOpcode } from './twoWireProtocol';

export interface TwoWireDiscoveredModule {
  addr: number;
  status: 'live' | 'unseen' | 'collision';
  fwVersion?: string;
  deviceType?: string;
  lastSeenTs?: number;
}

export interface ScanBusOptions {
  addrs?: number[];
  /** Per-address window before declaring `unseen`. */
  timeoutPerAddrMs?: number;
  /** Inter-address spacing — keeps the bus from saturating. */
  spacingMs?: number;
  signal?: AbortSignal;
}

export interface ScanBusResult {
  modules: TwoWireDiscoveredModule[];
  startedAt: number;
  finishedAt: number;
  durationMs: number;
}

const DEFAULT_ADDRS = Array.from({ length: 32 }, (_, i) => i + 1);
const DEFAULT_TIMEOUT_MS = 80;
const DEFAULT_SPACING_MS = 4;

function decodeIdentifyPayload(payload: Uint8Array): { fwVersion?: string; deviceType?: string } {
  // Honest layer: payload format is firmware-defined (see docs/reference/two-wire-cds-protocol.md).
  // We surface raw bytes when no parser is plumbed in yet.
  if (payload.length === 0) return {};
  // Convention: [deviceType u8][fwMajor u8][fwMinor u8][fwPatch u8?]
  const deviceTypeByte = payload[0];
  const major = payload[1] ?? 0;
  const minor = payload[2] ?? 0;
  const patch = payload[3] ?? 0;
  return {
    deviceType: `0x${deviceTypeByte.toString(16).padStart(2, '0')}`,
    fwVersion: `${major}.${minor}.${patch}`,
  };
}

export async function scanBus(
  transport: Pick<TwoWireTransport, 'send' | 'onFrame'>,
  opts: ScanBusOptions = {},
): Promise<ScanBusResult> {
  const addrs = opts.addrs ?? DEFAULT_ADDRS;
  const timeoutMs = opts.timeoutPerAddrMs ?? DEFAULT_TIMEOUT_MS;
  const spacingMs = opts.spacingMs ?? DEFAULT_SPACING_MS;
  const startedAt = Date.now();

  // Per-addr promise resolver
  const pending = new Map<number, (m: TwoWireDiscoveredModule) => void>();
  const detach = transport.onFrame(({ addr, opcode, payload }) => {
    if (opcode !== TwoWireOpcode.IDENTIFY && opcode !== TwoWireOpcode.STATUS) return;
    const cb = pending.get(addr);
    if (!cb) return;
    const meta = decodeIdentifyPayload(payload);
    cb({ addr, status: 'live', lastSeenTs: Date.now(), ...meta });
  });

  try {
    const results: TwoWireDiscoveredModule[] = [];
    for (const addr of addrs) {
      if (opts.signal?.aborted) break;
      const settled = new Promise<TwoWireDiscoveredModule>((resolve) => {
        pending.set(addr, (m) => { pending.delete(addr); resolve(m); });
        setTimeout(() => {
          if (pending.has(addr)) {
            pending.delete(addr);
            resolve({ addr, status: 'unseen' });
          }
        }, timeoutMs);
      });
      try {
        await transport.send({ type: 'IDENTIFY', addr });
      } catch {
        pending.delete(addr);
        results.push({ addr, status: 'unseen' });
        continue;
      }
      const m = await settled;
      results.push(m);
      if (spacingMs > 0) await new Promise((r) => setTimeout(r, spacingMs));
    }
    const finishedAt = Date.now();
    return { modules: results, startedAt, finishedAt, durationMs: finishedAt - startedAt };
  } finally {
    detach();
  }
}
