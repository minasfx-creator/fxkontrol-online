#!/usr/bin/env node
/**
 * sACN (E1.31) Multicast → WebSocket Bridge
 *
 * Receives sACN DMX data from grandMA3 (or any E1.31 source) via UDP multicast
 * and forwards it to the FXcommander browser app via WebSocket.
 * Zero npm dependencies.
 *
 * Usage:
 *   node sacn-bridge.js [options]
 *
 * Options:
 *   --port       WebSocket listen port          (default: 9003)
 *   --bind       Local bind address             (default: 0.0.0.0)
 *   --interface  Multicast interface IP         (default: 0.0.0.0)
 *   --verbose    Show packet info               (default: false)
 *
 * Architecture:
 *   grandMA3 sACN output ──UDP multicast 239.255.x.x:5568──► Bridge ──WS JSON──► Browser
 */

const dgram = require('dgram');
const http = require('http');
const crypto = require('crypto');

// ─── CLI Args ────────────────────────────────────────────
const args = process.argv.slice(2);
function getArg(name, def) {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : def;
}

const WS_PORT       = parseInt(getArg('port', '9003'), 10);
const BIND_ADDR     = getArg('bind', '0.0.0.0');
const MC_INTERFACE  = getArg('interface', '0.0.0.0');
const VERBOSE       = args.includes('--verbose');

const SACN_PORT = 5568;
const SACN_MULTICAST_BASE = '239.255.';

// ─── E1.31 Parser ────────────────────────────────────────

function universeToMulticast(universe) {
  const hi = (universe >> 8) & 0xFF;
  const lo = universe & 0xFF;
  return `${SACN_MULTICAST_BASE}${hi}.${lo}`;
}

function parseE131Packet(buf) {
  if (buf.length < 126) return null;

  // Root layer — check preamble
  const preamble = buf.readUInt16BE(0);
  if (preamble !== 0x0010) return null;

  // Check ACN packet identifier
  const acnId = buf.slice(4, 16);
  const expectedId = Buffer.from([
    0x41, 0x53, 0x43, 0x2D, 0x45, 0x31, 0x2E, 0x31,
    0x37, 0x00, 0x00, 0x00
  ]);
  if (!acnId.equals(expectedId)) return null;

  // Framing layer
  const sourceName = buf.slice(44, 108).toString('utf8').replace(/\0+$/, '');
  const priority = buf[108];
  const syncAddr = buf.readUInt16BE(109);
  const sequence = buf[111];
  const options = buf[112];
  const universe = buf.readUInt16BE(113);

  // DMP layer — property values start at offset 126
  const dmpStart = 126;
  const propCount = buf.readUInt16BE(123) - 1; // subtract start code
  const startCode = buf[dmpStart - 1];

  const channels = [];
  const channelCount = Math.min(512, buf.length - dmpStart);
  for (let i = 0; i < channelCount; i++) {
    channels.push(buf[dmpStart + i]);
  }

  return {
    sourceName,
    priority,
    sequence,
    universe,
    syncAddr,
    options,
    startCode,
    channels,
  };
}

// ─── UDP Multicast Listener ──────────────────────────────

const udpSocket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
const joinedGroups = new Set();
let packetCount = 0;
const discoveredUniverses = new Set();

udpSocket.on('error', err => console.error(`[UDP] Error: ${err.message}`));

udpSocket.on('message', (msg, rinfo) => {
  packetCount++;
  const parsed = parseE131Packet(msg);
  if (!parsed) return;

  discoveredUniverses.add(parsed.universe);

  if (VERBOSE) {
    console.log(`[sACN] U:${parsed.universe} Seq:${parsed.sequence} Pri:${parsed.priority} Src:${parsed.sourceName} CH:${parsed.channels.length}`);
  }

  // Forward to subscribed WS clients
  broadcastSACN(parsed);
});

udpSocket.bind(SACN_PORT, BIND_ADDR, () => {
  console.log(`[UDP] sACN listener on port ${SACN_PORT}`);
});

function joinMulticast(universe) {
  const addr = universeToMulticast(universe);
  if (joinedGroups.has(addr)) return;
  try {
    udpSocket.addMembership(addr, MC_INTERFACE);
    joinedGroups.add(addr);
    console.log(`[MULTICAST] Joined ${addr} (universe ${universe})`);
  } catch (err) {
    console.error(`[MULTICAST] Failed to join ${addr}: ${err.message}`);
  }
}

function leaveMulticast(universe) {
  const addr = universeToMulticast(universe);
  if (!joinedGroups.has(addr)) return;
  try {
    udpSocket.dropMembership(addr, MC_INTERFACE);
    joinedGroups.delete(addr);
    console.log(`[MULTICAST] Left ${addr} (universe ${universe})`);
  } catch (err) {
    console.error(`[MULTICAST] Failed to leave ${addr}: ${err.message}`);
  }
}

// ─── WebSocket Server (raw RFC 6455, zero deps) ──────────

const WS_MAGIC = '258EAFA5-E914-47DA-95CA-5AB4C15C2428';

const wsClients = new Map(); // socket → { subscribedUniverses: Set }

function wsSendText(socket, data) {
  const json = JSON.stringify(data);
  const buf = Buffer.from(json, 'utf8');
  let header;
  if (buf.length < 126) {
    header = Buffer.alloc(2);
    header[0] = 0x81;
    header[1] = buf.length;
  } else if (buf.length < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(buf.length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(buf.length), 2);
  }
  socket.write(Buffer.concat([header, buf]));
}

function broadcastSACN(parsed) {
  for (const [socket, info] of wsClients) {
    if (info.subscribedUniverses.has(parsed.universe) || info.subscribedUniverses.has(0)) {
      try {
        wsSendText(socket, {
          type: 'sacn_data',
          universe: parsed.universe,
          priority: parsed.priority,
          sequence: parsed.sequence,
          sourceName: parsed.sourceName,
          channels: parsed.channels,
        });
      } catch {}
    }
  }
}

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'running',
      packetCount,
      clients: wsClients.size,
      joinedGroups: [...joinedGroups],
      discoveredUniverses: [...discoveredUniverses],
      uptime: process.uptime(),
    }));
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('sACN Bridge — connect via WebSocket\n');
});

server.on('upgrade', (req, socket, head) => {
  const key = req.headers['sec-websocket-key'];
  if (!key) { socket.destroy(); return; }

  const accept = crypto.createHash('sha1')
    .update(key + WS_MAGIC)
    .digest('base64');

  socket.write([
    'HTTP/1.1 101 Switching Protocols',
    'Upgrade: websocket',
    'Connection: Upgrade',
    `Sec-WebSocket-Accept: ${accept}`,
    '', ''
  ].join('\r\n'));

  wsClients.set(socket, { subscribedUniverses: new Set() });
  console.log(`[WS] Client connected (${wsClients.size} total)`);

  // Send discovery info
  wsSendText(socket, {
    type: 'discovery',
    universes: [...discoveredUniverses],
  });

  let buffer = Buffer.alloc(0);

  socket.on('data', (data) => {
    buffer = Buffer.concat([buffer, data]);

    while (buffer.length >= 2) {
      const firstByte = buffer[0];
      const secondByte = buffer[1];
      const masked = (secondByte & 0x80) !== 0;
      let payloadLen = secondByte & 0x7F;
      let offset = 2;

      if (payloadLen === 126) {
        if (buffer.length < 4) return;
        payloadLen = buffer.readUInt16BE(2);
        offset = 4;
      } else if (payloadLen === 127) {
        if (buffer.length < 10) return;
        payloadLen = Number(buffer.readBigUInt64BE(2));
        offset = 10;
      }

      const maskSize = masked ? 4 : 0;
      const totalLen = offset + maskSize + payloadLen;
      if (buffer.length < totalLen) return;

      const mask = masked ? buffer.slice(offset, offset + maskSize) : null;
      const payload = buffer.slice(offset + maskSize, totalLen);

      if (masked && mask) {
        for (let i = 0; i < payload.length; i++) {
          payload[i] ^= mask[i % 4];
        }
      }

      buffer = buffer.slice(totalLen);

      const opcode = firstByte & 0x0F;
      if (opcode === 0x08) { socket.end(); return; }
      if (opcode === 0x09) {
        const pong = Buffer.alloc(2);
        pong[0] = 0x8A; pong[1] = 0;
        socket.write(pong);
        continue;
      }

      if (opcode === 0x01) {
        try {
          const msg = JSON.parse(payload.toString('utf8'));
          handleMessage(msg, socket);
        } catch (e) {
          console.error('[WS] Bad JSON:', e.message);
        }
      }
    }
  });

  socket.on('close', () => {
    wsClients.delete(socket);
    console.log(`[WS] Client disconnected (${wsClients.size} remaining)`);
  });

  socket.on('error', (err) => {
    wsClients.delete(socket);
    console.error(`[WS] Socket error: ${err.message}`);
  });
});

function handleMessage(msg, socket) {
  const info = wsClients.get(socket);
  if (!info) return;

  if (msg.type === 'subscribe') {
    const universes = Array.isArray(msg.universes) ? msg.universes : [msg.universes];
    for (const u of universes) {
      const uni = parseInt(u, 10);
      if (isNaN(uni) || uni < 1 || uni > 63999) continue;
      info.subscribedUniverses.add(uni);
      joinMulticast(uni);
    }
    wsSendText(socket, {
      type: 'subscribed',
      universes: [...info.subscribedUniverses],
    });
    return;
  }

  if (msg.type === 'unsubscribe') {
    const universes = Array.isArray(msg.universes) ? msg.universes : [msg.universes];
    for (const u of universes) {
      info.subscribedUniverses.delete(parseInt(u, 10));
    }
    wsSendText(socket, {
      type: 'unsubscribed',
      universes: [...info.subscribedUniverses],
    });
    return;
  }

  if (msg.type === 'discover') {
    wsSendText(socket, {
      type: 'discovery',
      universes: [...discoveredUniverses],
    });
    return;
  }

  if (msg.type === 'ping') {
    wsSendText(socket, { type: 'pong', packetCount, uptime: process.uptime() });
    return;
  }
}

// ─── Stats ───────────────────────────────────────────────
let lastCount = 0;
setInterval(() => {
  const delta = packetCount - lastCount;
  if (delta > 0) {
    console.log(`[STATS] ${delta} sACN packets (${(delta / 10).toFixed(1)} pkt/s) — ${wsClients.size} client(s) — ${joinedGroups.size} group(s)`);
  }
  lastCount = packetCount;
}, 10000);

// ─── Start ───────────────────────────────────────────────
server.listen(WS_PORT, BIND_ADDR, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║       📡 sACN Bridge — E1.31 — Running           ║');
  console.log('╠══════════════════════════════════════════════════╣');
  console.log(`║  WebSocket:  ws://${BIND_ADDR}:${WS_PORT}`.padEnd(51) + '║');
  console.log(`║  sACN Port:  ${SACN_PORT} (UDP multicast)`.padEnd(51) + '║');
  console.log(`║  Interface:  ${MC_INTERFACE}`.padEnd(51) + '║');
  console.log(`║  Health:     http://localhost:${WS_PORT}/health`.padEnd(51) + '║');
  console.log('╠══════════════════════════════════════════════════╣');
  console.log('║  Clients subscribe to universes via WS JSON.     ║');
  console.log('║  Bridge joins multicast groups automatically.     ║');
  console.log('║  Press Ctrl+C to stop.                            ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('');
});

process.on('SIGINT', () => {
  console.log('\n[SACN-BRIDGE] Shutting down...');
  for (const [s] of wsClients) s.destroy();
  for (const group of joinedGroups) {
    try { udpSocket.dropMembership(group, MC_INTERFACE); } catch {}
  }
  udpSocket.close();
  server.close();
  process.exit(0);
});
