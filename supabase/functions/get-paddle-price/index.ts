/**
 * get-paddle-price — Resolve human-readable price ID (e.g. "pro_monthly")
 * to Paddle internal ID for the requested environment.
 */
import { gatewayFetch, type PaddleEnv } from "../_shared/paddle.ts";
import { handleCors, buildCorsHeaders } from "../_shared/cors.ts";

async function resolvePaddlePrice(priceId: string, environment: PaddleEnv): Promise<string> {
  const response = await gatewayFetch(environment, `/prices?external_id=${encodeURIComponent(priceId)}`);
  const data = await response.json();
  if (!response.ok) throw new Error(`Paddle API error ${response.status}: ${JSON.stringify(data)}`);
  if (!data.data?.length) throw new Error(`Price not found: ${priceId}`);
  return data.data[0].id as string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  const pre = handleCors(req);
  if (pre) return pre;
  try {
    const { priceId, environment } = await req.json();
    if (!priceId || !environment) {
      return new Response(JSON.stringify({ error: "priceId and environment are required" }), {
        status: 400,
        headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" },
      });
    }
    if (environment !== "sandbox" && environment !== "live") {
      return new Response(JSON.stringify({ error: "environment must be 'sandbox' or 'live'" }), {
      status: 400,
      headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" },
    });
    }
    const paddleId = await resolvePaddlePrice(priceId, environment as PaddleEnv);
    return new Response(JSON.stringify({ paddleId }), {
      headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("get-paddle-price error");
    const msg = e instanceof Error ? e.message : "unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
