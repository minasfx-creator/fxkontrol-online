import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

/**
 * Timecode Bridge — WebSocket relay for external LTC/MTC timecode.
 * 
 * Protocol: JSON messages over WebSocket
 * 
 * Incoming (from TC generator):
 *   { type: "tc", hours: 1, minutes: 0, seconds: 30, frames: 15, fps: 30, dropFrame: false }
 *   { type: "tc_raw", timecode: "01:00:30:15", fps: 30 }
 *   { type: "transport", command: "play" | "stop" | "locate", position?: number }
 *   { type: "mtc", piece: 0, nibble: 5 }
 * 
 * Outgoing (to all connected clients):
 *   Relays all incoming messages to all other connected clients
 *   Adds server timestamp for jitter measurement
 * 
 * Also supports HTTP POST for non-WebSocket TC sources:
 *   POST /timecode-bridge { type: "tc", ... }
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

interface ConnectedClient {
  socket: WebSocket;
  role: "generator" | "receiver" | "both";
  id: string;
  connectedAt: number;
}

const clients = new Map<string, ConnectedClient>();

function broadcast(message: object, excludeId?: string) {
  const payload = JSON.stringify({
    ...message,
    serverTimestamp: Date.now(),
  });
  for (const [id, client] of clients) {
    if (id === excludeId) continue;
    if (client.socket.readyState === WebSocket.OPEN) {
      try {
        client.socket.send(payload);
      } catch {
        clients.delete(id);
      }
    }
  }
}

function parseTimecodeString(tc: string, fps: number): { hours: number; minutes: number; seconds: number; frames: number; dropFrame: boolean } | null {
  const df = tc.includes(";");
  const parts = tc.replace(/;/g, ":").split(":").map(Number);
  if (parts.length !== 4 || parts.some(isNaN)) return null;
  return { hours: parts[0], minutes: parts[1], seconds: parts[2], frames: parts[3], dropFrame: df };
}

function handleWebSocket(req: Request): Response {
  const { socket, response } = Deno.upgradeWebSocket(req);
  const clientId = crypto.randomUUID();

  socket.onopen = () => {
    clients.set(clientId, {
      socket,
      role: "both",
      id: clientId,
      connectedAt: Date.now(),
    });
    socket.send(JSON.stringify({
      type: "welcome",
      clientId,
      connectedClients: clients.size,
      serverTimestamp: Date.now(),
    }));
    console.log(`TC client connected: ${clientId} (total: ${clients.size})`);
  };

  socket.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);

      switch (msg.type) {
        case "tc": {
          // Full timecode frame
          broadcast({
            type: "tc",
            hours: msg.hours ?? 0,
            minutes: msg.minutes ?? 0,
            seconds: msg.seconds ?? 0,
            frames: msg.frames ?? 0,
            fps: msg.fps ?? 30,
            dropFrame: msg.dropFrame ?? false,
          }, clientId);
          break;
        }

        case "tc_raw": {
          // Parse timecode string
          const parsed = parseTimecodeString(msg.timecode, msg.fps ?? 30);
          if (parsed) {
            broadcast({
              type: "tc",
              ...parsed,
              fps: msg.fps ?? 30,
            }, clientId);
          }
          break;
        }

        case "transport": {
          // Play/Stop/Locate commands
          broadcast({
            type: "transport",
            command: msg.command,
            position: msg.position,
          }, clientId);
          break;
        }

        case "mtc": {
          // MIDI Timecode quarter-frame
          broadcast({
            type: "mtc",
            piece: msg.piece,
            nibble: msg.nibble,
          }, clientId);
          break;
        }

        case "set_role": {
          const client = clients.get(clientId);
          if (client) {
            client.role = msg.role ?? "both";
          }
          break;
        }

        case "ping": {
          socket.send(JSON.stringify({
            type: "pong",
            clientTimestamp: msg.timestamp,
            serverTimestamp: Date.now(),
          }));
          break;
        }

        default:
          // Forward unknown messages as-is
          broadcast(msg, clientId);
      }
    } catch (e) {
      console.error("TC bridge parse error:", e);
    }
  };

  socket.onclose = () => {
    clients.delete(clientId);
    console.log(`TC client disconnected: ${clientId} (remaining: ${clients.size})`);
  };

  socket.onerror = (e) => {
    console.error("TC WebSocket error:", e);
    clients.delete(clientId);
  };

  return response;
}

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);

  // WebSocket upgrade
  if (req.headers.get("upgrade")?.toLowerCase() === "websocket") {
    return handleWebSocket(req);
  }

  // HTTP POST — inject timecode from non-WS sources
  if (req.method === "POST") {
    try {
      const body = await req.json();
      broadcast(body);
      return new Response(
        JSON.stringify({ ok: true, clients: clients.size }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  // GET — status endpoint
  if (req.method === "GET") {
    return new Response(
      JSON.stringify({
        service: "Timecode Bridge",
        version: "1.0",
        protocol: "SMPTE 12M / MTC",
        connectedClients: clients.size,
        uptime: Date.now(),
        supportedMessages: ["tc", "tc_raw", "transport", "mtc", "ping", "set_role"],
        websocket: `wss://${url.host}${url.pathname}`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return new Response("Method not allowed", { status: 405, headers: corsHeaders });
});
