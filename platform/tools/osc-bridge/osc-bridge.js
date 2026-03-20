#!/usr/bin/env node
/**
 * OSC UDP ↔ WebSocket Bridge
 *
 * Bridges the FXcommander browser app to a real grandMA3 console via OSC.
 * Zero npm dependencies — uses only Node.js built-in modules.
 *
 * Usage:
 *   node osc-bridge.js [options]
 *
 * Options:
 *   --port      WebSocket listen port           (default: 9002)
 *   --target    MA3 console IP                  (default: 192.168.1.100)
 *   --tx-port   OSC send port (to MA3)          (default: 8000)
 *   --rx-port   OSC receive port (from MA3)     (default: 9000)
 *   --bind      Local bind address              (default: 0.0.0.0)
 *   --verbose   Show packet hex dumps           (default: false)
 *
 * Architecture:
 *   Browser (oscEngine.ts)  ──WS binary──►  Bridge  ──UDP──►  grandMA3 :8000
 *   Browser (oscEngine.ts)  ◄──WS binary──  Bridge  ◄──UDP──  grandMA3 :9000
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

let WS_PORT   = parseInt(getArg('port', '9002'), 10);
let TARGET_IP = getArg('target', '192.168.1.100');
let TX_PORT   = parseInt(getArg('tx-port', '8000'), 10);
let RX_PORT   = parseInt(getArg('rx-port', '9000'), 10);
const BIND_ADDR = getArg('bind', '0.0.0.0');
const VERBOSE   = args.includes('--verbose');

// ─── UDP Sockets ─────────────────────────────────────────

// TX socket — sends OSC to MA3
const txSocket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
txSocket.on('error', err => console.error(`[UDP-TX] Error: ${err.message}`));
txSocket.bind(0, BIND_ADDR);

// RX socket — receives OSC from MA3
const rxSocket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
rxSocket.on('error', err => console.error(`[UDP-RX] Error: ${err.message}`));

let txCount = 0;
let rxCount = 0;

rxSocket.on('message', (msg, rinfo) => {
  rxCount++;
  if (VERBOSE) {
    const hex = msg.slice(0, Math.min(32, msg.length)).toString('hex').match(/.{2}/g).join(' ');
    console.log(`[UDP-RX] ${rinfo.address}:${rinfo.port} → ${msg.length}B: ${hex}...`);
  }
  // Forward raw binary OSC to all connected WS clients
  broadcastBinary(msg);
});

rxSocket.bind(RX_PORT, BIND_ADDR, () => {
  console.log(`[UDP-RX] Listening for OSC on port ${RX_PORT}`);
});

function sendOSCToMA3(data) {
  txSocket.send(data, 0, data.length, TX_PORT, TARGET_IP, (err) => {
    if (err) console.error(`[UDP-TX] Send error: ${err.message}`);
    else {
      txCount++;
      if (VERBOSE) {
        const hex = data.slice(0, Math.min(32, data.length)).toString('hex').match(/.{2}/g).join(' ');
        console.log(`[UDP-TX] → ${TARGET_IP}:${TX_PORT} ${data.length}B: ${hex}...`);
      }
    }
  });
}

// ─── WebSocket Server (raw RFC 6455, zero deps) ──────────
const WS_MAGIC = '258EAFA5-E914-47DA-95CA-5AB4C15C2428';
const clients = new Set();

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'running',
      target: `${TARGET_IP}:${TX_PORT}`,
      rxPort: RX_PORT,
      txCount,
      rxCount,
      clients: clients.size,
      uptime: process.uptime(),
    }));
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('OSC Bridge — connect via WebSocket\n');
});

function wsSendBinary(socket, data) {
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
  let header;
  if (buf.length < 126) {
    header = Buffer.alloc(2);
    header[0] = 0x82; // FIN + binary
    header[1] = buf.length;
  } else if (buf.length < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x82;
    header[1] = 126;
    header.writeUInt16BE(buf.length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x82;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(buf.length), 2);
  }
  socket.write(Buffer.concat([header, buf]));
}

function wsSendText(socket, data) {
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

function broadcastBinary(data) {
  for (const client of clients) {
    try { wsSendBinary(client, data); } catch {}
  }
}

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
      if (opcode === 0x08) { socket.end(); return; }
      if (opcode === 0x09) {
        const pong = Buffer.alloc(2);
        pong[0] = 0x8A; pong[1] = 0;
        socket.write(pong);
        continue;
      }

      // Text frame — JSON config message
      if (opcode === 0x01) {
        try {
          const msg = JSON.parse(payload.toString('utf8'));
          if (msg.type === 'config') {
            if (msg.host) TARGET_IP = msg.host;
            if (msg.txPort) TX_PORT = parseInt(msg.txPort, 10);
            if (msg.rxPort) RX_PORT = parseInt(msg.rxPort, 10);
            console.log(`[CONFIG] Target: ${TARGET_IP}:${TX_PORT}, RX: ${RX_PORT}`);
            wsSendText(socket, { type: 'config-ack', host: TARGET_IP, txPort: TX_PORT, rxPort: RX_PORT });
          } else if (msg.type === 'ping') {
            wsSendText(socket, { type: 'pong', txCount, rxCount, uptime: process.uptime() });
          }
        } catch (e) {
          console.error('[WS] Bad JSON:', e.message);
        }
        continue;
      }

      // Binary frame — raw OSC packet, forward to MA3 via UDP
      if (opcode === 0x02) {
        sendOSCToMA3(payload);
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

// ─── Stats ───────────────────────────────────────────────
let lastTx = 0, lastRx = 0;
setInterval(() => {
  const dtx = txCount - lastTx;
  const drx = rxCount - lastRx;
  if (dtx > 0 || drx > 0) {
    console.log(`[STATS] TX:${dtx} RX:${drx} (total TX:${txCount} RX:${rxCount}) — ${clients.size} client(s)`);
  }
  lastTx = txCount;
  lastRx = rxCount;
}, 10000);

// ─── Start ───────────────────────────────────────────────
server.listen(WS_PORT, BIND_ADDR, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║       🎛  OSC Bridge — grandMA3 — Running        ║');
  console.log('╠══════════════════════════════════════════════════╣');
  console.log(`║  WebSocket:  ws://${BIND_ADDR}:${WS_PORT}`.padEnd(51) + '║');
  console.log(`║  MA3 Target: ${TARGET_IP}:${TX_PORT} (UDP TX)`.padEnd(51) + '║');
  console.log(`║  MA3 Listen: 0.0.0.0:${RX_PORT} (UDP RX)`.padEnd(51) + '║');
  console.log(`║  Health:     http://localhost:${WS_PORT}/health`.padEnd(51) + '║');
  console.log('╠══════════════════════════════════════════════════╣');
  console.log('║  Browser sends binary OSC → relay → MA3 console  ║');
  console.log('║  MA3 responses → relay → browser (bidirectional)  ║');
  console.log('║  Press Ctrl+C to stop.                            ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('');
});

process.on('SIGINT', () => {
  console.log('\n[OSC-BRIDGE] Shutting down...');
  for (const s of clients) s.destroy();
  txSocket.close();
  rxSocket.close();
  server.close();
  process.exit(0);
});
