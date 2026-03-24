/**
 * FX KONTROL · SMPTE/LTC Timecode Server
 * WebSocket server for distributing show timecode to all clients.
 * by Minas FX
 */

import { WebSocketServer } from "ws";

const PORT = 9091;
const wss = new WebSocketServer({ port: PORT });
let showTime = 0;
let playing = false;
let fps = 30;

function formatSMPTE(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  const f = Math.floor((totalSeconds % 1) * fps);
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}:${String(f).padStart(2,'0')}`;
}

function broadcast(data) {
  const msg = JSON.stringify(data);
  for (const client of wss.clients) {
    if (client.readyState === 1) client.send(msg);
  }
}

// Timecode loop at frame rate
setInterval(() => {
  if (playing) {
    showTime += 1 / fps;
    broadcast({
      type: 'timecode',
      time: showTime,
      smpte: formatSMPTE(showTime),
      playing,
    });
  }
}, 1000 / fps);

wss.on('connection', (ws) => {
  console.log(`[Timecode] Client connected (${wss.clients.size} total)`);

  ws.on('message', (data) => {
    const cmd = JSON.parse(data);
    switch (cmd.type) {
      case 'play': playing = true; break;
      case 'pause': playing = false; break;
      case 'stop': playing = false; showTime = 0; break;
      case 'seek': showTime = cmd.time || 0; break;
      case 'setFps': fps = cmd.fps || 30; break;
    }
    broadcast({ type: 'status', playing, time: showTime, smpte: formatSMPTE(showTime) });
  });
});

console.log(`╔══════════════════════════════════════╗`);
console.log(`║  FX KONTROL · Timecode Server v2.0   ║`);
console.log(`║  by Minas FX — Port ${PORT}            ║`);
console.log(`╚══════════════════════════════════════╝`);
