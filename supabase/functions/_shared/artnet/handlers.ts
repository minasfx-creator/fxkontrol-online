import type { ArtNetRequest, DMXUniverseData } from "./types.ts";
import { validateUniverse, requireUniverses } from "./validation.ts";
import { buildArtDmxPacket, buildArtPollPacket, buildArtSyncPacket, buildArtRdmPacket, toBase64 } from "./packets.ts";
import { jsonOk, jsonError } from "../response.ts";

export function handleValidate(universes: DMXUniverseData[] | undefined): Response {
  const guard = requireUniverses(universes);
  if (guard) return guard;

  const allErrors: string[] = [];
  for (const u of universes!) allErrors.push(...validateUniverse(u));

  return jsonOk({
    valid: allErrors.length === 0,
    errors: allErrors,
    universeCount: universes!.length,
    totalChannels: universes!.reduce((s, u) => s + (Array.isArray(u.channels) ? u.channels.length : 0), 0),
  });
}

export function handlePoll(targetIp?: string, targetPort?: number): Response {
  const packet = buildArtPollPacket();
  return jsonOk({
    success: true, type: 'ArtPoll', packetSize: 14, binary: toBase64(packet),
    target: { ip: targetIp || '255.255.255.255', port: targetPort || 6454, protocol: 'UDP' },
  });
}

export function handleSync(): Response {
  const packet = buildArtSyncPacket();
  return jsonOk({ success: true, type: 'ArtSync', packetSize: 14, binary: toBase64(packet) });
}

export function handleRdm(body: ArtNetRequest): Response {
  const packet = buildArtRdmPacket({
    rdmData: body.rdmData,
    universe: body.rdmUniverse,
    subnet: body.rdmSubnet,
    net: body.rdmNet,
  });
  return jsonOk({ success: true, type: 'ArtRdm', packetSize: packet.length, binary: toBase64(packet) });
}

export function handleExportBinary(universes: DMXUniverseData[], targetIp?: string, targetPort?: number): Response {
  const packets = universes.map(u => buildArtDmxPacket(u));
  const totalBytes = packets.reduce((s, p) => s + p.length, 0);
  const combined = new Uint8Array(totalBytes);
  let offset = 0;
  for (const p of packets) { combined.set(p, offset); offset += p.length; }

  return jsonOk({
    success: true,
    packetCount: packets.length,
    totalBytes,
    binary: toBase64(combined),
    format: 'Art-Net DMX (ArtDmx)',
    targetIp: targetIp || '255.255.255.255',
    targetPort: targetPort || 6454,
  });
}

export function handleSend(universes: DMXUniverseData[], targetIp?: string, targetPort?: number): Response {
  const packets = universes.map(u => buildArtDmxPacket(u));
  const totalBytes = packets.reduce((s, p) => s + p.length, 0);

  return jsonOk({
    success: true,
    message: `${packets.length} Art-Net packet(s) prepared`,
    packetCount: packets.length,
    totalBytes,
    target: { ip: targetIp || '255.255.255.255', port: targetPort || 6454, protocol: 'UDP' },
    packets: packets.map((p, i) => ({
      universe: universes[i].universe,
      subnet: universes[i].subnet,
      net: universes[i].net,
      channels: universes[i].channels.length,
      packetSize: p.length,
      hex: Array.from(p.slice(0, 18)).map(b => b.toString(16).padStart(2, '0')).join(' '),
    })),
  });
}
