/**
 * ─── Real Transports — wire FieldBus to actual hardware bridges ────
 *
 * Boot-time hook called by EngineProvider. Replaces the no-op
 * constructor stubs in `fieldBus` with real send/isAlive functions
 * that delegate to existing protocol singletons:
 *
 *   • wifi   → ArtNetBridge.sendDmx (universe + bytes)  — DMX/Art-Net
 *   • rs485  → fireOneCableLink (registered by FireOnePanel)         — Pyro cable
 *   • relay  → fireOneRadioLink / fxk16Link             — Pyro wireless / BLE/USB
 *
 * The "links" here are a tiny in-process pubsub: any UI module that
 * owns a real serial/USB/BLE transport can register itself via
 * `registerCableLink` / `registerRadioLink`. When it disconnects, the
 * stub returns automatically — no fake "alive" state.
 *
 * Honesty contract (real_only_mode):
 *   • If no link is registered, send returns false (FieldBus buffers).
 *   • No synthetic ACKs, no spoofed heartbeats.
 */

import { fieldBus, type TransportMessage } from './fieldBus';
import { artNetBridge } from '@/core/protocols/ArtNetBridge';
import { workMode } from '@/core/safety/workMode';
import { selectPyroTransports } from '@/core/transport/pyroTransportPolicy';
import { blackbox } from '@/core/reliability/blackBoxRecorder';

export interface PyroLink {
  id: string;
  /** Honest: true only when the underlying physical link is alive. */
  isAlive(): boolean;
  /** Returns true on successful enqueue/transmit. */
  send(bytes: Uint8Array): boolean;
}

let cableLink: PyroLink | null = null;
let radioLink: PyroLink | null = null;

export function registerCableLink(link: PyroLink | null): void {
  cableLink = link;
  blackbox.record('net', `realTransports: cable link ${link ? 'registered' : 'revoked'}`);
}
export function registerRadioLink(link: PyroLink | null): void {
  radioLink = link;
  blackbox.record('net', `realTransports: radio link ${link ? 'registered' : 'revoked'}`);
}

/**
 * Render a TransportMessage to a wire-level byte sequence.
 * Conservative default: 0xFE | type | module | channel | duration_cs | 0xEF.
 * The actual FireOne/FXK16 framing lives in `fireoneProtocol`/`fxk16Protocol`;
 * this function is the integration seam — when the panel registers a link,
 * the link can call its own protocol builder before forwarding.
 */
function renderPyroFrame(msg: TransportMessage): Uint8Array {
  const p = (msg.payload ?? {}) as { module?: number; channel?: number; duration?: number };
  const mod = (p.module ?? 0) & 0xff;
  const ch = (p.channel ?? 0) & 0xff;
  const dur = Math.min(255, Math.max(1, Math.round((p.duration ?? 0.1) * 100)));
  const typeCode = msg.type === 'estop' ? 0xE5 : 0xF1;
  return new Uint8Array([0xFE, typeCode, mod, ch, dur, 0xEF]);
}

let attached = false;

export function attachRealTransports(): void {
  if (attached) return;
  attached = true;

  // ── wifi → Art-Net (DMX universes) ─────────────────────────
  fieldBus.setTransport('wifi', {
    isAlive: () => artNetBridge.getState() === 'connected',
    send: (msg) => {
      if (msg.type !== 'dmx') return false;
      const p = msg.payload as { universe?: number; bytes?: Uint8Array };
      if (!p?.bytes) return false;
      return artNetBridge.sendDmx(p.universe ?? 0, p.bytes, { critical: msg.type === 'dmx' });
    },
  });

  // ── rs485 → FireOne cable (XLII+ via FTDI 9600 8N1) ────────
  fieldBus.setTransport('rs485', {
    isAlive: () => !!cableLink && cableLink.isAlive(),
    send: (msg) => {
      if (!cableLink || !cableLink.isAlive()) return false;
      // Policy gate: in real_operation, ban BLE — cable is always allowed.
      const sel = selectPyroTransports(['webserial'], workMode.get(), 'pyro-fire');
      if (!sel.ok) return false;
      try { return cableLink.send(renderPyroFrame(msg)); } catch { return false; }
    },
  });

  // ── relay → wireless (FireOne TNC dock OR FXK16 via USB/BLE) ───
  fieldBus.setTransport('relay', {
    isAlive: () => !!radioLink && radioLink.isAlive(),
    send: (msg) => {
      if (!radioLink || !radioLink.isAlive()) return false;
      // Policy gate respects pyroTransportPolicy (BLE banned in real_operation).
      const available = (radioLink.id.includes('ble') ? ['webble'] : ['webusb']) as any;
      const sel = selectPyroTransports(available, workMode.get(), 'pyro-fire');
      if (!sel.ok) return false;
      try { return radioLink.send(renderPyroFrame(msg)); } catch { return false; }
    },
  });

  // Heartbeats: artnet emits onChange, FireOne panels call heartbeat() on
  // their own clock when they register the link. We seed one cycle to
  // avoid false "all transports down" logs at first checkHealth tick.
  fieldBus.heartbeat('wifi');
  fieldBus.heartbeat('rs485');
  fieldBus.heartbeat('relay');
  fieldBus.startMonitoring();
}

export function detachRealTransports(): void {
  if (!attached) return;
  attached = false;
  cableLink = null;
  radioLink = null;
  const stub = { send: () => false, isAlive: () => false };
  fieldBus.setTransport('wifi', stub);
  fieldBus.setTransport('rs485', stub);
  fieldBus.setTransport('relay', stub);
  fieldBus.stopMonitoring();
}
