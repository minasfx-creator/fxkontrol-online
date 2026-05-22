/**
 * 2-Wire FireOne CDS Protocol — frame encode/decode + HMAC + counter + CRC16-CCITT.
 *
 * Half-duplex FSK over the same DC-biased pair (28V nominal).
 * Frame layout (max 80 bytes):
 *   [PRE 0xAA 0xAA][SYNC 0x7E][ADDR u8][CMD u8][LEN u8][PAYLOAD ≤56B]
 *   [COUNTER u32 LE monotonic][HMAC8 8B][CRC16-CCITT 2B]
 *
 * Anti-replay: counter is monotonically increasing per (psk, addr).
 * Anti-tamper: HMAC-SHA256 truncated to 8 bytes over [ADDR..COUNTER].
 *
 * NOTE: This module is a pure protocol codec. The on-wire transport
 * (`TwoWireTransport`) wraps it; the bench/firmware bring-up doc explains
 * physical-layer guarantees (`docs/reference/two-wire-cds-physical-layer.md`).
 */

export const PRE0 = 0xaa;
export const PRE1 = 0xaa;
export const SYNC = 0x7e;
export const FRAME_MAX = 80;
export const PAYLOAD_MAX = 56;
export const BROADCAST_ADDR = 0x00;

export enum TwoWireOpcode {
  POLL = 0x10,
  IDENTIFY = 0x11,
  STATUS = 0x12,
  CONTINUITY_REQ = 0x20,
  CONTINUITY_REPLY = 0x21,
  ARM = 0x30,
  DISARM = 0x31,
  FIRE_MASK = 0x40,
  E_STOP = 0x50, // broadcast (addr = 0)
  BUS_RENUMBER = 0x60,
  SET_PSK = 0x61,
  FW_VERSION = 0x70,
  TEMP_READ = 0x71,
}

export type TwoWireCmd =
  | { type: 'POLL'; addr: number }
  | { type: 'IDENTIFY'; addr: number }
  | { type: 'STATUS'; addr: number }
  | { type: 'CONTINUITY_REQ'; addr: number }
  | { type: 'ARM'; addr: number }
  | { type: 'DISARM'; addr: number }
  | { type: 'FIRE_MASK'; addr: number; mask: Uint32Array; tFireMs?: number }
  | { type: 'E_STOP' }
  | { type: 'BUS_RENUMBER'; addr: number; newAddr: number }
  | { type: 'SET_PSK'; addr: number; psk: Uint8Array }
  | { type: 'FW_VERSION'; addr: number }
  | { type: 'TEMP_READ'; addr: number };

// ── CRC16-CCITT (poly 0x1021, init 0xFFFF) ──────────────────────────
export function crc16Ccitt(buf: Uint8Array, start = 0, end = buf.length): number {
  let crc = 0xffff;
  for (let i = start; i < end; i++) {
    crc ^= buf[i] << 8;
    for (let b = 0; b < 8; b++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc & 0xffff;
}

// Canonical test vectors — published in docs/reference/two-wire-protocol-frames.md
export const CRC16_TEST_VECTORS: ReadonlyArray<{ name: string; bytes: number[]; crc: number }> = [
  { name: 'empty', bytes: [], crc: 0xffff },
  { name: 'single-zero', bytes: [0x00], crc: 0xe1f0 },
  { name: 'A', bytes: [0x41], crc: 0xb915 },
  { name: '123456789', bytes: [0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39], crc: 0x29b1 },
  { name: 'poll-addr-1', bytes: [0x01, TwoWireOpcode.POLL, 0x00], crc: crc16CcittRef([0x01, 0x10, 0x00]) },
  { name: 'estop-broadcast', bytes: [0x00, TwoWireOpcode.E_STOP, 0x00], crc: crc16CcittRef([0x00, 0x50, 0x00]) },
  { name: 'arm-addr-7', bytes: [0x07, TwoWireOpcode.ARM, 0x00], crc: crc16CcittRef([0x07, 0x30, 0x00]) },
  { name: 'fire-addr-3-len4', bytes: [0x03, TwoWireOpcode.FIRE_MASK, 0x04, 0xff, 0x00, 0x00, 0x00], crc: crc16CcittRef([0x03, 0x40, 0x04, 0xff, 0, 0, 0]) },
];

function crc16CcittRef(arr: number[]): number {
  return crc16Ccitt(new Uint8Array(arr));
}

// ── HMAC-SHA256 truncated to 8 bytes ────────────────────────────────
//
// Uses Web Crypto when available (browser/worker); a fallback pure-TS
// HMAC-SHA256 is provided for Node test environments without subtle.
const TEXT_ENCODER = new TextEncoder();

export async function hmacSha256Trunc8(psk: Uint8Array, msg: Uint8Array): Promise<Uint8Array> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const pskBuf = psk.buffer.slice(psk.byteOffset, psk.byteOffset + psk.byteLength) as ArrayBuffer;
    const msgBuf = msg.buffer.slice(msg.byteOffset, msg.byteOffset + msg.byteLength) as ArrayBuffer;
    const key = await crypto.subtle.importKey('raw', pskBuf, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sig = await crypto.subtle.sign('HMAC', key, msgBuf);
    return new Uint8Array(sig).slice(0, 8);
  }
  return hmacSha256TruncSync(psk, msg).slice(0, 8);
}

// Synchronous fallback (pure TS) — used in tests when subtle is missing.
function hmacSha256TruncSync(key: Uint8Array, msg: Uint8Array): Uint8Array {
  const blockSize = 64;
  let k = key;
  if (k.length > blockSize) k = sha256(k);
  if (k.length < blockSize) {
    const padded = new Uint8Array(blockSize);
    padded.set(k);
    k = padded;
  }
  const oKey = new Uint8Array(blockSize);
  const iKey = new Uint8Array(blockSize);
  for (let i = 0; i < blockSize; i++) {
    oKey[i] = k[i] ^ 0x5c;
    iKey[i] = k[i] ^ 0x36;
  }
  const inner = sha256(concat(iKey, msg));
  return sha256(concat(oKey, inner));
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

// Minimal SHA-256 (FIPS 180-4) — only used as fallback.
function sha256(data: Uint8Array): Uint8Array {
  const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]);
  const H = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const bitLen = data.length * 8;
  const padLen = ((data.length + 9 + 63) >> 6) << 6;
  const padded = new Uint8Array(padLen);
  padded.set(data);
  padded[data.length] = 0x80;
  // 64-bit length BE — JS bit ops are 32-bit, only set low 32 bits.
  padded[padLen - 4] = (bitLen >>> 24) & 0xff;
  padded[padLen - 3] = (bitLen >>> 16) & 0xff;
  padded[padLen - 2] = (bitLen >>> 8) & 0xff;
  padded[padLen - 1] = bitLen & 0xff;

  const W = new Uint32Array(64);
  for (let chunk = 0; chunk < padLen; chunk += 64) {
    for (let i = 0; i < 16; i++) {
      const j = chunk + i * 4;
      W[i] = (padded[j] << 24) | (padded[j + 1] << 16) | (padded[j + 2] << 8) | padded[j + 3];
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(W[i - 15], 7) ^ rotr(W[i - 15], 18) ^ (W[i - 15] >>> 3);
      const s1 = rotr(W[i - 2], 17) ^ rotr(W[i - 2], 19) ^ (W[i - 2] >>> 10);
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) | 0;
    }
    let [a, b, c, d, e, f, g, h] = [H[0], H[1], H[2], H[3], H[4], H[5], H[6], H[7]];
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[i] + W[i]) | 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const mj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + mj) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0;
      d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
    H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
  }
  const out = new Uint8Array(32);
  for (let i = 0; i < 8; i++) {
    out[i * 4] = (H[i] >>> 24) & 0xff;
    out[i * 4 + 1] = (H[i] >>> 16) & 0xff;
    out[i * 4 + 2] = (H[i] >>> 8) & 0xff;
    out[i * 4 + 3] = H[i] & 0xff;
  }
  return out;
}

function rotr(x: number, n: number): number {
  return ((x >>> n) | (x << (32 - n))) >>> 0;
}

// ── Frame encode / decode ───────────────────────────────────────────

function payloadFor(cmd: TwoWireCmd): Uint8Array {
  switch (cmd.type) {
    case 'POLL':
    case 'IDENTIFY':
    case 'STATUS':
    case 'CONTINUITY_REQ':
    case 'ARM':
    case 'DISARM':
    case 'E_STOP':
    case 'FW_VERSION':
    case 'TEMP_READ':
      return new Uint8Array(0);
    case 'FIRE_MASK': {
      const tMs = cmd.tFireMs ?? 0;
      const out = new Uint8Array(cmd.mask.byteLength + 4);
      const dv = new DataView(out.buffer);
      for (let i = 0; i < cmd.mask.length; i++) dv.setUint32(i * 4, cmd.mask[i] >>> 0, true);
      dv.setUint32(cmd.mask.byteLength, tMs >>> 0, true);
      return out;
    }
    case 'BUS_RENUMBER':
      return new Uint8Array([cmd.newAddr & 0xff]);
    case 'SET_PSK':
      return cmd.psk.slice(0, PAYLOAD_MAX);
  }
}

function opcodeFor(cmd: TwoWireCmd): TwoWireOpcode {
  switch (cmd.type) {
    case 'POLL': return TwoWireOpcode.POLL;
    case 'IDENTIFY': return TwoWireOpcode.IDENTIFY;
    case 'STATUS': return TwoWireOpcode.STATUS;
    case 'CONTINUITY_REQ': return TwoWireOpcode.CONTINUITY_REQ;
    case 'ARM': return TwoWireOpcode.ARM;
    case 'DISARM': return TwoWireOpcode.DISARM;
    case 'FIRE_MASK': return TwoWireOpcode.FIRE_MASK;
    case 'E_STOP': return TwoWireOpcode.E_STOP;
    case 'BUS_RENUMBER': return TwoWireOpcode.BUS_RENUMBER;
    case 'SET_PSK': return TwoWireOpcode.SET_PSK;
    case 'FW_VERSION': return TwoWireOpcode.FW_VERSION;
    case 'TEMP_READ': return TwoWireOpcode.TEMP_READ;
  }
}

function addrFor(cmd: TwoWireCmd): number {
  return cmd.type === 'E_STOP' ? BROADCAST_ADDR : (cmd as { addr: number }).addr & 0xff;
}

export interface EncodeOptions {
  psk: Uint8Array;
  counter: number; // monotonic per (psk, addr)
}

export async function encodeFrame(cmd: TwoWireCmd, opts: EncodeOptions): Promise<Uint8Array> {
  const payload = payloadFor(cmd);
  if (payload.length > PAYLOAD_MAX) {
    throw new Error(`payload too large: ${payload.length} > ${PAYLOAD_MAX}`);
  }
  const addr = addrFor(cmd);
  const op = opcodeFor(cmd);
  // Body covered by HMAC + CRC: ADDR | CMD | LEN | PAYLOAD | COUNTER(4 LE)
  const bodyLen = 1 + 1 + 1 + payload.length + 4;
  const body = new Uint8Array(bodyLen);
  body[0] = addr;
  body[1] = op;
  body[2] = payload.length;
  body.set(payload, 3);
  const dv = new DataView(body.buffer, body.byteOffset);
  dv.setUint32(3 + payload.length, opts.counter >>> 0, true);

  const hmac = await hmacSha256Trunc8(opts.psk, body);
  const crcInput = new Uint8Array(body.length + hmac.length);
  crcInput.set(body, 0);
  crcInput.set(hmac, body.length);
  const crc = crc16Ccitt(crcInput);

  // Final wire frame: PRE PRE SYNC | body | hmac | CRC(LE)
  const out = new Uint8Array(3 + body.length + hmac.length + 2);
  out[0] = PRE0;
  out[1] = PRE1;
  out[2] = SYNC;
  out.set(body, 3);
  out.set(hmac, 3 + body.length);
  out[out.length - 2] = crc & 0xff;
  out[out.length - 1] = (crc >>> 8) & 0xff;

  if (out.length > FRAME_MAX) {
    throw new Error(`frame too large: ${out.length} > ${FRAME_MAX}`);
  }
  return out;
}

export interface DecodedFrame {
  addr: number;
  opcode: TwoWireOpcode;
  payload: Uint8Array;
  counter: number;
}

export type DecodeError =
  | 'short'
  | 'sync'
  | 'crc'
  | 'hmac'
  | 'replay';

export interface DecodeOptions {
  psk: Uint8Array;
  /** Per-(psk,addr) last-seen counter store; decoder rejects ≤ value. */
  lastCounter?: (addr: number) => number;
}

export interface DecodeOk {
  ok: true;
  frame: DecodedFrame;
}

export interface DecodeFail {
  ok: false;
  error: DecodeError;
}

export async function decodeFrame(buf: Uint8Array, opts: DecodeOptions): Promise<DecodeOk | DecodeFail> {
  if (buf.length < 3 + 3 + 4 + 8 + 2) return { ok: false, error: 'short' };
  if (buf[0] !== PRE0 || buf[1] !== PRE1 || buf[2] !== SYNC) return { ok: false, error: 'sync' };

  const body = buf.subarray(3, buf.length - 10); // body | (hmac=8) | (crc=2)
  const hmac = buf.subarray(3 + body.length, 3 + body.length + 8);
  const crcLo = buf[buf.length - 2];
  const crcHi = buf[buf.length - 1];
  const crcGiven = (crcHi << 8) | crcLo;

  const crcInput = buf.subarray(3, buf.length - 2);
  const crcCalc = crc16Ccitt(crcInput);
  if (crcCalc !== crcGiven) return { ok: false, error: 'crc' };

  const expHmac = await hmacSha256Trunc8(opts.psk, body);
  for (let i = 0; i < 8; i++) {
    if (expHmac[i] !== hmac[i]) return { ok: false, error: 'hmac' };
  }

  const addr = body[0];
  const opcode = body[1] as TwoWireOpcode;
  const len = body[2];
  if (3 + len + 4 !== body.length) return { ok: false, error: 'short' };
  const payload = body.subarray(3, 3 + len);
  const dv = new DataView(body.buffer, body.byteOffset);
  const counter = dv.getUint32(3 + len, true);

  if (opts.lastCounter && counter <= opts.lastCounter(addr)) {
    return { ok: false, error: 'replay' };
  }

  return { ok: true, frame: { addr, opcode, payload, counter } };
}
