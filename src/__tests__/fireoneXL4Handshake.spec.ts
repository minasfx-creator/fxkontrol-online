/**
 * Tests for fireoneXL4Handshake — fake WebSerial port that echoes
 * IDENTIFY frames so we can validate baud setting, firmware gating, and
 * timeout/error paths without touching real hardware.
 */
import { describe, expect, it, vi } from 'vitest';
import {
  performXL4Handshake,
  isFirmwareSupported,
  XL4HandshakeError,
  MIN_XL4_FIRMWARE,
  DEFAULT_XL4_BAUD,
  SUPPORTED_BAUDS,
} from '@/lib/fireoneXL4Handshake';
import { buildFrame, FireOneCmd } from '@/lib/fireoneProtocol';

/**
 * Build a minimal status payload (length 8 = header only, no igniters).
 * Layout matches parseStatusPayload exactly.
 */
function statusPayload(opts: { armed?: boolean; fwMajor: number; fwMinor: number; signal?: number }) {
  const p = new Uint8Array(8);
  p[0] = opts.armed ? 1 : 0;
  p[1] = 0x12;          // battery hi
  p[2] = 0x34;          // battery lo
  p[3] = 65;            // temp 25C (offset +40)
  p[4] = opts.signal ?? 88;
  p[5] = opts.fwMajor;
  p[6] = opts.fwMinor;
  p[7] = 0;             // no errors
  return p;
}

interface FakePortOpts {
  /** If set, port.open will reject. */
  openError?: string;
  /** Bytes the port should reply with (ignored if `noReply`). */
  replyBytes?: Uint8Array;
  /** When true the read loop never resolves with data → forces timeout. */
  noReply?: boolean;
  /** Captures the last `port.open()` config so tests can assert baudRate. */
  onOpen?: (config: any) => void;
}

function makeFakePort(opts: FakePortOpts) {
  let opened = false;
  let writeBuf: Uint8Array | null = null;
  let resolveRead: ((value: { value: Uint8Array; done: false }) => void) | null = null;

  const reader = {
    read: () => {
      if (opts.noReply) {
        // Never resolve → handshake should hit its internal timeout race.
        return new Promise<{ value: Uint8Array; done: false }>(() => { /* hang */ });
      }
      // Deliver bytes once, then hang.
      if (opts.replyBytes && resolveRead === null) {
        return Promise.resolve({ value: opts.replyBytes, done: false as const });
      }
      return new Promise<{ value: Uint8Array; done: false }>((res) => { resolveRead = res; });
    },
    cancel: vi.fn().mockResolvedValue(undefined),
    releaseLock: vi.fn(),
  };

  const writer = {
    write: vi.fn(async (bytes: Uint8Array) => { writeBuf = bytes; }),
    releaseLock: vi.fn(),
  };

  return {
    open: vi.fn(async (config: any) => {
      opts.onOpen?.(config);
      if (opts.openError) throw new Error(opts.openError);
      opened = true;
    }),
    close: vi.fn(async () => { opened = false; }),
    get readable() { return opened ? { getReader: () => reader } : null; },
    get writable() { return opened ? { getWriter: () => writer } : null; },
    _internals: { reader, writer, get writeBuf() { return writeBuf; } },
  };
}

describe('isFirmwareSupported', () => {
  it('accepts equal-or-newer firmware', () => {
    expect(isFirmwareSupported(MIN_XL4_FIRMWARE.major, MIN_XL4_FIRMWARE.minor)).toBe(true);
    expect(isFirmwareSupported(MIN_XL4_FIRMWARE.major, MIN_XL4_FIRMWARE.minor + 1)).toBe(true);
    expect(isFirmwareSupported(MIN_XL4_FIRMWARE.major + 1, 0)).toBe(true);
  });
  it('rejects older firmware', () => {
    expect(isFirmwareSupported(MIN_XL4_FIRMWARE.major - 1, 99)).toBe(false);
    if (MIN_XL4_FIRMWARE.minor > 0) {
      expect(isFirmwareSupported(MIN_XL4_FIRMWARE.major, MIN_XL4_FIRMWARE.minor - 1)).toBe(false);
    }
  });
});

describe('performXL4Handshake', () => {
  it('opens the port at the requested baud and resolves on valid IDENTIFY reply', async () => {
    const reply = buildFrame(7, FireOneCmd.IDENTIFY, statusPayload({ fwMajor: 5, fwMinor: 1 }));
    const onOpen = vi.fn();
    const port = makeFakePort({ replyBytes: reply, onOpen });

    const result = await performXL4Handshake({ port, baudRate: 19200, timeoutMs: 500 });

    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({
      baudRate: 19200, dataBits: 8, stopBits: 1, parity: 'none',
    }));
    expect(result.baudRate).toBe(19200);
    expect(result.moduleAddress).toBe(7);
    expect(result.firmware).toBe('5.1');
    expect(result.firmwareMajor).toBeGreaterThanOrEqual(MIN_XL4_FIRMWARE.major);
    // IDENTIFY frame (cmd 0x49) was sent.
    expect(port._internals.writer.write).toHaveBeenCalledTimes(1);
    expect(port._internals.writeBuf?.[2]).toBe(0x49);
  });

  it('rejects firmware older than MIN_XL4_FIRMWARE with code firmware-too-old', async () => {
    const reply = buildFrame(2, FireOneCmd.IDENTIFY, statusPayload({ fwMajor: 4, fwMinor: 99 }));
    const port = makeFakePort({ replyBytes: reply });
    await expect(performXL4Handshake({ port, baudRate: DEFAULT_XL4_BAUD, timeoutMs: 500 }))
      .rejects.toMatchObject({ code: 'firmware-too-old' });
  });

  it('allows old firmware when allowOldFirmware=true', async () => {
    const reply = buildFrame(2, FireOneCmd.IDENTIFY, statusPayload({ fwMajor: 4, fwMinor: 0 }));
    const port = makeFakePort({ replyBytes: reply });
    const r = await performXL4Handshake({
      port, baudRate: DEFAULT_XL4_BAUD, timeoutMs: 500, allowOldFirmware: true,
    });
    expect(r.firmware).toBe('4.0');
  });

  it('throws timeout (and closes port) when no bytes arrive', async () => {
    const port = makeFakePort({ noReply: true });
    await expect(performXL4Handshake({ port, baudRate: DEFAULT_XL4_BAUD, timeoutMs: 50 }))
      .rejects.toMatchObject({ code: 'timeout' });
    expect(port.close).toHaveBeenCalled();
  });

  it('reports open-failed when port.open rejects', async () => {
    const port = makeFakePort({ openError: 'busy' });
    await expect(performXL4Handshake({ port, baudRate: DEFAULT_XL4_BAUD, timeoutMs: 50 }))
      .rejects.toMatchObject({ code: 'open-failed' });
  });

  it('exports the expected baud catalog', () => {
    expect(SUPPORTED_BAUDS).toContain(9600);
    expect(SUPPORTED_BAUDS).toContain(19200);
    expect(SUPPORTED_BAUDS).toContain(38400);
    expect(DEFAULT_XL4_BAUD).toBe(9600);
  });

  it('XL4HandshakeError exposes a stable code field', () => {
    const e = new XL4HandshakeError('timeout', 'no bytes');
    expect(e.code).toBe('timeout');
    expect(e.message).toBe('no bytes');
  });
});
