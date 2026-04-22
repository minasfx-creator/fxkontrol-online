/**
 * Art-Net 4 — Shared Types & Constants
 */

export const ARTNET_HEADER = new TextEncoder().encode('Art-Net\0');
export const ARTNET_OPCODE_DMX = 0x5000;
export const ARTNET_PROTOCOL_VERSION = 14;

export interface DMXUniverseData {
  universe: number;    // 0-15
  subnet: number;      // 0-15
  net: number;         // 0-127
  channels: number[];  // up to 512 values, 0-255
  sequence: number;    // 0-255
}

export interface ArtNetRequest {
  action: 'send' | 'validate' | 'export-binary' | 'poll' | 'sync' | 'rdm';
  universes?: DMXUniverseData[];
  targetIp?: string;
  targetPort?: number;
  // RDM-specific fields
  rdmData?: string;
  rdmUniverse?: number;
  rdmSubnet?: number;
  rdmNet?: number;
}
