import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Art-Net Bridge Edge Function
 * Receives DMX universe data from the web app and formats it as Art-Net packets.
 * In production, this would forward to a local Art-Net node via UDP.
 * For now, it validates, formats, and returns the Art-Net binary packet structure.
 */

// Art-Net packet constants
const ARTNET_HEADER = new TextEncoder().encode('Art-Net\0');
const ARTNET_OPCODE_DMX = 0x5000;
const ARTNET_PROTOCOL_VERSION = 14;

interface DMXUniverseData {
  universe: number;    // 0-32767
  subnet: number;      // 0-15
  net: number;         // 0-127
  channels: number[];  // 512 values, 0-255
  sequence: number;    // 0-255 (auto-increment)
}

interface ArtNetRequest {
  action: 'send' | 'validate' | 'export-binary';
  universes: DMXUniverseData[];
  targetIp?: string;
  targetPort?: number;
}

/**
 * Build an Art-Net DMX packet (ArtDmx).
 * Follows Art-Net 4 specification.
 */
function buildArtDmxPacket(data: DMXUniverseData): Uint8Array {
  const channelCount = Math.min(512, data.channels.length);
  // Ensure even channel count (Art-Net spec)
  const paddedCount = channelCount % 2 === 0 ? channelCount : channelCount + 1;
  const packetSize = 18 + paddedCount; // header(8) + opcode(2) + version(2) + seq(1) + physical(1) + universe(2) + length(2) + data

  const packet = new Uint8Array(packetSize);
  let offset = 0;

  // Header: "Art-Net\0"
  packet.set(ARTNET_HEADER, offset);
  offset += 8;

  // OpCode: 0x5000 (little-endian)
  packet[offset++] = ARTNET_OPCODE_DMX & 0xFF;
  packet[offset++] = (ARTNET_OPCODE_DMX >> 8) & 0xFF;

  // Protocol Version: 14 (big-endian)
  packet[offset++] = 0;
  packet[offset++] = ARTNET_PROTOCOL_VERSION;

  // Sequence: 0-255
  packet[offset++] = data.sequence & 0xFF;

  // Physical port (0)
  packet[offset++] = 0;

  // Universe (SubUni + Net)
  const subUni = (data.subnet & 0x0F) << 4 | (data.universe & 0x0F);
  packet[offset++] = subUni;
  packet[offset++] = data.net & 0x7F;

  // Data length (big-endian)
  packet[offset++] = (paddedCount >> 8) & 0xFF;
  packet[offset++] = paddedCount & 0xFF;

  // DMX channel data
  for (let i = 0; i < paddedCount; i++) {
    packet[offset++] = (data.channels[i] ?? 0) & 0xFF;
  }

  return packet;
}

/**
 * Validate DMX universe data.
 */
function validateUniverse(data: DMXUniverseData): string[] {
  const errors: string[] = [];
  if (data.universe < 0 || data.universe > 15) errors.push(`Universe ${data.universe} out of range (0-15)`);
  if (data.subnet < 0 || data.subnet > 15) errors.push(`Subnet ${data.subnet} out of range (0-15)`);
  if (data.net < 0 || data.net > 127) errors.push(`Net ${data.net} out of range (0-127)`);
  if (!data.channels || data.channels.length === 0) errors.push('No channel data');
  if (data.channels.length > 512) errors.push(`Too many channels: ${data.channels.length} (max 512)`);

  // Validate channel values
  for (let i = 0; i < data.channels.length; i++) {
    if (data.channels[i] < 0 || data.channels[i] > 255) {
      errors.push(`Channel ${i + 1} value ${data.channels[i]} out of range (0-255)`);
      break; // Only report first bad channel
    }
  }

  return errors;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: ArtNetRequest = await req.json();
    const { action, universes, targetIp, targetPort } = body;

    if (!universes || !Array.isArray(universes) || universes.length === 0) {
      return new Response(JSON.stringify({ error: 'No universe data provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate all universes
    const allErrors: string[] = [];
    for (const u of universes) {
      allErrors.push(...validateUniverse(u));
    }

    if (action === 'validate') {
      return new Response(JSON.stringify({
        valid: allErrors.length === 0,
        errors: allErrors,
        universeCount: universes.length,
        totalChannels: universes.reduce((s, u) => s + u.channels.length, 0),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Art-Net 4: ArtPoll
    if (action === 'poll') {
      const ARTNET_HDR = new TextEncoder().encode('Art-Net\0');
      const packet = new Uint8Array(14);
      packet.set(ARTNET_HDR, 0);
      packet[8] = 0x00; packet[9] = 0x20; // OpPoll LE
      packet[10] = 0; packet[11] = 14; // version
      packet[12] = 0x02; packet[13] = 0; // flags
      const b64 = btoa(String.fromCharCode(...packet));
      return new Response(JSON.stringify({
        success: true, type: 'ArtPoll', packetSize: 14, binary: b64,
        target: { ip: targetIp || '255.255.255.255', port: targetPort || 6454, protocol: 'UDP' },
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Art-Net 4: ArtSync
    if (action === 'sync') {
      const ARTNET_HDR = new TextEncoder().encode('Art-Net\0');
      const packet = new Uint8Array(14);
      packet.set(ARTNET_HDR, 0);
      packet[8] = 0x00; packet[9] = 0x52; // OpSync LE
      packet[10] = 0; packet[11] = 14;
      const b64 = btoa(String.fromCharCode(...packet));
      return new Response(JSON.stringify({
        success: true, type: 'ArtSync', packetSize: 14, binary: b64,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Art-Net 4: ArtRdm
    if (action === 'rdm' as any) {
      const { rdmData, universe: rdmUniverse, subnet: rdmSubnet, net: rdmNet } = body as any;
      const ARTNET_HDR = new TextEncoder().encode('Art-Net\0');
      const rdmBytes = rdmData ? Uint8Array.from(atob(rdmData), c => c.charCodeAt(0)) : new Uint8Array(0);
      const packet = new Uint8Array(24 + rdmBytes.length);
      packet.set(ARTNET_HDR, 0);
      packet[8] = 0x00; packet[9] = 0x83; // OpRdm LE
      packet[10] = 0; packet[11] = 14;
      packet[12] = 0x01; // RdmVer
      const subUni = ((rdmSubnet || 0) & 0x0F) << 4 | ((rdmUniverse || 0) & 0x0F);
      packet[21] = subUni;
      packet[22] = (rdmNet || 0) & 0x7F;
      packet.set(rdmBytes, 24);
      const b64 = btoa(String.fromCharCode(...packet));
      return new Response(JSON.stringify({
        success: true, type: 'ArtRdm', packetSize: packet.length, binary: b64,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (allErrors.length > 0) {
      return new Response(JSON.stringify({ error: 'Validation failed', details: allErrors }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build Art-Net packets
    const packets = universes.map(u => buildArtDmxPacket(u));
    const totalBytes = packets.reduce((s, p) => s + p.length, 0);

    if (action === 'export-binary') {
      // Return packets as base64 for download
      const combined = new Uint8Array(totalBytes);
      let offset = 0;
      for (const p of packets) {
        combined.set(p, offset);
        offset += p.length;
      }
      const base64 = btoa(String.fromCharCode(...combined));

      return new Response(JSON.stringify({
        success: true,
        packetCount: packets.length,
        totalBytes,
        binary: base64,
        format: 'Art-Net DMX (ArtDmx)',
        targetIp: targetIp || '255.255.255.255',
        targetPort: targetPort || 6454,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Action: 'send' — in web context we can't send UDP directly.
    // Return the formatted packets for a local bridge application to send.
    return new Response(JSON.stringify({
      success: true,
      message: `${packets.length} Art-Net packet(s) prepared`,
      packetCount: packets.length,
      totalBytes,
      target: {
        ip: targetIp || '255.255.255.255',
        port: targetPort || 6454,
        protocol: 'UDP',
      },
      packets: packets.map((p, i) => ({
        universe: universes[i].universe,
        subnet: universes[i].subnet,
        net: universes[i].net,
        channels: universes[i].channels.length,
        packetSize: p.length,
        hex: Array.from(p.slice(0, 18)).map(b => b.toString(16).padStart(2, '0')).join(' '),
      })),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
