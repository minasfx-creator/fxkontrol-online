#!/usr/bin/env node
/**
 * MVR-xchange Bridge — mDNS Discovery + TCP MVR ↔ WebSocket Bridge
 *
 * Discovers grandMA3 consoles on the LAN via mDNS (_mvrxchange._tcp.local),
 * connects to them via TCP (MVR-xchange / ANSI E1.67 JSON protocol),
 * and relays everything to the browser via WebSocket on port 9004.
 *
 * Usage:
 *   node mvr-xchange-bridge.js [options]
 *
 * Options:
 *   --port       WebSocket listen port         (default: 9004)
 *   --bind       Bind address                  (default: 0.0.0.0)
 *   --interface  mDNS multicast interface      (default: 0.0.0.0)
 *   --verbose    Show all mDNS/MVR traffic     (default: false)
 *
 * Zero npm dependencies — uses Node.js built-in dgram, net, http, crypto.
 */

const dgram = require('dgram');
const net = require('net');
const http = require('http');
const crypto = require('crypto');

// ─── CLI Args ────────────────────────────────────────
const args = process.argv.slice(2);
function getArg(name, def) {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : def;
}

const WS_PORT = parseInt(getArg('port', '9004'), 10);
const BIND_ADDR = getArg('bind', '0.0.0.0');
const MC_INTERFACE = getArg('interface', '0.0.0.0');
const VERBOSE = args.includes('--verbose');

const MDNS_ADDR = '224.0.0.251';
const MDNS_PORT = 5353;
const MVR_SERVICE = '_mvrxchange._tcp.local';
const WS_MAGIC = '258EAFA5-E914-47DA-95CA-5AB4C15C2428';

// ─── State ───────────────────────────────────────────
const discoveredStations = new Map(); // uuid -> { name, ip, port, provider, uuid, lastSeen }
const tcpConnections = new Map(); // uuid -> net.Socket
const wsClients = new Set();
let stats = { mdnsPackets: 0, mvrMessages: 0, wsMessages: 0 };

// ─── mDNS Listener ──────────────────────────────────
const mdns = dgram.createSocket({ type: 'udp4', reuseAddr: true });

mdns.on('error', (err) => {
  console.error(`[mDNS] Error: ${err.message}`);
});

mdns.on('message', (msg, rinfo) => {
  stats.mdnsPackets++;
  try {
    const parsed = parseDNSPacket(msg);
    if (!parsed) return;

    // Look for _mvrxchange._tcp.local PTR/SRV/TXT records
    for (const record of [...parsed.answers, ...parsed.additionals]) {
      if (record.type === 'PTR' && record.name.includes('_mvrxchange._tcp')) {
        if (VERBOSE) console.log(`[mDNS] PTR: ${record.data}`);
      }
      if (record.type === 'SRV' && record.name.includes('_mvrxchange')) {
        const station = {
          name: record.name.split('._mvrxchange')[0] || 'Unknown',
          ip: rinfo.address,
          port: record.data.port || 9100,
          provider: '',
          uuid: '',
          lastSeen: Date.now(),
        };

        // Look for TXT records with provider/UUID info
        for (const txt of [...parsed.answers, ...parsed.additionals]) {
          if (txt.type === 'TXT') {
            const entries = parseTXTRecord(txt.data);
            if (entries.StationUUID) station.uuid = entries.StationUUID;
            if (entries.Provider) station.provider = entries.Provider;
            if (entries.StationName) station.name = entries.StationName;
          }
        }

        // Look for A records
        for (const a of [...parsed.answers, ...parsed.additionals]) {
          if (a.type === 'A') {
            station.ip = a.data;
          }
        }

        if (!station.uuid) station.uuid = `mdns-${station.ip}-${station.port}`;

        const existing = discoveredStations.get(station.uuid);
        discoveredStations.set(station.uuid, station);

        if (!existing) {
          console.log(`[mDNS] Discovered: ${station.name} @ ${station.ip}:${station.port} (${station.provider})`);
          broadcastToWS(JSON.stringify({
            type: 'mdns_service',
            station,
          }));
        }
      }
    }
  } catch (e) {
    if (VERBOSE) console.error(`[mDNS] Parse error: ${e.message}`);
  }
});

mdns.bind(MDNS_PORT, () => {
  try {
    mdns.addMembership(MDNS_ADDR, MC_INTERFACE);
    mdns.setMulticastTTL(255);
    console.log(`[mDNS] Listening for ${MVR_SERVICE} on ${MDNS_ADDR}:${MDNS_PORT}`);
  } catch (e) {
    console.error(`[mDNS] Membership error: ${e.message}`);
  }
});

// ─── Minimal DNS Packet Parser ──────────────────────
function parseDNSPacket(buf) {
  if (buf.length < 12) return null;
  const qdCount = buf.readUInt16BE(4);
  const anCount = buf.readUInt16BE(6);
  const nsCount = buf.readUInt16BE(8);
  const arCount = buf.readUInt16BE(10);
  let offset = 12;

  // Skip questions
  for (let i = 0; i < qdCount; i++) {
    const { name, offset: newOff } = readName(buf, offset);
    offset = newOff + 4; // QTYPE + QCLASS
  }

  const answers = [];
  const additionals = [];

  function readRecords(count, target) {
    for (let i = 0; i < count && offset < buf.length; i++) {
      try {
        const { name, offset: nameEnd } = readName(buf, offset);
        offset = nameEnd;
        if (offset + 10 > buf.length) break;
        const type = buf.readUInt16BE(offset); offset += 2;
        const cls = buf.readUInt16BE(offset); offset += 2;
        const ttl = buf.readUInt32BE(offset); offset += 4;
        const rdLen = buf.readUInt16BE(offset); offset += 2;
        if (offset + rdLen > buf.length) break;
        const rdata = buf.slice(offset, offset + rdLen);
        offset += rdLen;

        const record = { name, typeNum: type };
        if (type === 12) { // PTR
          record.type = 'PTR';
          record.data = readName(buf, offset - rdLen).name;
        } else if (type === 33) { // SRV
          record.type = 'SRV';
          record.data = {
            priority: rdata.readUInt16BE(0),
            weight: rdata.readUInt16BE(2),
            port: rdata.readUInt16BE(4),
            target: readName(buf, offset - rdLen + 6).name,
          };
        } else if (type === 16) { // TXT
          record.type = 'TXT';
          record.data = rdata;
        } else if (type === 1) { // A
          record.type = 'A';
          record.data = `${rdata[0]}.${rdata[1]}.${rdata[2]}.${rdata[3]}`;
        } else {
          record.type = 'OTHER';
          record.data = rdata;
        }
        target.push(record);
      } catch (e) { break; }
    }
  }

  readRecords(anCount, answers);
  readRecords(nsCount, answers); // NS as answers
  readRecords(arCount, additionals);

  return { answers, additionals };
}

function readName(buf, offset) {
  const parts = [];
  let jumped = false;
  let jumpOffset = offset;
  let maxLen = 256;

  while (offset < buf.length && maxLen-- > 0) {
    const len = buf[offset];
    if (len === 0) { offset++; break; }
    if ((len & 0xC0) === 0xC0) {
      if (!jumped) jumpOffset = offset + 2;
      offset = ((len & 0x3F) << 8) | buf[offset + 1];
      jumped = true;
      continue;
    }
    offset++;
    if (offset + len > buf.length) break;
    parts.push(buf.slice(offset, offset + len).toString('utf8'));
    offset += len;
  }

  return { name: parts.join('.'), offset: jumped ? jumpOffset : offset };
}

function parseTXTRecord(data) {
  const entries = {};
  let off = 0;
  while (off < data.length) {
    const len = data[off++];
    if (off + len > data.length) break;
    const str = data.slice(off, off + len).toString('utf8');
    off += len;
    const eq = str.indexOf('=');
    if (eq > 0) {
      entries[str.slice(0, eq)] = str.slice(eq + 1);
    }
  }
  return entries;
}

// ─── Send mDNS Query ────────────────────────────────
function sendMDNSQuery() {
  // Build a minimal DNS query for _mvrxchange._tcp.local
  const labels = MVR_SERVICE.split('.');
  let nameLen = 1; // trailing null
  for (const l of labels) nameLen += 1 + l.length;

  const buf = Buffer.alloc(12 + nameLen + 4);
  // Transaction ID
  buf.writeUInt16BE(0, 0);
  // Flags: standard query
  buf.writeUInt16BE(0, 2);
  // Questions: 1
  buf.writeUInt16BE(1, 4);

  let off = 12;
  for (const label of labels) {
    buf[off++] = label.length;
    buf.write(label, off, 'utf8');
    off += label.length;
  }
  buf[off++] = 0; // end of name
  buf.writeUInt16BE(12, off); off += 2; // QTYPE: PTR
  buf.writeUInt16BE(1, off); off += 2;  // QCLASS: IN

  mdns.send(buf, 0, buf.length, MDNS_PORT, MDNS_ADDR, (err) => {
    if (err) console.error(`[mDNS] Query send error: ${err.message}`);
    else if (VERBOSE) console.log('[mDNS] Sent PTR query for ' + MVR_SERVICE);
  });
}

// Periodic mDNS queries
setInterval(sendMDNSQuery, 10000);
setTimeout(sendMDNSQuery, 1000);

// ─── TCP MVR-xchange Client ────────────────────────
function connectToStation(station) {
  if (tcpConnections.has(station.uuid)) return;

  console.log(`[MVR] Connecting to ${station.name} @ ${station.ip}:${station.port}`);
  const sock = net.createConnection({ host: station.ip, port: station.port });
  let buffer = '';

  sock.on('connect', () => {
    console.log(`[MVR] Connected to ${station.name}`);
    tcpConnections.set(station.uuid, sock);

    // Send mvr_join
    const joinMsg = JSON.stringify({
      Type: 'MVR_JOIN',
      verMajor: 1, verMinor: 6,
      StationName: 'FXKontrol',
      StationUUID: crypto.randomUUID(),
      Provider: 'FXKontrol v1.0',
    });
    sock.write(joinMsg + '\n');

    // Notify browser
    broadcastToWS(JSON.stringify({
      type: 'mvr_join',
      stationName: station.name,
      stationUUID: station.uuid,
      provider: station.provider,
      ip: station.ip,
    }));
  });

  sock.on('data', (data) => {
    buffer += data.toString('utf8');
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const msg = JSON.parse(line);
        stats.mvrMessages++;
        handleMVRMessage(station, msg);
      } catch (e) {
        if (VERBOSE) console.error(`[MVR] JSON parse error: ${e.message}`);
      }
    }
  });

  sock.on('error', (err) => {
    console.error(`[MVR] TCP error for ${station.name}: ${err.message}`);
  });

  sock.on('close', () => {
    console.log(`[MVR] Disconnected from ${station.name}`);
    tcpConnections.delete(station.uuid);
    broadcastToWS(JSON.stringify({
      type: 'mvr_leave',
      stationUUID: station.uuid,
    }));
  });
}

function handleMVRMessage(station, msg) {
  const type = (msg.Type || msg.type || '').toUpperCase();

  switch (type) {
    case 'MVR_COMMIT':
      console.log(`[MVR] Commit from ${station.name}: ${msg.FileName || msg.fileName}`);
      broadcastToWS(JSON.stringify({
        type: 'mvr_commit',
        stationName: station.name,
        stationUUID: station.uuid,
        fileUUID: msg.FileUUID || msg.fileUUID || '',
        fileName: msg.FileName || msg.fileName || 'scene.mvr',
        fileSize: msg.FileSize || msg.fileSize || 0,
        comment: msg.Comment || msg.comment || '',
      }));
      break;

    case 'MVR_JOIN':
      broadcastToWS(JSON.stringify({
        type: 'mvr_join',
        stationName: msg.StationName || msg.stationName || station.name,
        stationUUID: msg.StationUUID || msg.stationUUID || station.uuid,
        provider: msg.Provider || msg.provider || '',
        ip: station.ip,
      }));
      break;

    case 'MVR_LEAVE':
      broadcastToWS(JSON.stringify({
        type: 'mvr_leave',
        stationUUID: msg.StationUUID || msg.stationUUID || station.uuid,
      }));
      break;

    case 'MVR_NEW_SESSION_HOST':
      broadcastToWS(JSON.stringify({
        type: 'mvr_new_session_host',
        stationUUID: msg.StationUUID || msg.stationUUID || '',
      }));
      break;

    default:
      if (VERBOSE) console.log(`[MVR] Unknown type: ${type}`);
      // Forward raw
      broadcastToWS(JSON.stringify({ type: 'mvr_raw', data: msg }));
  }
}

// ─── WebSocket Server (RFC 6455 minimal) ────────────
const httpServer = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'running',
      stations: Array.from(discoveredStations.values()),
      tcpConnections: tcpConnections.size,
      wsClients: wsClients.size,
      stats,
      uptime: process.uptime(),
    }));
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('MVR-xchange Bridge — connect via WebSocket\n');
});

httpServer.on('upgrade', (req, socket, head) => {
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

  wsClients.add(socket);
  console.log(`[WS] Client connected (${wsClients.size} total)`);

  // Send current station list
  for (const station of discoveredStations.values()) {
    sendWSFrame(socket, JSON.stringify({ type: 'mdns_service', station }));
  }

  let wsBuf = Buffer.alloc(0);
  socket.on('data', (data) => {
    wsBuf = Buffer.concat([wsBuf, data]);
    while (wsBuf.length >= 2) {
      const parsed = parseWSFrame(wsBuf);
      if (!parsed) break;
      wsBuf = wsBuf.slice(parsed.totalLen);

      if (parsed.opcode === 0x08) { // close
        socket.end();
        return;
      }
      if (parsed.opcode === 0x09) { // ping
        sendWSFrame(socket, parsed.payload, 0x0A);
        continue;
      }
      if (parsed.opcode === 0x01) { // text
        try {
          const msg = JSON.parse(parsed.payload.toString('utf8'));
          handleWSMessage(socket, msg);
        } catch (e) {}
      }
    }
  });

  socket.on('close', () => {
    wsClients.delete(socket);
    console.log(`[WS] Client disconnected (${wsClients.size} total)`);
  });
  socket.on('error', () => { wsClients.delete(socket); });
});

function handleWSMessage(socket, msg) {
  stats.wsMessages++;
  switch (msg.type) {
    case 'discover':
      sendMDNSQuery();
      // Re-send known stations
      for (const station of discoveredStations.values()) {
        sendWSFrame(socket, JSON.stringify({ type: 'mdns_service', station }));
      }
      break;

    case 'connect_station':
      const station = discoveredStations.get(msg.uuid);
      if (station) connectToStation(station);
      break;

    case 'mvr_request':
    case 'mvr_join':
    case 'mvr_leave':
      // Forward to specific TCP connection
      if (msg.stationUUID && tcpConnections.has(msg.stationUUID)) {
        const sock = tcpConnections.get(msg.stationUUID);
        sock.write(JSON.stringify(msg) + '\n');
      }
      break;
  }
}

function parseWSFrame(buf) {
  if (buf.length < 2) return null;
  const b0 = buf[0], b1 = buf[1];
  const opcode = b0 & 0x0F;
  const masked = !!(b1 & 0x80);
  let payloadLen = b1 & 0x7F;
  let offset = 2;

  if (payloadLen === 126) {
    if (buf.length < 4) return null;
    payloadLen = buf.readUInt16BE(2);
    offset = 4;
  } else if (payloadLen === 127) {
    if (buf.length < 10) return null;
    payloadLen = Number(buf.readBigUInt64BE(2));
    offset = 10;
  }

  const maskLen = masked ? 4 : 0;
  const totalLen = offset + maskLen + payloadLen;
  if (buf.length < totalLen) return null;

  let payload = buf.slice(offset + maskLen, totalLen);
  if (masked) {
    const mask = buf.slice(offset, offset + 4);
    payload = Buffer.from(payload);
    for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i % 4];
  }

  return { opcode, payload, totalLen };
}

function sendWSFrame(socket, data, opcode = 0x01) {
  const payload = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
  let header;
  if (payload.length < 126) {
    header = Buffer.alloc(2);
    header[0] = 0x80 | opcode;
    header[1] = payload.length;
  } else if (payload.length < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 126;
    header.writeUInt16BE(payload.length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | opcode;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(payload.length), 2);
  }
  try { socket.write(Buffer.concat([header, payload])); } catch (e) {}
}

function broadcastToWS(data) {
  for (const socket of wsClients) {
    sendWSFrame(socket, data);
  }
}

// ─── Auto-connect discovered stations ───────────────
setInterval(() => {
  for (const station of discoveredStations.values()) {
    if (!tcpConnections.has(station.uuid)) {
      connectToStation(station);
    }
  }
  // Prune stale stations (> 60s)
  const now = Date.now();
  for (const [uuid, station] of discoveredStations) {
    if (now - station.lastSeen > 60000) {
      discoveredStations.delete(uuid);
      broadcastToWS(JSON.stringify({ type: 'mvr_leave', stationUUID: uuid }));
    }
  }
}, 15000);

// ─── Start ──────────────────────────────────────────
httpServer.listen(WS_PORT, BIND_ADDR, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║  MVR-xchange Bridge                                 ║');
  console.log('║  mDNS Discovery + TCP MVR ↔ WebSocket               ║');
  console.log('╠══════════════════════════════════════════════════════╣');
  console.log(`║  WebSocket : ws://${BIND_ADDR}:${WS_PORT}                    ║`);
  console.log(`║  mDNS      : ${MDNS_ADDR}:${MDNS_PORT} (${MVR_SERVICE})    ║`);
  console.log(`║  Health    : http://${BIND_ADDR}:${WS_PORT}/health            ║`);
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log('');
});

// ─── Stats ──────────────────────────────────────────
setInterval(() => {
  const elapsed = (Date.now() - lastStatsTime) / 1000;
  if (VERBOSE || stats.mvrMessages > 0) {
    console.log(`[STATS] mDNS:${stats.mdnsPackets} MVR:${stats.mvrMessages} WS:${stats.wsMessages} Stations:${discoveredStations.size} TCP:${tcpConnections.size} WS-Clients:${wsClients.size}`);
  }
}, 30000);
let lastStatsTime = Date.now();
