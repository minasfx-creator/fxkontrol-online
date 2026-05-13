import { describe, it, expect } from 'vitest';
import {
  crc16Ccitt,
  CRC16_TEST_VECTORS,
  encodeFrame,
  decodeFrame,
  TwoWireOpcode,
  PRE0,
  PRE1,
  SYNC,
} from '../twoWireProtocol';
import {
  PYRO_FIRE_PRIORITY,
  EXCLUSIVE_FAMILIES,
  selectBestPyroTransport,
  isExclusiveFamily,
  BANNED_FOR_REAL_FIRE,
} from '../pyroTransportPolicy';

const PSK = new Uint8Array(32).fill(0x42);

describe('twoWireProtocol — CRC16-CCITT vectors', () => {
  for (const v of CRC16_TEST_VECTORS) {
    it(`vector ${v.name}`, () => {
      expect(crc16Ccitt(new Uint8Array(v.bytes))).toBe(v.crc);
    });
  }
});

describe('twoWireProtocol — frame round-trip', () => {
  it('POLL encodes/decodes', async () => {
    const frame = await encodeFrame({ type: 'POLL', addr: 7 }, { psk: PSK, counter: 1 });
    expect(frame[0]).toBe(PRE0);
    expect(frame[1]).toBe(PRE1);
    expect(frame[2]).toBe(SYNC);
    const decoded = await decodeFrame(frame, { psk: PSK });
    expect(decoded.ok).toBe(true);
    if (decoded.ok) {
      expect(decoded.frame.addr).toBe(7);
      expect(decoded.frame.opcode).toBe(TwoWireOpcode.POLL);
      expect(decoded.frame.counter).toBe(1);
    }
  });

  it('FIRE_MASK round-trip preserves mask', async () => {
    const mask = new Uint32Array([0xdeadbeef, 0x12345678]);
    const frame = await encodeFrame(
      { type: 'FIRE_MASK', addr: 3, mask, tFireMs: 250 },
      { psk: PSK, counter: 5 },
    );
    const decoded = await decodeFrame(frame, { psk: PSK });
    expect(decoded.ok).toBe(true);
    if (decoded.ok) {
      const dv = new DataView(decoded.frame.payload.buffer, decoded.frame.payload.byteOffset);
      expect(dv.getUint32(0, true)).toBe(0xdeadbeef);
      expect(dv.getUint32(4, true)).toBe(0x12345678);
      expect(dv.getUint32(8, true)).toBe(250);
    }
  });

  it('E_STOP is broadcast (addr 0)', async () => {
    const frame = await encodeFrame({ type: 'E_STOP' }, { psk: PSK, counter: 1 });
    const decoded = await decodeFrame(frame, { psk: PSK });
    expect(decoded.ok).toBe(true);
    if (decoded.ok) {
      expect(decoded.frame.addr).toBe(0);
      expect(decoded.frame.opcode).toBe(TwoWireOpcode.E_STOP);
    }
  });

  it('rejects tampered HMAC', async () => {
    const frame = await encodeFrame({ type: 'ARM', addr: 1 }, { psk: PSK, counter: 1 });
    // Flip a byte in the HMAC region (just before CRC).
    frame[frame.length - 5] ^= 0x01;
    const decoded = await decodeFrame(frame, { psk: PSK });
    expect(decoded.ok).toBe(false);
    if (decoded.ok === false) {
      expect(['hmac', 'crc']).toContain((decoded as { error: string }).error);
    }
  });

  it('rejects replayed counter', async () => {
    const frame = await encodeFrame({ type: 'ARM', addr: 1 }, { psk: PSK, counter: 5 });
    const seen = new Map<number, number>([[1, 5]]);
    const decoded = await decodeFrame(frame, {
      psk: PSK,
      lastCounter: (a) => seen.get(a) ?? 0,
    });
    expect(decoded.ok).toBe(false);
    if (decoded.ok === false) expect((decoded as { error: string }).error).toBe('replay');
  });

  it('rejects wrong PSK', async () => {
    const frame = await encodeFrame({ type: 'POLL', addr: 1 }, { psk: PSK, counter: 1 });
    const decoded = await decodeFrame(frame, { psk: new Uint8Array(32).fill(0x00) });
    expect(decoded.ok).toBe(false);
  });
});

describe('pyroTransportPolicy', () => {
  it('two_wire is highest priority', () => {
    expect(PYRO_FIRE_PRIORITY[0]).toBe('two_wire');
  });

  it('exclusive families include FXK + IFMx', () => {
    expect(EXCLUSIVE_FAMILIES.has('fxk16')).toBe(true);
    expect(EXCLUSIVE_FAMILIES.has('fireone-ifmx')).toBe(true);
    expect(isExclusiveFamily('fxk32q')).toBe(true);
    expect(isExclusiveFamily('drone-vviz')).toBe(false);
  });

  it('ble is banned for real fire', () => {
    expect(BANNED_FOR_REAL_FIRE.has('ble')).toBe(true);
    expect(selectBestPyroTransport('fxk16', ['ble'], 'real_operation')).toBeNull();
    expect(selectBestPyroTransport('fxk16', ['ble', 'serial'], 'real_operation')).toBe('serial');
  });

  it('selects two_wire when available', () => {
    expect(selectBestPyroTransport('fxk16', ['serial', 'two_wire', 'artnet'], 'real_operation')).toBe('two_wire');
  });

  it('falls back through priority chain', () => {
    expect(selectBestPyroTransport('fxk16', ['artnet', 'radio'], 'real_operation')).toBe('artnet');
    expect(selectBestPyroTransport('fxk16', ['radio'], 'real_operation')).toBe('radio');
    expect(selectBestPyroTransport('fxk16', [], 'real_operation')).toBeNull();
  });
});
