import { ARTNET_HEADER, ARTNET_OPCODE_DMX, ARTNET_PROTOCOL_VERSION } from "./types.ts";
import type { DMXUniverseData } from "./types.ts";

/** Encode a Uint8Array to base64. */
export function toBase64(packet: Uint8Array): string {
  return btoa(String.fromCharCode(...packet));
}

/** Build an ArtDmx (0x5000) packet. */
export function buildArtDmxPacket(data: DMXUniverseData): Uint8Array {
  const channelCount = Math.min(512, data.channels.length);
  const paddedCount = channelCount % 2 === 0 ? channelCount : channelCount + 1;
  const packet = new Uint8Array(18 + paddedCount);
  let offset = 0;

  packet.set(ARTNET_HEADER, offset); offset += 8;
  packet[offset++] = ARTNET_OPCODE_DMX & 0xFF;
  packet[offset++] = (ARTNET_OPCODE_DMX >> 8) & 0xFF;
  packet[offset++] = 0;
  packet[offset++] = ARTNET_PROTOCOL_VERSION;
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

/** Build a 14-byte ArtPoll (0x2000) packet. */
export function buildArtPollPacket(): Uint8Array {
  const packet = new Uint8Array(14);
  packet.set(ARTNET_HEADER, 0);
  packet[8] = 0x00; packet[9] = 0x20;
  packet[10] = 0; packet[11] = ARTNET_PROTOCOL_VERSION;
  packet[12] = 0x02; packet[13] = 0;
  return packet;
}

/** Build a 14-byte ArtSync (0x5200) packet. */
export function buildArtSyncPacket(): Uint8Array {
  const packet = new Uint8Array(14);
  packet.set(ARTNET_HEADER, 0);
  packet[8] = 0x00; packet[9] = 0x52;
  packet[10] = 0; packet[11] = ARTNET_PROTOCOL_VERSION;
  return packet;
}

export interface ArtRdmOptions {
  rdmData?: string;
  universe?: number;
  subnet?: number;
  net?: number;
}

/** Build an ArtRdm (0x8300) packet with optional RDM payload. */
export function buildArtRdmPacket(opts: ArtRdmOptions): Uint8Array {
  const rdmBytes = opts.rdmData
    ? Uint8Array.from(atob(opts.rdmData), c => c.charCodeAt(0))
    : new Uint8Array(0);
  const packet = new Uint8Array(24 + rdmBytes.length);
  packet.set(ARTNET_HEADER, 0);
  packet[8] = 0x00; packet[9] = 0x83;
  packet[10] = 0; packet[11] = ARTNET_PROTOCOL_VERSION;
  packet[12] = 0x01; // RdmVer
  const subUni = ((opts.subnet || 0) & 0x0F) << 4 | ((opts.universe || 0) & 0x0F);
  packet[21] = subUni;
  packet[22] = (opts.net || 0) & 0x7F;
  packet.set(rdmBytes, 24);
  return packet;
}
