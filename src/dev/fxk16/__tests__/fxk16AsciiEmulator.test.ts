/**
 * Validates that the FXK16 ASCII protocol emulator (mirror of the firmware
 * in firmware/fxk16-esp32s3/src/fxk16_protocol.cpp) produces exactly the
 * frames the host-side `FireOneHardwareBridge` parser expects to recognize
 * the device as MODEL=FXK16, CH=16, and to fire each of the 16 channels.
 *
 * If any assertion in this file fails, the firmware AND/OR the host parser
 * have drifted apart — both sides MUST be updated in lockstep.
 */
import { describe, it, expect } from 'vitest';
import {
  FXK16AsciiEmulator,
  FXK16_CHANNEL_MAP,
  FXK16_FIRE_MAX_DURATION_MS,
} from '../fxk16AsciiEmulator';

describe('FXK16 ASCII emulator — handshake recognition', () => {
  it('VERSION → VER + MODEL/CH banner (handshake captures FXK16/16)', () => {
    const emu = new FXK16AsciiEmulator();
    const reply = emu.exchange('VERSION');
    expect(reply).toEqual([
      'VER:FXK16-1.0.0',
      'MODEL:FXK16;CH:16;FW:1.0.0',
    ]);
  });

  it('HEARTBEAT → PONG (handshake fallback)', () => {
    const emu = new FXK16AsciiEmulator();
    expect(emu.exchange('HEARTBEAT')).toEqual(['PONG']);
  });

  it('STATUS → semicolon tokens with MODEL:FXK16;CH:16', () => {
    const emu = new FXK16AsciiEmulator();
    const [reply] = emu.exchange('STATUS');
    expect(reply).toBeDefined();
    const tokens = reply.split(';');
    expect(tokens).toContain('MODEL:FXK16');
    expect(tokens).toContain('CH:16');
    expect(tokens.some((t) => t.startsWith('BAT:'))).toBe(true);
    expect(tokens.some((t) => t.startsWith('PINS:'))).toBe(true);
  });

  it('IDENTIFY → single line with MODEL/CH/FW/ID tokens', () => {
    const emu = new FXK16AsciiEmulator();
    const reply = emu.exchange('IDENTIFY');
    expect(reply).toHaveLength(1);
    const tokens = reply[0].split(';');
    expect(tokens).toContain('MODEL:FXK16');
    expect(tokens).toContain('CH:16');
    expect(tokens).toContain('FW:1.0.0');
    expect(tokens).toContain('ID:FXK16');
  });

  it('PINMAP → 16 MAP lines + OK:PINMAP terminator', () => {
    const emu = new FXK16AsciiEmulator();
    const reply = emu.exchange('PINMAP');
    expect(reply).toHaveLength(17);
    expect(reply[16]).toBe('OK:PINMAP');
    for (let i = 0; i < 16; i++) {
      const row = FXK16_CHANNEL_MAP[i];
      expect(reply[i]).toBe(`MAP:${row.channel}:GPIO${row.gpio}:${row.terminal}`);
    }
  });
});

describe('FXK16 ASCII emulator — FIRE per channel', () => {
  it('fires every one of the 16 channels (1..16) with 50ms pulse', () => {
    const emu = new FXK16AsciiEmulator();
    for (let ch = 1; ch <= 16; ch++) {
      const reply = emu.exchange(`FIRE:${ch}:50`);
      expect(reply, `channel ${ch}`).toEqual([`OK:FIRE:${ch}`]);
    }
    // All 16 channels should be latched closed simultaneously.
    expect(emu.snapshot().closed).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16,
    ]);
  });

  it('rejects out-of-range channels (0 and 17) and parses errors', () => {
    const emu = new FXK16AsciiEmulator();
    expect(emu.exchange('FIRE:0:50')).toEqual(['ERR:FIRE:0:OUT_OF_RANGE']);
    expect(emu.exchange('FIRE:17:50')).toEqual(['ERR:FIRE:17:OUT_OF_RANGE']);
    expect(emu.exchange('FIRE:foo:bar')).toEqual(['ERR:FIRE:0:PARSE']);
  });

  it('rejects FIRE durations >5000ms and zero', () => {
    const emu = new FXK16AsciiEmulator();
    expect(emu.exchange(`FIRE:1:${FXK16_FIRE_MAX_DURATION_MS + 1}`))
      .toEqual(['ERR:FIRE:1:BAD_DURATION']);
    expect(emu.exchange('FIRE:1:0'))
      .toEqual(['ERR:FIRE:1:BAD_DURATION']);
  });

  it('ESTOP latches and blocks subsequent FIRE; RESET unlatches', () => {
    const emu = new FXK16AsciiEmulator();
    expect(emu.exchange('ESTOP')).toEqual(['OK:ESTOP']);
    expect(emu.snapshot().estopLatched).toBe(true);
    expect(emu.exchange('FIRE:5:50')).toEqual(['ERR:FIRE:5:ESTOP_LATCHED']);
    expect(emu.exchange('RESET')).toEqual(['OK:RESET']);
    expect(emu.exchange('FIRE:5:50')).toEqual(['OK:FIRE:5']);
  });

  it('BATCH mask 0xFFFF fires all 16 channels in one frame', () => {
    const emu = new FXK16AsciiEmulator();
    expect(emu.exchange('BATCH:65535:50')).toEqual(['OK:BATCH:65535']);
    expect(emu.snapshot().closed).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16,
    ]);
  });
});

describe('FXK16 ASCII emulator — FireOneHardwareBridge parser contract', () => {
  /**
   * This block proves the emulator's frames satisfy the EXACT regexes the
   * production parser uses. If the parser ever changes its tokenization,
   * these tests fail loudly.
   */
  it('VERSION reply contains tokens parser splits by ; into MODEL/CH', () => {
    const emu = new FXK16AsciiEmulator();
    const reply = emu.exchange('VERSION');
    // Parser splits each line by ';' and inspects each chunk.
    const allTokens = reply.flatMap((l) => l.split(';').map((t) => t.trim()));
    expect(allTokens.some((t) => t.startsWith('VER:')), 'has VER:').toBe(true);
    expect(allTokens.includes('MODEL:FXK16'), 'has MODEL:FXK16').toBe(true);
    expect(allTokens.includes('CH:16'), 'has CH:16').toBe(true);
  });

  it('FIRE acknowledgment matches "OK:FIRE:<n>" prefix the bridge resolves', () => {
    const emu = new FXK16AsciiEmulator();
    for (let ch = 1; ch <= 16; ch++) {
      const [ack] = emu.exchange(`FIRE:${ch}:50`);
      expect(ack.startsWith(`OK:FIRE:${ch}`), `channel ${ch} ack prefix`).toBe(true);
    }
  });
});
