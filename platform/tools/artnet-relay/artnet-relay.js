#!/usr/bin/env node
/**
 * Art-Net UDP Relay — Local Bridge
 * 
 * Connects to the FXcommander web app via WebSocket and forwards
 * Art-Net DMX packets as UDP broadcasts on the local network (port 6454).
 * 
 * Usage:
 *   node artnet-relay.js [options]
 * 
 * Options:
 *   --port    WebSocket listen port        (default: 9001)
 *   --target  Art-Net target IP            (default: 255.255.255.255 broadcast)
 *   --artnet  Art-Net UDP port             (default: 6454)
 *   --bind    Local bind address           (default: 0.0.0.0)
 *   --verbose Show packet hex dumps        (default: false)
 * 
 * Requirements:
 *   npm install ws
 * 
 * The web app connects via WebSocket to ws://localhost:9001 and sends JSON:
 *   { "action": "dmx", "universe": 0, "subnet": 0, "net": 0, "channels": [0-255, ...] }
 * 
 * The relay builds the Art-Net ArtDmx packet and sends it via UDP broadcast.
 * Compatible with ArtNetominator, DMXControl, QLC+, and any Art-Net receiver.
 */

const dgram = require('dgram');
const http = require('http');

// --------------- CLI Args ---------------
const args = process.argv.slice(2);
function getArg(name, def) {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : def;
}

const WS_PORT     = parseInt(getArg('port', '9001'), 10);
const TARGET_IP   = getArg('target', '255.255.255.255');
const ARTNET_PORT = parseInt(getArg('artnet', '6454'), 10);
const BIND_ADDR   = getArg('bind', '0.0.0.0');
const VERBOSE     = args.includes('--verbose');

// --------------- Art-Net Packet Builder ---------------
const ARTNET_HEADER = Buffer.from('Art-Net\0');
const ARTNET_OPCODE_DMX = 0x5000;
const ARTNET_VERSION = 14;

let globalSequence = 1;

function buildArtDmxPacket(universe, subnet, net, channels) {
  const chCount = Math.min(512, channels.length);
  const padded = chCount % 2 === 0 ? chCount : chCount + 1;
  const packet = Buffer.alloc(18 + padded);
  let off = 0;

  // Header
  ARTNET_HEADER.copy(packet, off); off += 8;
  // OpCode (little-endian)
  packet.writeUInt16LE(ARTNET_OPCODE_DMX, off); off += 2;
  // Protocol version (big-endian)
  packet.writeUInt16BE(ARTNET_VERSION, off); off += 2;
  // Sequence
  packet[off++] = globalSequence & 0xFF;
  globalSequence = (globalSequence + 1) & 0xFF;
  if (globalSequence === 0) globalSequence = 1; // 0 = disable sequencing
  // Physical port
  packet[off++] = 0;
  // SubUni + Net
  packet[off++] = ((subnet & 0x0F) << 4) | (universe & 0x0F);
  packet[off++] = net & 0x7F;
  // Data length (big-endian)
  packet.writeUInt16BE(padded, off); off += 2;
  // Channel data
  for (let i = 0; i < padded; i++) {
    packet[off++] = (channels[i] || 0) & 0xFF;
  }
  return packet;
}

// --------------- UDP Socket ---------------
const udp = dgram.createSocket({ type: 'udp4', reuseAddr: true });
udp.on('error', (err) => {
  console.error(`[UDP] Error: ${err.message}`);
});
udp.bind(0, BIND_ADDR, () => {
  udp.setBroadcast(true);
  console.log(`[UDP] Socket ready — broadcasting to ${TARGET_IP}:${ARTNET_PORT}`);
});

let packetsSent = 0;
let lastStatsTime = Date.now();

function sendArtNet(universe, subnet, net, channels) {
  const packet = buildArtDmxPacket(universe, subnet, net, channels);
  udp.send(packet, 0, packet.length, ARTNET_PORT, TARGET_IP, (err) => {
    if (err) {
      console.error(`[UDP] Send error: ${err.message}`);
    } else {
      packetsSent++;
      if (VERBOSE) {
        const hex = packet.slice(0, 18).toString('hex').match(/.{2}/g).join(' ');
        console.log(`[ART-NET] U:${universe} S:${subnet} N:${net} CH:${channels.length} → ${hex}...`);
      }
    }
  });
}

// --------------- WebSocket Server (minimal, no deps) ---------------
// Using raw HTTP upgrade + RFC 6455 minimal frame parser
// For production, replace with `ws` package

const crypto = require('crypto');
const WS_MAGIC = '258EAFA5-E914-47DA-95CA-5AB4C15C2428';

const server = http.createServer((req, res) => {
  // Health check endpoint
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'running',
      packetsSent,
      uptime: process.uptime(),
      target: `${TARGET_IP}:${ARTNET_PORT}`,
    }));
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Art-Net Relay — connect via WebSocket\n');
});

const clients = new Set();

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

  clients.add(socket);
  console.log(`[WS] Client connected (${clients.size} total)`);

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
      if (opcode === 0x08) {
        // Close frame
        socket.end();
        return;
      }
      if (opcode === 0x09) {
        // Ping → Pong
        const pong = Buffer.alloc(2);
        pong[0] = 0x8A; pong[1] = 0;
        socket.write(pong);
        continue;
      }
      if (opcode === 0x01) {
        // Text frame — parse JSON
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
    clients.delete(socket);
    console.log(`[WS] Client disconnected (${clients.size} remaining)`);
  });

  socket.on('error', (err) => {
    clients.delete(socket);
    console.error(`[WS] Socket error: ${err.message}`);
  });
});

function wsSend(socket, data) {
  const json = JSON.stringify(data);
  const buf = Buffer.from(json, 'utf8');
  let header;
  if (buf.length < 126) {
    header = Buffer.alloc(2);
    header[0] = 0x81; // FIN + text
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

// --------------- Message Handler ---------------
function handleMessage(msg, socket) {
  if (msg.action === 'dmx') {
    const { universe = 0, subnet = 0, net = 0, channels = [] } = msg;
    if (!Array.isArray(channels) || channels.length === 0) {
      wsSend(socket, { error: 'No channel data' });
      return;
    }
    sendArtNet(universe, subnet, net, channels);
    // No ACK for performance — fire and forget
    return;
  }

  if (msg.action === 'dmx-batch') {
    // Multiple universes in one message
    const { universes = [] } = msg;
    for (const u of universes) {
      sendArtNet(u.universe || 0, u.subnet || 0, u.net || 0, u.channels || []);
    }
    return;
  }

  if (msg.action === 'ping') {
    wsSend(socket, { action: 'pong', packetsSent, uptime: process.uptime() });
    return;
  }

  if (msg.action === 'config') {
    wsSend(socket, {
      action: 'config',
      target: TARGET_IP,
      artnetPort: ARTNET_PORT,
      wsPort: WS_PORT,
      broadcast: true,
    });
    return;
  }

  wsSend(socket, { error: `Unknown action: ${msg.action}` });
}

// --------------- Stats ---------------
setInterval(() => {
  const now = Date.now();
  const elapsed = (now - lastStatsTime) / 1000;
  const rate = (packetsSent / elapsed).toFixed(1);
  if (packetsSent > 0) {
    console.log(`[STATS] ${packetsSent} packets sent (${rate} pkt/s) — ${clients.size} client(s)`);
  }
  packetsSent = 0;
  lastStatsTime = now;
}, 10000);

// --------------- Start ---------------
server.listen(WS_PORT, BIND_ADDR, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║       🎆 Art-Net UDP Relay — Running         ║');
  console.log('╠══════════════════════════════════════════════╣');
  console.log(`║  WebSocket:  ws://${BIND_ADDR}:${WS_PORT}`.padEnd(47) + '║');
  console.log(`║  Art-Net:    ${TARGET_IP}:${ARTNET_PORT} (UDP)`.padEnd(47) + '║');
  console.log(`║  Health:     http://localhost:${WS_PORT}/health`.padEnd(47) + '║');
  console.log('╠══════════════════════════════════════════════╣');
  console.log('║  Connect your browser app to the WS above.  ║');
  console.log('║  Open ArtNetominator on the same network.    ║');
  console.log('║  Press Ctrl+C to stop.                       ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log('');
});

process.on('SIGINT', () => {
  console.log('\n[RELAY] Shutting down...');
  for (const s of clients) s.destroy();
  udp.close();
  server.close();
  process.exit(0);
});
