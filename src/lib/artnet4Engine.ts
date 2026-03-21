/**
 * Art-Net 4 Full Protocol Engine
 * Supports ArtPoll, ArtPollReply, ArtSync, ArtRdm, ArtAddress, ArtInput.
 * Builds binary packets for relay via edge function or native UDP.
 */

// Art-Net OpCodes (little-endian in packet, big-endian values here)
export const ArtNetOpCode = {
  OpPoll:      0x2000,
  OpPollReply: 0x2100,
  OpDiagData:  0x2300,
  OpCommand:   0x2400,
  OpDmx:       0x5000,
  OpSync:      0x5200,
  OpAddress:   0x6000,
  OpInput:     0x7000,
  OpTodRequest:0x8000,
  OpTodData:   0x8100,
  OpTodControl:0x8200,
  OpRdm:       0x8300,
  OpRdmSub:    0x8400,
  OpIpProg:    0xF800,
  OpIpProgReply:0xF900,
} as const;

const ARTNET_HEADER = new TextEncoder().encode('Art-Net\0');
const PROTOCOL_VERSION = 14;

export interface ArtNetNode {
  ip: string;
  port: number;
  shortName: string;
  longName: string;
  firmwareVersion: number;
  netSwitch: number;
  subSwitch: number;
  oem: number;
  status1: number;
  status2: number;
  numPorts: number;
  portTypes: number[];
  goodInput: number[];
  goodOutput: number[];
  swIn: number[];
  swOut: number[];
  macAddress: string;
  bindIp: string;
  rdmSupported: boolean;
  sacnCapable: boolean;
}

// ─── ArtPoll ────────────────────────────────────────
export function buildArtPollPacket(targetedMode = false): Uint8Array {
  const packet = new Uint8Array(14);
  let o = 0;
  packet.set(ARTNET_HEADER, o); o += 8;
  packet[o++] = ArtNetOpCode.OpPoll & 0xFF;
  packet[o++] = (ArtNetOpCode.OpPoll >> 8) & 0xFF;
  packet[o++] = 0; // ProtVerHi
  packet[o++] = PROTOCOL_VERSION;
  // Flags: bit 1 = send ArtPollReply on changes, bit 5 = targeted mode
  packet[o++] = 0x02 | (targetedMode ? 0x20 : 0);
  packet[o++] = 0; // DiagPriority
  return packet;
}

// ─── ArtSync ────────────────────────────────────────
export function buildArtSyncPacket(): Uint8Array {
  const packet = new Uint8Array(14);
  let o = 0;
  packet.set(ARTNET_HEADER, o); o += 8;
  packet[o++] = ArtNetOpCode.OpSync & 0xFF;
  packet[o++] = (ArtNetOpCode.OpSync >> 8) & 0xFF;
  packet[o++] = 0;
  packet[o++] = PROTOCOL_VERSION;
  packet[o++] = 0; // Aux1
  packet[o++] = 0; // Aux2
  return packet;
}

// ─── ArtAddress ─────────────────────────────────────
export function buildArtAddressPacket(
  netSwitch: number,
  subSwitch: number,
  shortName: string,
  longName: string
): Uint8Array {
  const packet = new Uint8Array(107);
  let o = 0;
  packet.set(ARTNET_HEADER, o); o += 8;
  packet[o++] = ArtNetOpCode.OpAddress & 0xFF;
  packet[o++] = (ArtNetOpCode.OpAddress >> 8) & 0xFF;
  packet[o++] = 0;
  packet[o++] = PROTOCOL_VERSION;

  // NetSwitch (byte 12)
  packet[o++] = netSwitch & 0x7F;
  // BindIndex
  packet[o++] = 0;

  // ShortName (18 bytes)
  const sn = new TextEncoder().encode(shortName.slice(0, 17));
  packet.set(sn, o); o += 18;

  // LongName (64 bytes)
  const ln = new TextEncoder().encode(longName.slice(0, 63));
  packet.set(ln, o); o += 64;

  // SwIn[4] + SwOut[4] (skip, leave 0)
  o += 8;

  // SubSwitch
  packet[o++] = subSwitch & 0x0F;
  // SwVideo, Command (leave 0)

  return packet;
}

// ─── ArtRdm ─────────────────────────────────────────
export function buildArtRdmPacket(
  universe: number,
  subnet: number,
  net: number,
  rdmData: Uint8Array
): Uint8Array {
  const packet = new Uint8Array(24 + rdmData.length);
  let o = 0;
  packet.set(ARTNET_HEADER, o); o += 8;
  packet[o++] = ArtNetOpCode.OpRdm & 0xFF;
  packet[o++] = (ArtNetOpCode.OpRdm >> 8) & 0xFF;
  packet[o++] = 0;
  packet[o++] = PROTOCOL_VERSION;
  // RdmVer
  packet[o++] = 0x01;
  // Filler2
  o += 7;
  // Spare, Net
  packet[o++] = 0; // command (0=ArProcess)
  // Address
  const subUni = (subnet & 0x0F) << 4 | (universe & 0x0F);
  packet[o++] = subUni;
  packet[o++] = net & 0x7F;
  // RDM data
  packet.set(rdmData, o);
  return packet;
}

// ─── ArtInput ───────────────────────────────────────
export function buildArtInputPacket(
  portIndex: number,
  disabled: boolean
): Uint8Array {
  const packet = new Uint8Array(18);
  let o = 0;
  packet.set(ARTNET_HEADER, o); o += 8;
  packet[o++] = ArtNetOpCode.OpInput & 0xFF;
  packet[o++] = (ArtNetOpCode.OpInput >> 8) & 0xFF;
  packet[o++] = 0;
  packet[o++] = PROTOCOL_VERSION;
  // Filler1, Filler2
  o += 2;
  // NumPortsHi, NumPortsLo
  packet[o++] = 0;
  packet[o++] = 4;
  // Input[4]
  for (let i = 0; i < 4; i++) {
    packet[o++] = (i === portIndex && disabled) ? 0x08 : 0x00;
  }
  return packet;
}

// ─── Parse ArtPollReply ─────────────────────────────
export function parseArtPollReply(data: Uint8Array): ArtNetNode | null {
  if (data.length < 207) return null;
  // Verify header
  const header = new TextDecoder().decode(data.slice(0, 8));
  if (header !== 'Art-Net\0') return null;

  const decoder = new TextDecoder();
  const ip = `${data[10]}.${data[11]}.${data[12]}.${data[13]}`;
  const port = data[14] | (data[15] << 8);
  const firmwareVersion = (data[16] << 8) | data[17];
  const netSwitch = data[18];
  const subSwitch = data[19];
  const oem = (data[20] << 8) | data[21];
  const status1 = data[23];
  const shortName = decoder.decode(data.slice(26, 44)).replace(/\0+$/, '');
  const longName = decoder.decode(data.slice(44, 108)).replace(/\0+$/, '');
  const numPorts = data[173];
  const portTypes = Array.from(data.slice(174, 178));
  const goodInput = Array.from(data.slice(178, 182));
  const goodOutput = Array.from(data.slice(182, 186));
  const swIn = Array.from(data.slice(186, 190));
  const swOut = Array.from(data.slice(190, 194));
  const status2 = data[212] ?? 0;
  const mac = Array.from(data.slice(201, 207)).map(b => b.toString(16).padStart(2, '0')).join(':');
  const bindIp = `${data[207]}.${data[208]}.${data[209]}.${data[210]}`;

  return {
    ip, port, shortName, longName, firmwareVersion,
    netSwitch, subSwitch, oem, status1, status2,
    numPorts, portTypes, goodInput, goodOutput, swIn, swOut,
    macAddress: mac, bindIp,
    rdmSupported: !!(status2 & 0x02),
    sacnCapable: !!(status2 & 0x10),
  };
}

// ─── Helpers ────────────────────────────────────────
export function packetToBase64(packet: Uint8Array): string {
  return btoa(String.fromCharCode(...packet));
}

export function base64ToPacket(b64: string): Uint8Array {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

export const ARTNET_PORT = 6454;
export const ARTNET_BROADCAST = '255.255.255.255';
