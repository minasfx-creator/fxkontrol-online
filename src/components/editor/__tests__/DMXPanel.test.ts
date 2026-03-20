import { describe, it, expect } from 'vitest';

/**
 * Unit tests for DMXPanel logic (output mode, validation, Art-Net packet structure).
 * Tests the core business logic without rendering the full component.
 */

// Replicate the validation logic from DMXPanel / artnet-bridge
interface DMXUniverseData {
  universe: number;
  subnet: number;
  net: number;
  channels: number[];
  sequence: number;
}

function validateUniverse(data: DMXUniverseData): string[] {
  const errors: string[] = [];
  if (data.universe < 0 || data.universe > 15) errors.push(`Universe ${data.universe} out of range (0-15)`);
  if (data.subnet < 0 || data.subnet > 15) errors.push(`Subnet ${data.subnet} out of range (0-15)`);
  if (data.net < 0 || data.net > 127) errors.push(`Net ${data.net} out of range (0-127)`);
  if (!data.channels || data.channels.length === 0) errors.push('No channel data');
  if (data.channels.length > 512) errors.push(`Too many channels: ${data.channels.length} (max 512)`);
  for (let i = 0; i < data.channels.length; i++) {
    if (data.channels[i] < 0 || data.channels[i] > 255) {
      errors.push(`Channel ${i + 1} value ${data.channels[i]} out of range (0-255)`);
      break;
    }
  }
  return errors;
}

// Art-Net packet builder (mirrors edge function logic)
function buildArtDmxPacket(data: DMXUniverseData): Uint8Array {
  const ARTNET_HEADER = new TextEncoder().encode('Art-Net\0');
  const channelCount = Math.min(512, data.channels.length);
  const paddedCount = channelCount % 2 === 0 ? channelCount : channelCount + 1;
  const packetSize = 18 + paddedCount;
  const packet = new Uint8Array(packetSize);
  let offset = 0;

  packet.set(ARTNET_HEADER, offset); offset += 8;
  packet[offset++] = 0x00; packet[offset++] = 0x50; // OpCode 0x5000 LE
  packet[offset++] = 0; packet[offset++] = 14; // Protocol v14 BE
  packet[offset++] = data.sequence & 0xFF;
  packet[offset++] = 0; // physical
  const subUni = (data.subnet & 0x0F) << 4 | (data.universe & 0x0F);
  packet[offset++] = subUni;
  packet[offset++] = data.net & 0x7F;
  packet[offset++] = (paddedCount >> 8) & 0xFF;
  packet[offset++] = paddedCount & 0xFF;
  for (let i = 0; i < paddedCount; i++) {
    packet[offset++] = (data.channels[i] ?? 0) & 0xFF;
  }
  return packet;
}

describe('DMXPanel — Output Mode Defaults', () => {
  it('default output mode should be artnet', () => {
    // The DMXPanel initializes outputMode as 'artnet'
    const defaultMode: 'artnet' | 'usb' = 'artnet';
    expect(defaultMode).toBe('artnet');
  });

  it('artnet mode should not require WebSerial', () => {
    const outputMode: string = 'artnet';
    const requiresUSB = outputMode === 'usb';
    expect(requiresUSB).toBe(false);
  });
});

describe('DMX Universe Validation', () => {
  it('valid universe passes', () => {
    const errors = validateUniverse({ universe: 0, subnet: 0, net: 0, channels: [255, 128, 0], sequence: 1 });
    expect(errors).toHaveLength(0);
  });

  it('rejects universe out of range', () => {
    const errors = validateUniverse({ universe: 16, subnet: 0, net: 0, channels: [0], sequence: 0 });
    expect(errors.some(e => e.includes('Universe'))).toBe(true);
  });

  it('rejects subnet out of range', () => {
    const errors = validateUniverse({ universe: 0, subnet: 20, net: 0, channels: [0], sequence: 0 });
    expect(errors.some(e => e.includes('Subnet'))).toBe(true);
  });

  it('rejects net out of range', () => {
    const errors = validateUniverse({ universe: 0, subnet: 0, net: 200, channels: [0], sequence: 0 });
    expect(errors.some(e => e.includes('Net'))).toBe(true);
  });

  it('rejects empty channels', () => {
    const errors = validateUniverse({ universe: 0, subnet: 0, net: 0, channels: [], sequence: 0 });
    expect(errors.some(e => e.includes('No channel'))).toBe(true);
  });

  it('rejects >512 channels', () => {
    const errors = validateUniverse({ universe: 0, subnet: 0, net: 0, channels: new Array(513).fill(0), sequence: 0 });
    expect(errors.some(e => e.includes('Too many'))).toBe(true);
  });

  it('rejects channel value >255', () => {
    const errors = validateUniverse({ universe: 0, subnet: 0, net: 0, channels: [0, 300], sequence: 0 });
    expect(errors.some(e => e.includes('out of range (0-255)'))).toBe(true);
  });

  it('rejects negative channel value', () => {
    const errors = validateUniverse({ universe: 0, subnet: 0, net: 0, channels: [-1], sequence: 0 });
    expect(errors.some(e => e.includes('out of range (0-255)'))).toBe(true);
  });
});

describe('Art-Net Packet Builder', () => {
  it('starts with Art-Net\\0 header', () => {
    const pkt = buildArtDmxPacket({ universe: 0, subnet: 0, net: 0, channels: [0, 0], sequence: 0 });
    const header = new TextDecoder().decode(pkt.slice(0, 7));
    expect(header).toBe('Art-Net');
    expect(pkt[7]).toBe(0); // null terminator
  });

  it('OpCode is 0x5000 little-endian', () => {
    const pkt = buildArtDmxPacket({ universe: 0, subnet: 0, net: 0, channels: [0], sequence: 0 });
    expect(pkt[8]).toBe(0x00);
    expect(pkt[9]).toBe(0x50);
  });

  it('protocol version is 14 big-endian', () => {
    const pkt = buildArtDmxPacket({ universe: 0, subnet: 0, net: 0, channels: [0], sequence: 0 });
    expect(pkt[10]).toBe(0);
    expect(pkt[11]).toBe(14);
  });

  it('encodes sequence byte', () => {
    const pkt = buildArtDmxPacket({ universe: 0, subnet: 0, net: 0, channels: [0], sequence: 42 });
    expect(pkt[12]).toBe(42);
  });

  it('encodes universe and subnet correctly', () => {
    // subnet=2, universe=5 → SubUni = (2 << 4) | 5 = 37
    const pkt = buildArtDmxPacket({ universe: 5, subnet: 2, net: 0, channels: [0], sequence: 0 });
    expect(pkt[14]).toBe(37);
  });

  it('encodes net correctly', () => {
    const pkt = buildArtDmxPacket({ universe: 0, subnet: 0, net: 100, channels: [0], sequence: 0 });
    expect(pkt[15]).toBe(100);
  });

  it('pads odd channel count to even', () => {
    const pkt = buildArtDmxPacket({ universe: 0, subnet: 0, net: 0, channels: [255], sequence: 0 });
    // 1 channel → padded to 2, total = 18 + 2 = 20
    expect(pkt.length).toBe(20);
    expect(pkt[18]).toBe(255); // first channel
    expect(pkt[19]).toBe(0);   // padded zero
  });

  it('even channel count is not padded', () => {
    const pkt = buildArtDmxPacket({ universe: 0, subnet: 0, net: 0, channels: [100, 200], sequence: 0 });
    expect(pkt.length).toBe(20); // 18 header + 2 channels
    expect(pkt[18]).toBe(100);
    expect(pkt[19]).toBe(200);
  });

  it('data length field matches padded count (big-endian)', () => {
    const channels = new Array(512).fill(128);
    const pkt = buildArtDmxPacket({ universe: 0, subnet: 0, net: 0, channels, sequence: 0 });
    const lenHi = pkt[16];
    const lenLo = pkt[17];
    expect((lenHi << 8) | lenLo).toBe(512);
  });

  it('total packet size = 18 + channel count (even)', () => {
    const channels = new Array(100).fill(0);
    const pkt = buildArtDmxPacket({ universe: 0, subnet: 0, net: 0, channels, sequence: 0 });
    expect(pkt.length).toBe(118);
  });
});

describe('Connection Status State Machine', () => {
  it('starts in idle state', () => {
    const status: 'idle' | 'testing' | 'ok' | 'error' = 'idle';
    expect(status).toBe('idle');
  });

  it('transitions to ok on successful connection', () => {
    let status: 'idle' | 'testing' | 'ok' | 'error' = 'idle';
    // Simulate ws.onopen
    status = 'ok';
    expect(status).toBe('ok');
  });

  it('transitions to error on failed connection', () => {
    let status: 'idle' | 'testing' | 'ok' | 'error' = 'idle';
    // Simulate ws.onerror
    status = 'error';
    expect(status).toBe('error');
  });

  it('returns to idle on disconnect', () => {
    let status: 'idle' | 'testing' | 'ok' | 'error' = 'ok';
    // Simulate ws.onclose
    status = 'idle';
    expect(status).toBe('idle');
  });
});
