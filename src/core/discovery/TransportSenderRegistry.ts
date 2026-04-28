/**
 * ─── Transport Sender Registry ─────────────────────────────────────
 * Per-transport `send` function lookup. Real adapters (Web Serial,
 * WebUSB, BLE, Art-Net UDP/TCP) register their actual send routine
 * here once initialized; until then a SAFE STUB is used.
 *
 * The stub:
 *   • resolves successfully ONLY when `dev_hardware_simulator` is ON;
 *   • throws `NO_REAL_SENDER:<transport>` when the simulator is OFF —
 *     so the multi-transport coordinator records the attempt as `txErr`
 *     instead of silently faking a real transmission.
 *
 * This keeps the honest-hardware contract intact: no synthetic
 * "success" can leak into operational paths without an explicit
 * simulator opt-in.
 */

import type { DiscoveryTransport, PhysicalDevice, TransportPayload } from './types';
import { isHardwareSimulatorEnabled } from '@/lib/featureFlags';
import { logger } from '@/lib/logger';

export type TransportSendFn = (
  device: PhysicalDevice,
  payload: TransportPayload,
) => Promise<void>;

class TransportSenderRegistry {
  private _senders = new Map<DiscoveryTransport, TransportSendFn>();

  registerSender(transport: DiscoveryTransport, fn: TransportSendFn): void {
    this._senders.set(transport, fn);
    logger.info('[TransportSenderRegistry] real sender registered:', transport);
  }

  unregister(transport: DiscoveryTransport): void {
    this._senders.delete(transport);
  }

  hasReal(transport: DiscoveryTransport): boolean {
    return this._senders.has(transport);
  }

  /** Returns the registered real sender or a safe stub. */
  getSender(transport: DiscoveryTransport): TransportSendFn {
    const real = this._senders.get(transport);
    if (real) return real;
    return makeStubSender(transport);
  }

  listRegistered(): DiscoveryTransport[] {
    return [...this._senders.keys()];
  }
}

function makeStubSender(transport: DiscoveryTransport): TransportSendFn {
  return async (_device, _payload) => {
    if (!isHardwareSimulatorEnabled()) {
      throw new Error(`NO_REAL_SENDER:${transport}`);
    }
    // Simulator ON: emulate latency between 5–25ms.
    const jitter = 5 + Math.random() * 20;
    await new Promise((res) => setTimeout(res, jitter));
  };
}

export const transportSenderRegistry = new TransportSenderRegistry();
