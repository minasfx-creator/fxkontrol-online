import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * MAVLink Bridge Edge Function
 * 
 * Receives telemetry packets from the simulation frontend,
 * validates them, and returns processed/acknowledged data.
 * 
 * In a production setup this would relay to physical GCS via UDP/TCP.
 * For simulation, it acts as a virtual GCS that logs and validates packets.
 *
 * Endpoints:
 * POST /  — Process telemetry packet(s), return ACK + validation
 */
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, packets, command } = await req.json();

    // ── Telemetry ingestion ──
    if (action === "telemetry") {
      if (!Array.isArray(packets) || packets.length === 0) {
        return new Response(
          JSON.stringify({ error: "No packets provided" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Validate and process packets
      const results = packets.map((pkt: any) => {
        const warnings: string[] = [];
        
        // Validate battery
        if (pkt.sysStatus) {
          const battPct = pkt.sysStatus.batteryRemaining;
          if (battPct < 10) warnings.push(`CRITICAL: Battery at ${battPct}%`);
          else if (battPct < 20) warnings.push(`WARNING: Battery low at ${battPct}%`);
        }

        // Validate attitude (excessive tilt)
        if (pkt.attitude) {
          const rollDeg = Math.abs(pkt.attitude.roll * 180 / Math.PI);
          const pitchDeg = Math.abs(pkt.attitude.pitch * 180 / Math.PI);
          if (rollDeg > 45 || pitchDeg > 45) {
            warnings.push(`WARNING: Excessive tilt (R=${rollDeg.toFixed(1)}° P=${pitchDeg.toFixed(1)}°)`);
          }
        }

        // Validate GPS
        if (pkt.gps && pkt.gps.fixType < 3) {
          warnings.push("WARNING: No 3D GPS fix");
        }

        // Validate speed
        if (pkt.vfrHud && pkt.vfrHud.groundspeed > 20) {
          warnings.push(`WARNING: High speed ${pkt.vfrHud.groundspeed.toFixed(1)} m/s`);
        }

        return {
          systemId: pkt.systemId,
          ack: true,
          timestamp: Date.now(),
          warnings,
        };
      });

      return new Response(
        JSON.stringify({
          status: "ok",
          processed: results.length,
          results,
          serverTime: Date.now(),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Command relay ──
    if (action === "command") {
      const validCommands = ["ARM", "DISARM", "TAKEOFF", "LAND", "RTL", "GUIDED", "SET_MODE", "REBOOT"];
      if (!command || !validCommands.includes(command.type)) {
        return new Response(
          JSON.stringify({ error: `Invalid command. Valid: ${validCommands.join(", ")}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          status: "ok",
          command: command.type,
          targetSystem: command.targetSystem || 1,
          ack: "ACCEPTED",
          timestamp: Date.now(),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Status check ──
    if (action === "status") {
      return new Response(
        JSON.stringify({
          status: "ok",
          bridge: "virtual",
          protocol: "MAVLink 2.0",
          serverTime: Date.now(),
          capabilities: ["telemetry", "command", "status"],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Unknown action. Use: telemetry, command, status" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (e) {
    console.error("MAVLink bridge error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
